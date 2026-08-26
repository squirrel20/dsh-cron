/**
 * dsh-cron — Web overlay wiring, host half.
 *
 * Exact HTTP routes on the shared `ctx.webServer`. The read
 * (`GET /dsh-cron/api/state`) answers the sidebar section with the same
 * views the conversational tools read, plus the raw manual specs backing
 * the edit form. The writes (`POST …/run-now`, `POST …/stop`,
 * `POST …/jobs`, `POST …/update`, `POST …/enable`, `POST …/delete`)
 * steer the scheduler through the service's own methods; each demands an `application/json` body, so a cross-site
 * "simple request" (which the browser sends without a CORS preflight) is
 * refused before dispatch — the same CSRF fence dsh's `/api` bridge uses.
 * The registration is guarded by `ctx.inject`: headless profiles have no
 * webserver and the plugin must mount there unchanged.
 * @module dsh-cron/web
 */

/** Exact route paths answered by {@link registerCronWeb}. */
export const STATE_PATH = "/dsh-cron/api/state";
export const OPTIONS_PATH = "/dsh-cron/api/options";
export const RUN_NOW_PATH = "/dsh-cron/api/run-now";
export const STOP_PATH = "/dsh-cron/api/stop";
export const JOBS_PATH = "/dsh-cron/api/jobs";
export const UPDATE_PATH = "/dsh-cron/api/update";
export const ENABLE_PATH = "/dsh-cron/api/enable";
export const DELETE_PATH = "/dsh-cron/api/delete";

/** Largest accepted action body; a job spec is far below this. */
const MAX_BODY_BYTES = 64 * 1024;

/** HTTP status for each service-level error code. */
const ERROR_STATUS = {
	job_not_found: 404,
	not_running: 409,
	already_running: 409,
	job_exists: 409,
	invalid_job: 400,
	invalid_request: 400,
	config_job: 409,
};

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
		specs: service.manualSpecs(),
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
 * Assemble the create/edit dialog's option lists from whatever host
 * services this profile composes: agent presets, permission presets, and
 * the provider/model catalog (with per-model reasoning efforts). Every
 * absent service degrades to an empty list — the dialog then shows only
 * the inherit-default choice.
 * @param ctx - plugin root context.
 * @returns the JSON-safe options document.
 */
export async function cronWebOptions(ctx) {
	const optional = (name) => (typeof ctx.get === "function" ? ctx.get(name) : undefined);
	const out = { presets: [], access: [], models: [], defaults: {} };
	const presets = optional("agentPresets");
	if (presets !== undefined) {
		try {
			const list = await presets.list();
			out.presets = list
				.filter((preset) => preset.broken === undefined)
				.map((preset) => ({
					id: preset.id,
					name: preset.name ?? preset.id,
					...(preset.description === undefined ? {} : { description: preset.description }),
				}));
			out.defaults.preset = presets.defaultId;
		} catch {
			// advisory data; the dialog works without it
		}
	}
	const permissions = optional("permissionPresets");
	if (permissions !== undefined) {
		try {
			out.access = permissions.names.map((name) => {
				const spec = permissions.presets[name];
				return {
					id: name,
					name: spec?.name ?? name,
					...(spec?.description === undefined ? {} : { description: spec.description }),
				};
			});
			out.defaults.access = permissions.defaultSettings().defaultPreset;
		} catch {
			// advisory data; the dialog works without it
		}
	}
	const llm = optional("llm");
	if (llm !== undefined) {
		try {
			for (const provider of llm.listProviders()) {
				let models;
				try {
					models = await llm.listModels(provider.id);
				} catch {
					continue;
				}
				for (const model of models) {
					const entry = {
						provider: provider.id,
						providerName: provider.name,
						id: model.id,
						name: model.name,
					};
					try {
						const info = await llm.resolveModelInfo(provider.id, model.id);
						if (info.reasoning !== undefined) {
							entry.efforts = info.reasoning.efforts.map((effort) => ({ id: effort.id, name: effort.name }));
							if (info.reasoning.defaultEffort !== undefined) entry.defaultEffort = info.reasoning.defaultEffort;
						}
					} catch {
						// a model without resolvable info still lists, effort-less
					}
					out.models.push(entry);
				}
			}
		} catch {
			// advisory data; the dialog works without it
		}
	}
	const defaultModel = optional("agentDefaultModel");
	if (defaultModel !== undefined) {
		try {
			out.defaults.selection = defaultModel.currentSelection();
		} catch {
			// advisory data; the dialog works without it
		}
	}
	return out;
}

/**
 * Build the HTTP handler for the options route.
 * @param ctx - plugin root context (host services resolve lazily per call).
 * @param logger - plugin logger for handler-level failures.
 * @returns a `(req, res)` node handler.
 */
