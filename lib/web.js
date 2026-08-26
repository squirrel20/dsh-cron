/**
 * dsh-cron — read-only Web overlay wiring, host half.
 *
 * One exact HTTP route (`GET /dsh-cron/api/state`) on the shared
 * `ctx.webServer`, answering the sidebar overlay shipped in ./client.js with
 * the same views the conversational tools read: `listView()` for the job
 * list, `runsView()` for recent history. Read-only by design — the overlay
 * observes the scheduler, it never steers it, so the route stays a GET and
 * carries no CSRF surface. The registration is guarded by `ctx.inject`:
 * headless profiles have no webserver and the plugin must mount there
 * unchanged.
 * @module dsh-cron/web
 */

/** Exact route path answered by {@link registerCronWeb}. */
export const STATE_PATH = "/dsh-cron/api/state";

/** Recent-run window handed to the overlay (history is bounded per job anyway). */
const RUN_LIMIT = 200;

/**
 * Assemble the overlay's one read: every declared job plus recent runs.
 * @param service - the live, started CronService.
 * @returns the JSON-safe state document.
 */
export function cronWebState(service) {
	return {
		jobs: service.listView(),
		runs: service.runsView(undefined, RUN_LIMIT),
		now: new Date().toISOString(),
	};
}

/**
 * Build the HTTP handler for the state route.
 * @param getService - returns the live CronService or null while unmounted.
 * @param logger - plugin logger for handler-level failures.
 * @returns a `(req, res)` node handler.
 */
export function createStateHandler(getService, logger) {
	return (req, res) => {
		if (req.method !== "GET" && req.method !== "HEAD") {
			res.writeHead(405, { allow: "GET, HEAD" });
			res.end();
			return;
		}
		const service = getService();
		if (service === null || service.domain === null) {
			res.writeHead(503, { "content-type": "application/json" });
			res.end(JSON.stringify({ error: "scheduler_unavailable" }));
			return;
		}
		let body;
		try {
			body = JSON.stringify(cronWebState(service));
		} catch (error) {
			logger.warn(`cron: web state read failed: ${String(error)}`);
			res.writeHead(500, { "content-type": "application/json" });
			res.end(JSON.stringify({ error: "internal_error" }));
			return;
		}
		res.writeHead(200, {
			"content-type": "application/json",
			"cache-control": "no-store",
		});
		res.end(req.method === "HEAD" ? undefined : body);
	};
}

/**
 * Register the overlay's state route while a webserver is present.
 * @param ctx - plugin root context.
 * @param getService - returns the live CronService or null.
 */
export function registerCronWeb(ctx, getService) {
	ctx.inject(["webServer"], (webCtx) => {
		webCtx.effect(
			() =>
				webCtx.webServer.register({
					kind: "exact",
					path: STATE_PATH,
					handler: createStateHandler(getService, ctx.logger),
				}),
			"cron.web-route()",
		);
	});
}
