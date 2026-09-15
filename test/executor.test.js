import assert from "node:assert/strict";
import { test } from "node:test";
import { renderCronFraming, renderCronPrompt, summarize } from "../lib/executor.js";

const job = (name, prompt = "do the thing") => ({ name, task: { prompt } });
const ISO = "2026-08-26T12:07:19.272Z";

test("renderCronFraming: framing only, no job prompt", () => {
	const text = renderCronFraming(job("t1"), ISO);
	assert.match(text, /^\[CRON RUN\]\n/);
	assert.match(text, /job: "t1"\n/);
	assert.match(text, new RegExp(`scheduled_for: ${ISO}`));
	assert.match(text, /unattended scheduled run/);
	assert.doesNotMatch(text, /do the thing/);
});

test("renderCronFraming: breaks {{ pairs in user-input job names", () => {
	const text = renderCronFraming(job("a{{evil}}b"), ISO);
	assert.doesNotMatch(text, /\{\{/);
	assert.match(text, /a\{ \{evil\}\}b/);
});

test("renderCronPrompt: fallback appends the job prompt after a blank line", () => {
	const text = renderCronPrompt(job("t1"), ISO);
	assert.equal(text, `${renderCronFraming(job("t1"), ISO)}\n\ndo the thing`);
});

const EVENTS = [
	{ seq: 0, type: "assistant/message", data: { message: { content: [{ type: "text", text: "stale" }] } } },
	{ seq: 1, type: "turn/start", data: {} },
	{ seq: 2, type: "assistant/message", data: { message: { content: [{ type: "text", text: "first" }] } } },
	{ seq: 3, type: "assistant/message", data: { message: { content: [{ type: "text", text: "final" }, { type: "tool_use" }] } } },
	{ seq: 4, type: "turn/end", data: { reason: { kind: "completed" } } },
];

test("summarize: legacy event array — only the owned interval after turn/start counts", () => {
	const out = summarize(EVENTS, 1);
	assert.equal(out.text, "final");
	assert.deepEqual(out.reason, { kind: "completed" });
	assert.equal(summarize(EVENTS, 5).text, "");
});

test("summarize: legacy session object with an events array", () => {
	assert.equal(summarize({ events: EVENTS, seq: 5 }, 1).text, "final");
});

test("summarize: V3 session exposes events via eventAt(seq) only", () => {
	const session = { seq: EVENTS.length, eventAt: (seq) => EVENTS[seq] };
	const out = summarize(session, 1);
	assert.equal(out.text, "final");
	assert.deepEqual(out.reason, { kind: "completed" });
	assert.equal(summarize(session, 4).text, "");
	assert.throws(() => summarize({ seq: 3, eventAt: () => undefined }, 1), /cannot read seq 1/);
});
