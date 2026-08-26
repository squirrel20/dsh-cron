/**
 * dsh-cron — unattended scheduled jobs for the DeepSeek Harness.
 *
 * A HOST-plane plugin: jobs are declared in plugin config (versioned with the
 * profile), durable dispatch state and run history live in the storage
 * domain layer, and a due occurrence executes with no session attached — an
 * `agent` task runs a fresh one-shot agent (the dsh-headless recipe), a
 * `command` task spawns a process. This is deliberately NOT dsh-schedule:
 * that package delivers reminders into a live interactive session; this one
 * runs pipelines while nobody is watching.
 *
 * Reliability contract: at-most-once per occurrence (dispatch state reaches
 * durability before execution starts), no replay of missed occurrences
 * (misfire policy fires at most one catch-up run at the latest due target),
 * and runs interrupted by a host restart are repaired to `aborted` on boot.
 * @module dsh-cron
 */
import z from "@deepseek-ai/schemastery";
import { CronInputError, compileSchedule, latestDueOccurrence, nextOccurrence } from "./cron.js";
import { cronDomain, runKey } from "./domain.js";
import { deliver, runAgentTask, runCommandTask } from "./executor.js";

/** Cordis function-plugin name. */
export const name = "cron";

/** Host services required before the scheduler can start. */
export const inject = [
	"storage",
	"storageDomain",
	"agents",
	"agentDefaultModel",
	"sessions",
];

/**
 * Plugin config. Job entries are validated by {@link normalizeJobs} (closed
 * vocabulary, loud diagnostics) rather than schema defaults, so a
 * misconfigured job names itself in the error.
 */
export const Config = z.object({
	jobs: z.array(z.any()).default([]),
	historyLimit: z.number().default(50),
	maxConcurrentRuns: z.number().default(1),
});

const JOB_NAME_RE = /^[a-z][a-z0-9-]*$/;
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
	const selector = compileSchedule(raw.schedule ?? {}, jobName);
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
		enabled: raw.enabled ?? true,
		selector,
		task: {
			kind,
			prompt,
			argv,
			cwd: typeof task.cwd === "string" ? task.cwd : "",
			model: typeof task.model === "string" ? task.model : "",
			timeoutSeconds,
		},
		policy: { overlap, misfire },
		delivery: {
			argv: deliveryArgv,
			onlyOnFailure: delivery.onlyOnFailure ?? true,
		},
	};
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
class CronService {
	/** @param jobs - output of {@link normalizeJobs}. */
	constructor(ctx, config, jobs) {
		this.ctx = ctx;
		this.jobs = jobs;
		this.historyLimit = Math.max(1, config.historyLimit);
		this.gate = new Gate(Math.max(1, config.maxConcurrentRuns));
		this.running = new Map();
		this.pending = new Map();
		this.floor = new Map();
		this.stopped = false;
		this.wakeFn = null;
		this.timer = null;
		this.domain = null;
	}

	async start() {
		this.domain = await this.ctx.storage.domain.open(cronDomain);
		const runs = this.domain.table("runs");
		for (const [key, record] of runs.entries()) {
			if (record.status !== "running") continue;
			await runs.update(key, (r) => ({
				...r,
				status: "aborted",
				finishedAt: new Date().toISOString(),
				error: "host process restarted mid-run",
			}));
		}
		const jobsTable = this.domain.table("jobs");
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
		this.ctx.logger.info(`cron: scheduling ${this.jobs.filter((j) => j.enabled).length} job(s)`);
	}

	async loop() {
		const jobsTable = this.domain.table("jobs");
		while (!this.stopped) {
			const now = Date.now();
			let nearest = null;
			let dispatched = false;
			for (const job of this.jobs) {
				if (!job.enabled) continue;
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

	/** Execute one claimed occurrence and settle its run record. */
	launch(job, targetMs, seq) {
		const targetIso = new Date(targetMs).toISOString();
		const key = runKey(job.name, seq);
		const control = createControl();
		const entry = { control, promise: null };
		this.running.set(job.name, entry);
		entry.promise = (async () => {
			const runs = this.domain.table("runs");
			await runs.put(key, {
				job: job.name,
				seq,
				target: targetIso,
				startedAt: new Date().toISOString(),
				status: "running",
				summary: "",
			});
			let result;
			try {
				await this.gate.acquire();
				try {
					result = job.task.kind === "agent"
						? await runAgentTask(this.ctx, job, targetIso, control)
						: await runCommandTask(job, control);
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
			if (result.sessionId !== undefined) record.sessionId = result.sessionId;
			if (result.exitCode !== undefined) record.exitCode = result.exitCode;
			if (result.error !== undefined) record.error = result.error;
			await runs.put(key, record);
			await this.prune(job.name);
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

/** Mount the scheduler; config defects fail the mount loudly. */
export function apply(ctx, config) {
	const jobs = normalizeJobs(config.jobs);
	ctx.effect(() => {
		const service = new CronService(ctx, config, jobs);
		const ready = service.start().catch((error) => {
			ctx.logger.error(`cron: startup failed: ${String(error)}`);
		});
		return async () => {
			await ready;
			await service.dispose();
		};
	}, "cron.lifecycle()");
}
