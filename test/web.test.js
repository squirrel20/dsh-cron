import assert from "node:assert/strict";
import { test } from "node:test";
import { createStateHandler, cronWebState, STATE_PATH } from "../lib/web.js";

/** Minimal response double capturing status, headers, and body. */
function stubResponse() {
	const record = { status: undefined, headers: undefined, body: undefined, ended: false };
	return {
		record,
		writeHead(status, headers) {
			record.status = status;
			record.headers = headers;
		},
		end(body) {
			record.body = body;
			record.ended = true;
		},
	};
}

const silentLogger = { info() {}, warn() {}, error() {} };

/** A service double answering the two views the route reads. */
function stubService(jobs, runs) {
	return {
		domain: {},
		listView: () => jobs,
		runsView: (jobName, limit) => {
			assert.equal(jobName, undefined);
			return runs.slice(0, limit);
		},
	};
}

test("state route path is namespaced under the plugin", () => {
	assert.equal(STATE_PATH, "/dsh-cron/api/state");
});

test("cronWebState carries jobs, runs, and a clock", () => {
	const jobs = [{ name: "a", kind: "agent" }];
	const runs = [{ job: "a", seq: 1 }];
	const state = cronWebState(stubService(jobs, runs));
	assert.deepEqual(state.jobs, jobs);
	assert.deepEqual(state.runs, runs);
	assert.ok(!Number.isNaN(Date.parse(state.now)));
});

test("GET answers 200 JSON with no-store", () => {
	const handler = createStateHandler(() => stubService([], []), silentLogger);
	const res = stubResponse();
	handler({ method: "GET" }, res);
	assert.equal(res.record.status, 200);
	assert.equal(res.record.headers["content-type"], "application/json");
	assert.equal(res.record.headers["cache-control"], "no-store");
	const body = JSON.parse(res.record.body);
	assert.deepEqual(body.jobs, []);
	assert.deepEqual(body.runs, []);
});

test("HEAD answers headers only", () => {
	const handler = createStateHandler(() => stubService([], []), silentLogger);
	const res = stubResponse();
	handler({ method: "HEAD" }, res);
	assert.equal(res.record.status, 200);
	assert.equal(res.record.body, undefined);
	assert.ok(res.record.ended);
});

test("non-read methods are refused with 405", () => {
	const handler = createStateHandler(() => stubService([], []), silentLogger);
	for (const method of ["POST", "PUT", "DELETE"]) {
		const res = stubResponse();
		handler({ method }, res);
		assert.equal(res.record.status, 405);
		assert.equal(res.record.headers.allow, "GET, HEAD");
	}
});

test("missing scheduler answers 503 scheduler_unavailable", () => {
	for (const getService of [() => null, () => ({ domain: null })]) {
		const handler = createStateHandler(getService, silentLogger);
		const res = stubResponse();
		handler({ method: "GET" }, res);
		assert.equal(res.record.status, 503);
		assert.deepEqual(JSON.parse(res.record.body), { error: "scheduler_unavailable" });
	}
});

test("a view that throws answers 500 without leaking the error", () => {
	const broken = {
		domain: {},
		listView() {
			throw new Error("secret detail");
		},
		runsView: () => [],
	};
	const handler = createStateHandler(() => broken, silentLogger);
	const res = stubResponse();
	handler({ method: "GET" }, res);
	assert.equal(res.record.status, 500);
	assert.deepEqual(JSON.parse(res.record.body), { error: "internal_error" });
});
