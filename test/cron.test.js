import assert from "node:assert/strict";
import { test } from "node:test";
import {
	CronInputError,
	compileSchedule,
	latestDueOccurrence,
	nextCronOccurrence,
	nextOccurrence,
	parseCron,
} from "../lib/cron.js";

const TZ = "Asia/Shanghai";
const utc = (iso) => Date.parse(iso);

test("parseCron: field vocabulary", () => {
	const spec = parseCron("*/15 9-18 1,15 * 1-5");
	assert.deepEqual([...spec.minute].sort((a, b) => a - b), [0, 15, 30, 45]);
	assert.equal(spec.hour.size, 10);
	assert.deepEqual([...spec.dom], [1, 15]);
	assert.equal(spec.month, null);
	assert.deepEqual([...spec.dow].sort(), [1, 2, 3, 4, 5]);
});

test("parseCron: dow 7 normalizes to 0", () => {
	assert.deepEqual([...parseCron("0 0 * * 7").dow], [0]);
});

test("parseCron: rejects malformed input", () => {
	for (const bad of ["* * * *", "60 * * * *", "* 24 * * *", "*/0 * * * *", "1--2 * * * *", "a * * * *"]) {
		assert.throws(() => parseCron(bad), CronInputError, bad);
	}
});

test("nextCronOccurrence: daily time in an explicit zone", () => {
	const spec = parseCron("30 7 * * *");
	const next = nextCronOccurrence(spec, TZ, utc("2026-08-26T00:00:00+08:00"));
	assert.equal(next, utc("2026-08-26T07:30:00+08:00"));
});

test("nextCronOccurrence: strictly after, day rollover", () => {
	const spec = parseCron("30 7 * * *");
	const next = nextCronOccurrence(spec, TZ, utc("2026-08-26T07:30:00+08:00"));
	assert.equal(next, utc("2026-08-27T07:30:00+08:00"));
});

test("nextCronOccurrence: weekday match", () => {
	// 2026-08-26 is a Wednesday; next Monday 09:00 CST is 2026-08-31.
	const spec = parseCron("0 9 * * 1");
	const next = nextCronOccurrence(spec, TZ, utc("2026-08-26T12:00:00+08:00"));
	assert.equal(next, utc("2026-08-31T09:00:00+08:00"));
});

test("nextCronOccurrence: dom/dow OR rule when both restricted", () => {
	// 1st of month OR Monday. From Wed 2026-08-26, the Monday (08-31) wins over 09-01.
	const spec = parseCron("0 0 1 * 1");
	const next = nextCronOccurrence(spec, TZ, utc("2026-08-26T12:00:00+08:00"));
	assert.equal(next, utc("2026-08-31T00:00:00+08:00"));
});

test("nextCronOccurrence: unsatisfiable expression returns null", () => {
	const spec = parseCron("0 0 30 2 *");
	assert.equal(nextCronOccurrence(spec, TZ, utc("2026-01-01T00:00:00Z")), null);
});

test("compileSchedule: exactly one selector", () => {
	assert.throws(() => compileSchedule({}, "j"), CronInputError);
	assert.throws(() => compileSchedule({ cron: "* * * * *", everySeconds: 600, timeZone: TZ }, "j"), CronInputError);
});

test("compileSchedule: cron requires explicit zone, rejects bad zone", () => {
	assert.throws(() => compileSchedule({ cron: "0 7 * * *" }, "j"), CronInputError);
	assert.throws(() => compileSchedule({ cron: "0 7 * * *", timeZone: "Beijing" }, "j"), CronInputError);
	assert.equal(compileSchedule({ cron: "0 7 * * *", timeZone: TZ }, "j").kind, "cron");
});

test("compileSchedule: every bounds", () => {
	assert.throws(() => compileSchedule({ everySeconds: 30 }, "j"), CronInputError);
	assert.equal(compileSchedule({ everySeconds: 3600 }, "j").periodMs, 3_600_000);
});

test("compileSchedule: at requires explicit offset", () => {
	assert.throws(() => compileSchedule({ at: "2026-09-01T10:00:00" }, "j"), CronInputError);
	assert.equal(compileSchedule({ at: "2026-09-01T10:00:00+08:00" }, "j").atMs, utc("2026-09-01T10:00:00+08:00"));
});

test("nextOccurrence: every is anchor-aligned", () => {
	const selector = compileSchedule({ everySeconds: 600 }, "j");
	const anchor = utc("2026-08-26T10:00:00Z");
	assert.equal(nextOccurrence(selector, anchor, anchor), anchor + 600_000);
	assert.equal(nextOccurrence(selector, anchor + 90_000, anchor), anchor + 600_000);
	assert.equal(nextOccurrence(selector, anchor + 600_000, anchor), anchor + 1_200_000);
});

test("nextOccurrence: at fires once, then never again", () => {
	const selector = compileSchedule({ at: "2026-09-01T10:00:00Z" }, "j");
	assert.equal(nextOccurrence(selector, utc("2026-09-01T09:00:00Z")), utc("2026-09-01T10:00:00Z"));
	assert.equal(nextOccurrence(selector, utc("2026-09-01T10:00:00Z")), null);
});

test("latestDueOccurrence: catch-up collapses to the single latest miss", () => {
	const selector = compileSchedule({ everySeconds: 600 }, "j");
	const anchor = utc("2026-08-26T10:00:00Z");
	// Five periods elapsed; only the latest (anchor+50min) is due, never five runs.
	const due = latestDueOccurrence(selector, anchor, anchor + 50 * 60_000, anchor);
	assert.equal(due, anchor + 50 * 60_000);
});

test("latestDueOccurrence: nothing due returns null", () => {
	const selector = compileSchedule({ cron: "30 7 * * *", timeZone: TZ }, "j");
	const now = utc("2026-08-26T07:00:00+08:00");
	assert.equal(latestDueOccurrence(selector, now, now), null);
});

test("latestDueOccurrence: cron misses collapse to latest", () => {
	const selector = compileSchedule({ cron: "30 7 * * *", timeZone: TZ }, "j");
	const lastFired = utc("2026-08-20T07:30:00+08:00");
	const now = utc("2026-08-26T12:00:00+08:00");
	assert.equal(latestDueOccurrence(selector, lastFired, now), utc("2026-08-26T07:30:00+08:00"));
});
