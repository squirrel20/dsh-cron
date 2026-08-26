/**
 * dsh-cron — task executors.
 *
 * Two task kinds. `agent` follows the @deepseek-ai/dsh-headless one-shot
 * recipe verbatim: create a fresh persisted agent through `ctx.agents`,
 * submit the prompt as an ordinary user message, wait for quiescence, flush,
 * summarize the owned event interval, dispose the handle. `command` spawns a
 * child process and keeps a bounded output tail. Both return a settlement
 * `{status, summary, ...}` — they never throw for task failure, only for
 * executor bugs.
 * @module dsh-cron/executor
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { installModelSelection } from "@deepseek-ai/dsh-agent";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { SessionId } from "@deepseek-ai/dsh-session";

/** Bound on stored summaries/output tails; storage is a ledger, not a log sink. */
export const SUMMARY_LIMIT = 8_192;

/** Keep the TAIL of oversized text — the end carries the outcome. */
export function tail(text, limit = SUMMARY_LIMIT) {
	return text.length <= limit ? text : `…${text.slice(text.length - limit + 1)}`;
}

/**
 * Last non-empty assistant text and final turn outcome in one owned event
 * interval (same fold as dsh-headless).
 */
export function summarize(events, firstSeq) {
	let started = false;
	let text = "";
	let reason;
	for (const event of events) {
		if (event.seq < firstSeq) continue;
		if (event.type === "turn/start") {
			started = true;
			continue;
		}
		if (!started) continue;
		if (event.type === "assistant/message") {
			const joined = event.data.message.content
				.filter((block) => block.type === "text")
				.map((block) => block.text)
				.join("");
			if (joined !== "") text = joined;
		}
		if (event.type === "turn/end") reason = event.data.reason;
	}
	return { text, reason };
}

/** Fixed framing so the model knows this is unattended: no user to ask. */
export function renderCronPrompt(job, targetIso) {
	return [
		"[CRON RUN]",
		`job: ${JSON.stringify(job.name)}`,
		`scheduled_for: ${targetIso}`,
		"This is an unattended scheduled run. No user is watching and nobody can answer questions — never ask, never wait for confirmation. Do the task, then end with a concise report of what happened.",
		"",
		job.task.prompt,
	].join("\n");
}

/**
 * Run one agent task to settlement.
 * @param control - cancellation seam; teardown disposes the agent handle.
 * @returns `{status: "ok"|"failed"|"timeout", summary, sessionId, error?}`
 */
export async function runAgentTask(ctx, job, targetIso, control) {
	const selection = ctx.agentDefaultModel.currentSelection();
	const model = job.task.model !== "" ? job.task.model : selection.model;
	const sessionId = SessionId(`cron-${job.name}-${randomUUID()}`);
	const handle = await ctx.agents.create({
		sessionId,
		meta: { cwd: job.task.cwd !== "" ? job.task.cwd : process.cwd() },
		agentOptions: { provider: selection.provider, model },
		setup: (agentCtx) => {
			installModelSelection(agentCtx, {
				current: { ...selection, model },
				assembled: undefined,
			});
		},
	});
	const { agent } = handle;
	control?.register(() => {
		handle.dispose().catch(() => {});
	});
	try {
		await agent.whenIdle();
		const firstSeq = agent.session.seq;
		agent.followup(
			createUserMessage({
				content: [{ type: "text", text: renderCronPrompt(job, targetIso) }],
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

/**
 * Run one command task to settlement.
 * @param control - cancellation seam; teardown kills the child process.
 * @returns `{status: "ok"|"failed"|"timeout", summary, exitCode?, error?}`
 */
export function runCommandTask(job, control) {
	return new Promise((resolve) => {
		const [cmd, ...args] = job.task.argv;
		const child = spawn(cmd, args, {
			cwd: job.task.cwd !== "" ? job.task.cwd : process.cwd(),
			stdio: ["ignore", "pipe", "pipe"],
		});
		control?.register(() => {
			child.kill("SIGKILL");
		});
		let output = "";
		let settled = false;
		const collect = (chunk) => {
			output = tail(output + chunk.toString(), SUMMARY_LIMIT * 2);
		};
		child.stdout.on("data", collect);
		child.stderr.on("data", collect);
		const timer = setTimeout(() => {
			child.kill("SIGTERM");
			setTimeout(() => child.kill("SIGKILL"), 10_000).unref();
			settle({
				status: "timeout",
				summary: tail(output),
				error: `command exceeded ${job.task.timeoutSeconds}s`,
			});
		}, job.task.timeoutSeconds * 1000);
		const settle = (result) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(result);
		};
		child.on("error", (error) => {
			settle({ status: "failed", summary: tail(output), error: String(error) });
		});
		child.on("close", (code) => {
			settle({
				status: code === 0 ? "ok" : "failed",
				summary: tail(output),
				exitCode: code ?? -1,
				error: code === 0 ? undefined : `exit code ${code}`,
			});
		});
	});
}

/**
 * Feed one settled run record to the job's delivery command via stdin.
 * Delivery failure is logged by the caller, never escalated: the run itself
 * already settled.
 */
export function deliver(job, record) {
	return new Promise((resolve) => {
		const [cmd, ...args] = job.delivery.argv;
		const child = spawn(cmd, args, { stdio: ["pipe", "ignore", "pipe"] });
		let stderr = "";
		child.stderr.on("data", (chunk) => {
			stderr = tail(stderr + chunk.toString(), 2_048);
		});
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			resolve({ ok: false, error: "delivery command exceeded 60s" });
		}, 60_000);
		child.on("error", (error) => {
			clearTimeout(timer);
			resolve({ ok: false, error: String(error) });
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			resolve(code === 0 ? { ok: true } : { ok: false, error: `exit ${code}: ${stderr}` });
		});
		child.stdin.end(JSON.stringify(record));
	});
}
