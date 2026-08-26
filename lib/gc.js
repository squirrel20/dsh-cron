/**
 * dsh-cron — session file garbage collection.
 *
 * Agent runs persist one-shot sessions under the jsonl backend's layout
 * (`<root>/<project-key>/<session-id>/`). The run history is the ledger of
 * which sessions are still worth keeping: a `cron-*` session directory whose
 * id no other run record references is an orphan — its record was pruned
 * from the bounded history (or belonged to a job no longer declared) — and
 * gets removed. The scheduler writes `sessionId` into the run record BEFORE
 * the agent is created, so an in-flight run is always referenced; the mtime
 * grace window only guards against foreign clocks and half-created dirs.
 *
 * Ownership discipline: only directories matching the exact
 * `cron-<job>-<uuid>` naming this plugin generates are ever considered.
 * Nothing else in the sessions tree is touched.
 * @module dsh-cron/gc
 */
import { readdir, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { CronInputError } from "./cron.js";

/** Exactly the ids {@link newCronSessionId} generates; job names follow JOB_NAME_RE. */
const CRON_SESSION_DIR_RE =
	/^cron-[a-z][a-z0-9-]*-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Whether a directory entry name is one of this plugin's session dirs. */
export function isCronSessionDirName(name) {
	return CRON_SESSION_DIR_RE.test(name);
}

/** The jsonl backend's default session root. */
export function defaultSessionsRoot() {
	return join(homedir(), ".dsh", "sessions");
}

/** Validate and normalize the `sessionGc` config block; loud on any defect. */
export function normalizeGcConfig(raw) {
	const cfg = raw ?? {};
	if (typeof cfg !== "object" || Array.isArray(cfg)) {
		throw new CronInputError("sessionGc must be an object");
	}
	const enabled = cfg.enabled ?? true;
	if (typeof enabled !== "boolean") throw new CronInputError("sessionGc.enabled must be a boolean");
	const root = cfg.root ?? "";
	if (typeof root !== "string") throw new CronInputError("sessionGc.root must be a string");
	const graceMinutes = cfg.graceMinutes ?? 30;
	if (!Number.isSafeInteger(graceMinutes) || graceMinutes < 1) {
		throw new CronInputError("sessionGc.graceMinutes must be a positive integer");
	}
	return {
		enabled,
		root: root !== "" ? root : defaultSessionsRoot(),
		graceMs: graceMinutes * 60_000,
	};
}

/** Newest mtime among a session dir and its direct children; 0 when unreadable. */
async function newestMtime(dir) {
	let newest;
	try {
		newest = (await stat(dir)).mtimeMs;
	} catch {
		return 0;
	}
	let entries;
	try {
		entries = await readdir(dir);
	} catch {
		return newest;
	}
	for (const entry of entries) {
		try {
			newest = Math.max(newest, (await stat(join(dir, entry))).mtimeMs);
		} catch {
			// A file disappearing mid-scan just doesn't advance the clock.
		}
	}
	return newest;
}

/**
 * One sweep: remove every unreferenced `cron-*` session directory older than
 * the grace window. Never throws for a missing root — a host that has not
 * yet persisted any session has nothing to collect.
 * @param root - sessions root (the jsonl backend layout).
 * @param referenced - session ids still present in the runs table.
 * @param graceMs - minimum age (newest mtime) before an orphan is removed.
 * @returns `{removed, kept}` — removed ids and the count left in place.
 */
export async function sweepCronSessions(root, referenced, graceMs, nowMs = Date.now()) {
	const removed = [];
	let kept = 0;
	let projects;
	try {
		projects = await readdir(root, { withFileTypes: true });
	} catch (error) {
		if (error?.code === "ENOENT") return { removed, kept };
		throw error;
	}
	for (const project of projects) {
		if (!project.isDirectory()) continue;
		const projectPath = join(root, project.name);
		let entries;
		try {
			entries = await readdir(projectPath, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (!entry.isDirectory() || !isCronSessionDirName(entry.name)) continue;
			if (referenced.has(entry.name)) {
				kept += 1;
				continue;
			}
			const dir = join(projectPath, entry.name);
			const newest = await newestMtime(dir);
			if (newest === 0 || nowMs - newest < graceMs) {
				kept += 1;
				continue;
			}
			await rm(dir, { recursive: true, force: true });
			removed.push(entry.name);
		}
	}
	return { removed, kept };
}
