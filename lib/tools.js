/**
 * dsh-cron — conversational management tools.
 *
 * Seven agent-visible tools over the live scheduler: `cron_list`,
 * `cron_runs`, `cron_run_now`, `cron_enable`, `cron_disable`, plus the
 * manual-job overlay `cron_create` / `cron_delete`. Config jobs stay
 * declarative (created and deleted only in profile config); manual jobs are
 * created conversationally through the same normalizeJobs vocabulary the web
 * dialog uses, guided by the `cron-create` skill (./skill.js). Registration
 * follows the dsh-schedule pattern: one registration per root agent scope,
 * disposed with the agent.
 * @module dsh-cron/tools
 */
import { defineTool } from "@deepseek-ai/dsh-tools";
import { buildJobSpec } from "./service.js";

/** Build one exact two-field error schema while preserving its literal code. */
function basicErrorSchema(code) {
	return {
		type: "object",
		additionalProperties: false,
		properties: {
			code: { type: "string", required: true, const: code },
			message: { type: "string", required: true },
		},
	};
}

const ERROR_SCHEMAS = [
	basicErrorSchema("job_not_found"),
	basicErrorSchema("already_running"),
	basicErrorSchema("scheduler_unavailable"),
	basicErrorSchema("internal_error"),
];

const LAST_RUN_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		seq: { type: "integer", required: true },
		status: { type: "string", required: true },
		target: { type: "string", required: true },
		finishedAt: { type: "string" },
	},
};

const JOB_VIEW_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		name: { type: "string", required: true },
		kind: { type: "string", required: true, enum: ["agent", "command"] },
		schedule: { type: "string", required: true },
		enabled: { type: "boolean", required: true },
		enabledSource: { type: "string", required: true, enum: ["config", "override"] },
		source: { type: "string", required: true, enum: ["config", "manual"] },
		running: { type: "boolean", required: true },
		next: { type: "string" },
		lastRun: LAST_RUN_SCHEMA,
	},
};

const RUN_VIEW_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		job: { type: "string", required: true },
		seq: { type: "integer", required: true },
		target: { type: "string", required: true },
		startedAt: { type: "string", required: true },
		status: { type: "string", required: true },
		summary: { type: "string", required: true },
		finishedAt: { type: "string" },
		sessionId: { type: "string" },
		exitCode: { type: "integer" },
		error: { type: "string" },
		manual: { type: "boolean" },
	},
};

const LIST_OUTPUT_SCHEMA = {
	oneOf: [{ type: "array", items: JOB_VIEW_SCHEMA }, ...ERROR_SCHEMAS],
};

const RUNS_OUTPUT_SCHEMA = {
	oneOf: [{ type: "array", items: RUN_VIEW_SCHEMA }, ...ERROR_SCHEMAS],
};

const RUN_NOW_OUTPUT_SCHEMA = {
	oneOf: [
		{
			type: "object",
			additionalProperties: false,
			properties: {
				job: { type: "string", required: true },
				seq: { type: "integer", required: true },
				target: { type: "string", required: true },
				started: { type: "boolean", required: true, const: true },
			},
		},
		...ERROR_SCHEMAS,
	],
};

const TOGGLE_OUTPUT_SCHEMA = {
	oneOf: [
		{
			type: "object",
			additionalProperties: false,
			properties: {
				job: { type: "string", required: true },
				enabled: { type: "boolean", required: true },
				changed: { type: "boolean", required: true },
			},
		},
		...ERROR_SCHEMAS,
	],
};

const CREATE_OUTPUT_SCHEMA = {
	oneOf: [
		{
			type: "object",
			additionalProperties: false,
			properties: {
				job: { ...JOB_VIEW_SCHEMA, required: true },
			},
		},
		basicErrorSchema("invalid_job"),
		basicErrorSchema("job_exists"),
		...ERROR_SCHEMAS,
	],
};

const DELETE_OUTPUT_SCHEMA = {
	oneOf: [
		{
			type: "object",
			additionalProperties: false,
			properties: {
				job: { type: "string", required: true },
				deleted: { type: "boolean", required: true, const: true },
			},
		},
		basicErrorSchema("config_job"),
		...ERROR_SCHEMAS,
	],
};

