/**
 * dsh-cron — the scheduling core.
 *
 * Everything host-independent lives here: job normalization, the drive loop
 * over durable dispatch state, overlap/misfire policy, the run-history
 * ledger, the conversational service methods (list/runs/runNow/setEnabled),
 * and session-file GC wiring. This module imports nothing outside node
 * builtins and the plugin's own pure modules — ./domain.js (zod) and
 * ./agent-task.js (dsh host packages) load lazily at the two points that
 * need them — so the whole service is unit-testable without a mounted
 * harness. Plugin assembly (config schema, cordis mount, tool registration)
 * lives in ./index.js.
 * @module dsh-cron/service
 */
import { randomUUID } from "node:crypto";
import { CronInputError, compileSchedule, latestDueOccurrence, nextOccurrence } from "./cron.js";
import { deliver, runCommandTask } from "./executor.js";
import { sweepCronSessions } from "./gc.js";

/** Fixed-width run key so lexicographic order equals run order per job. */
export function runKey(jobName, seq) {
	return `${jobName}#${String(seq).padStart(10, "0")}`;
}

/** Mint one cron session id (plain string; branded at agent creation). The gc module's dir matcher mirrors this shape. */
export function newCronSessionId(jobName) {
	return `cron-${jobName}-${randomUUID()}`;
}

const JOB_NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u;
const OVERLAPS = new Set(["skip", "queue", "replace"]);
const MISFIRES = new Set(["skip", "runOnce"]);
/** Longest single timer slice; the loop rereads the wall clock after every wake. */
const MAX_SLICE_MS = 6 * 3600 * 1000;

/** Validate and normalize one raw job entry; throws CronInputError on any defect. */
function normalizeJob(raw) {
	if (typeof raw !== "object" || raw === null) throw new CronInputError("job entry must be an object");
	const jobName = raw.name;
	if (typeof jobName !== "string" || !JOB_NAME_RE.test(jobName)) {
		throw new CronInputError(`job name '${String(jobName)}' must match ${JOB_NAME_RE}`);
	}
	if (raw.description !== undefined && typeof raw.description !== "string") {
		throw new CronInputError(`job '${jobName}': description must be a string`);
	}
	const description = typeof raw.description === "string" ? raw.description.trim() : "";
	const schedule = raw.schedule ?? {};
	const selector = compileSchedule(schedule, jobName);
	// Human-readable schedule for cron_list; the compiled selector drops the raw text.
	const scheduleText = selector.kind === "cron"
		? `cron '${schedule.cron}' @ ${schedule.timeZone}`
		: selector.kind === "every"
			? `every ${schedule.everySeconds}s`
			: `at ${schedule.at}`;
	const task = raw.task ?? {};
	const kind = task.kind ?? "agent";
	if (kind !== "agent" && kind !== "command") {
		throw new CronInputError(`job '${jobName}': task.kind must be 'agent' or 'command'`);
	}
	const prompt = typeof task.prompt === "string" ? task.prompt : "";
	const argv = Array.isArray(task.argv) && task.argv.every((a) => typeof a === "string") ? task.argv : [];
	if (kind === "agent" && prompt.trim() === "") {
		throw new CronInputError(`job '${jobName}': agent tasks require a non-empty prompt`);
	}
	if (kind === "command" && argv.length === 0) {
		throw new CronInputError(`job '${jobName}': command tasks require a non-empty argv`);
	}
	const timeoutSeconds = task.timeoutSeconds ?? 1800;
	if (!Number.isSafeInteger(timeoutSeconds) || timeoutSeconds < 1) {
		throw new CronInputError(`job '${jobName}': timeoutSeconds must be a positive integer`);
	}
	const policy = raw.policy ?? {};
	const overlap = policy.overlap ?? "skip";
	const misfire = policy.misfire ?? "skip";
	if (!OVERLAPS.has(overlap)) throw new CronInputError(`job '${jobName}': policy.overlap must be skip|queue|replace`);
	if (!MISFIRES.has(misfire)) throw new CronInputError(`job '${jobName}': policy.misfire must be skip|runOnce`);
	const delivery = raw.delivery ?? {};
	const deliveryArgv = Array.isArray(delivery.argv) && delivery.argv.every((a) => typeof a === "string")
		? delivery.argv
		: [];
	return {
		name: jobName,
		description,
		enabled: raw.enabled ?? true,
		selector,
		scheduleText,
		task: {
			kind,
			prompt,
			argv,
			cwd: typeof task.cwd === "string" ? task.cwd : "",
			provider: typeof task.provider === "string" ? task.provider : "",
			model: typeof task.model === "string" ? task.model : "",
			effort: typeof task.effort === "string" ? task.effort : "",
			preset: typeof task.preset === "string" ? task.preset : "",
			access: typeof task.access === "string" ? task.access : "",
			timeoutSeconds,
		},
		policy: { overlap, misfire },
		delivery: {
			argv: deliveryArgv,
			onlyOnFailure: delivery.onlyOnFailure ?? true,
		},
	};
}

