/**
 * dsh-cron — schedule math.
 *
 * Three selector kinds: 5-field cron expressions evaluated in an explicit
 * IANA time zone, anchor-aligned `everySeconds` intervals, and one-shot `at`
 * instants. All arithmetic is UTC-millisecond based; zone interpretation
 * happens only through Intl at minute granularity, so zone offsets (whole
 * minutes) can never be split by a step.
 *
 * Discipline borrowed from @deepseek-ai/dsh-schedule: never enumerate missed
 * occurrences for replay — a catch-up run fires at most once, at the latest
 * due occurrence.
 * @module dsh-cron/cron
 */

/** Field ranges of a 5-field cron expression, in order. */
const FIELDS = [
	{ key: "minute", min: 0, max: 59 },
	{ key: "hour", min: 0, max: 23 },
	{ key: "dom", min: 1, max: 31 },
	{ key: "month", min: 1, max: 12 },
	{ key: "dow", min: 0, max: 7 },
];

const MINUTE_MS = 60_000;
/** Scan horizon: one leap year of minutes. A valid expression always fires within it. */
const SCAN_LIMIT_MINUTES = 366 * 24 * 60;

/** Error for user-facing schedule misconfiguration; message is the diagnosis. */
export class CronInputError extends Error {}

/**
 * Parse one cron field into a sorted set of allowed values, or null for `*`.
 * Supports `*`, `a`, `a-b`, lists, and `/step` on any of those.
 */
function parseField(text, { key, min, max }) {
	if (text === "*") return null;
	const values = new Set();
	for (const part of text.split(",")) {
		const [rangeText, stepText, extra] = part.split("/");
		if (extra !== undefined || rangeText === "" || stepText === "") {
			throw new CronInputError(`cron field '${key}': malformed part '${part}'`);
		}
		const step = stepText === undefined ? 1 : Number(stepText);
		if (!Number.isInteger(step) || step < 1) {
			throw new CronInputError(`cron field '${key}': invalid step '${stepText}'`);
		}
		let lo;
		let hi;
		if (rangeText === "*") {
			lo = min;
			hi = max;
		} else {
			const bounds = rangeText.split("-");
			if (bounds.length > 2) throw new CronInputError(`cron field '${key}': malformed range '${rangeText}'`);
			lo = Number(bounds[0]);
			hi = bounds.length === 2 ? Number(bounds[1]) : stepText !== undefined ? max : lo;
			if (!Number.isInteger(lo) || !Number.isInteger(hi)) {
				throw new CronInputError(`cron field '${key}': non-integer bound in '${rangeText}'`);
			}
		}
		if (lo < min || hi > max || lo > hi) {
			throw new CronInputError(`cron field '${key}': '${part}' outside ${min}-${max}`);
		}
		for (let v = lo; v <= hi; v += step) values.add(key === "dow" && v === 7 ? 0 : v);
	}
	return values;
}

/**
 * Parse a 5-field cron expression.
 * @returns spec with per-field allowed sets (null = any) plus the dom/dow
 * restriction flags the standard OR rule needs.
 */
export function parseCron(expr) {
	const fields = expr.trim().split(/\s+/);
	if (fields.length !== 5) {
		throw new CronInputError(`cron expression must have 5 fields, got ${fields.length}: '${expr}'`);
	}
	const spec = {};
	for (let i = 0; i < 5; i += 1) spec[FIELDS[i].key] = parseField(fields[i], FIELDS[i]);
	return spec;
}

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatters = new Map();

/** Cached per-zone formatter; throws CronInputError on an unknown zone. */
function formatterFor(timeZone) {
	let formatter = formatters.get(timeZone);
	if (formatter === undefined) {
		try {
			formatter = new Intl.DateTimeFormat("en-US", {
				timeZone,
				hourCycle: "h23",
				minute: "numeric",
				hour: "numeric",
				day: "numeric",
				month: "numeric",
				weekday: "short",
			});
		} catch {
			throw new CronInputError(`invalid time zone '${timeZone}'`);
		}
		formatters.set(timeZone, formatter);
	}
	return formatter;
}

/** Wall-clock fields of one UTC instant in the given zone. */
export function zonedFields(ms, timeZone) {
	const parts = formatterFor(timeZone).formatToParts(new Date(ms));
	const out = {};
	for (const part of parts) {
		if (part.type === "minute") out.minute = Number(part.value);
		else if (part.type === "hour") out.hour = Number(part.value);
		else if (part.type === "day") out.dom = Number(part.value);
		else if (part.type === "month") out.month = Number(part.value);
		else if (part.type === "weekday") out.dow = WEEKDAYS[part.value];
	}
	return out;
}