/** cron_create parameter blocks; the vocabulary mirrors normalizeJobs exactly. */
const SCHEDULE_PARAM = {
	type: "object",
	additionalProperties: false,
	required: true,
	description:
		"When the job fires. Set EXACTLY ONE of cron / everySeconds / at; a cron expression additionally requires an IANA timeZone.",
	properties: {
		cron: { type: "string", description: "Five-field cron expression 'M H DOM MON DOW' (e.g. '30 7 * * 1-5'). Requires timeZone." },
		timeZone: { type: "string", description: "IANA time zone the cron expression is evaluated in, e.g. 'Asia/Singapore'. No abbreviations or fixed offsets." },
		everySeconds: { type: "integer", description: "Fixed interval in seconds, minimum 60, anchor-aligned from creation." },
		at: { type: "string", description: "One-shot RFC 3339 timestamp, e.g. '2026-09-01T09:00:00+08:00'." },
	},
};

const TASK_PARAM = {
	type: "object",
	additionalProperties: false,
	required: true,
	description:
		"What one occurrence executes. kind 'agent' runs a fresh headless one-shot agent from prompt (the prompt must stand alone — the run has no session context); kind 'command' spawns argv exec-style with no shell interpretation.",
	properties: {
		kind: { type: "string", required: true, enum: ["agent", "command"] },
		prompt: { type: "string", description: "Agent tasks: the standalone instruction the headless agent receives. Required for kind 'agent'." },
		argv: { type: "array", items: { type: "string" }, description: "Command tasks: exec-style argv, e.g. ['/bin/sh', '-c', '…']. Required for kind 'command'." },
		cwd: { type: "string", description: "Working directory for the run; omit for the host default." },
		provider: { type: "string", description: "Agent tasks: LLM provider override; omit for the host default." },
		model: { type: "string", description: "Agent tasks: model override; omit for the host default." },
		effort: { type: "string", description: "Agent tasks: reasoning-effort override; omit for the host default." },
		preset: { type: "string", description: "Agent tasks: agent preset override; omit for the host default." },
		access: { type: "string", description: "Agent tasks: tool-access profile override; omit for the host default." },
		timeoutSeconds: { type: "integer", description: "Per-run wall-clock cap in seconds (default 1800)." },
	},
};

const POLICY_PARAM = {
	type: "object",
	additionalProperties: false,
	description:
		"Dispatch policy. overlap: what a due occurrence does while the previous run is in flight (default skip). misfire: whether occurrences missed while the host was down or the job disabled fire one catch-up run (default skip).",
	properties: {
		overlap: { type: "string", enum: ["skip", "queue", "replace"] },
		misfire: { type: "string", enum: ["skip", "runOnce"] },
	},
};

const DELIVERY_PARAM = {
	type: "object",
	additionalProperties: false,
	description:
		"Optional notifier: a command fed the settled run record as JSON on stdin after each run (60s cap). onlyOnFailure default true.",
	properties: {
		argv: { type: "array", items: { type: "string" }, description: "Exec-style notifier argv." },
		onlyOnFailure: { type: "boolean", description: "Notify only for unsuccessful runs (default true)." },
	},
};

const LIST_DESCRIPTION =
	"List every host-plane cron job: task kind, schedule, effective enabled state (profile config or a conversational override), whether a run is in flight, the next occurrence (UTC), and the latest run outcome. source 'config' jobs are declared in profile config (read-only here); source 'manual' jobs were created at runtime and can be removed with cron_delete. Use cron_create to add a manual job, cron_enable/cron_disable to toggle dispatch, and cron_run_now to trigger one manually.";

const RUNS_DESCRIPTION =
	"Read recent cron run records, newest first: status (ok|failed|timeout|skipped-overlap|replaced|aborted|killed|running), the occurrence answered, a bounded summary (agent's final text or command output tail), the persisted sessionId for agent runs, and manual true for cron_run_now triggers. Optionally filter to one job; history is bounded per job.";

const RUN_NOW_DESCRIPTION =
	"Trigger one cron job immediately, outside its schedule. Returns as soon as the run has started (non-blocking) — check cron_runs for the outcome. The manual run does not consume or shift any scheduled occurrence, and works even on a disabled job. Fails with already_running while the job has a run in flight.";

