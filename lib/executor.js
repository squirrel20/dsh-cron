/**
 * dsh-cron — task executors.
 *
 * The dependency-free half: `command` tasks (spawned child processes with a
 * bounded output tail), delivery, and the pure text folds shared with the
 * agent executor. The `agent` executor lives in ./agent-task.js because it
 * imports dsh host packages — the service loads it lazily so the scheduling
 * core stays testable without a mounted harness. Executors return a
 * settlement `{status, summary, ...}` — they never throw for task failure,
 * only for executor bugs.
 * @module dsh-cron/executor
 */
import { spawn } from "node:child_process";

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

/**
 * Fixed framing so the model knows this is unattended: no user to ask.
 * Registered as a scoped system-prompt section by the agent executor; the
 * user message then carries only the author's prompt. The harness renders
 * sections with strict `{{variable}}` interpolation and the job name is
 * user input, so any `{{` pair in it is broken up.
 */
export function renderCronFraming(job, targetIso) {
	return [
		"[CRON RUN]",
		`job: ${JSON.stringify(job.name).replaceAll("{{", "{ {")}`,
		`scheduled_for: ${targetIso}`,
		"This is an unattended scheduled run. No user is watching and nobody can answer questions — never ask, never wait for confirmation. Do the task, then end with a concise report of what happened.",
	].join("\n");
}

/** Fallback when the host lacks the system-prompt service: framing rides the user message. */
export function renderCronPrompt(job, targetIso) {
	return [renderCronFraming(job, targetIso), "", job.task.prompt].join("\n");
}

/**
 * Run one command task to settlement.
 * @param control - cancellation seam; teardown kills the child process.
 * @param onOutput - optional live-tail observer, called with the bounded
 * output tail on every chunk; feeds the web overlay's streaming view and
 * never affects settlement.
 * @returns `{status: "ok"|"failed"|"timeout", summary, exitCode?, error?}`
 */
export function runCommandTask(job, control, onOutput) {
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
			onOutput?.(tail(output));
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