/** Drop undefined-valued keys so a conversationally built block persists clean. */
function compactSpecObject(value) {
	if (typeof value !== "object" || value === null) return undefined;
	const out = {};
	for (const [key, entry] of Object.entries(value)) {
		if (entry !== undefined) out[key] = entry;
	}
	return out;
}

/**
 * Assemble one raw config-shaped job spec from cron_create tool arguments.
 * Only blocks the caller actually provided appear in the spec — the manual
 * table persists it verbatim, so an omitted policy/delivery/enabled must stay
 * omitted rather than freeze today's defaults. Validation stays with
 * {@link normalizeJobs}; this is pure shaping.
 */
export function buildJobSpec(args) {
	const spec = { name: args.name };
	if (args.description !== undefined) spec.description = args.description;
	const schedule = compactSpecObject(args.schedule);
	if (schedule !== undefined) spec.schedule = schedule;
	const task = compactSpecObject(args.task);
	if (task !== undefined) spec.task = task;
	const policy = compactSpecObject(args.policy);
	if (policy !== undefined) spec.policy = policy;
	const delivery = compactSpecObject(args.delivery);
	if (delivery !== undefined) spec.delivery = delivery;
	if (args.enabled !== undefined) spec.enabled = args.enabled;
	return spec;
}

/** Validate the whole job list; duplicate names are a config bug. */
export function normalizeJobs(rawJobs) {
	const jobs = rawJobs.map(normalizeJob);
	const seen = new Set();
	for (const job of jobs) {
		if (seen.has(job.name)) throw new CronInputError(`duplicate job name '${job.name}'`);
		seen.add(job.name);
	}
	return jobs;
}

/**
 * Cancellation seam between the service and one in-flight run. `cancel`
 * records the terminal status the run must settle with ('replaced' or
 * 'aborted') and invokes whatever teardown the executor registered.
 */
export function createControl() {
	let resolveCancelled;
	const whenCancelled = new Promise((resolve) => {
		resolveCancelled = resolve;
	});
	return {
		cancelled: null,
		teardown: null,
		whenCancelled,
		register(fn) {
			this.teardown = fn;
			if (this.cancelled !== null) fn();
		},
		cancel(status) {
			if (this.cancelled !== null) return;
			this.cancelled = status;
			resolveCancelled(status);
			this.teardown?.();
		},
	};
}

/** Counting semaphore bounding concurrent run execution host-wide. */
class Gate {
	constructor(slots) {
		this.free = slots;
		this.waiters = [];
	}
	async acquire() {
		if (this.free > 0) {
			this.free -= 1;
			return;
		}
		await new Promise((resolve) => this.waiters.push(resolve));
	}
	release() {
		const next = this.waiters.shift();
		if (next !== undefined) next();
		else this.free += 1;
	}
}

/** The scheduler: one drive loop over durable job state, per-job run tracking. */
export class CronService {
	/**
	 * @param jobs - output of {@link normalizeJobs}.
	 * @param gcConfig - output of {@link normalizeGcConfig}.
	 */
	constructor(ctx, config, jobs, gcConfig) {
		this.ctx = ctx;
		this.jobs = jobs;
		this.historyLimit = Math.max(1, config.historyLimit);
		this.gate = new Gate(Math.max(1, config.maxConcurrentRuns));
		this.gcConfig = gcConfig;
		this.gcBusy = false;
		this.running = new Map();
		this.pending = new Map();
		this.floor = new Map();
		this.stopped = false;
		this.wakeFn = null;
		this.timer = null;
		this.domain = null;
	}