const ENABLE_DESCRIPTION =
	"Enable one cron job by persisting a conversational override on top of the profile config's enabled flag; the override survives host restarts. Occurrences missed while a misfire:skip job was disabled are forgotten; a misfire:runOnce job catches up its single latest missed occurrence.";

const DISABLE_DESCRIPTION =
	"Disable one cron job by persisting a conversational override on top of the profile config's enabled flag; the override survives host restarts. Disabling stops future dispatches but never cancels a run already in flight. Re-enable with cron_enable.";

const CREATE_DESCRIPTION =
	"Create one manual cron job at runtime: an unattended 'agent' task (fresh headless one-shot agent per occurrence) or 'command' task (spawned process) on a cron/interval/one-shot schedule. The spec is validated by the same vocabulary as profile-config jobs, persisted durably (survives host restarts), and scheduled from now — it never back-fills occurrences predating its creation. Load the cron-create skill for the full workflow before first use. Show the user the exact spec and confirm before creating; a duplicate name fails with job_exists, a defective spec with invalid_job naming the field. Undo with cron_delete.";

const DELETE_DESCRIPTION =
	"Delete one manual cron job together with its entire run history (releasing its headless session files to garbage collection). Only jobs created at runtime (source 'manual' in cron_list) can be deleted — profile-config jobs fail with config_job and must be removed in profile config; a job with a run in flight fails with already_running. Deletion is permanent: confirm with the user first.";

/** Deterministic model content for every canonical value. */
function renderValue(_args, value) {
	return [{ type: "text", text: JSON.stringify(value) }];
}

/** Pure generic pending card. */
function present(title, kind, rawInput) {
	return {
		card: "generic",
		title,
		kind,
		...(rawInput === undefined ? {} : { rawInput }),
	};
}

/** Stable error for failures not safe to expose. */
function internalError() {
	return { code: "internal_error", message: "The cron operation failed." };
}

/** Stable error while the scheduler is not (yet) mounted. */
function unavailableError() {
	return {
		code: "scheduler_unavailable",
		message: "The cron scheduler is not running on this host.",
	};
}

/**
 * Register the seven cron tools in one exact agent scope.
 * @param rootCtx - global plugin context (logging).
 * @param toolCtx - agent-scoped context receiving the definitions.
 * @param agent - exact live owner the tools are scoped to.
 * @param getService - returns the live {@link CronService} or null.
 * @returns Idempotent aggregate disposer for the seven registrations.
 */