/** Standard cron match: dom/dow OR each other when both are restricted. */
function matches(spec, fields) {
	if (spec.minute !== null && !spec.minute.has(fields.minute)) return false;
	if (spec.hour !== null && !spec.hour.has(fields.hour)) return false;
	if (spec.month !== null && !spec.month.has(fields.month)) return false;
	const domOk = spec.dom === null || spec.dom.has(fields.dom);
	const dowOk = spec.dow === null || spec.dow.has(fields.dow);
	if (spec.dom !== null && spec.dow !== null) return domOk || dowOk;
	return domOk && dowOk;
}

/**
 * First cron occurrence strictly after `afterMs`, or null when none exists
 * within the scan horizon (an unsatisfiable expression such as Feb 30).
 */
export function nextCronOccurrence(spec, timeZone, afterMs) {
	let t = (Math.floor(afterMs / MINUTE_MS) + 1) * MINUTE_MS;
	for (let i = 0; i < SCAN_LIMIT_MINUTES; i += 1, t += MINUTE_MS) {
		if (matches(spec, zonedFields(t, timeZone))) return t;
	}
	return null;
}

/**
 * Validate one job schedule config and return a normalized selector.
 * Exactly one of cron / everySeconds / at; cron requires an explicit zone.
 */
export function compileSchedule(schedule, jobName) {
	const kinds = ["cron", "everySeconds", "at"].filter((k) => schedule[k] !== undefined && schedule[k] !== null);
	if (kinds.length !== 1) {
		throw new CronInputError(`job '${jobName}': schedule must set exactly one of cron / everySeconds / at`);
	}
	if (schedule.cron !== undefined && schedule.cron !== null) {
		if (typeof schedule.timeZone !== "string" || schedule.timeZone === "") {
			throw new CronInputError(`job '${jobName}': cron schedules require an explicit IANA timeZone`);
		}
		const spec = parseCron(schedule.cron);
		formatterFor(schedule.timeZone);
		return { kind: "cron", spec, timeZone: schedule.timeZone };
	}
	if (schedule.everySeconds !== undefined && schedule.everySeconds !== null) {
		if (!Number.isSafeInteger(schedule.everySeconds) || schedule.everySeconds < 60) {
			throw new CronInputError(`job '${jobName}': everySeconds must be an integer >= 60`);
		}
		return { kind: "every", periodMs: schedule.everySeconds * 1000 };
	}
	const atMs = Date.parse(schedule.at);
	if (Number.isNaN(atMs)) {
		throw new CronInputError(`job '${jobName}': at must be an RFC 3339 instant with zone/offset, got '${schedule.at}'`);
	}
	if (!/([zZ]|[+-]\d{2}:\d{2})$/.test(schedule.at.trim())) {
		throw new CronInputError(`job '${jobName}': at must carry an explicit Z or numeric offset`);
	}
	return { kind: "at", atMs };
}

/**
 * First occurrence strictly after `afterMs` for a compiled selector.
 * `anchorMs` anchors `every` intervals (the job's first-seen instant).
 * Returns null when the selector has no future occurrence.
 */
export function nextOccurrence(selector, afterMs, anchorMs) {
	if (selector.kind === "cron") return nextCronOccurrence(selector.spec, selector.timeZone, afterMs);
	if (selector.kind === "every") {
		const base = Math.max(afterMs, anchorMs - selector.periodMs);
		const steps = Math.floor((base - anchorMs) / selector.periodMs) + 1;
		return anchorMs + Math.max(steps, 0) * selector.periodMs;
	}
	return selector.atMs > afterMs ? selector.atMs : null;
}

/**
 * Latest occurrence in (afterMs, nowMs], or null when none is due. This is
 * the single catch-up target: intermediate misses are skipped, never
 * enumerated (same policy as dsh-schedule's Every dispatch).
 */
export function latestDueOccurrence(selector, afterMs, nowMs, anchorMs) {
	let due = null;
	let t = afterMs;
	// Each step advances at least one occurrence; bounded by the scan horizon.
	for (let i = 0; i < SCAN_LIMIT_MINUTES; i += 1) {
		const next = nextOccurrence(selector, t, anchorMs);
		if (next === null || next > nowMs) break;
		due = next;
		t = next;
	}
	return due;
}
