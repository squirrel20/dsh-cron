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
 * Conversational surface: five agent-scoped tools (cron_list / cron_runs /
 * cron_run_now / cron_enable / cron_disable) observe and steer the declared
 * jobs — see ./tools.js. A read-only web overlay (sidebar foot, ./client.js)
 * observes the same views over one HTTP route — see ./web.js. Session files left behind by pruned agent runs are
 * garbage-collected against the run-history ledger — see ./gc.js.
 *
 * This module is only the cordis assembly; the scheduling core is
 * ./service.js.
 * @module dsh-cron
 */
import z from "@deepseek-ai/schemastery";
import { normalizeGcConfig } from "./gc.js";
import { CronService, normalizeJobs } from "./service.js";
import { registerCronTools } from "./tools.js";
import { registerCronWeb } from "./web.js";

export { CronService, createControl, newCronSessionId, normalizeJobs, runKey } from "./service.js";

/** Cordis function-plugin name. */
export const name = "cron";

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
	maxConcurrentRuns: z.number().default(1),
	sessionGc: z.any(),
});

/** Mount the scheduler and its conversational tools; config defects fail the mount loudly. */
export function apply(ctx, config) {
	const jobs = normalizeJobs(config.jobs);
	const gcConfig = normalizeGcConfig(config.sessionGc);
	/** The live service, visible to tools registered on any agent scope. */
	let live = null;
	ctx.effect(() => {
		const service = new CronService(ctx, config, jobs, gcConfig);
		live = service;
		const ready = service.start().catch((error) => {
			ctx.logger.error(`cron: startup failed: ${String(error)}`);
		});
		return async () => {
			live = null;
			await ready;
			await service.dispose();
		};
	}, "cron.lifecycle()");
	registerCronWeb(ctx, () => live);
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