export function registerCronTools(rootCtx, toolCtx, agent, getService) {
	const disposers = [];
	/** The live, started service — or null when tools must refuse. */
	const ready = () => {
		const service = getService();
		return service !== null && service.domain !== null ? service : null;
	};
	try {
		disposers.push(toolCtx.tools.register(defineTool({
			name: "cron_list",
			description: LIST_DESCRIPTION,
			parameters: {},
			output: { schema: LIST_OUTPUT_SCHEMA, render: renderValue },
			async execute(_args, exec) {
				if (exec.agent !== agent) return internalError();
				const service = ready();
				if (service === null) return unavailableError();
				try {
					return service.listView();
				} catch (error) {
					rootCtx.logger.warn(`cron: cron_list failed: ${String(error)}`);
					return internalError();
				}
			},
			presentCall: () => present("List cron jobs", "read"),
		})));
		disposers.push(toolCtx.tools.register(defineTool({
			name: "cron_runs",
			description: RUNS_DESCRIPTION,
			parameters: {
				job: {
					type: "string",
					description: "Restrict to one job by exact name; omit for all jobs.",
				},
				limit: {
					type: "integer",
					description: "Maximum records to return, 1-100 (default 20).",
				},
			},
			output: { schema: RUNS_OUTPUT_SCHEMA, render: renderValue },
			async execute(args, exec) {
				if (exec.agent !== agent) return internalError();
				if (args.limit !== undefined && (!Number.isSafeInteger(args.limit) || args.limit < 1 || args.limit > 100)) {
					return { code: "internal_error", message: "limit must be an integer between 1 and 100." };
				}
				const service = ready();
				if (service === null) return unavailableError();
				try {
					return service.runsView(args.job, args.limit ?? 20);
				} catch (error) {
					rootCtx.logger.warn(`cron: cron_runs failed: ${String(error)}`);
					return internalError();
				}
			},
			presentCall: (args) => present("List cron runs", "read", args.job),
		})));
		disposers.push(toolCtx.tools.register(defineTool({
			name: "cron_run_now",
			description: RUN_NOW_DESCRIPTION,
			parameters: {
				job: { type: "string", required: true, description: "Exact job name from cron_list." },
			},
			output: { schema: RUN_NOW_OUTPUT_SCHEMA, render: renderValue },
			async execute(args, exec) {
				if (exec.agent !== agent) return internalError();
				const service = ready();
				if (service === null) return unavailableError();
				try {
					return await service.runNow(args.job);
				} catch (error) {
					rootCtx.logger.warn(`cron: cron_run_now failed: ${String(error)}`);
					return internalError();
				}
			},
			presentCall: (args) => present("Run cron job now", "other", args.job),
		})));
		disposers.push(toolCtx.tools.register(defineTool({
			name: "cron_enable",
			description: ENABLE_DESCRIPTION,
			parameters: {
				job: { type: "string", required: true, description: "Exact job name from cron_list." },
			},
			output: { schema: TOGGLE_OUTPUT_SCHEMA, render: renderValue },
			async execute(args, exec) {
				if (exec.agent !== agent) return internalError();
				const service = ready();
				if (service === null) return unavailableError();
				try {
					return await service.setEnabled(args.job, true);
				} catch (error) {
					rootCtx.logger.warn(`cron: cron_enable failed: ${String(error)}`);
					return internalError();
				}
			},
			presentCall: (args) => present("Enable cron job", "other", args.job),
		})));
		disposers.push(toolCtx.tools.register(defineTool({
			name: "cron_disable",
			description: DISABLE_DESCRIPTION,
			parameters: {
				job: { type: "string", required: true, description: "Exact job name from cron_list." },
			},
			output: { schema: TOGGLE_OUTPUT_SCHEMA, render: renderValue },
			async execute(args, exec) {
				if (exec.agent !== agent) return internalError();
				const service = ready();
				if (service === null) return unavailableError();
				try {
					return await service.setEnabled(args.job, false);
				} catch (error) {
					rootCtx.logger.warn(`cron: cron_disable failed: ${String(error)}`);
					return internalError();
				}
			},
			presentCall: (args) => present("Disable cron job", "other", args.job),
		})));
		disposers.push(toolCtx.tools.register(defineTool({
			name: "cron_create",
			description: CREATE_DESCRIPTION,
			parameters: {
				name: {
					type: "string",
					required: true,
					description: "Job name matching ^[a-z][a-z0-9-]*$, unique across all jobs (check cron_list first).",
				},
				schedule: SCHEDULE_PARAM,
				task: TASK_PARAM,
				policy: POLICY_PARAM,
				delivery: DELIVERY_PARAM,
				enabled: {
					type: "boolean",
					description: "Whether the job dispatches; omit for true.",
				},
			},
			output: { schema: CREATE_OUTPUT_SCHEMA, render: renderValue },
			async execute(args, exec) {
				if (exec.agent !== agent) return internalError();
				const service = ready();
				if (service === null) return unavailableError();
				try {
					return await service.addJob(buildJobSpec(args));
				} catch (error) {
					rootCtx.logger.warn(`cron: cron_create failed: ${String(error)}`);
					return internalError();
				}
			},
			presentCall: (args) => present("Create cron job", "other", args.name),
		})));
		disposers.push(toolCtx.tools.register(defineTool({
			name: "cron_delete",
			description: DELETE_DESCRIPTION,
			parameters: {
				job: { type: "string", required: true, description: "Exact job name from cron_list; must have source 'manual'." },
			},
			output: { schema: DELETE_OUTPUT_SCHEMA, render: renderValue },
			async execute(args, exec) {
				if (exec.agent !== agent) return internalError();
				const service = ready();
				if (service === null) return unavailableError();
				try {
					return await service.deleteJob(args.job);
				} catch (error) {
					rootCtx.logger.warn(`cron: cron_delete failed: ${String(error)}`);
					return internalError();
				}
			},
			presentCall: (args) => present("Delete cron job", "other", args.job),
		})));
	} catch (error) {
		for (const dispose of disposers.reverse()) dispose();
		throw error;
	}
	let active = true;
	return () => {
		if (!active) return;
		active = false;
		for (const dispose of disposers.reverse()) dispose();
	};
}
