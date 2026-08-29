import assert from "node:assert/strict";
import { test } from "node:test";
import { CronService, normalizeJobs } from "../lib/service.js";

/** In-memory stand-in for one storage-domain table. */
function stubTable() {
	const map = new Map();
	return {
		get: (key) => map.get(key),
		put: async (key, value) => {
			map.set(key, value);
			return value;
		},
		update: async (key, fn) => {
			const next = fn(map.get(key));
			map.set(key, next);
			return next;
		},
		delete: async (key) => {
			map.delete(key);
		},
		keys: () => map.keys(),
		entries: () => map.entries(),
	};
}

function stubDomain() {
	const tables = { runs: stubTable(), jobs: stubTable(), manual: stubTable() };
	return { table: (name) => tables[name], close: async () => {} };
}

const ctx = { logger: { info() {}, warn() {}, error() {} } };
const GC_OFF = { enabled: false, root: "/nonexistent", graceMs: 60_000 };

/** A started-enough service: domain attached, job states seeded, floors set. */
async function makeService(rawJobs, { seed = {}, maxConcurrentRuns = 0 } = {}) {
	const jobs = normalizeJobs(rawJobs);
	const service = new CronService(ctx, { historyLimit: 3, maxConcurrentRuns }, jobs, GC_OFF);
	service.domain = stubDomain();
	const now = Date.now();
	for (const job of jobs) {
		await service.domain.table("jobs").put(job.name, {
			anchorMs: now,
			lastFiredMs: 0,
			runSeq: 0,
			...(seed[job.name] ?? {}),
		});
		service.floor.set(job.name, now);
	}
	return service;
}

const CRON_JOB = {
	name: "daily",
	schedule: { cron: "0 7 * * *", timeZone: "Asia/Shanghai" },
	task: { kind: "agent", prompt: "do it" },
};
const CMD_JOB = {
	name: "echo",
	schedule: { everySeconds: 3600 },
	task: { kind: "command", argv: ["echo", "hi"], timeoutSeconds: 30 },
};

const sleepJob = (name) => ({
	name,
	schedule: { everySeconds: 3600 },
	task: { kind: "command", argv: ["sleep", "0.4"], timeoutSeconds: 30 },
});

test("run gate: unbounded by default, a positive cap serializes unrelated jobs", async () => {
	async function elapsedForTwoRuns(maxConcurrentRuns) {
		const service = await makeService([sleepJob("a"), sleepJob("b")], { maxConcurrentRuns });
		const startedAt = Date.now();
		await service.runNow("a");
		await service.runNow("b");
		await Promise.all(["a", "b"].map((name) => service.running.get(name)?.promise));
		return Date.now() - startedAt;
	}
	// Two 0.4s jobs: overlapped they finish well inside one serial pair.
	assert.ok(await elapsedForTwoRuns(0) < 700);
	assert.ok(await elapsedForTwoRuns(1) >= 750);
});

test("listView: schedule text, effective enabled, next occurrence", async () => {
	const service = await makeService([CRON_JOB, { ...CMD_JOB, enabled: false }]);
	const [daily, echo] = service.listView();
	assert.equal(daily.name, "daily");
	assert.equal(daily.kind, "agent");
	assert.equal(daily.schedule, "cron '0 7 * * *' @ Asia/Shanghai");
	assert.equal(daily.enabled, true);
	assert.equal(daily.enabledSource, "config");
	assert.equal(daily.running, false);
	assert.ok(typeof daily.next === "string" && daily.next.endsWith("Z"));
	assert.equal(echo.enabled, false);
	assert.equal(echo.next, undefined);
	assert.equal(echo.schedule, "every 3600s");
});

test("setEnabled: durable override, changed flag, skip-floor raised on enable", async () => {
	const service = await makeService([CRON_JOB]);
	const oldFloor = service.floor.get("daily");
	assert.deepEqual(await service.setEnabled("daily", false), { job: "daily", enabled: false, changed: true });
	assert.equal(service.effectiveEnabled(service.jobs[0]), false);
	assert.equal(service.listView()[0].enabledSource, "override");
	assert.deepEqual(await service.setEnabled("daily", false), { job: "daily", enabled: false, changed: false });
	const enabledAgain = await service.setEnabled("daily", true);
	assert.equal(enabledAgain.changed, true);
	assert.ok(service.floor.get("daily") >= oldFloor);
	assert.equal((await service.setEnabled("nope", true)).code, "job_not_found");
});