	/** Effective enabled state: the durable conversational override wins over config. */
	effectiveEnabled(job) {
		const state = this.domain.table("jobs").get(job.name);
		return state?.enabledOverride ?? job.enabled;
	}

	async start() {
		// Lazy: ./domain.js needs zod; the scheduling core itself stays
		// import-clean so it can be unit-tested without installed deps.
		const { cronDomain } = await import("./domain.js");
		this.domain = await this.ctx.storage.domain.open(cronDomain);
		// Overlay-created jobs: re-normalize each persisted spec and merge it in
		// BEFORE the known-set cleanup below, or their ledger records would be
		// dropped as removed-from-config. Config owns a colliding name; a spec
		// that no longer normalizes is kept on disk but not scheduled, loudly.
		const manualTable = this.domain.table("manual");
		for (const [name, record] of manualTable.entries()) {
			if (this.jobs.some((job) => job.name === name)) {
				this.ctx.logger.warn(`cron: manual job '${name}' shadowed by a config job; dropping the manual copy`);
				await manualTable.delete(name);
				continue;
			}
			try {
				const job = normalizeJobs([record.spec])[0];
				job.source = "manual";
				this.jobs.push(job);
			} catch (error) {
				this.ctx.logger.error(`cron: manual job '${name}' no longer normalizes, not scheduling it: ${String(error)}`);
			}
		}
		const runs = this.domain.table("runs");
		const known = new Set(this.jobs.map((job) => job.name));
		for (const [key, record] of runs.entries()) {
			// The ledger tracks declared jobs: records of jobs removed from
			// config are dropped here, which also releases their session
			// files to the GC below.
			if (!known.has(record.job)) {
				await runs.delete(key);
				continue;
			}
			if (record.status !== "running") continue;
			await runs.update(key, (r) => ({
				...r,
				status: "aborted",
				finishedAt: new Date().toISOString(),
				error: "host process restarted mid-run",
			}));
		}
		const jobsTable = this.domain.table("jobs");
		for (const key of [...jobsTable.keys()]) {
			if (!known.has(key)) await jobsTable.delete(key);
		}
		const now = Date.now();
		for (const job of this.jobs) {
			let state = jobsTable.get(job.name);
			if (state === undefined) {
				state = { anchorMs: now, lastFiredMs: 0, runSeq: 0 };
				await jobsTable.put(job.name, state);
			}
			// The catch-up floor: 'skip' forgets everything before this boot;
			// 'runOnce' reaches back to the last dispatched occurrence — but a
			// job that never fired has missed nothing.
			const floor = job.policy.misfire === "runOnce" && state.lastFiredMs > 0 ? state.lastFiredMs : now;
			this.floor.set(job.name, floor);
		}
		this.loop().catch((error) => {
			this.ctx.logger.error(`cron: drive loop crashed: ${String(error)}`);
		});
		this.scheduleGc();
		this.ctx.logger.info(`cron: scheduling ${this.jobs.filter((j) => this.effectiveEnabled(j)).length} job(s)`);
	}

	async loop() {
		const jobsTable = this.domain.table("jobs");
		while (!this.stopped) {
			const now = Date.now();
			let nearest = null;
			let dispatched = false;
			for (const job of this.jobs) {
				if (!this.effectiveEnabled(job)) continue;
				const state = jobsTable.get(job.name);
				const after = Math.max(state.lastFiredMs, this.floor.get(job.name));
				const due = latestDueOccurrence(job.selector, after, now, state.anchorMs);
				if (due !== null) {
					await this.dispatch(job, due);
					dispatched = true;
					continue;
				}
				const next = nextOccurrence(job.selector, Math.max(after, now), state.anchorMs);
				if (next !== null && (nearest === null || next < nearest)) nearest = next;
			}
			if (dispatched) continue;
			const delay = nearest === null
				? MAX_SLICE_MS
				: Math.min(Math.max(nearest - Date.now(), 0) + 5, MAX_SLICE_MS);
			await this.sleep(delay);
		}
	}