export function createOptionsHandler(ctx, logger) {
	return async (req, res) => {
		if (req.method !== "GET" && req.method !== "HEAD") {
			res.writeHead(405, { allow: "GET, HEAD" });
			res.end();
			return;
		}
		let body;
		try {
			body = JSON.stringify(await cronWebOptions(ctx));
		} catch (error) {
			logger.warn(`cron: web options read failed: ${String(error)}`);
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

/** Answer one action route with a JSON body and status. */
function sendJson(res, status, value) {
	res.writeHead(status, { "content-type": "application/json" });
	res.end(JSON.stringify(value));
}

/** Read and parse one JSON request body; resolves null after answering the error itself. */
function readJsonBody(req, res) {
	return new Promise((resolve) => {
		const type = String(req.headers["content-type"] ?? "");
		if (!/^application\/json\s*(;|$)/i.test(type)) {
			sendJson(res, 415, { error: "invalid_body", message: "content-type must be application/json" });
			resolve(null);
			return;
		}
		const chunks = [];
		let size = 0;
		let answered = false;
		const fail = (status, message) => {
			if (answered) return;
			answered = true;
			sendJson(res, status, { error: "invalid_body", message });
			resolve(null);
		};
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > MAX_BODY_BYTES) {
				fail(413, "request body too large");
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("error", () => fail(400, "request body failed"));
		req.on("end", () => {
			if (answered) return;
			let body;
			try {
				body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
			} catch {
				fail(400, "request body is not valid JSON");
				return;
			}
			if (typeof body !== "object" || body === null || Array.isArray(body)) {
				fail(400, "request body must be a JSON object");
				return;
			}
			answered = true;
			resolve(body);
		});
	});
}

/**
 * Build one POST action handler: JSON body in, service outcome out.
 * @param getService - returns the live CronService or null while unmounted.
 * @param logger - plugin logger for handler-level failures.
 * @param act - `(service, body) => outcome`, an object with `code` on refusal.
 * @returns a `(req, res)` node handler.
 */
export function createActionHandler(getService, logger, act) {
	return async (req, res) => {
		if (req.method !== "POST") {
			res.writeHead(405, { allow: "POST" });
			res.end();
			return;
		}
		const service = getService();
		if (service === null || service.domain === null) {
			sendJson(res, 503, { error: "scheduler_unavailable" });
			return;
		}
		const body = await readJsonBody(req, res);
		if (body === null) return;
		let outcome;
		try {
			outcome = await act(service, body);
		} catch (error) {
			logger.warn(`cron: web action failed: ${String(error)}`);
			sendJson(res, 500, { error: "internal_error" });
			return;
		}
		if (outcome !== null && typeof outcome === "object" && typeof outcome.code === "string") {
			sendJson(res, ERROR_STATUS[outcome.code] ?? 500, { error: outcome.code, message: outcome.message });
			return;
		}
		sendJson(res, 200, outcome);
	};
}

/** The write actions, keyed by route path. */
export function actionRoutes() {
	return [
		{
			path: RUN_NOW_PATH,
			act: (service, body) => service.runNow(typeof body.job === "string" ? body.job : ""),
		},
		{
			path: STOP_PATH,
			act: (service, body) => service.stopRun(typeof body.job === "string" ? body.job : ""),
		},
		{
			path: JOBS_PATH,
			act: (service, body) => service.addJob(body.spec ?? {}),
		},
		{
			path: UPDATE_PATH,
			act: (service, body) => service.updateJob(typeof body.job === "string" ? body.job : "", body.spec ?? {}),
		},
		{
			path: ENABLE_PATH,
			act: (service, body) => {
				if (typeof body.enabled !== "boolean") {
					return { code: "invalid_request", message: "enabled must be a boolean" };
				}
				return service.setEnabled(typeof body.job === "string" ? body.job : "", body.enabled);
			},
		},
		{
			path: DELETE_PATH,
			act: (service, body) => service.deleteJob(typeof body.job === "string" ? body.job : ""),
		},
	];
}

/**
 * Register the overlay's routes while a webserver is present.
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
			"cron.web-route(state)",
		);
		webCtx.effect(
			() =>
				webCtx.webServer.register({
					kind: "exact",
					path: OPTIONS_PATH,
					handler: createOptionsHandler(ctx, ctx.logger),
				}),
			"cron.web-route(options)",
		);
		for (const route of actionRoutes()) {
			webCtx.effect(
				() =>
					webCtx.webServer.register({
						kind: "exact",
						path: route.path,
						handler: createActionHandler(getService, ctx.logger, route.act),
					}),
				`cron.web-route(${route.path})`,
			);
		}
	});
}
