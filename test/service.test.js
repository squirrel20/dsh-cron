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
	const tables = { runs: stubTable(), jobs: stubTable() };
	return { table: (name) => tables[name], close: async () => {} };
}

const ctx = { logger: { info() {}, warn() {}, error() {} } };
const GC_OFF = { enabled: false, root: "/nonexistent", graceMs: 60_000 };

/** A started-enough service: domain attached, job states seeded, floors set. */
async function makeService(rawJobs, { seed = {} } = {}) {
	const jobs = normalizeJobs(rawJobs);
	const service = new CronService(ctx, { historyLimit: 3, maxConcurrentRuns: 1 }, jobs, GC_OFF);
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
