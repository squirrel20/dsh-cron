/**
 * Browser-half regression tests.
 *
 * `lib/client.js` is a self-registering ModuleLoader entry, so this suite loads
 * it the way the shell does — a `window` carrying `__ModuleLoader__` — and then
 * drives the one seam a run row needs: the injected `openSession`.
 *
 * That seam must reopen a finished run whose plain Session dropped out of the
 * client list when the host disposed the run's Agent (lib/agent-task.js keeps
 * the run Session plain so the harness serves it on the ordinary address), and
 * it must still answer false — the row then falls back to the run-detail page —
 * when the id stays unknown.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/** Module scope only ever calls `react.createElement`. */
const reactStub = { createElement: (type, props, ...children) => ({ type, props, children }) };
const reactDomStub = { createPortal: (node) => node };
/** Primitives members are referenced while rendering, never while loading. */
const primitivesStub = new Proxy({}, { get: () => () => null });

/** Load `lib/client.js` through its ModuleLoader entry and return its exports. */
function loadClientModule(primitives = primitivesStub) {
	const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
	let entry;
	const windowStub = {
		__ModuleLoader__: {
			load(value) {
				entry = value;
			},
		},
		addEventListener() {},
		removeEventListener() {},
		dispatchEvent() {},
	};
	const requireStub = (id) => {
		if (id === "react") return reactStub;
		if (id === "react-dom") return reactDomStub;
		if (id === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
		throw new Error(`unexpected module request: ${id}`);
	};
	new Function("window", source)(windowStub);
	assert.notEqual(entry, undefined, "the bundle must register itself on window.__ModuleLoader__");
	return entry.factory(requireStub);
}

/** Apply the plugin to a context stub and return the sidebar injection's openSession. */
function injectedOpenSession(sessions) {
	const registered = [];
	const ctx = {
		effect(callback) {
			callback();
			return () => {};
		},
		locale: { register() {} },
		workspaces: {},
		sessions,
		slots: {
			inject(_name, factory) {
				factory();
			},
			register(registration) {
				registered.push(registration);
			},
		},
	};
	loadClientModule().apply(ctx);
	const sidebar = registered.find((registration) => registration.id === "cron-jobs");
	assert.notEqual(sidebar, undefined, "the section must register on sidebar.footer.action");
	return sidebar.inject().openSession;
}

test("cron client: an open the client already lists never refreshes the host list", async () => {
	const calls = [];
	const openSession = injectedOpenSession({
		open(id) {
			calls.push(`open:${id}`);
		},
		async refresh() {
			calls.push("refresh");
		},
	});
	assert.equal(await openSession("cron-opc-intel-daily-1"), true);
	assert.deepEqual(calls, ["open:cron-opc-intel-daily-1"]);
});

test("cron client: a settled run reopens after exactly one list refresh", async () => {
	const calls = [];
	let attempts = 0;
	const openSession = injectedOpenSession({
		open(id) {
			attempts += 1;
			calls.push(`open:${id}`);
			if (attempts === 1) throw new Error(`sessions.select: unknown session ${id}`);
		},
		async refresh() {
			calls.push("refresh");
		},
	});
	assert.equal(await openSession("cron-opc-intel-daily-1"), true);
	assert.deepEqual(calls, ["open:cron-opc-intel-daily-1", "refresh", "open:cron-opc-intel-daily-1"]);
});

test("cron client: an id that stays unknown reports false for the detail-page fallback", async () => {
	const calls = [];
	const warnings = [];
	const openSession = injectedOpenSession({
		open(id) {
			calls.push(`open:${id}`);
			throw new Error(`sessions.select: unknown session ${id}`);
		},
		async refresh() {
			calls.push("refresh");
		},
	});
	const originalWarn = console.warn;
	console.warn = (...args) => {
		warnings.push(args);
	};
	try {
		assert.equal(await openSession("cron-pruned-run-9"), false);
	} finally {
		console.warn = originalWarn;
	}
	assert.deepEqual(calls, ["open:cron-pruned-run-9", "refresh", "open:cron-pruned-run-9"]);
	assert.equal(warnings.length, 1, "one warning per failed open");
});

test("cron client: an unreachable host list still reports false", async () => {
	const openSession = injectedOpenSession({
		open(id) {
			throw new Error(`sessions.select: unknown session ${id}`);
		},
		async refresh() {
			throw new Error("gateway/unavailable");
		},
	});
	const originalWarn = console.warn;
	console.warn = () => {};
	try {
		assert.equal(await openSession("cron-x"), false);
	} finally {
		console.warn = originalWarn;
	}
});

/** The icons the section renders, with the size suffix dsh <= 0.1.5 exported them under. */
const ICONS = {
	PlusOutline: "16",
	TrashOutline: "16",
	EllipsisOutline: "16",
	EditOutline: "16",
	PauseOutline: "16",
	PlayOutline: "16",
	SearchOutline: "16",
	CloseOutline: "16",
	PersonalizationOutline: "16",
	StopFill: "16",
	TriangleRightFill: "14",
};

/** A primitives stub exporting only `exported` icon names; records every Icon* lookup. */
function iconPrimitives(exported) {
	const lookups = [];
	const target = {};
	for (const name of exported) target[name] = () => null;
	const primitives = new Proxy(target, {
		get(object, key) {
			if (typeof key === "string" && key.startsWith("Icon")) {
				lookups.push(key);
				return object[key];
			}
			return () => null;
		},
	});
	return { primitives, lookups };
}

test("cron client: icons render through the resolver, never a bare primitives member (#5)", () => {
	const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
	assert.doesNotMatch(source, /primitives\.Icon/);
});

test("cron client: dsh 0.1.7 Regular icon names are preferred and legacy names never consulted (#5)", () => {
	const { primitives, lookups } = iconPrimitives(Object.keys(ICONS).map((stem) => `Icon${stem}Regular`));
	loadClientModule(primitives);
	for (const stem of Object.keys(ICONS)) {
		assert.ok(lookups.includes(`Icon${stem}Regular`), stem);
		assert.ok(!lookups.includes(`Icon${stem}${ICONS[stem]}`), stem);
	}
});

test("cron client: dsh 0.1.5 legacy icon names are the fallback, and loading survives neither (#5)", () => {
	const legacy = iconPrimitives(Object.entries(ICONS).map(([stem, size]) => `Icon${stem}${size}`));
	loadClientModule(legacy.primitives);
	for (const [stem, size] of Object.entries(ICONS)) assert.ok(legacy.lookups.includes(`Icon${stem}${size}`), stem);
	assert.doesNotThrow(() => loadClientModule(iconPrimitives([]).primitives));
});