	/** Durably claim one occurrence, then route it through the overlap policy. */
	async dispatch(job, targetMs) {
		const jobsTable = this.domain.table("jobs");
		const state = await jobsTable.update(job.name, (s) => ({
			...s,
			lastFiredMs: targetMs,
			runSeq: s.runSeq + 1,
		}));
		const seq = state.runSeq;
		const current = this.running.get(job.name);
		if (current !== undefined) {
			if (job.policy.overlap === "skip") {
				await this.recordSkipped(job, targetMs, seq);
				return;
			}
			// queue and replace both park the newest occurrence; replace also
			// tears down the run in flight. Only the latest parked target
			// survives — occurrences are never queued deeper than one.
			this.pending.set(job.name, { targetMs, seq });
			if (job.policy.overlap === "replace") current.control.cancel("replaced");
			return;
		}
		this.launch(job, targetMs, seq);
	}

	async recordSkipped(job, targetMs, seq) {
		const nowIso = new Date().toISOString();
		await this.domain.table("runs").put(runKey(job.name, seq), {
			job: job.name,
			seq,
			target: new Date(targetMs).toISOString(),
			startedAt: nowIso,
			finishedAt: nowIso,
			status: "skipped-overlap",
			summary: "",
		});
		await this.prune(job.name);
	}

	/**
	 * Execute one claimed occurrence and settle its run record. An agent
	 * task's session id is minted HERE and reaches durability in the initial
	 * `running` record, before the agent exists — the invariant session-file
	 * GC relies on to never collect a live run's session.
	 * @returns a promise settling when the initial `running` record is
	 * readable — runNow awaits it so the record is already visible to the
	 * overlay's post-action refresh when the call answers.
	 */
	launch(job, targetMs, seq, manual = false) {
		const targetIso = new Date(targetMs).toISOString();
		const key = runKey(job.name, seq);
		const control = createControl();
		// liveOutput: in-memory tail of a command run's output, fed to the
		// overlay's streaming view; never persisted before settlement.
		const entry = { control, promise: null, seq, liveOutput: "" };
		this.running.set(job.name, entry);
		const sessionId = job.task.kind === "agent" ? newCronSessionId(job.name) : undefined;
		const runs = this.domain.table("runs");
		const opened = runs.put(key, {
			job: job.name,
			seq,
			target: targetIso,
			startedAt: new Date().toISOString(),
			status: "running",
			summary: "",
			...(sessionId === undefined ? {} : { sessionId }),
			...(manual ? { manual: true } : {}),
		});
		entry.promise = (async () => {
			await opened;
			let result;
			try {
				await this.gate.acquire();
				try {
					if (job.task.kind === "agent") {
						// Lazy: ./agent-task.js imports dsh host packages.
						const { runAgentTask } = await import("./agent-task.js");
						result = await runAgentTask(this.ctx, job, targetIso, control, sessionId, seq);
					} else {
						result = await runCommandTask(job, control, (text) => {
							entry.liveOutput = text;
						});
					}
				} finally {
					this.gate.release();
				}
			} catch (error) {
				result = { status: "failed", summary: "", error: String(error) };
			}
			if (control.cancelled !== null) result = { ...result, status: control.cancelled };
			const record = {
				job: job.name,
				seq,
				target: targetIso,
				startedAt: runs.get(key)?.startedAt ?? targetIso,
				finishedAt: new Date().toISOString(),
				status: result.status,
				summary: result.summary ?? "",
			};
			if (manual) record.manual = true;
			if (result.sessionId !== undefined) record.sessionId = result.sessionId;
			if (result.exitCode !== undefined) record.exitCode = result.exitCode;
			if (result.error !== undefined) record.error = result.error;
			await runs.put(key, record);
			await this.prune(job.name);
			this.scheduleGc();
			if (
				job.delivery.argv.length > 0
				&& (!job.delivery.onlyOnFailure || (record.status !== "ok" && record.status !== "replaced"))
			) {
				const outcome = await deliver(job, record);
				if (!outcome.ok) this.ctx.logger.warn(`cron: delivery for '${job.name}' failed: ${outcome.error}`);
			}
		})()
			.catch((error) => {
				this.ctx.logger.warn(`cron: run '${key}' bookkeeping failed: ${String(error)}`);
			})
			.finally(() => {
				if (this.running.get(job.name) === entry) this.running.delete(job.name);
				const queued = this.pending.get(job.name);
				if (queued !== undefined && !this.stopped) {
					this.pending.delete(job.name);
					this.launch(job, queued.targetMs, queued.seq);
				}
				this.wake();
			});
		return opened;
	}

