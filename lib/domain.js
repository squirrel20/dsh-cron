/**
 * dsh-cron — durable state declaration.
 *
 * Cron jobs are host assets, not session data, so their durable state lives
 * in the storage hub's domain layer (never in a session event log): one
 * `jobs` table for per-job dispatch state and one `runs` table as a bounded
 * run history. Record schemas are zod, per the storage-domain contract.
 * @module dsh-cron/domain
 */
import { z } from "zod";
import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";

/** Closed set of run outcomes; `running` is transient and repaired to `aborted` on boot; `killed` is a run stopped from the web overlay. */
export const RUN_STATUSES = [
	"running",
	"ok",
	"failed",
	"timeout",
	"skipped-overlap",
	"replaced",
	"aborted",
	"killed",
];

export const runRecordSchema = z.object({
	job: z.string(),
	seq: z.number().int(),
	/** The occurrence this run answers, RFC 3339 UTC. */
	target: z.string(),
	startedAt: z.string(),
	finishedAt: z.string().optional(),
	status: z.enum(RUN_STATUSES),
	/** Last assistant text (agent task) or output tail (command task), truncated. */
	summary: z.string(),
	sessionId: z.string().optional(),
	exitCode: z.number().int().optional(),
	error: z.string().optional(),
	/** True when the run was triggered by cron_run_now rather than the schedule. */
	manual: z.boolean().optional(),
});

export const jobStateSchema = z.object({
	/** Anchor instant for `everySeconds` alignment: the job's first-seen time. */
	anchorMs: z.number().int(),
	/** Target time of the last dispatched occurrence; 0 when never fired. Written BEFORE execution — the at-most-once guard. */
	lastFiredMs: z.number().int(),
	/** Monotonic run counter; never reused. */
	runSeq: z.number().int(),
	/** Conversational enable override (cron_enable/cron_disable); wins over config when set. */
	enabledOverride: z.boolean().optional(),
});

/** One overlay-created job: the raw config-shaped spec, re-normalized on every boot. */
export const manualJobSchema = z.object({
	/** Raw job entry exactly as {@link normalizeJobs} accepts it. */
	spec: z.any(),
	createdAt: z.string(),
});

/**
 * One plugin-registered job, as last seen from its provider.
 *
 * Unlike the manual table this is a PROJECTION, never a source of truth: the
 * spec lives in the provider's code and is re-registered on every boot. The
 * row exists for two jobs storage has to do anyway — it keeps the name in the
 * ledger's known-set (so a provider that mounts after the scheduler does not
 * find its run history swept as "removed"), and it lets the overlay show, and
 * let the user clear, a job whose provider is no longer installed.
 */
export const pluginJobSchema = z.object({
	/** Provider identity passed to registerJob, e.g. a package name. */
	owner: z.string(),
	/** Last registered spec; drives the orphan row's schedule/kind display. */
	spec: z.any(),
	createdAt: z.string(),
	/** Last time the provider registered this job — an orphan's age. */
	lastSeenAt: z.string(),
});

/**
 * The domain version stays 1 across the `plugin` table's arrival ON PURPOSE:
 * the json backend rejects a stored unit whose version differs from the
 * declared one (`version-mismatch`), which would take the whole scheduler —
 * every job's dispatch state included — down on the first boot after an
 * upgrade. Adding a table is backward compatible without a bump: a table
 * missing from the stored medium loads as empty. Bump only for a change that
 * makes existing records unreadable, and ship a migration with it.
 */
export const cronDomain = defineDomain({
	name: "cron",
	version: 1,
	tables: {
		runs: domainTable(runRecordSchema),
		jobs: domainTable(jobStateSchema),
		manual: domainTable(manualJobSchema),
		plugin: domainTable(pluginJobSchema),
	},
});
