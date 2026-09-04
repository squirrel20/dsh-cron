/**
 * dsh-cron — unattended scheduled jobs for the DeepSeek Harness.
 *
 * A HOST-plane plugin: jobs are declared in plugin config (versioned with the
 * profile), durable dispatch state and run history live in the storage
 * domain layer, and a due occurrence executes with no session attached — an
 * `agent` task runs a fresh one-shot agent (the dsh-headless recipe), a
 * `command` task spawns a process. This is deliberately NOT dsh-schedule:
 * that package delivers reminders into a live interactive session; this one
 * runs pipelines while nobody is watching.
 *
 * Reliability contract: at-most-once per occurrence (dispatch state reaches
 * durability before execution starts), no replay of missed occurrences
 * (misfire policy fires at most one catch-up run at the latest due target),
 * and runs interrupted by a host restart are repaired to `aborted` on boot.
 *
 * Three authors can declare a job: the profile config below, a user at
 * runtime (the web dialog / `cron_create`, persisted as "manual" jobs), and
 * another plugin through the `cron` service — see {@link JobRegistry}.
 *
 * Conversational surface: seven agent-scoped tools (cron_list / cron_runs /
 * cron_run_now / cron_enable / cron_disable / cron_create / cron_delete)
 * observe, steer, and — for runtime "manual" jobs — create and remove jobs,
 * see ./tools.js; a runtime skill (`cron-create`, ./skill.js) teaches session
 * agents the create workflow and the spec vocabulary. A sidebar section (Workspaces-grade list with run
 * history, session jump-through, and a create/edit dialog; ./client.js)
 * observes and steers the same views over HTTP routes — see ./web.js. Session files left behind by pruned agent runs are
 * garbage-collected against the run-history ledger — see ./gc.js.
 *
 * This module is only the cordis assembly; the scheduling core is
 * ./service.js.
 * @module dsh-cron
 */
import z from "@deepseek-ai/schemastery";
import { normalizeGcConfig } from "./gc.js";
import { JobRegistry } from "./registry.js";
import { CronService, normalizeJobs } from "./service.js";
import { registerCronSkill } from "./skill.js";
import { registerCronTools } from "./tools.js";
import { registerCronWeb } from "./web.js";

export { CronService, buildJobSpec, createControl, newCronSessionId, normalizeJobs, runKey } from "./service.js";
export {
	JobNameReservedError,
	JobOwnerConflictError,
	JobRegistry,
	MissingOwnerError,
} from "./registry.js";
export { CRON_SKILL, CRON_SKILL_NAME } from "./skill.js";

/** Cordis function-plugin name. */
export const name = "cron";

/**
 * The service handed to other plugins: `ctx.cron.registerJob(spec, { owner })`
 * (and `registerJobs` for a batch).
 *
 * This is the third way a job reaches the scheduler, next to profile config
 * and the runtime "manual" jobs the web dialog and `cron_create` write. Here
 * the author is a package: a plugin ships its schedules alongside the scripts
 * they run, installing it creates the jobs and unmounting it retires them —
 * no spec transcribed into a dialog, no config hand-edited per host. Storage,
 * run history, overlay and tools are unchanged; a plugin job is the same
 * thing as any other job, only its `source` differs. See {@link JobRegistry}.
 */
export const provide = "cron";

/** Host services required before the scheduler can start. */
export const inject = [
	"storage",
	"storageDomain",
	"agents",
	"agentDefaultModel",
	"sessions",
	"tools",
];

/**
 * Plugin config. Job entries are validated by {@link normalizeJobs} (closed
 * vocabulary, loud diagnostics) rather than schema defaults, so a
 * misconfigured job names itself in the error; the sessionGc block gets the
 * same treatment in normalizeGcConfig.
 */
export const Config = z.object({
	jobs: z.array(z.any()).default([]),
	historyLimit: z.number().default(50),
	// 0 = unbounded: unrelated jobs have no reason to wait on each other, and
	// a job's own overlap is already governed by policy.overlap. Set a positive
	// number only to deliberately cap host-wide load.
	maxConcurrentRuns: z.number().default(0),
	sessionGc: z.any(),
});

/** Mount the scheduler and its conversational tools; config defects fail the mount loudly. */
export function apply(ctx, config) {
	const jobs = normalizeJobs(config.jobs);
	const gcConfig = normalizeGcConfig(config.sessionGc);
	/** The live service, visible to tools registered on any agent scope. */
	let live = null;
	/**
	 * Plugin-registered jobs. Built outside the effect on purpose: it is the
	 * facade provider plugins hold, so it must outlive any single service
	 * instance — dsh-cron reloading must not silently drop their registrations.
	 */
	const registry = new JobRegistry({
		getService: () => live,
		isConfigName: (name) => jobs.some((job) => job.name === name),
		logger: ctx.logger,
	});
	// Provide before the service exists: a provider's apply may run first, so
	// registerJob admits synchronously and attaches on a queue (see registry).
	ctx.provide("cron", registry.api);
	ctx.effect(() => {
		const service = new CronService(ctx, config, jobs, gcConfig);
		live = service;
		const ready = service.start().then(() => {
			// Replay the registry: covers both "the provider mounted first" and
			// "this is a new service instance after a reload".
			return registry.flush();
		}).catch((error) => {
			ctx.logger.error(`cron: startup failed: ${String(error)}`);
		});
		return async () => {
			live = null;
			await ready;
			await service.dispose();
		};
	}, "cron.lifecycle()");
	registerCronWeb(ctx, () => live);
	registerCronSkill(ctx);
	ctx.effect(() => {
		return ctx.on("agent/created", ({ agent }) => {
			if (!ctx.agents.roots().includes(agent)) return;
			agent.ctx.effect(
				() => registerCronTools(ctx, agent.ctx, agent, () => live),
				"cron.tools()",
			);
		});
	}, "cron.tools-lifecycle()");
}
