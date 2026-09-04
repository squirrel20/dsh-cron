/**
 * dsh-cron — conversational job-creation skill.
 *
 * One runtime skill, registered into the host's global skill layer, that
 * teaches a session agent the full create-a-cron-job workflow: collect the
 * requirement, check the name against cron_list, confirm the exact spec with
 * the user, call cron_create, verify, and undo with cron_delete. The skill is
 * pure instructions — the spec vocabulary it documents is enforced by
 * normalizeJobs, so the text and the validator must stay in step.
 *
 * The module is dependency-free on purpose: the registration body runs behind
 * `ctx.inject(["skills"], …)`, so a host without the skill registry mounts
 * the scheduler unchanged and simply never registers the skill.
 * @module dsh-cron/skill
 */

/** Kebab-case skill name; also the user-facing `/cron-create` command. */
export const CRON_SKILL_NAME = "cron-create";

const DESCRIPTION =
	"Create an unattended scheduled job (cron) on this host from the conversation: agent prompts or shell commands on cron/interval/one-shot schedules, managed with the cron_* tools.";

const WHEN_TO_USE =
	"Use when the user wants something to run on a schedule or unattended — \"every morning\", \"each hour\", \"at 9pm\", \"run this daily\", \"schedule a job/pipeline/report\" — or asks to change or remove such a job.";

const CONTENT = `# Creating cron jobs from a session

This host runs the dsh-cron scheduler: jobs execute unattended, with no session attached — an \`agent\` task runs a fresh one-shot headless agent, a \`command\` task spawns a process. Jobs created here are "manual" jobs: they live in host storage next to the profile-declared ("config") jobs and survive host restarts.

## Workflow

1. **Collect the requirement.** What should run (an agent prompt or an exec-style command), on what schedule, and under what name (kebab-case ASCII by convention; letters of any script, digits, \`-\` and \`_\` are accepted). Prompts for agent tasks must stand alone: the headless run has none of this conversation's context.
2. **Check the name.** Call \`cron_list\` — the name must be free, and existing jobs show the local naming conventions.
3. **Confirm with the user.** Show the exact spec you intend to create (a standing job is persistent behavior) and get a clear yes before creating it. Skip this only when the user already dictated every field.
4. **Create.** Call \`cron_create\`. Validation is loud: an \`invalid_job\` error names the defective field — fix it and retry.
5. **Verify.** \`cron_list\` shows the new job with \`source: "manual"\` and its next occurrence (UTC). Offer a smoke test via \`cron_run_now\` and read the outcome with \`cron_runs\`.
6. **Undo / remove.** \`cron_delete\` removes a manual job and its run history (refused while a run is in flight). Config-declared jobs are read-only here — point the user at the profile config for those; \`source: "plugin"\` jobs belong to the plugin named in \`owner\` and are removed by uninstalling it (an \`orphan: true\` row is the leftover history of a plugin that is already gone, and deleting it only clears that).

## Spec vocabulary

- \`name\` — required, must match \`^[\\p{L}\\p{N}][\\p{L}\\p{N}_-]*$\` (any-script letters, digits, \`-\`, \`_\`; no spaces), unique across all jobs.
- \`description\` — optional short one-liner saying what the job does; shown in \`cron_list\` and the web overlay. Provide one when creating jobs so future readers know each job's purpose at a glance.
- \`schedule\` — required, **exactly one** of:
  - \`{ "cron": "M H DOM MON DOW", "timeZone": "Asia/Singapore" }\` — five-field cron expression; \`timeZone\` is a **required** IANA zone (no abbreviations, no offsets).
  - \`{ "everySeconds": 3600 }\` — fixed interval, integer, minimum 60.
  - \`{ "at": "2026-09-01T09:00:00+08:00" }\` — one-shot RFC 3339 timestamp.
- \`task\` — required:
  - Agent task: \`{ "kind": "agent", "prompt": "…" }\` plus optional \`cwd\`, \`provider\`, \`model\`, \`effort\`, \`preset\`, \`access\`, \`timeoutSeconds\` (default 1800). Omit provider/model/effort/preset/access unless the user asks — omitted fields use the host defaults.
  - Command task: \`{ "kind": "command", "argv": ["/bin/sh", "-c", "…"] }\` plus optional \`cwd\`, \`timeoutSeconds\`. \`argv\` is exec-style — no shell interpretation unless you invoke a shell yourself.
- \`policy\` — optional: \`{ "overlap": "skip" | "queue" | "replace", "misfire": "skip" | "runOnce" }\`, both default \`"skip"\`. \`overlap\` decides what a due occurrence does while the previous run is still in flight; \`misfire\` decides whether occurrences missed while the host was down (or the job disabled) fire one catch-up run.
- \`delivery\` — optional: \`{ "argv": ["…"], "onlyOnFailure": true }\` — a notifier command fed the settled run record on stdin after each run (60s cap), by default only for failed runs.
- \`enabled\` — optional boolean, default true.

## Cautions

- Reach for a \`cron\` schedule with the user's own time zone rather than \`everySeconds\` arithmetic when the user says "every day at …".
- The web overlay's job dialog builds schedules from trigger presets — hourly / daily / weekdays / weekly — that compile to the plain cron shapes \`M * * * *\`, \`M H * * *\`, \`M H * * 1-5\`, \`M H * * DOW\`, and maps those shapes back onto the presets when a job is edited (the dialog never shows a time-zone field; it uses the browser's current zone). Prefer these shapes for everyday schedules so the job stays preset-editable in the dialog; any other expression is still valid but lands in the dialog's "custom" drawer.
- Agent runs execute with real tool access and nobody watching: keep prompts narrow, prefer read-and-report over write-and-hope, and set a realistic \`timeoutSeconds\`.
- The other cron tools also work on config and plugin jobs: \`cron_enable\`/\`cron_disable\` toggle dispatch, \`cron_run_now\` fires a manual run.
- When the schedule belongs with a piece of software rather than with this host — a package that ships both a script and the cadence it should run at — the right home is a provider plugin calling \`ctx.cron.registerJob\`, not a manual job. Say so instead of creating one, so uninstalling the package also retires its jobs.
`;

/**
 * The complete runtime skill registration, exported for tests and reuse.
 * `source: "runtime"` marks the origin bucket; invocation defaults permit
 * both model and user (`/cron-create`) surfaces.
 */
export const CRON_SKILL = {
	name: CRON_SKILL_NAME,
	description: DESCRIPTION,
	whenToUse: WHEN_TO_USE,
	content: CONTENT,
	source: "runtime",
};

/**
 * Register the skill once the host's skill registry is available. The inner
 * fiber starts only when a `skills` service exists, so hosts composed without
 * the skill seam run the scheduler untouched; the registration disposes with
 * the plugin scope.
 * @param ctx - global plugin context.
 */
export function registerCronSkill(ctx) {
	ctx.inject(["skills"], (skillCtx) => {
		skillCtx.skills.register(CRON_SKILL);
	});
}
