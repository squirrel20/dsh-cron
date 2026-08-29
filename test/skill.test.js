import assert from "node:assert/strict";
import { test } from "node:test";
import { buildJobSpec, normalizeJobs } from "../lib/service.js";
import { CRON_SKILL, CRON_SKILL_NAME, registerCronSkill } from "../lib/skill.js";

test("CRON_SKILL is a valid runtime registration", () => {
	assert.match(CRON_SKILL_NAME, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
	assert.equal(CRON_SKILL.name, CRON_SKILL_NAME);
	assert.ok(CRON_SKILL.description.length > 0);
	assert.ok(CRON_SKILL.whenToUse.length > 0);
	assert.equal(CRON_SKILL.source, "runtime");
});

test("skill content teaches the tools and the validator's vocabulary", () => {
	const content = CRON_SKILL.content;
	for (const tool of ["cron_list", "cron_create", "cron_delete", "cron_run_now", "cron_runs"]) {
		assert.ok(content.includes(tool), `content must mention ${tool}`);
	}
	// The vocabulary section must stay in step with normalizeJobs.
	for (const term of ["everySeconds", "timeZone", "RFC 3339", "overlap", "misfire", "timeoutSeconds", "onlyOnFailure"]) {
		assert.ok(content.includes(term), `content must document ${term}`);
	}
	assert.ok(content.includes("[a-z][a-z0-9-]*"), "content must state the job-name grammar");
});

test("registerCronSkill defers to the skills service and registers CRON_SKILL", () => {
	const registered = [];
	let injected;
	const ctx = {
		inject(deps, callback) {
			injected = deps;
			callback({ skills: { register: (skill) => registered.push(skill) } });
		},
	};
	registerCronSkill(ctx);
	assert.deepEqual(injected, ["skills"]);
	assert.equal(registered.length, 1);
	assert.equal(registered[0], CRON_SKILL);
});

test("buildJobSpec keeps only provided blocks and drops undefined keys", () => {
	const spec = buildJobSpec({
		name: "daily-brief",
		schedule: { cron: "30 7 * * *", timeZone: "Asia/Singapore", everySeconds: undefined, at: undefined },
		task: { kind: "agent", prompt: "Summarize the overnight logs.", argv: undefined, model: undefined },
		policy: undefined,
		delivery: undefined,
		enabled: undefined,
	});
	assert.deepEqual(spec, {
		name: "daily-brief",
		schedule: { cron: "30 7 * * *", timeZone: "Asia/Singapore" },
		task: { kind: "agent", prompt: "Summarize the overnight logs." },
	});
	// The clean spec must round-trip the shared validator.
	const [job] = normalizeJobs([spec]);
	assert.equal(job.name, "daily-brief");
	assert.equal(job.task.kind, "agent");
	assert.equal(job.policy.overlap, "skip");
});

test("buildJobSpec forwards optional policy, delivery, and enabled", () => {
	const spec = buildJobSpec({
		name: "nightly-sync",
		description: "hourly workspace sync",
		schedule: { everySeconds: 3600 },
		task: { kind: "command", argv: ["/bin/true"] },
		policy: { overlap: "queue", misfire: undefined },
		delivery: { argv: ["/usr/bin/notify"], onlyOnFailure: false },
		enabled: false,
	});
	assert.equal(spec.description, "hourly workspace sync");
	assert.deepEqual(spec.policy, { overlap: "queue" });
	assert.deepEqual(spec.delivery, { argv: ["/usr/bin/notify"], onlyOnFailure: false });
	assert.equal(spec.enabled, false);
	const [job] = normalizeJobs([spec]);
	assert.equal(job.enabled, false);
	assert.equal(job.policy.overlap, "queue");
	assert.equal(job.delivery.onlyOnFailure, false);
});

test("buildJobSpec leaves validation to normalizeJobs, which stays loud", () => {
	const spec = buildJobSpec({ name: "broken", schedule: {}, task: { kind: "agent" } });
	assert.throws(() => normalizeJobs([spec]), /exactly one of cron \/ everySeconds \/ at/);
});
