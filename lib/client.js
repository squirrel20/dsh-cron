window.__ModuleLoader__.load({
	id: "dsh-cron",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		const h = react.createElement;
		//#region styles
		// Anatomy copied from shipped surfaces: the footer badge from
		// ui-cordis CordisPanel, the menu/rows from ui-jobs JobListAction,
		// the dialog geometry from the shipped dialog primitives. Colors are
		// dsw tokens only, so both themes come for free.
		const css = [
			".dshCron_layer{flex:none;align-items:center;width:100%;height:42px;margin:8px 0 0;display:flex;position:relative}",
			".dshCron_badge{width:calc(100% + 4px);height:42px;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:none;border-radius:12px;align-items:center;gap:8px;margin:0 -2px;padding:0 10px 0 8px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden}",
			".dshCron_badge:hover,.dshCron_badge[data-active]{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshCron_badgeLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}",
			".dshCron_badgeCount{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex:none;margin-left:auto;font-size:12px;line-height:16px}",
			".dshCron_layer.dshCron_rail{width:36px;height:36px;margin:0}",
			".dshCron_rail .dshCron_badge{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;padding:0}",
			".dshCron_panel{z-index:30;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-specific-menu);width:336px;max-width:calc(100vw - 24px);max-height:min(560px,72vh);box-shadow:var(--dsw-shadow-lv3);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:12px;flex-direction:column;gap:1px;padding:4px;display:flex;position:fixed;overflow:auto}",
			".dshCron_head{box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:6px 8px 4px;font-size:11px;line-height:18px;color:var(--dsw-alias-label-caption)}",
			".dshCron_headTitle{flex:1}",
			".dshCron_headCount{font-variant-numeric:tabular-nums}",
			".dshCron_iconBtn{flex:none;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:0;border-radius:5px;padding:0}",
			".dshCron_iconBtn:hover,.dshCron_iconBtn:focus-visible{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}",
			".dshCron_iconBtn:disabled{opacity:.5;cursor:default}",
			".dshCron_row{box-sizing:border-box;width:100%;color:var(--dsw-alias-label-primary);text-align:inherit;background:0 0;border:0;font-family:inherit;cursor:pointer;border-radius:8px;display:flex;flex-direction:column;gap:0;padding:6px 8px}",
			".dshCron_row:hover,.dshCron_row:focus-visible,.dshCron_row:focus-within{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshCron_rowMuted{color:var(--dsw-alias-label-tertiary)}",
			".dshCron_rowLine{display:flex;align-items:center;gap:8px;font-size:13px;line-height:18px}",
			".dshCron_rowMeta{display:flex;align-items:center;gap:6px;padding-left:18px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption);white-space:nowrap;overflow:hidden}",
			".dshCron_act{display:none;margin:-1px 0}",
			".dshCron_row:hover .dshCron_act,.dshCron_row:focus-within .dshCron_act{display:inline-flex}",
			".dshCron_dotWrap{flex:none;color:var(--dsw-alias-label-caption);display:inline-flex}",
			".dshCron_kind{background:var(--dsw-alias-fill-l2,var(--dsw-alias-interactive-bg-hover-solid));color:var(--dsw-alias-label-secondary);border-radius:5px;flex:none;padding:0 6px;font-size:11px;line-height:18px}",
			".dshCron_name{min-width:0;font-family:var(--dsw-font-mono,var(--ds-font-family-code,monospace));white-space:nowrap;text-overflow:ellipsis;flex:1;overflow:hidden}",
			".dshCron_status,.dshCron_duration{color:var(--dsw-alias-label-tertiary);flex:none;font-size:11px;line-height:18px}",
			".dshCron_status{white-space:nowrap;text-overflow:ellipsis;max-width:40%;overflow:hidden}",
			".dshCron_statusDanger{color:var(--dsw-alias-state-error-primary)}",
			".dshCron_duration{font-variant-numeric:tabular-nums}",
			".dshCron_mono{font-family:var(--dsw-font-mono,var(--ds-font-family-code,monospace))}",
			".dshCron_note{color:var(--dsw-alias-label-tertiary);padding:10px 8px;font-size:12px;line-height:18px}",
			".dshCron_noteError{color:var(--dsw-alias-state-error-primary)}",
			".dshCron_detailHead{box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:6px 8px;font-size:13px;line-height:18px}",
			".dshCron_back{flex:none;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;border-radius:6px;padding:2px;display:inline-flex;align-items:center}",
			".dshCron_back:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshCron_detailName{min-width:0;font-family:var(--dsw-font-mono,var(--ds-font-family-code,monospace));white-space:nowrap;text-overflow:ellipsis;flex:1;overflow:hidden;font-weight:600}",
			".dshCron_detailMeta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:0 8px 6px 30px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption)}",
			".dshCron_divider{height:1px;background:var(--dsw-alias-border-l2);margin:0 8px 3px}",
			".dshCron_runRow{box-sizing:border-box;width:100%;color:var(--dsw-alias-label-primary);text-align:inherit;background:0 0;border:0;font-family:inherit;border-radius:8px;display:flex;flex-direction:column;gap:6px;padding:6px 8px}",
			"button.dshCron_runRow{cursor:pointer}",
			"button.dshCron_runRow:hover,button.dshCron_runRow:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshCron_seq{flex:none;color:var(--dsw-alias-label-tertiary);font-family:var(--dsw-font-mono,var(--ds-font-family-code,monospace));font-size:11px}",
			".dshCron_target{min-width:0;white-space:nowrap;text-overflow:ellipsis;flex:1;overflow:hidden}",
			".dshCron_card{margin-left:18px;background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-interactive-bg-hover));border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:4px}",
			".dshCron_cardText{font-family:var(--dsw-font-mono,var(--ds-font-family-code,monospace));font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere;margin:0}",
			".dshCron_cardMeta{display:flex;align-items:center;gap:6px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption);min-width:0}",
			".dshCron_cardMeta > span{min-width:0;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}",
			// form
			".dshCron_form{display:flex;flex-direction:column;gap:10px;padding:0 8px 8px}",
			".dshCron_field{display:flex;flex-direction:column;gap:4px;min-width:0}",
			".dshCron_lbl{font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption)}",
			".dshCron_input{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-specific-input-major,transparent);padding:6px 10px;font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary);font-family:inherit;outline:none}",
			".dshCron_input:focus-visible{border-color:var(--dsw-alias-border-l4)}",
			".dshCron_input::placeholder{color:var(--dsw-alias-label-caption)}",
			"textarea.dshCron_input{resize:vertical;min-height:64px}",
			"select.dshCron_input{appearance:auto;padding:5px 6px}",
			".dshCron_inputRow{display:flex;align-items:center;gap:6px}",
			".dshCron_cwdBox{box-sizing:border-box;display:flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-specific-input-major,transparent);padding:0 4px 0 0}",
			".dshCron_cwdBox > input{border:0;background:0 0;flex:1;min-width:0}",
			".dshCron_seg{display:flex;background:var(--dsw-specific-selector,var(--dsw-alias-interactive-bg-hover-solid));border-radius:8px;padding:2px;gap:2px}",
			".dshCron_segItem{flex:1;text-align:center;font-size:12px;line-height:18px;padding:3px 0;border-radius:6px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;font-family:inherit}",
			".dshCron_segOn{background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-menu));color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-shadow-lv1)}",
			".dshCron_submit{box-sizing:border-box;width:100%;min-height:36px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border:0;border-radius:8px;font-family:inherit;font-size:13px;font-weight:500;cursor:pointer}",
			".dshCron_submit:disabled{opacity:.6;cursor:default}",
			// directory picker dialog
			".dshCron_scrim{position:fixed;inset:0;z-index:40;background:#00000033;display:flex;align-items:center;justify-content:center}",
			".dshCron_dialog{box-sizing:border-box;display:flex;flex-direction:column;width:min(420px,calc(100vw - 32px));height:min(440px,calc(100vh - 64px));border-radius:16px;border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-menu));box-shadow:var(--dsw-shadow-lv3);overflow:hidden}",
			".dshCron_dlgHead{flex:none;display:flex;flex-direction:column;gap:6px;padding:14px 16px 8px;border-bottom:1px solid var(--dsw-alias-border-l2)}",
			".dshCron_dlgTitle{font-size:14px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-primary)}",
			".dshCron_crumbs{display:flex;align-items:center;gap:4px;min-width:0;overflow:hidden;font-size:12px;line-height:18px}",
			".dshCron_crumb{flex:none;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:0;padding:0;font-family:inherit;font-size:12px;font-weight:500}",
			".dshCron_crumb:hover{color:var(--dsw-alias-label-primary)}",
			".dshCron_crumbOn{color:var(--dsw-alias-label-primary)}",
			".dshCron_dlgBody{flex:1;min-height:0;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:2px;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}",
			".dshCron_dirRow{display:flex;align-items:center;gap:6px;width:100%;height:28px;padding:4px 6px;box-sizing:border-box;border-radius:6px;background:0 0;border:0;cursor:pointer;font-family:inherit;text-align:inherit}",
			".dshCron_dirRow:hover,.dshCron_dirRow:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshCron_dirIcon{flex:none;color:var(--dsw-alias-label-secondary);display:inline-flex}",
			".dshCron_dirName{min-width:0;flex:1;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);white-space:nowrap;text-overflow:ellipsis;overflow:hidden}",
			".dshCron_dlgFoot{flex:none;display:flex;align-items:center;gap:8px;padding:10px 16px;border-top:1px solid var(--dsw-alias-border-l2)}",
			".dshCron_dlgPath{min-width:0;flex:1;font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption);white-space:nowrap;text-overflow:ellipsis;overflow:hidden;direction:rtl;text-align:left}",
			".dshCron_btn{display:inline-flex;align-items:center;justify-content:center;min-width:64px;height:30px;padding:0 12px;border-radius:15px;font-family:inherit;font-size:13px;line-height:20px;cursor:pointer}",
			".dshCron_btnGhost{border:1px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-primary)}",
			".dshCron_btnPrimary{border:0;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}",
		].join("");
		const tagId = "dsh-cron/CronOverlay.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-cron";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region locales
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"panel.trigger": "定时任务",
			"panel.title": "定时作业",
			"panel.aria": "定时作业",
			"badge.jobs": "{count} 个作业",
			"badge.running": "{count} 运行中",
			"head.count.idle": "{count} 个作业",
			"head.count.running": "{count} 个作业 · {running} 个运行中",
			"head.add": "新增作业",
			"empty.jobs": "尚无定时作业，点右上角 + 新建。",
			"error.unavailable": "调度器未运行。",
			"error.network": "读取失败，稍后自动重试。",
			"action.run": "立即运行",
			"action.stop": "停止",
			"action.failed": "操作失败：{message}",
			"status.ok": "成功",
			"status.failed": "已失败",
			"status.timeout": "超时",
			"status.replaced": "被替换",
			"status.aborted": "中止",
			"status.killed": "已停止",
			"status.skipped": "已跳过 · 重叠",
			"status.running": "运行中",
			"status.pending": "待触发",
			"status.disabled": "已停用",
			"meta.next": "下次 {time}",
			"meta.enabled.override": "会话改动",
			"meta.source.manual": "手动",
			"detail.delivered": "已投递",
			"detail.session": "会话 {id}",
			"detail.exit": "exit {code}",
			"detail.manual": "手动",
			"detail.history": "保留最近 {count} 条运行记录",
			"time.today": "{time}",
			"time.tomorrow": "明日 {time}",
			"time.other": "{date} {time}",
			"duration.seconds": "{seconds}秒",
			"duration.minutes": "{minutes}分{seconds}秒",
			"duration.hours": "{hours}小时{minutes}分",
			"form.title": "新增作业",
			"form.name": "名称",
			"form.name.hint": "小写字母开头，可含数字和 -",
			"form.trigger": "触发",
			"form.trigger.cron": "cron",
			"form.trigger.every": "周期",
			"form.trigger.at": "一次性",
			"form.cron": "表达式",
			"form.timezone": "时区",
			"form.every": "间隔（秒，≥60）",
			"form.at": "触发时刻",
			"form.task": "任务",
			"form.prompt": "prompt",
			"form.prompt.hint": "将带固定 [CRON RUN] 无人值守 framing",
			"form.argv": "命令（argv，空格分隔）",
			"form.cwd": "工作目录",
			"form.cwd.hint": "手输或点文件夹图标从目录树选择",
			"form.browse": "浏览目录",
			"form.timeout": "超时（秒）",
			"form.overlap": "重叠时",
			"form.overlap.skip": "跳过",
			"form.overlap.queue": "排队",
			"form.overlap.replace": "替换",
			"form.misfire": "错过时",
			"form.misfire.skip": "不补",
			"form.misfire.runOnce": "补一次",
			"form.submit": "创建并启用",
			"form.submitting": "创建中…",
			"picker.title": "选择工作目录",
			"picker.loading": "加载中…",
			"picker.empty": "没有子目录",
			"picker.cancel": "取消",
			"picker.choose": "选择",
		};
		/** English dictionary, key-identical to the Chinese source of truth. */
		const en = {
			"panel.trigger": "Cron jobs",
			"panel.title": "Cron jobs",
			"panel.aria": "Cron jobs",
			"badge.jobs": "{count} jobs",
			"badge.running": "{count} running",
			"head.count.idle": "{count} jobs",
			"head.count.running": "{count} jobs · {running} running",
			"head.add": "New job",
			"empty.jobs": "No cron jobs yet — use + to create one.",
			"error.unavailable": "The scheduler is not running.",
			"error.network": "Read failed; retrying automatically.",
			"action.run": "Run now",
			"action.stop": "Stop",
			"action.failed": "Action failed: {message}",
			"status.ok": "ok",
			"status.failed": "failed",
			"status.timeout": "timeout",
			"status.replaced": "replaced",
			"status.aborted": "aborted",
			"status.killed": "stopped",
			"status.skipped": "skipped · overlap",
			"status.running": "running",
			"status.pending": "pending",
			"status.disabled": "disabled",
			"meta.next": "next {time}",
			"meta.enabled.override": "override",
			"meta.source.manual": "manual",
			"detail.delivered": "delivered",
			"detail.session": "session {id}",
			"detail.exit": "exit {code}",
			"detail.manual": "manual",
			"detail.history": "last {count} runs kept",
			"time.today": "{time}",
			"time.tomorrow": "tomorrow {time}",
			"time.other": "{date} {time}",
			"duration.seconds": "{seconds}s",
			"duration.minutes": "{minutes}m {seconds}s",
			"duration.hours": "{hours}h {minutes}m",
			"form.title": "New job",
			"form.name": "Name",
			"form.name.hint": "lowercase, digits and - allowed",
			"form.trigger": "Trigger",
			"form.trigger.cron": "cron",
			"form.trigger.every": "interval",
			"form.trigger.at": "one-shot",
			"form.cron": "Expression",
			"form.timezone": "Time zone",
			"form.every": "Interval (seconds, ≥60)",
			"form.at": "Fire at",
			"form.task": "Task",
			"form.prompt": "Prompt",
			"form.prompt.hint": "runs unattended with the fixed [CRON RUN] framing",
			"form.argv": "Command (argv, space-separated)",
			"form.cwd": "Working directory",
			"form.cwd.hint": "type a path or browse via the folder icon",
			"form.browse": "Browse",
			"form.timeout": "Timeout (seconds)",
			"form.overlap": "On overlap",
			"form.overlap.skip": "skip",
			"form.overlap.queue": "queue",
			"form.overlap.replace": "replace",
			"form.misfire": "On misfire",
			"form.misfire.skip": "skip",
			"form.misfire.runOnce": "run once",
			"form.submit": "Create & enable",
			"form.submitting": "Creating…",
			"picker.title": "Choose working directory",
			"picker.loading": "Loading…",
			"picker.empty": "No subdirectories",
			"picker.cancel": "Cancel",
			"picker.choose": "Choose",
		};
		//#endregion
		//#region view model
		/** Exact routes served by ../web.js on the host. */
		const STATE_PATH = "/dsh-cron/api/state";
		const RUN_NOW_PATH = "/dsh-cron/api/run-now";
		const STOP_PATH = "/dsh-cron/api/stop";
		const JOBS_PATH = "/dsh-cron/api/jobs";
		/**
		* Terminal-status presentation. Same color semantics as the shipped
		* ui-jobs list: green = finished on its own, red = the run itself
		* failed (timeout included), amber = ended by request or environment,
		* muted = nothing ran.
		*/
		const STATUS_META = {
			"ok": { dot: "done", key: "status.ok" },
			"failed": { dot: "error", key: "status.failed", danger: true },
			"timeout": { dot: "error", key: "status.timeout", danger: true },
			"replaced": { dot: "warning", key: "status.replaced" },
			"aborted": { dot: "warning", key: "status.aborted" },
			"killed": { dot: "warning", key: "status.killed" },
			"skipped-overlap": { dot: "muted", key: "status.skipped" },
			"running": { dot: "ongoing", key: "status.running" },
		};
		/** Meta for one wire status, tolerating vocabulary the host may grow. */
		function statusMeta(status) {
			return STATUS_META[status] ?? { dot: "muted", key: undefined, raw: status };
		}
		/** Elapsed time in at most two adjacent units (ui-jobs convention). */
		function formatDuration(elapsedMs, t) {
			const total = Math.max(0, Math.floor(elapsedMs / 1e3));
			const seconds = total % 60;
			const minutes = Math.floor(total / 60) % 60;
			const hours = Math.floor(total / 3600);
			if (hours > 0) return t("duration.hours", { hours, minutes });
			if (minutes > 0) return t("duration.minutes", { minutes, seconds });
			return t("duration.seconds", { seconds });
		}
		/** Local wall-clock rendering: today bare, tomorrow marked, else dated. */
		function formatInstant(iso, t) {
			const at = new Date(iso);
			if (Number.isNaN(at.getTime())) return iso;
			const now = new Date();
			const pad = (n) => String(n).padStart(2, "0");
			const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
			const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
			if (sameDay(at, now)) return t("time.today", { time });
			const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
			if (sameDay(at, tomorrow)) return t("time.tomorrow", { time });
			return t("time.other", { date: `${pad(at.getMonth() + 1)}-${pad(at.getDate())}`, time });
		}
		/** Duration of one run record; live records tick against `nowMs`. */
		function runElapsedMs(record, nowMs) {
			const started = Date.parse(record.startedAt);
			if (Number.isNaN(started)) return 0;
			const end = record.finishedAt !== undefined ? Date.parse(record.finishedAt) : nowMs;
			return Math.max(0, (Number.isNaN(end) ? nowMs : end) - started);
		}
		/** POST one overlay action; resolves {ok, value|message}, never throws. */
		async function postAction(path, body) {
			try {
				const response = await fetch(new URL(path, location.origin), {
					method: "POST",
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify(body),
				});
				let value = null;
				try {
					value = await response.json();
				} catch {
					value = null;
				}
				if (!response.ok) {
					return { ok: false, message: value?.message ?? value?.error ?? `HTTP ${response.status}` };
				}
				return { ok: true, value };
			} catch (error) {
				return { ok: false, message: String(error) };
			}
		}
		//#endregion
		//#region icons
		/** Stroke clock on the 16px grid, sized like the shipped footer icons. */
		function IconClock({ size }) {
			return h("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" },
				h("circle", { cx: 8, cy: 8, r: 6.35, stroke: "currentColor", strokeWidth: 1.3 }),
				h("path", { d: "M8 4.6V8l2.3 1.7", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" }));
		}
		/** 14px back chevron matching the shipped chevron geometry. */
		function IconBack() {
			return h("svg", { width: 14, height: 14, viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true" },
				h("path", { d: "M8.75 3.5 5.25 7l3.5 3.5", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }));
		}
		function IconChevron({ size = 12, rotate = 0 }) {
			return h("svg", { width: size, height: size, viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true", style: rotate === 0 ? undefined : { transform: `rotate(${rotate}deg)` } },
				h("path", { d: "M5.25 3.5 8.75 7l-3.5 3.5", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }));
		}
		function IconPlus() {
			return h("svg", { width: 14, height: 14, viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true" },
				h("path", { d: "M7 2.9v8.2M2.9 7h8.2", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }));
		}
		function IconPlay() {
			return h("svg", { width: 12, height: 12, viewBox: "0 0 12 12", fill: "none", "aria-hidden": "true" },
				h("path", { d: "M3.6 2.8v6.4c0 .5.5.8.9.5l5-3.2c.4-.2.4-.8 0-1L4.5 2.3c-.4-.3-.9 0-.9.5Z", stroke: "currentColor", strokeWidth: 1.3, strokeLinejoin: "round" }));
		}
		function IconStop() {
			return h("svg", { width: 12, height: 12, viewBox: "0 0 12 12", fill: "none", "aria-hidden": "true" },
				h("rect", { x: 2.75, y: 2.75, width: 6.5, height: 6.5, rx: 1, stroke: "currentColor", strokeWidth: 1.4 }));
		}
		function IconFolder({ size = 14 }) {
			return h("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" },
				h("path", { d: "M1.8 4.2c0-.7.6-1.3 1.3-1.3h3l1.5 1.6h5.3c.7 0 1.3.6 1.3 1.3v6c0 .7-.6 1.3-1.3 1.3H3.1c-.7 0-1.3-.6-1.3-1.3v-7.6Z", stroke: "currentColor", strokeWidth: 1.3, strokeLinejoin: "round" }));
		}
		//#endregion
		//#region components
		/** Status dot with the muted fallback: StateDot inherits currentColor. */
		function Dot({ state }) {
			return h("span", { className: "dshCron_dotWrap" }, h(primitives.StateDot, { state, size: 10 }));
		}
		/** One job row in the list view, with its hover-revealed run/stop action. */
		function JobRow({ job, lastRecord, nowMs, busyAction, t, onOpen, onAction }) {
			const running = job.running === true;
			const meta = running ? statusMeta("running") : job.lastRun !== undefined ? statusMeta(job.lastRun.status) : statusMeta("pending-none");
			const dotState = running ? "ongoing" : job.enabled === false ? "muted" : job.lastRun !== undefined ? meta.dot : "muted";
			const statusText = job.enabled === false && !running
				? t("status.disabled")
				: running
					? t("status.running")
					: job.lastRun !== undefined
						? (meta.key !== undefined ? t(meta.key) : meta.raw)
						: t("status.pending");
			const danger = !running && job.enabled !== false && meta.danger === true;
			const duration = lastRecord !== undefined ? formatDuration(runElapsedMs(lastRecord, nowMs), t) : undefined;
			const muted = job.enabled === false || (!running && job.lastRun === undefined);
			const metaBits = [];
			if (job.next !== undefined) metaBits.push(t("meta.next", { time: formatInstant(job.next, t) }));
			if (job.source === "manual") metaBits.push(t("meta.source.manual"));
			if (job.enabledSource === "override") metaBits.push(t("meta.enabled.override"));
			const actionLabel = running ? t("action.stop") : t("action.run");
			return h("div", {
				role: "button",
				tabIndex: 0,
				className: muted ? "dshCron_row dshCron_rowMuted" : "dshCron_row",
				onClick: () => onOpen(job.name),
				onKeyDown: (event) => {
					if (event.key === "Enter" && event.target === event.currentTarget) onOpen(job.name);
				},
			},
				h("span", { className: "dshCron_rowLine" },
					h(Dot, { state: dotState }),
					h("span", { className: "dshCron_kind" }, job.kind),
					h("span", { className: "dshCron_name", title: job.name }, job.name),
					h("span", { className: danger ? "dshCron_status dshCron_statusDanger" : "dshCron_status", title: statusText }, statusText),
					duration !== undefined ? h("span", { className: "dshCron_duration" }, duration) : null,
					h("button", {
						type: "button",
						className: "dshCron_iconBtn dshCron_act",
						"aria-label": actionLabel,
						title: actionLabel,
						disabled: busyAction,
						onClick: (event) => {
							event.stopPropagation();
							onAction(job.name, running ? "stop" : "run");
						},
					}, running ? h(IconStop, {}) : h(IconPlay, {}))),
				h("span", { className: "dshCron_rowMeta" },
					h("span", { className: "dshCron_mono", title: job.schedule, style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" } }, job.schedule),
					...metaBits.flatMap((bit, index) => [h("span", { key: `s${index}` }, "·"), h("span", { key: index }, bit)])));
		}
		/** One run row in the drill-in view; danger rows expand their summary. */
		function RunRow({ record, expanded, nowMs, t, onToggle }) {
			const meta = statusMeta(record.status);
			const running = record.status === "running";
			const statusText = meta.key !== undefined ? t(meta.key) : meta.raw;
			const expandable = record.summary !== "" || record.error !== undefined || record.sessionId !== undefined;
			const line = h("span", { className: "dshCron_rowLine" },
				h(Dot, { state: running ? "ongoing" : meta.dot }),
				h("span", { className: "dshCron_seq" }, `#${record.seq}`),
				h("span", { className: "dshCron_target" }, formatInstant(record.target, t)),
				record.manual === true ? h("span", { className: "dshCron_kind" }, t("detail.manual")) : null,
				h("span", { className: meta.danger === true ? "dshCron_status dshCron_statusDanger" : "dshCron_status", title: statusText }, statusText),
				h("span", { className: "dshCron_duration" }, formatDuration(runElapsedMs(record, nowMs), t)));
			const card = expanded && expandable ? h("div", { className: "dshCron_card" },
				record.summary !== "" || record.error !== undefined ? h("pre", { className: "dshCron_cardText" }, record.error !== undefined ? record.error : record.summary) : null,
				record.sessionId !== undefined ? h("div", { className: "dshCron_cardMeta" }, h("span", { className: "dshCron_mono", title: record.sessionId }, t("detail.session", { id: record.sessionId }))) : null,
				record.exitCode !== undefined ? h("div", { className: "dshCron_cardMeta" }, h("span", { className: "dshCron_mono" }, t("detail.exit", { code: String(record.exitCode) }))) : null) : null;
			if (!expandable) return h("div", { className: "dshCron_runRow" }, line);
			return h("button", { type: "button", className: "dshCron_runRow", "aria-expanded": expanded, onClick: onToggle }, line, card);
		}
		/** Modal single-column directory navigator over ctx.workspaces.listDirectory. */
		function DirPicker({ workspaces, t, initialPath, onPick, onCancel }) {
			const [level, setLevel] = react.useState(null);
			const [busy, setBusy] = react.useState(true);
			const [error, setError] = react.useState(null);
			const seqRef = react.useRef(0);
			const load = react.useCallback(async (path) => {
				const seq = ++seqRef.current;
				setBusy(true);
				setError(null);
				try {
					const next = await workspaces.listDirectory(path);
					if (seq !== seqRef.current) return;
					setLevel(next);
				} catch (fault) {
					if (seq !== seqRef.current) return;
					if (path !== undefined) {
						// A bad start path falls back to home rather than erroring.
						load(undefined);
						return;
					}
					setError(String(fault?.message ?? fault));
				} finally {
					if (seq === seqRef.current) setBusy(false);
				}
			}, [workspaces]);
			react.useEffect(() => {
				load(initialPath !== "" && initialPath.startsWith("/") ? initialPath : undefined);
			}, [load, initialPath]);
			const sep = level !== null && level.path.includes("\\") ? "\\" : "/";
			const segments = level === null ? [] : level.path.split(sep).filter((part) => part !== "");
			const crumbs = segments.map((name, index) => ({
				name,
				path: sep === "/" ? `/${segments.slice(0, index + 1).join("/")}` : segments.slice(0, index + 1).join(sep),
			}));
			const shown = crumbs.slice(-3);
			const entries = (level?.entries ?? []).filter((entry) => {
				const name = entry.name ?? entry.path.split(sep).pop() ?? "";
				return !name.startsWith(".");
			});
			return h("div", { className: "dshCron_scrim", onClick: onCancel },
				h("div", { className: "dshCron_dialog", role: "dialog", "aria-label": t("picker.title"), onClick: (event) => event.stopPropagation() },
					h("div", { className: "dshCron_dlgHead" },
						h("span", { className: "dshCron_dlgTitle" }, t("picker.title")),
						h("span", { className: "dshCron_crumbs" },
							sep === "/" && shown.length < crumbs.length + 1 ? h("button", { type: "button", className: "dshCron_crumb", onClick: () => load("/") }, "/") : null,
							...shown.flatMap((crumb, index) => [
								h(IconChevron, { key: `c${index}`, size: 10 }),
								h("button", {
									key: crumb.path,
									type: "button",
									className: index === shown.length - 1 ? "dshCron_crumb dshCron_crumbOn" : "dshCron_crumb",
									title: crumb.path,
									onClick: () => load(crumb.path),
								}, crumb.name),
							]))),
					h("div", { className: "dshCron_dlgBody" },
						error !== null ? h("p", { className: "dshCron_note dshCron_noteError", role: "alert" }, error) : null,
						error === null && busy && level === null ? h("p", { className: "dshCron_note" }, t("picker.loading")) : null,
						error === null && !busy && entries.length === 0 && level !== null ? h("p", { className: "dshCron_note" }, t("picker.empty")) : null,
						...entries.map((entry) => {
							const name = entry.name ?? entry.path.split(sep).pop() ?? entry.path;
							return h("button", { key: entry.path, type: "button", className: "dshCron_dirRow", onClick: () => load(entry.path) },
								h("span", { className: "dshCron_dirIcon" }, h(IconFolder, { size: 15 })),
								h("span", { className: "dshCron_dirName", title: entry.path }, name),
								h("span", { className: "dshCron_dirIcon" }, h(IconChevron, { size: 11 })));
						})),
					h("div", { className: "dshCron_dlgFoot" },
						h("span", { className: "dshCron_dlgPath dshCron_mono", title: level?.path ?? "" }, level?.path ?? ""),
						h("button", { type: "button", className: "dshCron_btn dshCron_btnGhost", onClick: onCancel }, t("picker.cancel")),
						h("button", { type: "button", className: "dshCron_btn dshCron_btnPrimary", disabled: level === null, onClick: () => {
							if (level !== null) onPick(level.path);
						} }, t("picker.choose")))));
		}
		/** Segmented control shared by the trigger and task pickers. */
		function Seg({ options, value, onChange }) {
			return h("div", { className: "dshCron_seg", role: "tablist" },
				...options.map((option) => h("button", {
					key: option.value,
					type: "button",
					role: "tab",
					"aria-selected": value === option.value,
					className: value === option.value ? "dshCron_segItem dshCron_segOn" : "dshCron_segItem",
					onClick: () => onChange(option.value),
				}, option.label)));
		}
		/** The create-job form; posts the raw config-shaped spec to the host. */
		function NewJobForm({ t, workspaces, onBack, onCreated }) {
			const [name, setName] = react.useState("");
			const [trigger, setTrigger] = react.useState("cron");
			const [cron, setCron] = react.useState("0 7 * * *");
			const [timeZone, setTimeZone] = react.useState(() => {
				try {
					return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Asia/Shanghai";
				} catch {
					return "Asia/Shanghai";
				}
			});
			const [everySeconds, setEverySeconds] = react.useState("3600");
			const [at, setAt] = react.useState("");
			const [taskKind, setTaskKind] = react.useState("agent");
			const [prompt, setPrompt] = react.useState("");
			const [argv, setArgv] = react.useState("");
			const [cwd, setCwd] = react.useState("");
			const [timeout, setTimeoutSeconds] = react.useState("1800");
			const [overlap, setOverlap] = react.useState("skip");
			const [misfire, setMisfire] = react.useState("skip");
			const [picking, setPicking] = react.useState(false);
			const [submitting, setSubmitting] = react.useState(false);
			const [fault, setFault] = react.useState(null);
			const ready = name.trim() !== ""
				&& (trigger === "cron" ? cron.trim() !== "" && timeZone.trim() !== "" : trigger === "every" ? Number(everySeconds) >= 60 : at !== "")
				&& (taskKind === "agent" ? prompt.trim() !== "" : argv.trim() !== "");
			const submit = async () => {
				if (!ready || submitting) return;
				setSubmitting(true);
				setFault(null);
				const schedule = trigger === "cron"
					? { cron: cron.trim(), timeZone: timeZone.trim() }
					: trigger === "every"
						? { everySeconds: Number(everySeconds) }
						: { at: new Date(at).toISOString() };
				const task = {
					kind: taskKind,
					...(taskKind === "agent" ? { prompt: prompt.trim() } : { argv: argv.trim().split(/\s+/) }),
					...(cwd.trim() === "" ? {} : { cwd: cwd.trim() }),
					timeoutSeconds: Number(timeout) > 0 ? Number(timeout) : 1800,
				};
				const spec = { name: name.trim(), schedule, task, policy: { overlap, misfire } };
				const outcome = await postAction(JOBS_PATH, { spec });
				setSubmitting(false);
				if (!outcome.ok) {
					setFault(outcome.message);
					return;
				}
				onCreated();
			};
			const field = (label, control, hint) => h("div", { className: "dshCron_field" },
				h("span", { className: "dshCron_lbl" }, label),
				control,
				hint !== undefined ? h("span", { className: "dshCron_lbl" }, hint) : null);
			return h("div", { className: "dshCron_form" },
				field(t("form.name"), h("input", {
					className: "dshCron_input dshCron_mono",
					value: name,
					placeholder: "weekly-deps-audit",
					onChange: (event) => setName(event.target.value),
				}), t("form.name.hint")),
				h("div", { className: "dshCron_field" },
					h("span", { className: "dshCron_lbl" }, t("form.trigger")),
					h(Seg, {
						options: [
							{ value: "cron", label: t("form.trigger.cron") },
							{ value: "every", label: t("form.trigger.every") },
							{ value: "at", label: t("form.trigger.at") },
						],
						value: trigger,
						onChange: setTrigger,
					}),
					trigger === "cron" ? h("div", { className: "dshCron_inputRow" },
						h("input", { className: "dshCron_input dshCron_mono", style: { flex: 1.2 }, value: cron, placeholder: "0 7 * * *", "aria-label": t("form.cron"), onChange: (event) => setCron(event.target.value) }),
						h("input", { className: "dshCron_input", style: { flex: 1 }, value: timeZone, "aria-label": t("form.timezone"), onChange: (event) => setTimeZone(event.target.value) })) : null,
					trigger === "every" ? h("input", { className: "dshCron_input dshCron_mono", type: "number", min: 60, value: everySeconds, "aria-label": t("form.every"), onChange: (event) => setEverySeconds(event.target.value) }) : null,
					trigger === "at" ? h("input", { className: "dshCron_input", type: "datetime-local", value: at, "aria-label": t("form.at"), onChange: (event) => setAt(event.target.value) }) : null),
				h("div", { className: "dshCron_field" },
					h("span", { className: "dshCron_lbl" }, t("form.task")),
					h(Seg, {
						options: [
							{ value: "agent", label: "agent" },
							{ value: "command", label: "command" },
						],
						value: taskKind,
						onChange: setTaskKind,
					}),
					taskKind === "agent"
						? h("textarea", { className: "dshCron_input", value: prompt, "aria-label": t("form.prompt"), onChange: (event) => setPrompt(event.target.value) })
						: h("input", { className: "dshCron_input dshCron_mono", value: argv, placeholder: "/bin/date -u", "aria-label": t("form.argv"), onChange: (event) => setArgv(event.target.value) }),
					taskKind === "agent" ? h("span", { className: "dshCron_lbl" }, t("form.prompt.hint")) : null),
				field(t("form.cwd"), h("div", { className: "dshCron_cwdBox" },
					h("input", {
						className: "dshCron_input dshCron_mono",
						value: cwd,
						placeholder: "/path/to/project",
						onChange: (event) => setCwd(event.target.value),
					}),
					workspaces !== undefined ? h("button", {
						type: "button",
						className: "dshCron_iconBtn",
						style: { width: 24, height: 24 },
						"aria-label": t("form.browse"),
						title: t("form.browse"),
						onClick: () => setPicking(true),
					}, h(IconFolder, {})) : null), t("form.cwd.hint")),
				h("div", { className: "dshCron_inputRow" },
					field(t("form.timeout"), h("input", { className: "dshCron_input dshCron_mono", type: "number", min: 1, value: timeout, onChange: (event) => setTimeoutSeconds(event.target.value) })),
					field(t("form.overlap"), h("select", { className: "dshCron_input", value: overlap, onChange: (event) => setOverlap(event.target.value) },
						h("option", { value: "skip" }, t("form.overlap.skip")),
						h("option", { value: "queue" }, t("form.overlap.queue")),
						h("option", { value: "replace" }, t("form.overlap.replace")))),
					field(t("form.misfire"), h("select", { className: "dshCron_input", value: misfire, onChange: (event) => setMisfire(event.target.value) },
						h("option", { value: "skip" }, t("form.misfire.skip")),
						h("option", { value: "runOnce" }, t("form.misfire.runOnce"))))),
				fault !== null ? h("p", { className: "dshCron_note dshCron_noteError", role: "alert", style: { padding: 0 } }, fault) : null,
				h("button", { type: "button", className: "dshCron_submit", disabled: !ready || submitting, onClick: submit },
					submitting ? t("form.submitting") : t("form.submit")),
				picking && workspaces !== undefined ? h(DirPicker, {
					workspaces,
					t,
					initialPath: cwd.trim(),
					onPick: (path) => {
						setCwd(path);
						setPicking(false);
					},
					onCancel: () => setPicking(false),
				}) : null);
		}
		/**
		* Sidebar-foot entry point: the badge and its fixed panel. Three views:
		* the job list (with hover run/stop actions), one job's run history,
		* and the create-job form.
		*/
		function CronJobsAction({ wide, t, workspaces }) {
			const [open, setOpen] = react.useState(false);
			const [view, setView] = react.useState(null);
			const [expanded, setExpanded] = react.useState(null);
			const [snapshot, setSnapshot] = react.useState(null);
			const [actionFault, setActionFault] = react.useState(null);
			const [busyAction, setBusyAction] = react.useState(false);
			const [nowMs, setNowMs] = react.useState(() => Date.now());
			const rootRef = react.useRef(null);
			const [anchor, setAnchor] = react.useState(undefined);
			const refresh = react.useCallback(async () => {
				const degrade = (error) => {
					// A failed refresh keeps the last good data on screen; the
					// hard error state is only for a panel that never loaded.
					setSnapshot((previous) => previous?.data !== undefined ? previous : { error });
				};
				try {
					const response = await fetch(new URL(STATE_PATH, location.origin), { headers: { accept: "application/json" } });
					if (!response.ok) {
						degrade(response.status === 503 ? "unavailable" : "network");
						return;
					}
					setSnapshot({ data: await response.json() });
				} catch {
					degrade("network");
				}
			}, []);
			react.useEffect(() => {
				refresh();
			}, [refresh]);
			react.useEffect(() => {
				if (!open) return;
				refresh();
				const timer = setInterval(refresh, 15e3);
				return () => {
					clearInterval(timer);
				};
			}, [open, refresh]);
			const jobs = snapshot?.data?.jobs ?? [];
			const runs = snapshot?.data?.runs ?? [];
			const runningCount = jobs.filter((job) => job.running === true).length;
			react.useEffect(() => {
				if (!open || runningCount === 0) return;
				setNowMs(Date.now());
				const timer = setInterval(() => {
					setNowMs(Date.now());
				}, 1e3);
				return () => {
					clearInterval(timer);
				};
			}, [open, runningCount]);
			react.useLayoutEffect(() => {
				if (!open) return;
				const place = () => {
					const rect = rootRef.current?.getBoundingClientRect();
					if (rect !== undefined) setAnchor({ left: rect.left, bottom: window.innerHeight - rect.top + 8 });
				};
				place();
				window.addEventListener("resize", place);
				return () => {
					window.removeEventListener("resize", place);
				};
			}, [open]);
			primitives.useDismissOnOutsidePointer(rootRef, open, setOpen);
			const runAction = react.useCallback(async (jobName, kind) => {
				setBusyAction(true);
				setActionFault(null);
				const outcome = await postAction(kind === "stop" ? STOP_PATH : RUN_NOW_PATH, { job: jobName });
				setBusyAction(false);
				if (!outcome.ok) setActionFault(t("action.failed", { message: outcome.message }));
				refresh();
			}, [refresh, t]);
			const onKeyDown = (event) => {
				if (event.key !== "Escape" || !open) return;
				event.preventDefault();
				if (view !== null) {
					setView(null);
					setExpanded(null);
					return;
				}
				setOpen(false);
			};
			const lastRecordOf = (job) => job.lastRun === undefined ? undefined : runs.find((record) => record.job === job.name && record.seq === job.lastRun.seq);
			const countLabel = runningCount > 0 ? t("badge.running", { count: runningCount }) : t("badge.jobs", { count: jobs.length });
			let body;
			if (view === null && snapshot?.error !== undefined) {
				body = h("p", { className: "dshCron_note dshCron_noteError", role: "alert" }, t(snapshot.error === "unavailable" ? "error.unavailable" : "error.network"));
			} else if (view === null) {
				body = h(react.Fragment, {},
					actionFault !== null ? h("p", { className: "dshCron_note dshCron_noteError", role: "alert", style: { paddingTop: 0, paddingBottom: 4 } }, actionFault) : null,
					jobs.length === 0
						? h("p", { className: "dshCron_note" }, t("empty.jobs"))
						: jobs.map((job) => h(JobRow, { key: job.name, job, lastRecord: lastRecordOf(job), nowMs, busyAction, t, onAction: runAction, onOpen: (name) => {
							setView({ kind: "job", name });
							setExpanded(null);
						} })));
			} else if (view.kind === "new") {
				body = h(react.Fragment, {},
					h("div", { className: "dshCron_detailHead" },
						h("button", { type: "button", className: "dshCron_back", "aria-label": t("panel.title"), onClick: () => setView(null) }, h(IconBack, {})),
						h("span", { style: { flex: 1, fontWeight: 600 } }, t("form.title"))),
					h(NewJobForm, { t, workspaces, onBack: () => setView(null), onCreated: () => {
						setView(null);
						refresh();
					} }));
			} else {
				const jobName = view.name;
				const job = jobs.find((entry) => entry.name === jobName);
				const jobRuns = runs.filter((record) => record.job === jobName);
				body = h(react.Fragment, {},
					h("div", { className: "dshCron_detailHead" },
						h("button", { type: "button", className: "dshCron_back", "aria-label": t("panel.title"), onClick: () => {
							setView(null);
							setExpanded(null);
						} }, h(IconBack, {})),
						h("span", { className: "dshCron_detailName", title: jobName }, jobName),
						job !== undefined ? h("span", { className: "dshCron_kind" }, job.kind) : null),
					job !== undefined ? h("div", { className: "dshCron_detailMeta" },
						h("span", { className: "dshCron_mono" }, job.schedule),
						job.next !== undefined ? h("span", {}, t("meta.next", { time: formatInstant(job.next, t) })) : null,
						job.source === "manual" ? h("span", {}, t("meta.source.manual")) : null,
						job.enabled === false ? h("span", {}, t("status.disabled")) : null) : null,
					h("div", { className: "dshCron_divider" }),
					...jobRuns.map((record) => {
						const key = `${record.job}#${record.seq}`;
						return h(RunRow, { key, record, expanded: expanded === key, nowMs, t, onToggle: () => {
							setExpanded(expanded === key ? null : key);
						} });
					}),
					jobRuns.length === 0 ? h("p", { className: "dshCron_note" }, t("status.pending")) : null);
			}
			return h("div", { ref: rootRef, className: wide ? "dshCron_layer" : "dshCron_layer dshCron_rail", onKeyDown },
				open && anchor !== undefined ? h("section", { className: "dshCron_panel", style: anchor, "aria-label": t("panel.aria") },
					view === null ? h("div", { className: "dshCron_head" },
						h("span", { className: "dshCron_headTitle" }, t("panel.title")),
						h("span", { className: "dshCron_headCount" }, runningCount > 0 ? t("head.count.running", { count: jobs.length, running: runningCount }) : t("head.count.idle", { count: jobs.length })),
						h("button", { type: "button", className: "dshCron_iconBtn", "aria-label": t("head.add"), title: t("head.add"), onClick: () => setView({ kind: "new" }) }, h(IconPlus, {}))) : null,
					body) : null,
				h("button", {
					type: "button",
					className: "dshCron_badge",
					"data-active": runningCount > 0 || undefined,
					"aria-label": t("panel.aria"),
					"aria-expanded": open,
					onClick: () => {
						setNowMs(Date.now());
						setOpen((value) => !value);
						setView(null);
						setExpanded(null);
					},
				},
					h(IconClock, { size: wide ? 16 : 18 }),
					wide ? h(react.Fragment, {},
						h("span", { className: "dshCron_badgeLabel" }, t("panel.trigger")),
						h("span", { className: "dshCron_badgeCount" }, countLabel)) : null));
		}
		//#endregion
		//#region plugin
		/** Dictionary namespace owned by this plugin. */
		const NS = "cron";
		/** Required client services for the sidebar registration and the directory picker's data plane. */
		const inject = ["slots", "locale", "workspaces"];
		/** Register dictionaries and the sidebar-foot overlay entry. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "cron: dictionaries");
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "cron-jobs",
				order: 20,
				locale: NS,
				inject: () => ({ workspaces: ctx.workspaces }),
			}, CronJobsAction));
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
