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
		// ui-cordis CordisPanel, the menu/rows from ui-jobs JobListAction.
		// Colors are dsw tokens only, so both themes come for free.
		const css = [
			".dshCron_layer{flex:none;align-items:center;width:100%;height:42px;margin:8px 0 0;display:flex;position:relative}",
			".dshCron_badge{width:calc(100% + 4px);height:42px;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:none;border-radius:12px;align-items:center;gap:8px;margin:0 -2px;padding:0 10px 0 8px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden}",
			".dshCron_badge:hover,.dshCron_badge[data-active]{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshCron_badgeLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}",
			".dshCron_badgeCount{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex:none;margin-left:auto;font-size:12px;line-height:16px}",
			".dshCron_layer.dshCron_rail{width:36px;height:36px;margin:0}",
			".dshCron_rail .dshCron_badge{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;padding:0}",
			".dshCron_panel{z-index:30;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-specific-menu);width:336px;max-width:calc(100vw - 24px);max-height:min(480px,60vh);box-shadow:var(--dsw-shadow-lv3);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:12px;flex-direction:column;gap:1px;padding:4px;display:flex;position:fixed;overflow:auto}",
			".dshCron_head{box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:6px 8px 4px;font-size:11px;line-height:18px;color:var(--dsw-alias-label-caption)}",
			".dshCron_headTitle{flex:1}",
			".dshCron_headCount{font-variant-numeric:tabular-nums}",
			".dshCron_row{box-sizing:border-box;width:100%;color:var(--dsw-alias-label-primary);text-align:inherit;background:0 0;border:0;font-family:inherit;cursor:pointer;border-radius:8px;display:flex;flex-direction:column;gap:0;padding:6px 8px}",
			".dshCron_row:hover,.dshCron_row:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshCron_rowMuted{color:var(--dsw-alias-label-tertiary)}",
			".dshCron_rowLine{display:flex;align-items:center;gap:8px;font-size:13px;line-height:18px}",
			".dshCron_rowMeta{display:flex;align-items:center;gap:6px;padding-left:18px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption);white-space:nowrap;overflow:hidden}",
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
			".dshCron_foot{display:flex;align-items:center;justify-content:center;padding:4px 8px 6px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption)}",
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
			"empty.jobs": "profile 未声明任何定时作业。",
			"error.unavailable": "调度器未运行。",
			"error.network": "读取失败，稍后自动重试。",
			"status.ok": "成功",
			"status.failed": "已失败",
			"status.timeout": "超时",
			"status.replaced": "被替换",
			"status.aborted": "中止",
			"status.skipped": "已跳过 · 重叠",
			"status.running": "运行中",
			"status.pending": "待触发",
			"status.disabled": "已停用",
			"meta.next": "下次 {time}",
			"meta.enabled.override": "会话改动",
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
			"empty.jobs": "No cron jobs declared in this profile.",
			"error.unavailable": "The scheduler is not running.",
			"error.network": "Read failed; retrying automatically.",
			"status.ok": "ok",
			"status.failed": "failed",
			"status.timeout": "timeout",
			"status.replaced": "replaced",
			"status.aborted": "aborted",
			"status.skipped": "skipped · overlap",
			"status.running": "running",
			"status.pending": "pending",
			"status.disabled": "disabled",
			"meta.next": "next {time}",
			"meta.enabled.override": "override",
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
		};
		//#endregion
		//#region view model
		/** Exact route served by ../web.js on the host. */
		const STATE_PATH = "/dsh-cron/api/state";
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
		//#endregion
		//#region components
		/** Status dot with the muted fallback: StateDot inherits currentColor. */
		function Dot({ state }) {
			return h("span", { className: "dshCron_dotWrap" }, h(primitives.StateDot, { state, size: 10 }));
		}
		/** One job row in the list view. */
		function JobRow({ job, lastRecord, nowMs, t, onOpen }) {
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
			const metaBits = [job.schedule];
			if (job.next !== undefined) metaBits.push(t("meta.next", { time: formatInstant(job.next, t) }));
			if (job.enabledSource === "override") metaBits.push(t("meta.enabled.override"));
			return h("button", {
				type: "button",
				className: muted ? "dshCron_row dshCron_rowMuted" : "dshCron_row",
				onClick: () => onOpen(job.name),
			},
				h("span", { className: "dshCron_rowLine" },
					h(Dot, { state: dotState }),
					h("span", { className: "dshCron_kind" }, job.kind),
					h("span", { className: "dshCron_name", title: job.name }, job.name),
					h("span", { className: danger ? "dshCron_status dshCron_statusDanger" : "dshCron_status", title: statusText }, statusText),
					duration !== undefined ? h("span", { className: "dshCron_duration" }, duration) : null),
				h("span", { className: "dshCron_rowMeta" },
					metaBits.flatMap((bit, index) => index === 0
						? [h("span", { key: index, className: "dshCron_mono", title: bit, style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" } }, bit)]
						: [h("span", { key: `s${index}` }, "·"), h("span", { key: index }, bit)])));
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
		/**
		* Sidebar-foot entry point: the badge and its fixed panel. List view
		* first; a job row drills into that job's run history. Read-only —
		* the overlay observes the host scheduler, it never steers it.
		*/
		function CronJobsAction({ wide, t }) {
			const [open, setOpen] = react.useState(false);
			const [view, setView] = react.useState(null);
			const [expanded, setExpanded] = react.useState(null);
			const [snapshot, setSnapshot] = react.useState(null);
			const [nowMs, setNowMs] = react.useState(() => Date.now());
			const rootRef = react.useRef(null);
			const [anchor, setAnchor] = react.useState(undefined);
			const refresh = react.useCallback(async () => {
				try {
					const response = await fetch(new URL(STATE_PATH, location.origin), { headers: { accept: "application/json" } });
					if (!response.ok) {
						setSnapshot({ error: response.status === 503 ? "unavailable" : "network" });
						return;
					}
					setSnapshot({ data: await response.json() });
				} catch {
					setSnapshot({ error: "network" });
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
			if (snapshot?.error !== undefined) {
				body = h("p", { className: "dshCron_note dshCron_noteError", role: "alert" }, t(snapshot.error === "unavailable" ? "error.unavailable" : "error.network"));
			} else if (view === null) {
				body = jobs.length === 0
					? h("p", { className: "dshCron_note" }, t("empty.jobs"))
					: jobs.map((job) => h(JobRow, { key: job.name, job, lastRecord: lastRecordOf(job), nowMs, t, onOpen: (name) => {
						setView(name);
						setExpanded(null);
					} }));
			} else {
				const job = jobs.find((entry) => entry.name === view);
				const jobRuns = runs.filter((record) => record.job === view);
				body = [
					h("div", { key: "head", className: "dshCron_detailHead" },
						h("button", { type: "button", className: "dshCron_back", "aria-label": t("panel.title"), onClick: () => {
							setView(null);
							setExpanded(null);
						} }, h(IconBack, {})),
						h("span", { className: "dshCron_detailName", title: view }, view),
						job !== undefined ? h("span", { className: "dshCron_kind" }, job.kind) : null),
					job !== undefined ? h("div", { key: "meta", className: "dshCron_detailMeta" },
						h("span", { className: "dshCron_mono" }, job.schedule),
						job.next !== undefined ? h("span", {}, t("meta.next", { time: formatInstant(job.next, t) })) : null,
						job.enabled === false ? h("span", {}, t("status.disabled")) : null) : null,
					h("div", { key: "div", className: "dshCron_divider" }),
					...jobRuns.map((record) => {
						const key = `${record.job}#${record.seq}`;
						return h(RunRow, { key, record, expanded: expanded === key, nowMs, t, onToggle: () => {
							setExpanded(expanded === key ? null : key);
						} });
					}),
					jobRuns.length === 0 ? h("p", { key: "none", className: "dshCron_note" }, t("status.pending")) : null,
				];
			}
			return h("div", { ref: rootRef, className: wide ? "dshCron_layer" : "dshCron_layer dshCron_rail", onKeyDown },
				open && anchor !== undefined ? h("section", { className: "dshCron_panel", style: anchor, "aria-label": t("panel.aria") },
					view === null ? h("div", { className: "dshCron_head" },
						h("span", { className: "dshCron_headTitle" }, t("panel.title")),
						h("span", { className: "dshCron_headCount" }, runningCount > 0 ? t("head.count.running", { count: jobs.length, running: runningCount }) : t("head.count.idle", { count: jobs.length }))) : null,
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
		/** Required client services for the sidebar registration. */
		const inject = ["slots", "locale"];
		/** Register dictionaries and the sidebar-foot overlay entry. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "cron: dictionaries");
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "cron-jobs",
				order: 20,
				locale: NS,
			}, CronJobsAction));
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
