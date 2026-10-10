import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { authorizeCronAgent, approveManualJob, isManualJobApproved, commandEnvironment } from "../lib/security.js";
import { CronService, normalizeJobs } from "../lib/service.js";
import { runCommandTask, deliver } from "../lib/executor.js";

// Exercise real tool and agent executor code, replacing only host package seams.
const hostModules = {
	"@deepseek-ai/dsh-tools": "export const defineTool = x => x;",
	"@deepseek-ai/dsh-agent": "export const installModelSelection = () => {};",
	"@deepseek-ai/dsh-llm": "export const ReasoningEffortId = x => x; export const createUserMessage = x => x;",
	"@deepseek-ai/dsh-session": "export const SessionId = x => x;",
};
registerHooks({
	resolve(specifier, context, next) {
		if (hostModules[specifier]) return { url: `data:text/javascript,${encodeURIComponent(hostModules[specifier])}`, shortCircuit: true };
		// Only the storage adapter's declaration is mocked; restore/dispatch are real.
		if (specifier === "./domain.js") return { url: "data:text/javascript,export const cronDomain = {};", shortCircuit: true };
		return next(specifier, context);
	},
});
const { registerCronTools } = await import("../lib/tools.js");
const { runAgentTask } = await import("../lib/agent-task.js");
const logger = { info() {}, warn() {}, error() {} };
const gc = { enabled: false };
const spec = { name: "probe", schedule: { everySeconds: 3600 }, task: { kind: "command", argv: [process.execPath, "-e", "console.log('ok')"] } };
function actor(sandbox = "workspace-write", approval = "ask", name = "selected") {
	return { agent: { session: { id: "creator" }, ctx: { get: () => ({ current: () => name, resolve: () => ({ sandbox, approval }) }) } } };
}
function domain() {
	const tables = Object.fromEntries(["jobs", "runs", "manual", "plugin"].map(name => {
		const map = new Map();
		return [name, { get: k => map.get(k), put: async (k,v) => (map.set(k,v),v), update: async (k,f) => { const v=f(map.get(k)); map.set(k,v); return v; }, delete: async k => map.delete(k), entries: () => map.entries(), keys: () => map.keys() }];
	}));
	return { table: name => tables[name], close: async () => {} };
}
function service(store = domain()) {
	const ctx = { logger, storage: { domain: { open: async () => store } } };
	const value = new CronService(ctx, { historyLimit: 10 }, [], gc);
	value.domain = store;
	return value;
}

test("only effective unrestricted + never grants host control; unknown and Auto fail closed", () => {
	for (const a of [actor(), actor("read-only", "never"), actor("danger-full-access", "ask"), actor("danger-full-access", "never", "auto"), actor("danger-full-access", "never", "custom"), { agent: {} }]) {
		assert.equal(authorizeCronAgent(a.agent).code, "permission_denied");
	}
	assert.equal(authorizeCronAgent(actor("workspace-write", "ask", "danger-full-access").agent).code, "permission_denied");
	assert.equal(authorizeCronAgent(actor("danger-full-access", "never", "operator-alias").agent), null);
	assert.equal(authorizeCronAgent({ session: {}, ctx: { get() { throw Error("missing"); } } }).code, "permission_denied");
});

test("all mutating tools pass caller identity and block both issue vectors plus delivery", async () => {
	const s = service();
	await s.addJob(spec);
	await s.attachPluginJob({ ...spec, name: "plugin", task: { kind: "callback" } }, "test", () => { throw Error("must not run"); });
	const caller = actor().agent;
	const registered = new Map();
	registerCronTools({ logger }, { tools: { register(tool) { registered.set(tool.name, tool); return () => {}; } } }, caller, () => s);
	const create = registered.get("cron_create");
	for (const task of [spec.task, { kind: "agent", prompt: "test", access: "danger-full-access", cwd: "/" }]) {
		const result = await create.execute({ ...spec, name: "attack", task, delivery: { argv: ["/bin/false"], onlyOnFailure: false } }, { agent: caller });
		assert.equal(result.code, "permission_denied");
	}
	for (const name of ["cron_run_now", "cron_enable", "cron_disable", "cron_delete"]) {
		for (const job of ["probe", "plugin"]) assert.equal((await registered.get(name).execute({ job }, { agent: caller })).code, "permission_denied");
	}
	assert.equal(s.running.size, 0);
	assert.equal(s.domain.table("manual").get("attack"), undefined);
	assert.equal((await s.updateJob("probe", spec, { agent: caller })).code, "permission_denied");
	assert.equal(s.stopRun("probe", { agent: caller }).code, "permission_denied");
	// Permissions are evaluated at call time, not at tool registration.
	caller.ctx = actor("danger-full-access", "never").agent.ctx;
	assert.equal((await create.execute({ ...spec, name: "allowed" }, { agent: caller })).job.name, "allowed");
	assert.equal(s.domain.table("manual").get("allowed").authorization.sessionId, "creator");
});