test("runsView: newest first, per-job filter, unknown job", async () => {
	const service = await makeService([CRON_JOB, CMD_JOB]);
	const runs = service.domain.table("runs");
	await runs.put("daily#0000000001", {
		job: "daily", seq: 1, target: "t", startedAt: "2026-08-26T01:00:00.000Z", status: "ok", summary: "",
	});
	await runs.put("echo#0000000001", {
		job: "echo", seq: 1, target: "t", startedAt: "2026-08-26T02:00:00.000Z", status: "failed", summary: "",
	});
	const all = service.runsView(undefined, 20);
	assert.deepEqual(all.map((r) => r.job), ["echo", "daily"]);
	assert.deepEqual(service.runsView("daily", 20).map((r) => r.seq), [1]);
	assert.equal(service.runsView(undefined, 1).length, 1);
	assert.equal(service.runsView("nope", 20).code, "job_not_found");
});

test("runNow: manual run settles without touching lastFiredMs", async () => {
	const service = await makeService([CMD_JOB], { seed: { echo: { lastFiredMs: 123 } } });
	assert.equal((await service.runNow("nope")).code, "job_not_found");
	const started = await service.runNow("echo");
	assert.equal(started.started, true);
	assert.equal(started.seq, 1);
	assert.equal((await service.runNow("echo")).code, "already_running");
	await service.running.get("echo").promise;
	const record = service.domain.table("runs").get("echo#0000000001");
	assert.equal(record.status, "ok");
	assert.equal(record.manual, true);
	assert.match(record.summary, /hi/);
	const state = service.domain.table("jobs").get("echo");
	assert.equal(state.lastFiredMs, 123);
	assert.equal(state.runSeq, 1);
});

test("runNow: the running record is readable once the call resolves", async () => {
	// The real storage-domain table only exposes a write after backend
	// durability; a stub whose map updates synchronously would hide the
	// race between runNow answering and the initial record commit.
	const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
	function slowTable() {
		const map = new Map();
		return {
			get: (key) => map.get(key),
			put: async (key, value) => {
				await settle();
				map.set(key, value);
				return value;
			},
			update: async (key, fn) => {
				await settle();
				const next = fn(map.get(key));
				map.set(key, next);
				return next;
			},
			delete: async (key) => {
				await settle();
				map.delete(key);
			},
			keys: () => map.keys(),
			entries: () => map.entries(),
		};
	}
	const jobs = normalizeJobs([CMD_JOB]);
	const service = new CronService(ctx, { historyLimit: 3, maxConcurrentRuns: 1 }, jobs, GC_OFF);
	const tables = { runs: slowTable(), jobs: slowTable(), manual: slowTable() };
	service.domain = { table: (name) => tables[name], close: async () => {} };
	await tables.jobs.put("echo", { anchorMs: Date.now(), lastFiredMs: 0, runSeq: 0 });
	service.floor.set("echo", Date.now());
	const started = await service.runNow("echo");
	assert.equal(started.started, true);
	const records = service.runsView("echo", 10);
	assert.equal(records.length, 1);
	assert.equal(records[0].status, "running");
	assert.equal(records[0].manual, true);
	await service.running.get("echo")?.promise;
});

test("updateJob: refuses unknown, config-declared, and renaming specs", async () => {
	const service = await makeService([CRON_JOB]);
	const missing = await service.updateJob("nope", CRON_JOB);
	assert.equal(missing.code, "job_not_found");
	const config = await service.updateJob("daily", CRON_JOB);
	assert.equal(config.code, "config_job");
	await service.addJob({ ...CMD_JOB, name: "manual-echo" });
	const renamed = await service.updateJob("manual-echo", { ...CMD_JOB, name: "other" });
	assert.equal(renamed.code, "invalid_job");
	const invalid = await service.updateJob("manual-echo", { name: "manual-echo" });
	assert.equal(invalid.code, "invalid_job");
});

