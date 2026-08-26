import assert from "node:assert/strict";
import { test } from "node:test";
import { renderCronFraming, renderCronPrompt } from "../lib/executor.js";

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
