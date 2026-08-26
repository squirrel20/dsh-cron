/**
 * dsh-cron — the agent task executor.
 *
 * Follows the @deepseek-ai/dsh-headless one-shot recipe verbatim: create a
 * fresh persisted agent through `ctx.agents`, submit the prompt as an
 * ordinary user message, wait for quiescence, flush, summarize the owned
 * event interval, dispose the handle. Split from ./executor.js because this
 * is the one module that imports dsh host packages; the service imports it
 * lazily, only when an agent task actually launches.
 * @module dsh-cron/agent-task
 */
import { installModelSelection } from "@deepseek-ai/dsh-agent";
import { ReasoningEffortId, createUserMessage } from "@deepseek-ai/dsh-llm";
import { SessionId } from "@deepseek-ai/dsh-session";
import { renderCronFraming, renderCronPrompt, summarize, tail } from "./executor.js";

/**
 * Run one agent task to settlement.
 * @param control - cancellation seam; teardown disposes the agent handle.
 * @param sessionId - pre-minted id: the caller records it durably BEFORE the
 *   agent exists, so session-file GC can never mistake a live run's session
 *   for an orphan.
 * @returns `{status: "ok"|"failed"|"timeout", summary, sessionId, error?}`
 */
export async function runAgentTask(ctx, job, targetIso, control, sessionId) {
	const optional = (name) => (typeof ctx.get === "function" ? ctx.get(name) : undefined);
	const selection = ctx.agentDefaultModel.currentSelection();
	const provider = job.task.provider !== "" ? job.task.provider : selection.provider;
	const model = job.task.model !== "" ? job.task.model : selection.model;
	// An explicit effort wins; an explicit model with no effort clears the
	// inherited one (the default selection's effort may not exist on it).
	const effort = job.task.effort !== ""
		? ReasoningEffortId(job.task.effort)
		: job.task.model !== "" ? undefined : selection.reasoningEffort;
	const presets = optional("agentPresets");
	// The unattended framing rides the system prompt, not the user message:
	// the transcript keeps only the author's prompt, and an interactive
	// resume (where dsh-cron is not in the setup path) sheds the never-ask
	// rule. Hosts without the service fall back to in-message framing.
	let framingInstalled = false;
	const handle = await ctx.agents.create({
		sessionId: SessionId(sessionId),
		meta: { cwd: job.task.cwd !== "" ? job.task.cwd : process.cwd() },
		agentOptions: { provider, model },
		setup: async (agentCtx) => {
			installModelSelection(agentCtx, {
				current: { provider, model, ...(effort === undefined ? {} : { reasoningEffort: effort }) },
				assembled: undefined,
			});
			// Join the same preset composition an interactive session would;
			// hosts without the presets service keep the bare-agent behavior.
			if (presets !== undefined) {
				await presets.mount(agentCtx, job.task.preset !== "" ? job.task.preset : undefined);
			}
			const systemPrompt = typeof agentCtx.get === "function" ? agentCtx.get("systemPrompt") : undefined;
			if (systemPrompt !== undefined) {
				// After the persona slot (0), before tool guidance (100–199).
				systemPrompt.section({
					name: "dsh-cron:unattended",
					order: 50,
					text: renderCronFraming(job, targetIso),
				});
				framingInstalled = true;
			}
		},
	});
	const { agent } = handle;
	if (job.task.access !== "") {
		const permissions = optional("permissionPresets");
		if (permissions !== undefined) {
			try {
				permissions.set(agent.session, job.task.access);
			} catch (error) {
				ctx.logger.warn(`cron: job '${job.name}' access preset '${job.task.access}' not applied: ${String(error)}`);
			}
		}
	}
	control?.register(() => {
		handle.dispose().catch(() => {});
	});
	try {
		await agent.whenIdle();
		const firstSeq = agent.session.seq;
		agent.followup(
			createUserMessage({
				content: [{ type: "text", text: framingInstalled ? job.task.prompt : renderCronPrompt(job, targetIso) }],
				source: { kind: "user" },
			}),
		);
		let timer;
		const timedOut = new Promise((resolve) => {
			timer = setTimeout(() => resolve("timeout"), job.task.timeoutSeconds * 1000);
		});
		const races = [agent.whenIdle().then(() => "idle"), timedOut];
		if (control !== undefined) races.push(control.whenCancelled.then(() => "cancelled"));
		const winner = await Promise.race(races);
		clearTimeout(timer);
		if (winner === "cancelled") {
			// The service overrides the status with the cancel reason.
			return { status: "failed", summary: "", sessionId, error: "cancelled" };
		}
		if (winner === "timeout") {
			return {
				status: "timeout",
				summary: "",
				sessionId,
				error: `agent run exceeded ${job.task.timeoutSeconds}s`,
			};
		}
		await ctx.sessions.flush(agent.session);
		const outcome = summarize(agent.session.events, firstSeq);
		const failed = outcome.reason?.kind === "error";
		return {
			status: failed ? "failed" : "ok",
			summary: tail(outcome.text),
			sessionId,
			error: failed ? `${outcome.reason.error?.code ?? "error"}: ${outcome.reason.error?.message ?? ""}` : undefined,
		};
	} finally {
		// Dispose stops the loop and unregisters the agent; the persisted
		// session file remains on disk for later inspection/resume.
		await handle.dispose().catch(() => {});
	}
}

