/** Host-plane authorization. No preset name or model-supplied field grants access. */
import { createHash } from "node:crypto";

export function forbidden(message = "Cron mutations execute on the host and require an unrestricted session with approval disabled. Ask the operator to review the job in the cron UI.") {
	return { code: "permission_denied", message };
}

/** Missing/unknown services and Auto review fail closed, including on older hosts. */
export function authorizeCronAgent(agent) {
	try {
		const permissions = agent?.ctx?.get?.("permissionPresets");
		if (!agent?.session || !permissions) return forbidden();
		const name = permissions.current(agent.session);
		if (name === "auto" || name === "custom") return forbidden();
		const spec = permissions.resolve(name);
		if (spec.sandbox === "danger-full-access" && spec.approval === "never") return null;
	} catch { /* Unsupported hosts must not accidentally grant host execution. */ }
	return forbidden();
}

/** Internal service callers and authenticated operator UI are trusted; tools pass an actor. */
export function authorizeCronActor(actor) {
	return actor === undefined ? null : authorizeCronAgent(actor?.agent);
}

export function specDigest(spec) {
	return createHash("sha256").update(JSON.stringify(spec)).digest("hex");
}

/** Generated out-of-band, never copied from a model-controlled job spec. */
export function approveManualJob(spec, actor) {
	return {
		version: 1,
		source: actor === undefined ? "operator" : "agent",
		...(actor === undefined ? {} : { sessionId: String(actor.agent.session.id) }),
		digest: specDigest(spec),
	};
}

export function isManualJobApproved(record) {
	const approval = record?.authorization;
	return approval?.version === 1
		&& ["operator", "agent"].includes(approval.source)
		&& approval.digest === specDigest(record.spec);
}

/** An explicit, small ambient allowlist; extra names come only from operator config. */
export function commandEnvironment(extraNames = [], source = process.env) {
	const names = ["PATH", "HOME", "USER", "LOGNAME", "LANG", "LC_ALL", "LC_CTYPE", "TZ", "TMPDIR", "TMP", "TEMP", "SystemRoot", "WINDIR", ...extraNames];
	return Object.fromEntries(names.filter((name) => typeof source[name] === "string").map((name) => [name, source[name]]));
}

/** An explicit requested restriction must never silently fall back to a host default. */
export function applyTaskAccess(ctx, session, access) {
	if (access === "") return;
	const permissions = ctx.get?.("permissionPresets");
	if (!permissions) throw new Error("cron: permission service unavailable for requested access preset");
	permissions.set(session, access);
}
