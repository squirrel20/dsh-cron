import assert from "node:assert/strict";
import { test } from "node:test";
import {
	JobNameReservedError,
	JobOwnerConflictError,
	JobRegistry,
	MissingOwnerError,
} from "../lib/registry.js";

const SPEC = {
	name: "kb-refresh",
	schedule: { everySeconds: 3600 },
	task: { kind: "command", argv: ["/bin/echo", "hi"] },
};

/** Records what the registry asked the service to do; `domain` mimics a started service. */
function stubService() {
	return {
		domain: {},
		attached: [],
		detached: [],
		async attachPluginJob(spec, owner) {
			this.attached.push({ spec, owner });
			return { job: { name: spec.name } };
		},
		detachPluginJob(name, owner) {
			this.detached.push({ name, owner });
			return true;
		},
	};
}

function makeRegistry({ service = stubService(), configNames = [] } = {}) {
	const errors = [];
	const registry = new JobRegistry({
		getService: () => service,
		isConfigName: (name) => configNames.includes(name),
		logger: { info() {}, warn() {}, error: (line) => errors.push(line) },
	});
	return { registry, service, errors };
}

test("registerJob validates on the synchronous path, blaming the provider's own spec", () => {
	const { registry } = makeRegistry();
	assert.throws(() => registry.register({ ...SPEC, schedule: {} }, { owner: "pkg" }), /kb-refresh/);
	assert.throws(() => registry.register({ ...SPEC, task: { kind: "command", argv: [] } }, { owner: "pkg" }), /non-empty argv/);
	assert.throws(() => registry.register(null, { owner: "pkg" }), TypeError);
	// Nothing defective is admitted, so a retry after the fix is clean.
	assert.equal(registry.entries.size, 0);
});

test("registerJob demands an owner and refuses names the profile config declares", () => {
	const { registry } = makeRegistry({ configNames: ["kb-refresh"] });
	assert.throws(() => registry.register(SPEC), MissingOwnerError);
	assert.throws(() => registry.register(SPEC, { owner: "  " }), MissingOwnerError);
	assert.throws(() => registry.register(SPEC, { owner: "pkg" }), JobNameReservedError);
});

test("two providers claiming one name is an error, not a mount-order race", () => {
	const { registry } = makeRegistry();
	registry.register(SPEC, { owner: "pkg-a" });
	assert.throws(() => registry.register(SPEC, { owner: "pkg-b" }), JobOwnerConflictError);
	assert.equal(registry.entries.get("kb-refresh").owner, "pkg-a");
});

test("a registration attaches to the live service and detaches on dispose", async () => {
	const { registry, service } = makeRegistry();
	const dispose = registry.register(SPEC, { owner: "pkg" });
	await registry.idle();
	assert.deepEqual(service.attached.map((a) => [a.spec.name, a.owner]), [["kb-refresh", "pkg"]]);
	dispose();
	dispose(); // idempotent
	await registry.idle();
	assert.deepEqual(service.detached, [{ name: "kb-refresh", owner: "pkg" }]);
	assert.equal(registry.entries.size, 0);
});

test("the spec is copied at registration: a provider mutating its object later cannot rewrite the job", async () => {
	const { registry, service } = makeRegistry();
	const spec = { ...SPEC, task: { kind: "command", argv: ["/bin/echo", "hi"] } };
	registry.register(spec, { owner: "pkg" });
	spec.task.argv = ["/bin/rm", "-rf", "/"];
	await registry.idle();
	assert.deepEqual(service.attached[0].spec.task.argv, ["/bin/echo", "hi"]);
});

test("registration before the service is ready is replayed by flush", async () => {
	const service = stubService();
	service.domain = null;
	const { registry } = makeRegistry({ service });
	registry.register(SPEC, { owner: "pkg" });
	await registry.idle();
	assert.deepEqual(service.attached, []);
	service.domain = {};
	await registry.flush();
	assert.equal(service.attached.length, 1);
});

test("flush replays every live registration onto a service that just replaced the old one", async () => {
	const { registry, service } = makeRegistry();
	registry.register(SPEC, { owner: "pkg" });
	const dispose = registry.register({ ...SPEC, name: "kb-parse" }, { owner: "pkg" });
	await registry.idle();
	dispose();
	await registry.idle();
	service.attached.length = 0;
	await registry.flush();
	assert.deepEqual(service.attached.map((a) => a.spec.name), ["kb-refresh"]);
});

test("registerJobs is all-or-nothing, so a provider never mounts half its schedules", async () => {
	const { registry, service } = makeRegistry();
	assert.throws(
		() => registry.api.registerJobs([SPEC, { ...SPEC, name: "kb-parse", schedule: {} }], { owner: "pkg" }),
		/kb-parse/,
	);
	assert.equal(registry.entries.size, 0);
	// The rolled-back member also unwinds its queued attach; start the real
	// batch from a clean slate.
	await registry.idle();
	service.detached.length = 0;
	const dispose = registry.api.registerJobs([SPEC, { ...SPEC, name: "kb-parse" }], { owner: "pkg" });
	await registry.idle();
	assert.equal(registry.entries.size, 2);
	dispose();
	await registry.idle();
	assert.deepEqual(service.detached.map((d) => d.name).sort(), ["kb-parse", "kb-refresh"]);
});

test("an attach that throws is logged, not swallowed into a broken queue", async () => {
	const service = stubService();
	service.attachPluginJob = async () => {
		throw new Error("boom");
	};
	const { registry, errors } = makeRegistry({ service });
	registry.register(SPEC, { owner: "pkg" });
	await registry.idle();
	assert.match(errors.join("\n"), /attaching plugin job 'kb-refresh' failed: Error: boom/);
	// The queue still works afterwards.
	service.attachPluginJob = stubService().attachPluginJob;
	registry.register({ ...SPEC, name: "kb-parse" }, { owner: "pkg" });
	await registry.idle();
	assert.equal(registry.entries.size, 2);
});
