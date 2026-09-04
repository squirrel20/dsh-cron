/**
 * dsh-cron — the plugin-mode job registry.
 *
 * The third way a job reaches the scheduler. The first two put a spec in
 * storage — the web dialog and `cron_create` write the `manual` table, the
 * profile writes `config` — and both make the user the author. This one lets
 * a DeepSeek Harness plugin be the author: a package ships its own schedules
 * next to the scripts they run, and installing it is what creates the jobs.
 *
 * ```js
 * export const inject = ["cron"];
 * export function apply(ctx) {
 *   ctx.effect(() => ctx.cron.registerJob({
 *     name: "kb-refresh",
 *     schedule: { cron: "30 7 * * *", timeZone: "Asia/Shanghai" },
 *     task: { kind: "command", argv: ["/bin/sh", "/abs/refresh.sh"] },
 *   }, { owner: "dsh-cron-source-kb" }), "kb.cron()");
 * }
 * ```
 *
 * Four constraints shape everything here — the first three mirror
 * dsh-ingest's SourceRegistry, which this module is deliberately modelled on:
 *
 * 1. **Registration may precede service readiness.** A provider's `apply` and
 *    dsh-cron's own `service.start()` race, so registerJob is a synchronous
 *    admission + an asynchronous attach on a serial queue. When dsh-cron
 *    reloads (its effect reruns with a brand-new service), {@link flush}
 *    replays the whole table onto the new one.
 * 2. **The provider's code is the truth; storage holds only a projection.**
 *    So two providers claiming one name is an error (letting the later one
 *    win silently would make behaviour depend on mount order), and unmounting
 *    a provider does NOT delete the job's dispatch state or run history —
 *    pulling a package for an hour must not erase its ledger. The leftover
 *    rows surface as orphan jobs in the overlay, deletable by the user.
 * 3. **This module never touches cordis.** It needs one `getService()`, one
 *    `isConfigName()` and a logger, so it unit-tests offline.
 * 4. **Defects blame the provider.** The spec is normalized on the synchronous
 *    path, so a bad schedule throws inside the provider's own `apply` and
 *    names the offending field, instead of surfacing minutes later as an
 *    ownerless line in the scheduler log.
 * @module dsh-cron/registry
 */
import { normalizeJobs } from "./service.js";

/** Two providers registered the same job name. */
export class JobOwnerConflictError extends Error {
	constructor(name, owner) {
		super(`cron job '${name}' is already registered by ${owner}`);
		this.code = "job_owner_conflict";
	}
}

/** A provider claimed a name the profile config already declares. */
export class JobNameReservedError extends Error {
	constructor(name) {
		super(`cron job '${name}' is declared in profile config; a plugin cannot register that name`);
		this.code = "job_name_reserved";
	}
}

/** Provider identity missing: the overlay has to be able to say who brought a job. */
export class MissingOwnerError extends Error {
	constructor() {
		super("registerJob needs options.owner — the overlay tells the user which plugin brought each job");
		this.code = "missing_owner";
	}
}

export class JobRegistry {
	/**
	 * @param options.getService - the live CronService, or null while unmounted
	 *   or not yet started.
	 * @param options.isConfigName - true when profile config declares that name.
	 * @param options.logger - cordis logger (info/warn/error).
	 */
	constructor({ getService, isConfigName, logger }) {
		this.getService = getService;
		this.isConfigName = isConfigName;
		this.logger = logger;
		/** Live registrations: name → { spec, owner }. */
		this.entries = new Map();
		/** Attach/detach queue. Serial so a name's register → dispose → register lands in order. */
		this.queue = Promise.resolve();
		/** The facade handed to ctx.provide. Stable: a service reload never swaps it. */
		this.api = {
			registerJob: (spec, options) => this.register(spec, options),
			registerJobs: (specs, options) => this.registerAll(specs, options),
		};
	}

	/** Queue one thunk; a failure is logged and does not poison the queue. */
	#enqueue(label, thunk) {
		this.queue = this.queue.then(thunk).catch((error) => {
			this.logger?.error(`cron: ${label} failed: ${String(error)}`);
		});
		return this.queue;
	}

	/** Attach one registration to the live service; a service that is not ready yet is caught by {@link flush}. */
	#attach(name) {
		return this.#enqueue(`attaching plugin job '${name}'`, async () => {
			const entry = this.entries.get(name);
			const service = this.getService();
			// The provider may have unmounted while this sat in the queue.
			if (entry === undefined || service === null || service.domain === null) return;
			await service.attachPluginJob(entry.spec, entry.owner);
		});
	}

	/**
	 * Register one job on behalf of a plugin.
	 *
	 * The spec is exactly the shape profile config and `cron_create` accept —
	 * `{ name, description?, schedule, task, policy?, delivery?, enabled? }` —
	 * and is validated by the same {@link normalizeJobs} vocabulary. `enabled`
	 * is only the initial value: a user pausing the job in the overlay writes a
	 * durable override that outlives re-registration.
	 *
	 * @returns an idempotent disposer. Disposing means "the provider is gone":
	 *   the job stops being scheduled, while its dispatch state and run history
	 *   stay on disk.
	 */
	register(spec, options = {}) {
		if (spec === null || typeof spec !== "object") throw new TypeError("registerJob: spec must be an object");
		const owner = options.owner;
		if (typeof owner !== "string" || owner.trim() === "") throw new MissingOwnerError();
		// Throws CronInputError naming the defective field, inside the
		// provider's own apply — where the fix is.
		const job = normalizeJobs([spec])[0];
		const name = job.name;
		if (this.isConfigName(name)) throw new JobNameReservedError(name);
		const existing = this.entries.get(name);
		if (existing !== undefined) throw new JobOwnerConflictError(name, existing.owner);

		this.entries.set(name, { spec: structuredClone(spec), owner });
		this.#attach(name);

		let active = true;
		return () => {
			if (!active) return;
			active = false;
			if (this.entries.get(name)?.owner !== owner) return;
			this.entries.delete(name);
			this.#enqueue(`detaching plugin job '${name}'`, async () => {
				const service = this.getService();
				if (service === null || service.domain === null) return;
				service.detachPluginJob(name, owner);
			});
		};
	}

	/**
	 * Register a batch under one owner — the common shape for a provider that
	 * ships a fixed set of schedules. All-or-nothing: a defect in any spec
	 * throws after rolling the successful ones back, so a provider never mounts
	 * half its jobs.
	 * @returns one disposer covering the whole batch.
	 */
	registerAll(specs, options = {}) {
		if (!Array.isArray(specs)) throw new TypeError("registerJobs: specs must be an array");
		const disposers = [];
		try {
			for (const spec of specs) disposers.push(this.register(spec, options));
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

	/** Replay the whole table onto a service that just became ready (or was just replaced). */
	flush() {
		for (const name of this.entries.keys()) this.#attach(name);
		return this.queue;
	}

	/** Drain the queue; for tests and orderly teardown. */
	idle() {
		return this.queue;
	}
}
