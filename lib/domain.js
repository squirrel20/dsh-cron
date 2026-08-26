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

/** Closed set of run outcomes; `running` is transient and repaired to `aborted` on boot. */
export const RUN_STATUSES = [
	"running",
	"ok",
	"failed",
	"timeout",
	"skipped-overlap",
	"replaced",
	"aborted",
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
});

export const jobStateSchema = z.object({
	/** Anchor instant for `everySeconds` alignment: the job's first-seen time. */
	anchorMs: z.number().int(),
	/** Target time of the last dispatched occurrence; 0 when never fired. Written BEFORE execution — the at-most-once guard. */
	lastFiredMs: z.number().int(),
	/** Monotonic run counter; never reused. */
	runSeq: z.number().int(),
});

export const cronDomain = defineDomain({
	name: "cron",
	version: 1,
	tables: {
		runs: domainTable(runRecordSchema),
		jobs: domainTable(jobStateSchema),
	},
});

/** Fixed-width run key so lexicographic order equals run order per job. */
export function runKey(jobName, seq) {
	return `${jobName}#${String(seq).padStart(10, "0")}`;
}
