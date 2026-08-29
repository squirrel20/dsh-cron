import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { CronInputError } from "../lib/cron.js";
import { isCronSessionDirName, normalizeGcConfig, sweepCronSessions } from "../lib/gc.js";

const UUID = "af9c8064-2007-4e43-a00b-5af5bd95c6da";

test("isCronSessionDirName: accepts exactly the ids the executor mints", () => {
	assert.equal(isCronSessionDirName(`cron-daily-log-review-${UUID}`), true);
	assert.equal(isCronSessionDirName(`cron-a-${UUID}`), true);
	assert.equal(isCronSessionDirName(`cron-Daily-${UUID}`), true);
	assert.equal(isCronSessionDirName(`cron-\u5e02\u573a\u590d\u76d8-${UUID}`), true);
	for (const bad of [
		`session-${UUID}`,
		"cron-daily",
		`cron--${UUID}`,
		`cron-\u5e02\u573a \u590d\u76d8-${UUID}`,
		`cron-daily-${UUID}x`,
		`cron-daily-${UUID.toUpperCase()}`,
	]) {
		assert.equal(isCronSessionDirName(bad), false, bad);
	}
});

test("normalizeGcConfig: defaults and diagnostics", () => {
	const cfg = normalizeGcConfig(undefined);
	assert.equal(cfg.enabled, true);
	assert.equal(cfg.graceMs, 30 * 60_000);
	assert.ok(cfg.root.endsWith("/.dsh/sessions"));
	assert.equal(normalizeGcConfig({ enabled: false, root: "/x", graceMinutes: 1 }).root, "/x");
	assert.throws(() => normalizeGcConfig([]), CronInputError);
	assert.throws(() => normalizeGcConfig({ enabled: "yes" }), CronInputError);
	assert.throws(() => normalizeGcConfig({ graceMinutes: 0 }), CronInputError);
});

test("sweepCronSessions: removes only stale unreferenced cron dirs", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "dsh-cron-gc-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const project = join(root, "--some-project--");
	const referenced = `cron-kept-${UUID}`;
	const stale = `cron-stale-${UUID}`;
	const fresh = `cron-fresh-${UUID}`;
	const foreign = `session-${UUID}`;
	for (const name of [referenced, stale, fresh, foreign]) {
		await mkdir(join(project, name), { recursive: true });
		await writeFile(join(project, name, "session.jsonl.zstd"), "x");
	}
	const old = new Date(Date.now() - 3 * 3600 * 1000);
	for (const name of [referenced, stale, foreign]) {
		await utimes(join(project, name), old, old);
		await utimes(join(project, name, "session.jsonl.zstd"), old, old);
	}
	const outcome = await sweepCronSessions(root, new Set([referenced]), 30 * 60_000);
	assert.deepEqual(outcome.removed, [stale]);
	assert.equal(outcome.kept, 2); // referenced + fresh; the foreign dir is never considered
	assert.equal(existsSync(join(project, referenced)), true);
	assert.equal(existsSync(join(project, fresh)), true);
	assert.equal(existsSync(join(project, foreign)), true);
	assert.equal(existsSync(join(project, stale)), false);
});

test("sweepCronSessions: a fresh file inside an old dir protects it", async (t) => {
	const root = await mkdtemp(join(tmpdir(), "dsh-cron-gc-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const dir = join(root, "--p--", `cron-live-${UUID}`);
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, "session.jsonl.zstd"), "x");
	const old = new Date(Date.now() - 3 * 3600 * 1000);
	await utimes(dir, old, old); // dir looks old; the log file is fresh
	const outcome = await sweepCronSessions(root, new Set(), 30 * 60_000);
	assert.deepEqual(outcome.removed, []);
	assert.equal(existsSync(dir), true);
});

test("sweepCronSessions: missing root is a clean no-op", async () => {
	const outcome = await sweepCronSessions("/nonexistent/dsh-cron-gc-test", new Set(), 1);
	assert.deepEqual(outcome, { removed: [], kept: 0 });
});