test("updateJob: replaces a manual job's spec in place and raises the floor", async () => {
	const service = await makeService([]);
	await service.addJob({ ...CMD_JOB, name: "manual-echo" });
	const before = service.floor.get("manual-echo");
	const spec = {
		name: "manual-echo",
		schedule: { everySeconds: 120 },
		task: { kind: "command", argv: ["echo", "bye"], timeoutSeconds: 60 },
	};
	const outcome = await service.updateJob("manual-echo", spec);
	assert.equal(outcome.job.name, "manual-echo");
	assert.equal(outcome.job.schedule, "every 120s");
	assert.equal(outcome.job.source, "manual");
	assert.ok(service.floor.get("manual-echo") >= before);
	const stored = service.domain.table("manual").get("manual-echo");
	assert.deepEqual(stored.spec, spec);
	assert.ok(typeof stored.updatedAt === "string");
});

test("updateJob: a run in flight is refused", async () => {
	const service = await makeService([]);
	await service.addJob({ ...CMD_JOB, name: "manual-echo" });
	service.running.set("manual-echo", { control: { cancel() {} } });
	const outcome = await service.updateJob("manual-echo", { ...CMD_JOB, name: "manual-echo" });
	assert.equal(outcome.code, "already_running");
});

test("manualSpecs: only manual jobs, raw specs as stored", async () => {
	const service = await makeService([CRON_JOB]);
	assert.deepEqual(service.manualSpecs(), {});
	const spec = { ...CMD_JOB, name: "manual-echo" };
	await service.addJob(spec);
	assert.deepEqual(service.manualSpecs(), { "manual-echo": spec });
});

test("normalizeJobs: description trims, defaults empty, and rejects non-strings", async () => {
	const [bare] = normalizeJobs([CRON_JOB]);
	assert.equal(bare.description, "");
	const [described] = normalizeJobs([{ ...CRON_JOB, description: "  盘后复盘管线  " }]);
	assert.equal(described.description, "盘后复盘管线");
	assert.throws(() => normalizeJobs([{ ...CRON_JOB, description: 7 }]), /description must be a string/);
	// The view carries it only when set, so cron_list and the overlay stay clean.
	const service = await makeService([CRON_JOB, { ...CMD_JOB, description: "hourly echo" }]);
	const [daily, echo] = service.listView();
	assert.equal(daily.description, undefined);
	assert.equal(echo.description, "hourly echo");
});

test("normalizeJobs: agent execution knobs default empty and pass through", () => {
	const [bare] = normalizeJobs([CRON_JOB]);
	assert.equal(bare.task.provider, "");
	assert.equal(bare.task.model, "");
	assert.equal(bare.task.effort, "");
	assert.equal(bare.task.preset, "");
	assert.equal(bare.task.access, "");
	const [knobbed] = normalizeJobs([{
		...CRON_JOB,
		task: { ...CRON_JOB.task, provider: "spark", model: "v4-flash", effort: "max", preset: "standard", access: "workspace-write" },
	}]);
	assert.equal(knobbed.task.provider, "spark");
	assert.equal(knobbed.task.model, "v4-flash");
	assert.equal(knobbed.task.effort, "max");
	assert.equal(knobbed.task.preset, "standard");
	assert.equal(knobbed.task.access, "workspace-write");
});

test("runsView: a running command run's summary carries the live output tail", async () => {
	const service = await makeService([{
		name: "stream",
		schedule: { everySeconds: 3600 },
		task: { kind: "command", argv: ["node", "-e", "console.log('live-tail'); setTimeout(() => {}, 30_000)"], timeoutSeconds: 60 },
	}]);
	await service.runNow("stream");
	const entry = service.running.get("stream");
	// Wait for the first stdout chunk to reach the in-memory tail.
	for (let i = 0; i < 200 && entry.liveOutput === ""; i++) {
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	const live = service.runsView("stream", 10)[0];
	assert.equal(live.status, "running");
	assert.match(live.summary, /live-tail/);
	// The durable record itself stays empty until settlement.
	assert.equal(service.domain.table("runs").get("stream#0000000001").summary, "");
	service.stopRun("stream");
	await entry.promise;
	const settled = service.runsView("stream", 10)[0];
	assert.equal(settled.status, "killed");
	assert.match(settled.summary, /live-tail/);
});