	/** Trim one job's run history to the configured bound, oldest first. */
	async prune(jobName) {
		const runs = this.domain.table("runs");
		const prefix = `${jobName}#`;
		const keys = [...runs.keys()].filter((k) => k.startsWith(prefix)).sort();
		for (const key of keys.slice(0, Math.max(0, keys.length - this.historyLimit))) {
			await runs.delete(key);
		}
	}

	/** One job view for cron_list; shapes match tools.js JOB_VIEW_SCHEMA. */
	jobView(job, now = Date.now()) {
		const state = this.domain.table("jobs").get(job.name);
		const runs = this.domain.table("runs");
		const enabled = state?.enabledOverride ?? job.enabled;
		const view = {
			name: job.name,
			...(job.description === "" ? {} : { description: job.description }),
			kind: job.task.kind,
			schedule: job.scheduleText,
			enabled,
			enabledSource: state?.enabledOverride !== undefined ? "override" : "config",
			source: job.source ?? "config",
			running: this.running.has(job.name),
		};
		if (enabled && state !== undefined) {
			const after = Math.max(state.lastFiredMs, this.floor.get(job.name) ?? now, now);
			const next = nextOccurrence(job.selector, after, state.anchorMs);
			if (next !== null) view.next = new Date(next).toISOString();
		}
		const prefix = `${job.name}#`;
		const keys = [...runs.keys()].filter((k) => k.startsWith(prefix)).sort();
		const last = keys.length > 0 ? runs.get(keys[keys.length - 1]) : undefined;
		if (last !== undefined) {
			view.lastRun = {
				seq: last.seq,
				status: last.status,
				target: last.target,
				...(last.finishedAt === undefined ? {} : { finishedAt: last.finishedAt }),
			};
		}
		return view;
	}

	/** cron_list: every declared job, config order. */
	listView() {
		const now = Date.now();
		return this.jobs.map((job) => this.jobView(job, now));
	}

