import assert from "node:assert/strict";
import { test } from "node:test";
import { CronService, createControl, normalizeJobs } from "../lib/service.js";
import { actionRoutes, createActionHandler } from "../lib/web.js";

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
	const tables = { runs: stubTable(), jobs: stubTable(), manual: stubTable(), plugin: stubTable() };
	return { table: (name) => tables[name], close: async () => {} };
}

const ctx = { logger: { info() {}, warn() {}, error() {} } };
const GC_OFF = { enabled: false, root: "/nonexistent", graceMs: 60_000 };

function makeService(rawJobs) {
	const jobs = normalizeJobs(rawJobs);
	const service = new CronService(ctx, { historyLimit: 5, maxConcurrentRuns: 1 }, jobs, GC_OFF);
	service.domain = stubDomain();
	const now = Date.now();
	for (const job of jobs) {
		service.domain.table("jobs").put(job.name, { anchorMs: now, lastFiredMs: 0, runSeq: 0 });
		service.floor.set(job.name, now);
	}
	return service;
}

const SPEC = {
	name: "manual-echo",
	schedule: { everySeconds: 3600 },
	task: { kind: "command", argv: ["/bin/echo", "hi"] },
};

test("addJob persists the raw spec, schedules the job, and reports source manual", async () => {
	const service = makeService([]);
	const outcome = await service.addJob(SPEC);
	assert.equal(outcome.job.name, "manual-echo");
	assert.equal(outcome.job.source, "manual");
	assert.ok(service.jobs.some((job) => job.name === "manual-echo"));
	assert.deepEqual(service.domain.table("manual").get("manual-echo").spec, SPEC);
	assert.ok(service.domain.table("jobs").get("manual-echo") !== undefined);
	assert.ok(service.floor.get("manual-echo") > 0);
});

test("addJob refuses an invalid spec with the normalizer's message", async () => {
	const service = makeService([]);
	const outcome = await service.addJob({ name: "Bad Name" });
	assert.equal(outcome.code, "invalid_job");
	assert.match(outcome.message, /job name/);
});

test("addJob refuses a duplicate name, config or manual", async () => {
	const service = makeService([{ name: "manual-echo", schedule: { everySeconds: 3600 }, task: { kind: "command", argv: ["/bin/true"] } }]);
	const dup = await service.addJob(SPEC);
	assert.equal(dup.code, "job_exists");
	const first = await service.addJob({ ...SPEC, name: "other" });
	assert.equal(first.job.name, "other");
	const second = await service.addJob({ ...SPEC, name: "other" });
	assert.equal(second.code, "job_exists");
});

test("stopRun cancels the in-flight run with status killed", () => {
	const service = makeService([{ name: "runner", schedule: { everySeconds: 3600 }, task: { kind: "command", argv: ["/bin/true"] } }]);
	const control = createControl();
	service.running.set("runner", { control, promise: Promise.resolve() });
	const outcome = service.stopRun("runner");
	assert.deepEqual(outcome, { job: "runner", stopping: true });
	assert.equal(control.cancelled, "killed");
});

test("stopRun refuses unknown and idle jobs distinctly", () => {
	const service = makeService([{ name: "idle", schedule: { everySeconds: 3600 }, task: { kind: "command", argv: ["/bin/true"] } }]);
	assert.equal(service.stopRun("ghost").code, "job_not_found");
	assert.equal(service.stopRun("idle").code, "not_running");
});

test("deleteJob removes a manual job and its whole ledger", async () => {
	const service = makeService([]);
	await service.addJob(SPEC);
	await service.domain.table("runs").put("manual-echo#0000000001", {
		job: "manual-echo", seq: 1, target: "t", startedAt: "s", status: "ok", summary: "",
	});
	const outcome = await service.deleteJob("manual-echo");
	assert.deepEqual(outcome, { job: "manual-echo", deleted: true });
	assert.ok(!service.jobs.some((job) => job.name === "manual-echo"));
	assert.equal(service.domain.table("manual").get("manual-echo"), undefined);
	assert.equal(service.domain.table("jobs").get("manual-echo"), undefined);
	assert.deepEqual([...service.domain.table("runs").keys()], []);
	assert.equal(service.floor.get("manual-echo"), undefined);
});