test("old manual jobs survive restart but cannot run until reviewed; forged spec flags do not approve them", async () => {
	const store = domain();
	const raw = { ...spec, authorization: approveManualJob(spec), hostAuthorized: true };
	await store.table("manual").put("probe", { spec: raw, createdAt: "old" });
	await store.table("runs").put("probe#0000000001", { job: "probe", seq: 1, status: "ok", summary: "keep" });
	const s = service(store);
	await s.start();
	try {
		assert.equal(s.listView()[0].requiresApproval, true);
		assert.equal(s.listView()[0].enabled, false);
		assert.equal((await s.runNow("probe")).code, "permission_denied");
		assert.equal((await s.setEnabled("probe", true)).code, "permission_denied");
		assert.equal((await s.dispatch(s.jobs[0], Date.now())).code, "permission_denied");
		assert.equal(store.table("runs").get("probe#0000000001").summary, "keep");
		await s.updateJob("probe", spec);
		assert.equal(s.jobAuthorized(s.jobs[0]), true);
	} finally { await s.dispose(); }
	const restarted = service(store);
	await restarted.start();
	try {
		assert.equal(restarted.jobAuthorized(restarted.jobs[0]), true);
		assert.equal((await restarted.runNow("probe")).started, true);
		await restarted.running.get("probe").promise;
		assert.equal(restarted.runsView("probe", 1)[0].status, "ok");
	} finally { await restarted.dispose(); }
});

test("changed persisted specs invalidate approval and direct launch suppresses command AND delivery", async () => {
	const s = service();
	await s.addJob({ ...spec, delivery: { argv: ["missing-delivery-must-not-run"], onlyOnFailure: false } });
	const row = s.domain.table("manual").get("probe");
	row.spec.task = { ...row.spec.task, cwd: "/" };
	assert.equal(isManualJobApproved(row), false);
	await s.launch(s.jobs[0], Date.now(), 1);
	await s.running.get("probe").promise;
	const run = s.runsView("probe", 1)[0];
	assert.equal(run.status, "failed");
	assert.match(run.error, /authorization/);
	assert.equal(run.summary, "");
});

test("command and delivery children receive allowlisted env, never ambient secrets", async () => {
	const dir = await mkdtemp(join(tmpdir(), "cron-security-"));
	const key = "CRON_SECURITY_TEST_SECRET";
	process.env[key] = "synthetic-canary";
	try {
		assert.equal(commandEnvironment()[key], undefined);
		assert.equal(commandEnvironment([key])[key], "synthetic-canary");
		const out = await runCommandTask({ task: { argv: [process.execPath, "-e", `console.log(process.env.${key} ?? 'absent')`], cwd: dir, timeoutSeconds: 5 } });
		assert.equal(out.summary.trim(), "absent");
		const file = join(dir, "delivery-result");
		const result = await deliver({ delivery: { argv: [process.execPath, "-e", `require('fs').writeFileSync(process.argv[1], process.env.${key} ?? 'absent'); process.stdin.resume()`, file] } }, { status: "ok" });
		assert.equal(result.ok, true);
		assert.equal(await readFile(file, "utf8"), "absent");
	} finally { delete process.env[key]; await rm(dir, { recursive: true, force: true }); }
});

test("agent access setup failure disposes handle without submitting a prompt", async () => {
	for (const permission of [undefined, { set() { throw Error("invalid preset"); } }]) {
		let disposed = false, followed = false;
		const ctx = {
			get: name => name === "permissionPresets" ? permission : undefined,
			agentDefaultModel: { currentSelection: () => ({ provider: "test", model: "test" }) },
			agents: { create: async () => ({ agent: { session: {}, followup() { followed = true; }, whenIdle: async () => {} }, dispose: async () => { disposed = true; } }) },
		};
		const job = normalizeJobs([{ ...spec, task: { kind: "agent", prompt: "test", access: "read-only" } }])[0];
		await assert.rejects(runAgentTask(ctx, job, new Date().toISOString(), undefined, "test"), /permission service|invalid preset/);
		assert.equal(disposed, true);
		assert.equal(followed, false);
	}
});

test("authorization is rechecked after a run waits for capacity", async () => {
	const s = new CronService({ logger }, { historyLimit: 10, maxConcurrentRuns: 1 }, [], gc);
	s.domain = domain();
	await s.addJob(spec);
	await s.gate.acquire();
	await s.launch(s.jobs[0], Date.now(), 1);
	const pending = s.running.get("probe").promise;
	delete s.domain.table("manual").get("probe").authorization;
	s.gate.release();
	await pending;
	assert.match(s.runsView("probe", 1)[0].error, /authorization/);
	assert.equal(s.runsView("probe", 1)[0].summary, "");
});