	/** cron_runs: recent run records, newest first, optionally one job. */
	runsView(jobName, limit) {
		if (jobName !== undefined && !this.jobs.some((job) => job.name === jobName)) {
			return { code: "job_not_found", message: `no cron job named '${jobName}'` };
		}
		const runs = this.domain.table("runs");
		let keys = [...runs.keys()];
		if (jobName !== undefined) keys = keys.filter((k) => k.startsWith(`${jobName}#`));
		const records = keys.map((key) => runs.get(key)).filter((r) => r !== undefined);
		// ISO instants sort lexicographically; seq breaks same-instant ties.
		records.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : b.seq - a.seq));
		return records.slice(0, limit).map((record) => {
			const copy = { ...record };
			// A running command run's record has no stored output yet; splice
			// in the in-memory live tail so readers (overlay, cron_runs) see
			// the output as it streams. Settlement then writes the real one.
			if (copy.status === "running") {
				const entry = this.running.get(copy.job);
				if (entry !== undefined && entry.seq === copy.seq && entry.liveOutput !== "") {
					copy.summary = entry.liveOutput;
				}
			}
			return copy;
		});
	}

	/**
	 * cron_run_now: launch one manual run immediately. Claims a fresh seq but
	 * never touches lastFiredMs — a manual run consumes no scheduled
	 * occurrence. Refuses while a run is in flight (no overlap policy applies
	 * to explicit user intent); works on disabled jobs by design.
	 */
	async runNow(jobName) {
		const job = this.jobs.find((j) => j.name === jobName);
		if (job === undefined) {
			return { code: "job_not_found", message: `no cron job named '${jobName}'` };
		}
		if (this.running.has(jobName)) {
			return {
				code: "already_running",
				message: `job '${jobName}' has a run in flight; wait for it to settle (see cron_runs)`,
			};
		}
		const state = await this.domain.table("jobs").update(jobName, (s) => ({
			...s,
			runSeq: s.runSeq + 1,
		}));
		const targetMs = Date.now();
		await this.launch(job, targetMs, state.runSeq, true);
		return {
			job: jobName,
			seq: state.runSeq,
			target: new Date(targetMs).toISOString(),
			started: true,
		};
	}

	/**
	 * cron_enable / cron_disable: persist the conversational override. On a
	 * disabled→enabled transition, a misfire:skip job forgets occurrences
	 * missed while disabled (floor rises to now); a misfire:runOnce job keeps
	 * its floor and the drive loop catches up the single latest one.
	 */
	async setEnabled(jobName, enabled) {
		const job = this.jobs.find((j) => j.name === jobName);
		if (job === undefined) {
			return { code: "job_not_found", message: `no cron job named '${jobName}'` };
		}
		const jobsTable = this.domain.table("jobs");
		const previous = jobsTable.get(jobName)?.enabledOverride ?? job.enabled;
		await jobsTable.update(jobName, (s) => ({ ...s, enabledOverride: enabled }));
		if (enabled && !previous && job.policy.misfire === "skip") {
			this.floor.set(jobName, Math.max(this.floor.get(jobName) ?? 0, Date.now()));
		}
		this.wake();
		return { job: jobName, enabled, changed: previous !== enabled };
	}

	/**
	 * Web overlay: create one manual job at runtime. The raw config-shaped
	 * spec is validated by the same normalizeJobs vocabulary as config jobs,
	 * persisted verbatim in the manual table, and scheduled from now — its
	 * floor starts at creation, so it never back-fills occurrences that
	 * predate its own existence.
	 */
	async addJob(rawSpec) {
		let job;
		try {
			job = normalizeJobs([rawSpec])[0];
		} catch (error) {
			if (error instanceof CronInputError) {
				return { code: "invalid_job", message: error.message };
			}
			throw error;
		}
		if (this.jobs.some((existing) => existing.name === job.name)) {
			return { code: "job_exists", message: `a cron job named '${job.name}' already exists` };
		}
		job.source = "manual";
		await this.domain.table("manual").put(job.name, {
			spec: rawSpec,
			createdAt: new Date().toISOString(),
		});
		const jobsTable = this.domain.table("jobs");
		if (jobsTable.get(job.name) === undefined) {
			await jobsTable.put(job.name, { anchorMs: Date.now(), lastFiredMs: 0, runSeq: 0 });
		}
		this.jobs.push(job);
		this.floor.set(job.name, Date.now());
		this.wake();
		return { job: this.jobView(job) };
	}

	/**
	 * Web overlay: replace one manual job's spec in place. Renames are
	 * refused (delete + recreate instead), so the run ledger and dispatch
	 * state keep their identity; a run in flight is refused too, and config
	 * jobs stay read-only here. The floor moves to now: an edited schedule
	 * never back-fills occurrences that predate the edit itself.
	 */
	async updateJob(jobName, rawSpec) {
		const existing = this.jobs.find((j) => j.name === jobName);
		if (existing === undefined) {
			return { code: "job_not_found", message: `no cron job named '${jobName}'` };
		}
		if ((existing.source ?? "config") !== "manual") {
			return { code: "config_job", message: `job '${jobName}' is declared in profile config; edit it there` };
		}
		if (this.running.has(jobName)) {
			return { code: "already_running", message: `job '${jobName}' has a run in flight; stop it first` };
		}
		let job;
		try {
			job = normalizeJobs([rawSpec])[0];
		} catch (error) {
			if (error instanceof CronInputError) {
				return { code: "invalid_job", message: error.message };
			}
			throw error;
		}
		if (job.name !== jobName) {
			return { code: "invalid_job", message: `spec renames the job to '${job.name}'; delete and recreate instead` };
		}
		job.source = "manual";
		const manual = this.domain.table("manual");
		const kept = manual.get(jobName);
		await manual.put(jobName, {
			spec: rawSpec,
			createdAt: kept?.createdAt ?? new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
		this.jobs = this.jobs.map((j) => (j.name === jobName ? job : j));
		this.pending.delete(jobName);
		this.floor.set(jobName, Math.max(this.floor.get(jobName) ?? 0, Date.now()));
		this.wake();
		return { job: this.jobView(job) };
	}

	/** Web overlay: raw manual specs by job name, backing the edit form's backfill. */
	manualSpecs() {
		const manual = this.domain.table("manual");
		const specs = {};
		for (const job of this.jobs) {
			if ((job.source ?? "config") !== "manual") continue;
			const row = manual.get(job.name);
			if (row !== undefined) specs[job.name] = row.spec;
		}
		return specs;
	}

	/**
	 * Web overlay: stop the run in flight for one job. Reuses the run's
	 * cancellation seam; the settled record reads `killed`. Later scheduled
	 * occurrences are untouched — this stops a run, not the job.
	 */
	stopRun(jobName) {
		const job = this.jobs.find((j) => j.name === jobName);
		if (job === undefined) {
			return { code: "job_not_found", message: `no cron job named '${jobName}'` };
		}
		const entry = this.running.get(jobName);
		if (entry === undefined) {
			return { code: "not_running", message: `job '${jobName}' has no run in flight` };
		}
		entry.control.cancel("killed");
		return { job: jobName, stopping: true };
	}

	/**
	 * Web overlay: delete one manual job and its whole ledger. Config jobs
	 * are refused — they are declared in the profile and would resurrect on
	 * the next boot; a run in flight is refused too (stop it first), so the
	 * ledger never loses a record that is still being written. Dropping the
	 * run records releases the job's session files to the GC, mirroring the
	 * removed-from-config path in start().
	 */
	async deleteJob(jobName) {
		const job = this.jobs.find((j) => j.name === jobName);
		if (job === undefined) {
			return { code: "job_not_found", message: `no cron job named '${jobName}'` };
		}
		if ((job.source ?? "config") !== "manual") {
			return { code: "config_job", message: `job '${jobName}' is declared in profile config; remove it there` };
		}
		if (this.running.has(jobName)) {
			return { code: "already_running", message: `job '${jobName}' has a run in flight; stop it first` };
		}
		this.pending.delete(jobName);
		this.jobs = this.jobs.filter((j) => j.name !== jobName);
		this.floor.delete(jobName);
		await this.domain.table("manual").delete(jobName);
		await this.domain.table("jobs").delete(jobName);
		const runs = this.domain.table("runs");
		for (const key of [...runs.keys()].filter((k) => k.startsWith(`${jobName}#`))) {
			await runs.delete(key);
		}
		this.wake();
		this.scheduleGc();
		return { job: jobName, deleted: true };
	}

	/** Kick one background GC sweep; concurrent requests coalesce into the running one. */
	scheduleGc() {
		if (!this.gcConfig.enabled || this.gcBusy || this.stopped) return;
		this.gcBusy = true;
		this.runGc()
			.catch((error) => {
				this.ctx.logger.warn(`cron: session gc failed: ${String(error)}`);
			})
			.finally(() => {
				this.gcBusy = false;
			});
	}

	/** Sweep cron session dirs unreferenced by the run-history ledger. */
	async runGc() {
		const referenced = new Set();
		for (const [, record] of this.domain.table("runs").entries()) {
			if (record.sessionId !== undefined) referenced.add(record.sessionId);
		}
		const outcome = await sweepCronSessions(this.gcConfig.root, referenced, this.gcConfig.graceMs);
		if (outcome.removed.length > 0) {
			this.ctx.logger.info(`cron: gc removed ${outcome.removed.length} orphaned session dir(s)`);
		}
	}

	sleep(ms) {
		return new Promise((resolve) => {
			this.wakeFn = resolve;
			this.timer = setTimeout(resolve, ms);
		}).finally(() => {
			clearTimeout(this.timer);
			this.wakeFn = null;
		});
	}

	wake() {
		this.wakeFn?.();
	}

	/** Stop accepting due work, force in-flight runs to settle, close the domain. */
	async dispose() {
		this.stopped = true;
		this.wake();
		this.pending.clear();
		for (const entry of this.running.values()) entry.control.cancel("aborted");
		await Promise.allSettled([...this.running.values()].map((entry) => entry.promise));
		await this.domain?.close();
	}
}