test("deleteJob refuses config jobs, running jobs, and unknowns", async () => {
	const service = makeService([{ name: "cfg", schedule: { everySeconds: 3600 }, task: { kind: "command", argv: ["/bin/true"] } }]);
	assert.equal((await service.deleteJob("cfg")).code, "config_job");
	assert.equal((await service.deleteJob("ghost")).code, "job_not_found");
	await service.addJob(SPEC);
	service.running.set("manual-echo", { control: createControl(), promise: Promise.resolve() });
	assert.equal((await service.deleteJob("manual-echo")).code, "already_running");
	service.running.delete("manual-echo");
	assert.equal((await service.deleteJob("manual-echo")).deleted, true);
});

// --- action handler transport ---

function stubResponse() {
	const record = { status: undefined, headers: undefined, body: undefined };
	return {
		record,
		writeHead(status, headers) {
			record.status = status;
			record.headers = headers;
		},
		end(body) {
			record.body = body;
		},
	};
}

/** A POST request double streaming one JSON body. */
function stubRequest(body, contentType = "application/json") {
	const listeners = {};
	return {
		method: "POST",
		headers: { "content-type": contentType },
		on(event, fn) {
			listeners[event] = fn;
			if (event === "end") {
				if (body !== undefined) listeners.data?.(Buffer.from(body));
				listeners.end();
			}
			return this;
		},
		destroy() {},
	};
}

const silentLogger = { info() {}, warn() {}, error() {} };

test("delete route maps config_job to 409", async () => {
	const service = makeService([{ name: "cfg", schedule: { everySeconds: 3600 }, task: { kind: "command", argv: ["/bin/true"] } }]);
	const del = actionRoutes().find((route) => route.path.endsWith("/delete"));
	const handler = createActionHandler(() => service, silentLogger, del.act);
	const res = stubResponse();
	await handler(stubRequest(JSON.stringify({ job: "cfg" })), res);
	assert.equal(res.record.status, 409);
	assert.equal(JSON.parse(res.record.body).error, "config_job");
});

test("action handler maps service error codes to HTTP statuses", async () => {
	const service = makeService([]);
	const stop = actionRoutes().find((route) => route.path.endsWith("/stop"));
	const handler = createActionHandler(() => service, silentLogger, stop.act);
	const res = stubResponse();
	await handler(stubRequest(JSON.stringify({ job: "ghost" })), res);
	assert.equal(res.record.status, 404);
	assert.equal(JSON.parse(res.record.body).error, "job_not_found");
});

test("action handler creates a job end to end", async () => {
	const service = makeService([]);
	const jobs = actionRoutes().find((route) => route.path.endsWith("/jobs"));
	const handler = createActionHandler(() => service, silentLogger, jobs.act);
	const res = stubResponse();
	await handler(stubRequest(JSON.stringify({ spec: SPEC })), res);
	assert.equal(res.record.status, 200);
	assert.equal(JSON.parse(res.record.body).job.name, "manual-echo");
});

test("action handler refuses non-JSON content types before dispatch", async () => {
	const service = makeService([]);
	const jobs = actionRoutes().find((route) => route.path.endsWith("/jobs"));
	const handler = createActionHandler(() => service, silentLogger, jobs.act);
	for (const type of ["text/plain", "application/x-www-form-urlencoded", ""]) {
		const res = stubResponse();
		await handler(stubRequest(JSON.stringify({ spec: SPEC }), type), res);
		assert.equal(res.record.status, 415);
	}
	assert.equal(service.jobs.length, 0);
});

test("action handler refuses non-POST and malformed bodies", async () => {
	const service = makeService([]);
	const run = actionRoutes().find((route) => route.path.endsWith("/run-now"));
	const handler = createActionHandler(() => service, silentLogger, run.act);
	const res405 = stubResponse();
	await handler({ method: "GET", headers: {} }, res405);
	assert.equal(res405.record.status, 405);
	const res400 = stubResponse();
	await handler(stubRequest("not json"), res400);
	assert.equal(res400.record.status, 400);
	const resArr = stubResponse();
	await handler(stubRequest("[1,2]"), resArr);
	assert.equal(resArr.record.status, 400);
});
