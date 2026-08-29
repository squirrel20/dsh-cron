window.__ModuleLoader__.load({
	id: "dsh-cron",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let reactDom = require("react-dom");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		const h = react.createElement;
		//#region styles
		// Anatomy copied from shipped surfaces: the section header and the
		// 32px job rows from ui-workspace's WorkspaceBrowser/Rows (search
		// capsule, hover-swapped slot and actions included), menus and the
		// modal from the shipped primitives. Colors are dsw tokens only, so
		// both themes come for free.
		const css = [
			// Region placement: the section portals into the sidebar's region
			// area right below the workspaces slot, so the workspace browser
			// must size to content (shrinkable, inner list still scrolls)
			// instead of greedily filling the column. data-slot is the only
			// stable hook — the browser's own class names are hashed.
			"div[data-slot=\"sidebar.workspaces\"]{flex:0 1 auto;min-height:0}",
			"div[data-slot=\"sidebar.workspaces\"]>*{flex:0 1 auto;min-height:0}",
			// The holder shares the region column with the workspaces slot:
			// content-sized, shrinkable, so the job list may use whatever
			// height the workspaces browser leaves free and only scrolls once
			// the column itself runs out (the fixed cap below stays for the
			// footer fallback, where no ancestor bounds the section).
			".dshCron_holder{box-sizing:border-box;flex:0 1 auto;min-height:0;width:100%;min-width:0;display:flex;padding-right:var(--dsh-sidebar-inline-padding,12px)}",
			".dshCron_section{box-sizing:border-box;width:100%;min-width:0;min-height:0;flex:none;display:flex;flex-direction:column;margin:2px 0 4px}",
			".dshCron_head{box-sizing:border-box;height:36px;flex:none;display:flex;align-items:center;gap:4px;padding-left:4px;color:var(--dsw-alias-label-tertiary)}",
			".dshCron_headLabel{flex:none;white-space:nowrap;line-height:20px;overflow:hidden;text-overflow:ellipsis}",
			".dshCron_headTitle{display:flex;flex:1;min-width:0;align-items:center;gap:4px}",
			".dshCron_headCount{flex:1;min-width:0;margin-left:4px;font-size:12px;line-height:20px;color:var(--dsw-alias-state-business-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}",
			".dshCron_headBtn{cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}",
			".dshCron_headBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshCron_searchBox{box-sizing:border-box;display:flex;align-items:center;flex:1;min-width:0;height:30px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;color:var(--dsw-alias-label-caption);margin:0 -2px 0 -4px;padding:0 4px 0 0}",
			".dshCron_searchBox .dshCron_headBtn{width:28px;height:28px;color:inherit}",
			".dshCron_searchBox .dshCron_headBtn:hover{background:0 0}",
			".dshCron_searchInput{flex:1;min-width:0;border:0;background:0 0;outline:none;color:var(--dsw-alias-label-primary);font-size:13px;line-height:18px;font-family:inherit;padding:0}",
			".dshCron_searchInput::placeholder{color:var(--dsw-alias-label-tertiary)}",
			".dshCron_list{display:flex;flex-direction:column;gap:2px;min-height:0;overflow-y:auto;max-height:min(320px,38vh)}",
			".dshCron_holder .dshCron_list{max-height:none}",
			".dshCron_row{box-sizing:border-box;width:100%;flex:none;display:flex;align-items:center;height:32px;padding:0 8px;border-radius:8px;cursor:pointer;user-select:none;color:var(--dsw-alias-label-primary);background:0 0;border:0;text-align:inherit;font-family:inherit}",
			".dshCron_row:hover,.dshCron_rowMenuOpen{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshCron_slot{width:16px;height:20px;flex:none;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary)}",
			".dshCron_slotDot{display:inline-flex}",
			".dshCron_slotArrow{display:none;color:var(--dsw-alias-label-caption)}",
			".dshCron_row:hover .dshCron_slotArrow,.dshCron_rowMenuOpen .dshCron_slotArrow{display:inline-flex}",
			".dshCron_row:hover .dshCron_slotDot,.dshCron_rowMenuOpen .dshCron_slotDot{display:none}",
			".dshCron_arrow{display:inline-flex;transition:transform .15s var(--ds-ease-in-out)}",
			".dshCron_arrowOpen{transform:rotate(90deg)}",
			".dshCron_name{flex:1;min-width:0;margin:0 6px 0 4px;font-size:13px;line-height:20px;font-family:var(--dsw-font-mono,var(--ds-font-family-code,monospace));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshCron_nameMuted{color:var(--dsw-alias-label-tertiary)}",
			".dshCron_when{flex:none;font-size:12px;line-height:20px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}",
			".dshCron_whenOngoing{color:var(--dsw-alias-state-business-primary)}",
			".dshCron_rowActions{flex:none;display:none;align-items:center}",
			".dshCron_row:hover .dshCron_rowActions,.dshCron_rowMenuOpen .dshCron_rowActions{display:inline-flex}",
			".dshCron_row:hover .dshCron_when,.dshCron_rowMenuOpen .dshCron_when{display:none}",
			".dshCron_iconBtn{cursor:pointer;width:16px;height:16px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;border-radius:4px;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}",
			".dshCron_iconBtn:hover{color:var(--dsw-alias-label-primary)}",
			".dshCron_confirm{flex:none;font-size:11px;line-height:18px;color:var(--dsw-alias-state-error-primary);cursor:pointer;background:0 0;border:0;border-radius:5px;padding:1px 6px;font-family:inherit}",
			".dshCron_confirm:hover{background:var(--dsw-alias-interactive-bg-hover-danger,var(--dsw-alias-interactive-bg-hover))}",
			".dshCron_runRow{box-sizing:border-box;width:100%;flex:none;display:flex;flex-direction:column;gap:6px;padding:4px 8px 4px 28px;border-radius:8px;color:var(--dsw-alias-label-primary);background:0 0;border:0;text-align:inherit;font-family:inherit}",
			"button.dshCron_runRow{cursor:pointer}",
			"button.dshCron_runRow:hover,.dshCron_runSelected{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshCron_runLine{display:flex;align-items:center;gap:6px;width:100%;min-height:20px}",
			".dshCron_seq{flex:none;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);font-family:var(--dsw-font-mono,var(--ds-font-family-code,monospace))}",
			".dshCron_target{flex:1;min-width:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshCron_dotWrap{flex:none;color:var(--dsw-alias-label-caption);display:inline-flex}",
			".dshCron_more{box-sizing:border-box;width:100%;flex:none;height:28px;display:flex;align-items:center;padding:0 12px 0 44px;font-size:12px;line-height:20px;color:var(--dsw-alias-label-tertiary);background:0 0;border:0;cursor:pointer;border-radius:8px;font-family:inherit;text-align:left}",
			".dshCron_more:hover{color:var(--dsw-alias-label-secondary)}",
			// command-run detail page: portals over the center (conversation)
			// column, the same surface an agent run's session opens in. The
			// anchor's parent gets position:relative via :has so inset:0 spans
			// exactly the center column, never the whole frame.
			"div:has(> div[data-slot=\"conversation\"]){position:relative}",
			".dshCron_page{box-sizing:border-box;position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;min-width:0;background:var(--dsw-alias-bg-base)}",
			".dshCron_pageHead{flex:none;display:flex;align-items:center;gap:10px;min-width:0;padding:12px 20px;border-bottom:1px solid var(--dsw-alias-border-l2)}",
			".dshCron_pageName{min-width:0;font-size:14px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-mono,var(--ds-font-family-code,monospace));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshCron_pageSeq{flex:none;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);font-family:var(--dsw-font-mono,var(--ds-font-family-code,monospace))}",
			".dshCron_pageSpacer{flex:1;min-width:8px}",
			".dshCron_pageStatus{flex:none;display:inline-flex;align-items:center;gap:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}",
			".dshCron_pageStatusDanger{color:var(--dsw-alias-state-error-primary)}",
			".dshCron_pageBody{flex:1;min-height:0;overflow-y:auto;padding:16px 20px 24px}",
			".dshCron_pageInner{box-sizing:border-box;width:min(748px,100%);margin:0 auto;display:flex;flex-direction:column;gap:16px}",
			".dshCron_pageMeta{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;font-size:12px;line-height:18px}",
			".dshCron_pageMetaLabel{color:var(--dsw-alias-label-tertiary);white-space:nowrap}",
			".dshCron_pageMetaValue{color:var(--dsw-alias-label-primary);min-width:0;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}",
			".dshCron_pageBlockTitle{font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary);margin:0 0 6px}",
			".dshCron_pagePre{box-sizing:border-box;margin:0;padding:12px 14px;border-radius:10px;background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-interactive-bg-hover));font-family:var(--dsw-font-mono,var(--ds-font-family-code,monospace));font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere}",
			".dshCron_pagePreError{color:var(--dsw-alias-state-error-primary)}",
			".dshCron_mono{font-family:var(--dsw-font-mono,var(--ds-font-family-code,monospace))}",
			".dshCron_note{color:var(--dsw-alias-label-tertiary);padding:6px 8px;font-size:12px;line-height:18px}",
			".dshCron_noteError{color:var(--dsw-alias-state-error-primary)}",
			// model chip + drill-in panel (composer model-select anatomy)
			".dshCron_chip{display:inline-flex;align-items:center;gap:5px;box-sizing:border-box;height:32px;max-width:100%;min-width:0;padding:0 10px;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover);border:0;cursor:pointer;font-family:inherit;color:var(--dsw-alias-label-primary)}",
			".dshCron_chipName{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:13px;line-height:18px}",
			".dshCron_chipEffort{flex:none;font-size:13px;line-height:18px;color:var(--dsw-alias-label-tertiary)}",
			".dshCron_chipChevron{flex:none;color:var(--dsw-alias-label-tertiary);display:inline-flex}",
			".dshCron_mwrap{position:relative;min-width:0}",
			".dshCron_mpanel{position:absolute;top:calc(100% + 4px);left:0;z-index:70;box-sizing:border-box;width:min(300px,100%);max-height:300px;overflow-y:auto;background:var(--dsw-specific-menu);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;box-shadow:var(--dsw-shadow-lv3);padding:6px;display:flex;flex-direction:column;gap:1px}",
			".dshCron_mrow{display:flex;align-items:center;gap:12px;box-sizing:border-box;width:100%;min-height:40px;padding:0 12px;border-radius:9px;cursor:pointer;background:0 0;border:0;font-family:inherit;text-align:inherit;color:var(--dsw-alias-label-primary)}",
			".dshCron_mrow:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshCron_mrowLabel{flex:none;font-size:14px;line-height:20px;font-weight:500}",
			".dshCron_mrowValue{flex:1;min-width:0;font-size:14px;line-height:20px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshCron_mrowValueEnd{text-align:right}",
			".dshCron_mrowChevron{flex:none;color:var(--dsw-alias-label-caption);display:inline-flex}",
			".dshCron_mitem{display:flex;align-items:center;gap:8px;box-sizing:border-box;width:100%;min-height:34px;padding:0 12px;border-radius:9px;cursor:pointer;background:0 0;border:0;font-family:inherit;text-align:inherit;color:var(--dsw-alias-label-primary)}",
			".dshCron_mitem:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshCron_mitemName{flex:1;min-width:0;font-size:13px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshCron_mitemOn{color:var(--dsw-alias-state-business-primary)}",
			".dshCron_mcaption{padding:6px 12px 2px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption)}",
			// form (inside the modal)
			".dshCron_form{display:flex;flex-direction:column;gap:16px;min-width:0}",
			".dshCron_field{display:flex;flex-direction:column;gap:6px;min-width:0}",
			".dshCron_lbl{font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary)}",
			".dshCron_hint{font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption)}",
			".dshCron_input{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-specific-input-major,transparent);padding:6px 10px;font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary);font-family:inherit;outline:none}",
			".dshCron_input:focus-visible{border-color:var(--dsw-alias-border-l4)}",
			".dshCron_input::placeholder{color:var(--dsw-alias-label-caption)}",
			".dshCron_input:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}",
			"textarea.dshCron_input{resize:vertical;min-height:64px}",
			"select.dshCron_input{appearance:auto;padding:5px 6px}",
			".dshCron_inputRow{display:flex;align-items:center;gap:6px}",
			".dshCron_unit{flex:none;font-size:12px;color:var(--dsw-alias-label-secondary)}",
			".dshCron_cwdBox{box-sizing:border-box;display:flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-specific-input-major,transparent);padding:0 4px 0 0}",
			".dshCron_cwdBox > input{border:0;background:0 0;flex:1;min-width:0}",
			".dshCron_cwdBtn{cursor:pointer;width:24px;height:24px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;border-radius:5px;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}",
			".dshCron_cwdBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}",
			".dshCron_seg{display:flex;background:var(--dsw-specific-selector,var(--dsw-alias-interactive-bg-hover-solid));border-radius:8px;padding:2px;gap:2px}",
			".dshCron_segItem{flex:1;text-align:center;font-size:12px;line-height:18px;padding:3px 0;border-radius:6px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:0;font-family:inherit}",
			".dshCron_segOn{background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-menu));color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-shadow-lv1)}",
			// the shipped Modal is a fixed 380px; the routine-style form needs more room
			"div[role=\"dialog\"]:has(.dshCron_form){width:min(640px,calc(100vw - 32px))}",
			// composite task editor (textarea + attached toolbar rows, routine-dialog anatomy)
			".dshCron_editor{box-sizing:border-box;display:flex;flex-direction:column;min-width:0;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-specific-input-major,transparent)}",
			".dshCron_editor:focus-within{border-color:var(--dsw-alias-border-l4)}",
			".dshCron_editorText{box-sizing:border-box;width:100%;min-height:132px;border:0;background:0 0;outline:none;resize:vertical;padding:10px 12px;font-size:13px;line-height:19px;color:var(--dsw-alias-label-primary);font-family:inherit}",
			".dshCron_editorText::placeholder{color:var(--dsw-alias-label-caption)}",
			"input.dshCron_editorText{min-height:0;resize:none}",
			".dshCron_editorBar{display:flex;align-items:center;gap:6px;min-width:0;padding:6px 8px;border-top:1px solid var(--dsw-alias-border-l2)}",
			".dshCron_editorSpacer{flex:1;min-width:8px}",
			".dshCron_tbSelect{box-sizing:border-box;flex:0 1 auto;min-width:36px;max-width:46%;overflow:hidden;text-overflow:ellipsis;border:0;border-radius:6px;background:0 0;padding:4px;font-size:12px;line-height:16px;color:var(--dsw-alias-label-secondary);font-family:inherit;outline:none;cursor:pointer}",
			".dshCron_editorBar .dshCron_mwrap{flex:0 1 auto}",
			".dshCron_tbSelect:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".dshCron_tbInput{flex:1;min-width:0;border:0;background:0 0;outline:none;padding:4px 2px;font-size:12px;line-height:16px;color:var(--dsw-alias-label-primary)}",
			".dshCron_tbInput::placeholder{color:var(--dsw-alias-label-caption)}",
			".dshCron_chipSm{height:26px;padding:0 8px;border-radius:6px;background:0 0}",
			".dshCron_chipSm:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dshCron_chipSm .dshCron_chipName,.dshCron_chipSm .dshCron_chipEffort{font-size:12px;line-height:16px}",
			// directory picker dialog (unchanged anatomy)
			".dshCron_scrim{position:fixed;inset:0;z-index:60;background:#00000033;display:flex;align-items:center;justify-content:center}",
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
			"@media (prefers-reduced-motion:reduce){.dshCron_arrow{transition:none}}",
		].join("");
		const tagId = "dsh-cron/CronSection.css";
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
			"section.title": "定时任务",
			"section.running": "{count} 运行中",
			"section.search": "搜索作业",
			"section.search.aria": "搜索定时作业",
			"section.search.close": "收起搜索",
			"section.add": "新建作业",
			"view.label": "视图选项",
			"orderBy.label": "排序方式",
			"orderBy.smart": "智能排序",
			"orderBy.name": "按名称",
			"orderBy.next": "按下次执行",
			"orderBy.last-run": "按最近执行",
			"empty.jobs": "尚无定时作业，点 + 新建。",
			"empty.search": "没有匹配的作业。",
			"error.unavailable": "调度器未运行。",
			"error.network": "读取失败，稍后自动重试。",
			"action.failed": "操作失败：{message}",
			"menu.aria": "作业操作",
			"menu.run": "立即运行",
			"menu.stop": "停止运行",
			"menu.pause": "暂停调度",
			"menu.resume": "恢复调度",
			"menu.edit": "编辑作业",
			"menu.delete": "删除作业",
			"delete.confirm": "确认删除",
			"runs.empty": "还没有运行记录。",
			"runs.more": "还有 {count} 条运行记录",
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
			"detail.manual": "手动",
			"detail.exit": "exit {code}",
			"page.close": "关闭详情",
			"page.target": "计划触发",
			"page.started": "开始",
			"page.finished": "结束",
			"page.duration": "耗时",
			"page.exit": "退出码",
			"page.command": "命令",
			"page.cwd": "工作目录",
			"page.output": "输出",
			"page.error": "错误",
			"page.empty": "（无输出）",
			"page.waiting": "等待输出…",
			"time.today": "{time}",
			"time.tomorrow": "明天 {time}",
			"time.other": "{date} {time}",
			"duration.seconds": "{seconds}秒",
			"duration.minutes": "{minutes}分{seconds}秒",
			"duration.hours": "{hours}小时{minutes}分",
			"form.title": "新建作业",
			"form.title.edit": "编辑作业",
			"form.name": "名称",
			"form.name.hint": "字母或数字开头，可含数字、- 和 _（支持中文）",
			"form.desc": "描述",
			"form.desc.ph": "一句话说明这个作业是干什么的（可选）",
			"form.trigger": "触发",
			"form.trigger.hourly": "每小时",
			"form.trigger.daily": "每天",
			"form.trigger.weekdays": "工作日",
			"form.trigger.weekly": "每周",
			"form.trigger.custom": "自定义",
			"form.trigger.kind": "触发类型",
			"form.trigger.cron": "cron",
			"form.trigger.every": "周期",
			"form.trigger.at": "一次性",
			"form.minute": "分钟（0-59）",
			"form.minute.unit": "分",
			"form.timeOfDay": "时刻",
			"form.weekday": "星期",
			"weekday.1": "周一",
			"weekday.2": "周二",
			"weekday.3": "周三",
			"weekday.4": "周四",
			"weekday.5": "周五",
			"weekday.6": "周六",
			"weekday.0": "周日",
			"form.cron": "表达式",
			"form.every": "间隔（秒，≥60）",
			"form.every.unit": "秒",
			"form.at": "触发时刻",
			"form.task": "任务",
			"form.prompt": "prompt",
			"form.prompt.ph": "描述这个作业每次运行要做什么…",
			"form.argv": "命令（argv，空格分隔）",
			"form.preset": "模式",
			"preset.standard.name": "标准模式",
			"preset.standard.description": "功能完整的编码 Agent，支持文件编辑、Shell、文件与网页检索、Skills、计划、目标、子代理和工作流。",
			"preset.code.name": "PTC 模式",
			"preset.code.description": "具备标准模式的全部能力，并通过 Code Mode SDK 呈现工具，让模型用一个 TypeScript 程序组合多步操作。",
			"preset.minimal.name": "极简模式",
			"preset.minimal.description": "仅提供持久 bash 与 str_replace_editor 的双工具编码 Agent。",
			"preset.cordis.name": "创造模式",
			"preset.cordis.description": "用于创建自定义 Agent preset：具备标准模式的全部能力，并提供运行时检查、插件实验和 preset 创作指导。",
			"form.access": "权限",
			"form.model": "模型",
			"form.effort": "推理",
			"form.inherit": "默认（{name}）",
			"form.inherit.bare": "默认",
			"form.back": "返回",
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
			"form.cancel": "取消",
			"form.submit": "创建并启用",
			"form.save": "保存修改",
			"form.submitting": "提交中…",
			"picker.title": "选择工作目录",
			"picker.loading": "加载中…",
			"picker.empty": "没有子目录",
			"picker.cancel": "取消",
			"picker.choose": "选择",
		};
		/** English dictionary, key-identical to the Chinese source of truth. */
		const en = {
			"section.title": "Cron Jobs",
			"section.running": "{count} running",
			"section.search": "Search jobs",
			"section.search.aria": "Search cron jobs",
			"section.search.close": "Close search",
			"section.add": "New job",
			"view.label": "View options",
			"orderBy.label": "Order by",
			"orderBy.smart": "Smart",
			"orderBy.name": "Name",
			"orderBy.next": "Next run",
			"orderBy.last-run": "Last run",
			"empty.jobs": "No cron jobs yet — use + to create one.",
			"empty.search": "No matching jobs.",
			"error.unavailable": "The scheduler is not running.",
			"error.network": "Read failed; retrying automatically.",
			"action.failed": "Action failed: {message}",
			"menu.aria": "Job actions",
			"menu.run": "Run now",
			"menu.stop": "Stop run",
			"menu.pause": "Pause schedule",
			"menu.resume": "Resume schedule",
			"menu.edit": "Edit job",
			"menu.delete": "Delete job",
			"delete.confirm": "Confirm delete",
			"runs.empty": "No runs yet.",
			"runs.more": "Show {count} more runs",
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
			"detail.manual": "manual",
			"detail.exit": "exit {code}",
			"page.close": "Close details",
			"page.target": "Scheduled for",
			"page.started": "Started",
			"page.finished": "Finished",
			"page.duration": "Duration",
			"page.exit": "Exit code",
			"page.command": "Command",
			"page.cwd": "Working directory",
			"page.output": "Output",
			"page.error": "Error",
			"page.empty": "(no output)",
			"page.waiting": "waiting for output…",
			"time.today": "{time}",
			"time.tomorrow": "tomorrow {time}",
			"time.other": "{date} {time}",
			"duration.seconds": "{seconds}s",
			"duration.minutes": "{minutes}m {seconds}s",
			"duration.hours": "{hours}h {minutes}m",
			"form.title": "New job",
			"form.title.edit": "Edit job",
			"form.name": "Name",
			"form.name.hint": "letters (any script), digits, - and _ allowed",
			"form.desc": "Description",
			"form.desc.ph": "One line on what this job does (optional)",
			"form.trigger": "Trigger",
			"form.trigger.hourly": "Hourly",
			"form.trigger.daily": "Daily",
			"form.trigger.weekdays": "Weekdays",
			"form.trigger.weekly": "Weekly",
			"form.trigger.custom": "Custom",
			"form.trigger.kind": "Trigger type",
			"form.trigger.cron": "cron",
			"form.trigger.every": "interval",
			"form.trigger.at": "one-shot",
			"form.minute": "Minute (0-59)",
			"form.minute.unit": "min",
			"form.timeOfDay": "Time",
			"form.weekday": "Day",
			"weekday.1": "Mon",
			"weekday.2": "Tue",
			"weekday.3": "Wed",
			"weekday.4": "Thu",
			"weekday.5": "Fri",
			"weekday.6": "Sat",
			"weekday.0": "Sun",
			"form.cron": "Expression",
			"form.every": "Interval (seconds, ≥60)",
			"form.every.unit": "sec",
			"form.at": "Fire at",
			"form.task": "Task",
			"form.prompt": "Prompt",
			"form.prompt.ph": "Describe what this job should do on each run…",
			"form.argv": "Command (argv, space-separated)",
			"form.preset": "Preset",
			"preset.standard.name": "Standard mode",
			"preset.standard.description": "Full coding agent with file editing, shell, file and web search, skills, planning, goals, subagents, and workflows.",
			"preset.code.name": "PTC mode",
			"preset.code.description": "All Standard mode capabilities, with tools exposed through the Code Mode SDK so the model can combine multi-step operations in one TypeScript program.",
			"preset.minimal.name": "Minimal mode",
			"preset.minimal.description": "Two-tool coding agent with persistent bash and str_replace_editor.",
			"preset.cordis.name": "Creator mode",
			"preset.cordis.description": "Built for creating custom agent presets, with all Standard mode capabilities plus runtime inspection, plugin experiments, and preset-authoring guidance.",
			"form.access": "Access",
			"form.model": "Model",
			"form.effort": "Effort",
			"form.inherit": "Default ({name})",
			"form.inherit.bare": "Default",
			"form.back": "Back",
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
			"form.cancel": "Cancel",
			"form.submit": "Create & enable",
			"form.save": "Save changes",
			"form.submitting": "Submitting…",
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
		const OPTIONS_PATH = "/dsh-cron/api/options";
		const RUN_NOW_PATH = "/dsh-cron/api/run-now";
		const STOP_PATH = "/dsh-cron/api/stop";
		const JOBS_PATH = "/dsh-cron/api/jobs";
		const UPDATE_PATH = "/dsh-cron/api/update";
		const ENABLE_PATH = "/dsh-cron/api/enable";
		const DELETE_PATH = "/dsh-cron/api/delete";
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
		/**
		* Smart order (the default): running first, then jobs whose last run
		* failed, then by next fire time ascending, then never-fired,
		* disabled last; name breaks ties.
		*/
		function jobRank(job) {
			if (job.running === true) return 0;
			if (job.enabled === false) return 4;
			const last = job.lastRun?.status;
			if (last === "failed" || last === "timeout") return 1;
			if (job.next !== undefined) return 2;
			return 3;
		}
		/** Instant of one job's most recent run, -Infinity when it never ran. */
		function lastRunMs(job) {
			const run = job.lastRun;
			if (run === undefined) return -Infinity;
			const at = Date.parse(run.finishedAt ?? run.target);
			return Number.isNaN(at) ? -Infinity : at;
		}
		/** The Order by choices the view-options menu offers. */
		const ORDER_IDS = ["smart", "name", "next", "last-run"];
		/** localStorage slot for the section's Order by choice. */
		const ORDER_STORE = "dshCron.orderBy";
		/** Sort jobs by the picked order; every mode breaks ties by name. */
		function sortJobs(jobs, orderBy) {
			const byName = (a, b) => a.name.localeCompare(b.name);
			if (orderBy === "name") return [...jobs].sort(byName);
			if (orderBy === "next") {
				// Next fire ascending; jobs with nothing scheduled (disabled,
				// spent one-shots) sink to the bottom.
				return [...jobs].sort((a, b) => {
					if (a.next !== b.next) {
						if (a.next === undefined) return 1;
						if (b.next === undefined) return -1;
						return a.next < b.next ? -1 : 1;
					}
					return byName(a, b);
				});
			}
			if (orderBy === "last-run") {
				// Most recently executed first; a live run counts as newest.
				return [...jobs].sort((a, b) => {
					const ra = a.running === true ? Infinity : lastRunMs(a);
					const rb = b.running === true ? Infinity : lastRunMs(b);
					if (ra !== rb) return rb - ra;
					return byName(a, b);
				});
			}
			return [...jobs].sort((a, b) => {
				const ra = jobRank(a);
				const rb = jobRank(b);
				if (ra !== rb) return ra - rb;
				if (ra === 2 && a.next !== b.next) return a.next < b.next ? -1 : 1;
				return byName(a, b);
			});
		}
		/** POST one section action; resolves {ok, value|message}, never throws. */
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
		function IconChevron({ size = 12, rotate = 0 }) {
			return h("svg", { width: size, height: size, viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true", style: rotate === 0 ? undefined : { transform: `rotate(${rotate}deg)` } },
				h("path", { d: "M5.25 3.5 8.75 7l-3.5 3.5", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }));
		}
		function IconFolder({ size = 14 }) {
			return h("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" },
				h("path", { d: "M1.8 4.2c0-.7.6-1.3 1.3-1.3h3l1.5 1.6h5.3c.7 0 1.3.6 1.3 1.3v6c0 .7-.6 1.3-1.3 1.3H3.1c-.7 0-1.3-.6-1.3-1.3v-7.6Z", stroke: "currentColor", strokeWidth: 1.3, strokeLinejoin: "round" }));
		}
		//#endregion
		//#region components
		/** Status dot with the muted fallback: StateDot inherits currentColor. */
		function Dot({ state, size = 10 }) {
			return h("span", { className: "dshCron_dotWrap" }, h(primitives.StateDot, { state, size }));
		}
		/**
		* The right-edge label of one job row: live duration or next fire.
		* A failed last run is the dot's job — the label stays on schedule.
		*/
		function jobWhen(job, lastRecord, nowMs, t) {
			if (job.running === true) {
				return { text: lastRecord !== undefined ? formatDuration(runElapsedMs(lastRecord, nowMs), t) : t("status.running"), tone: "ongoing" };
			}
			if (job.enabled === false) return { text: t("status.disabled"), tone: "muted" };
			if (job.next !== undefined) return { text: formatInstant(job.next, t), tone: "muted" };
			return { text: t("status.pending"), tone: "muted" };
		}
		/** The status-dot state of one job row (last outcome, live states first). */
		function jobDotState(job) {
			if (job.running === true) return "ongoing";
			if (job.enabled === false) return "muted";
			if (job.lastRun !== undefined) return statusMeta(job.lastRun.status).dot;
			return "muted";
		}
		/**
		* One job row: sessionRow anatomy — dot slot (arrow on hover), mono
		* name, right label that swaps to the ... menu on hover. Row click
		* toggles the run-history expansion.
		*/
		function JobRow({ job, expanded, lastRecord, nowMs, confirmDelete, t, onToggle, onMenu, onConfirmDelete }) {
			const [menuOpen, setMenuOpen] = react.useState(false);
			const when = jobWhen(job, lastRecord, nowMs, t);
			const muted = job.enabled === false;
			const manual = job.source === "manual";
			const items = [
				job.running === true
					? { id: "stop", label: t("menu.stop"), icon: h(primitives.IconStopFill16, { size: 16 }) }
					: { id: "run", label: t("menu.run"), icon: h(primitives.IconPlayOutline16, { size: 16 }) },
				job.enabled === false
					? { id: "resume", label: t("menu.resume"), icon: h(primitives.IconPlayOutline16, { size: 16 }) }
					: { id: "pause", label: t("menu.pause"), icon: h(primitives.IconPauseOutline16, { size: 16 }) },
				...manual ? [
					{ id: "edit", label: t("menu.edit"), icon: h(primitives.IconEditOutline16, { size: 16 }) },
					{ id: "delete", label: t("menu.delete"), icon: h(primitives.IconTrashOutline16, { size: 16 }), danger: true },
				] : [],
			];
			return h("div", {
				role: "button",
				tabIndex: 0,
				className: menuOpen ? "dshCron_row dshCron_rowMenuOpen" : "dshCron_row",
				"aria-expanded": expanded,
				onClick: () => onToggle(job.name),
				onKeyDown: (event) => {
					if (event.key === "Enter" && event.target === event.currentTarget) onToggle(job.name);
				},
			},
				h("span", { className: "dshCron_slot" },
					h("span", { className: "dshCron_slotDot" }, h(Dot, { state: jobDotState(job) })),
					h("span", { className: "dshCron_slotArrow" },
						h("span", { className: expanded ? "dshCron_arrow dshCron_arrowOpen" : "dshCron_arrow" },
							h(primitives.IconTriangleRightFill14, {})))),
				h("span", { className: muted ? "dshCron_name dshCron_nameMuted" : "dshCron_name", title: `${job.name}${job.description !== undefined ? ` · ${job.description}` : ""} · ${job.schedule}` }, job.name),
				confirmDelete
					? h("button", {
						type: "button",
						className: "dshCron_confirm",
						onClick: (event) => {
							event.stopPropagation();
							onConfirmDelete(job.name);
						},
					}, t("delete.confirm"))
					: h(react.Fragment, {},
						h("span", {
							className: when.tone === "ongoing" ? "dshCron_when dshCron_whenOngoing" : "dshCron_when",
							title: job.schedule,
						}, when.text),
						h("span", { className: "dshCron_rowActions" },
							h(primitives.Menu, {
								open: menuOpen,
								onClose: () => setMenuOpen(false),
								items,
								onSelect: (id) => {
									setMenuOpen(false);
									onMenu(job, id);
								},
								portal: true,
								closeOnPointerLeave: true,
								anchor: h("button", {
									type: "button",
									className: "dshCron_iconBtn",
									"aria-label": t("menu.aria"),
									onClick: (event) => {
										event.stopPropagation();
										setMenuOpen((value) => !value);
									},
								}, h(primitives.IconEllipsisOutline16, {})),
							}))));
		}
		/**
		* One run row under an expanded job. An agent run with a session
		* opens that session like clicking a session row; anything else
		* (command runs, pruned sessions) opens the run-detail page over
		* the center column — the same surface, one interaction model.
		*/
		function RunRow({ record, selected, nowMs, t, onOpenSession, onOpenPage }) {
			const meta = statusMeta(record.status);
			const running = record.status === "running";
			const openable = record.sessionId !== undefined && onOpenSession !== undefined;
			// The dot alone carries the outcome; the right edge says when the
			// run started (the job row already ticks a live elapsed).
			const line = h("span", { className: "dshCron_runLine" },
				h(Dot, { state: running ? "ongoing" : meta.dot, size: 8 }),
				h("span", { className: "dshCron_seq" }, `#${record.seq}`),
				h("span", { className: "dshCron_target" },
					record.manual === true ? t("detail.manual") : ""),
				h("span", {
					className: running ? "dshCron_when dshCron_whenOngoing" : "dshCron_when",
					title: formatInstant(record.target, t),
				}, formatInstant(record.startedAt, t)));
			return h("button", {
				type: "button",
				className: selected ? "dshCron_runRow dshCron_runSelected" : "dshCron_runRow",
				onClick: () => {
					// sessions.open throws for sessions the client does not list
					// (stale list after a host restart, GC-pruned session) — fall
					// back to the detail page instead of a dead click.
					if (openable && onOpenSession(record.sessionId)) return;
					onOpenPage(record);
				},
			}, line);
		}
		/**
		* The command-run detail page. Portaled over the center column; shows
		* the settled (or live) record of one run: status, timing, exit code,
		* the job's argv/cwd when the manual spec is at hand, and the output
		* tail. While the run is in flight the record's summary carries the
		* live output tail (spliced in server-side) and the section polls
		* fast, so the output streams here; the body follows the tail unless
		* the reader scrolls away from the bottom.
		*/
		function CommandRunPage({ record, spec, nowMs, t, onClose }) {
			const meta = statusMeta(record.status);
			const running = record.status === "running";
			const bodyRef = react.useRef(null);
			const stickRef = react.useRef(true);
			react.useEffect(() => {
				if (!running) return;
				const node = bodyRef.current;
				if (node !== null && stickRef.current) node.scrollTop = node.scrollHeight;
			}, [running, record.summary]);
			const danger = meta.danger === true;
			const statusText = meta.key !== undefined ? t(meta.key) : meta.raw ?? record.status;
			const metaRows = [];
			const row = (label, value, mono = true) => {
				metaRows.push(h("span", { key: `${label}-l`, className: "dshCron_pageMetaLabel" }, label));
				metaRows.push(h("span", { key: `${label}-v`, className: mono ? "dshCron_pageMetaValue dshCron_mono" : "dshCron_pageMetaValue" }, value));
			};
			row(t("page.target"), record.manual === true ? t("detail.manual") : formatInstant(record.target, t));
			row(t("page.started"), formatInstant(record.startedAt, t));
			if (record.finishedAt !== undefined) row(t("page.finished"), formatInstant(record.finishedAt, t));
			row(t("page.duration"), formatDuration(runElapsedMs(record, nowMs), t));
			if (record.exitCode !== undefined) row(t("page.exit"), String(record.exitCode));
			if (Array.isArray(spec?.task?.argv)) row(t("page.command"), spec.task.argv.join(" "));
			if (typeof spec?.task?.cwd === "string" && spec.task.cwd !== "") row(t("page.cwd"), spec.task.cwd);
			return h("div", { className: "dshCron_page", role: "region", "aria-label": `${record.job} #${record.seq}` },
				h("div", { className: "dshCron_pageHead" },
					h(Dot, { state: running ? "ongoing" : meta.dot, size: 10 }),
					h("span", { className: "dshCron_pageName", title: record.job }, record.job),
					h("span", { className: "dshCron_pageSeq" }, `#${record.seq}`),
					h("span", { className: "dshCron_pageSpacer" }),
					h("span", { className: danger ? "dshCron_pageStatus dshCron_pageStatusDanger" : "dshCron_pageStatus" }, statusText),
					h("button", {
						type: "button",
						className: "dshCron_headBtn",
						"aria-label": t("page.close"),
						title: t("page.close"),
						onClick: onClose,
					}, h(primitives.IconCloseOutline16, { size: 16 }))),
				h("div", {
					className: "dshCron_pageBody",
					ref: bodyRef,
					onScroll: (event) => {
						const el = event.currentTarget;
						stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
					},
				},
					h("div", { className: "dshCron_pageInner" },
						h("div", { className: "dshCron_pageMeta" }, metaRows),
						record.error !== undefined ? h("div", {},
							h("p", { className: "dshCron_pageBlockTitle" }, t("page.error")),
							h("pre", { className: "dshCron_pagePre dshCron_pagePreError" }, record.error)) : null,
						h("div", {},
							h("p", { className: "dshCron_pageBlockTitle" }, t("page.output")),
							h("pre", { className: "dshCron_pagePre" }, record.summary !== "" ? record.summary : t(running ? "page.waiting" : "page.empty"))))));
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
		/** ISO instant -> datetime-local input value in the local zone. */
		function toLocalInput(iso) {
			const at = new Date(iso);
			if (Number.isNaN(at.getTime())) return "";
			const pad = (n) => String(n).padStart(2, "0");
			return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
		}
		/**
		* Map an existing schedule spec onto the trigger presets (hourly / daily /
		* weekdays / weekly), falling back to the custom drawer for interval,
		* one-shot, and any cron shape the presets can't express.
		*/
		function deriveTrigger(schedule) {
			const out = { mode: "daily", sub: "cron", minute: "0", time: "07:00", weekday: "1", cron: "0 7 * * *", everySeconds: "3600", at: "" };
			if (schedule === undefined || schedule === null) return out;
			if (schedule.everySeconds !== undefined && schedule.everySeconds !== null) return { ...out, mode: "custom", sub: "every", everySeconds: String(schedule.everySeconds) };
			if (schedule.at !== undefined && schedule.at !== null) return { ...out, mode: "custom", sub: "at", at: toLocalInput(schedule.at) };
			if (typeof schedule.cron !== "string") return out;
			const cron = schedule.cron.trim();
			const pad = (n) => String(n).padStart(2, "0");
			const hourly = cron.match(/^(\d{1,2})\s+\*\s+\*\s+\*\s+\*$/);
			if (hourly !== null && Number(hourly[1]) <= 59) return { ...out, mode: "hourly", minute: String(Number(hourly[1])), cron };
			const clock = cron.match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+(\*|1-5|[0-7])$/);
			if (clock !== null && Number(clock[1]) <= 59 && Number(clock[2]) <= 23) {
				const time = `${pad(Number(clock[2]))}:${pad(Number(clock[1]))}`;
				if (clock[3] === "*") return { ...out, mode: "daily", time, cron };
				if (clock[3] === "1-5") return { ...out, mode: "weekdays", time, cron };
				return { ...out, mode: "weekly", time, weekday: clock[3] === "7" ? "0" : clock[3], cron };
			}
			return { ...out, mode: "custom", sub: "cron", cron };
		}
		/**
		* The agent task's model control: the composer model-select anatomy
		* rebuilt as a form control — a chip (model name + effort) opening a
		* drill-in panel (Model / Effort rows -> option lists). Values are
		* config strings; "" everywhere means inherit the host default. The
		* option data comes from the options route (the same provider/model
		* catalog the composer's ModelDirectory reads).
		*/
		function ModelChip({ t, options, provider, model, effort, onChange, size, menuStyle }) {
			const [open, setOpen] = react.useState(false);
			const [view, setView] = react.useState("root");
			const rootRef = react.useRef(null);
			primitives.useDismissOnOutsidePointer(rootRef, open, (next) => {
				setOpen(next);
				if (!next) setView("root");
			});
			const models = options?.models ?? [];
			const selection = options?.defaults?.selection;
			const chosen = model !== ""
				? models.find((entry) => entry.id === model && (provider === "" || entry.provider === provider))
				: selection !== undefined ? models.find((entry) => entry.id === selection.model && entry.provider === selection.provider) : undefined;
			const modelName = model !== ""
				? (chosen?.name ?? model)
				: chosen?.name ?? selection?.model ?? t("form.inherit.bare");
			const effortId = effort !== ""
				? effort
				: model !== "" ? (chosen?.defaultEffort ?? "") : (selection?.reasoningEffort ?? chosen?.defaultEffort ?? "");
			const effortName = effortId === ""
				? t("form.inherit.bare")
				: chosen?.efforts?.find((entry) => entry.id === effortId)?.name ?? effortId;
			const providers = [...new Set(models.map((entry) => entry.provider))];
			const pick = (nextProvider, nextModel) => {
				onChange({ provider: nextProvider, model: nextModel, effort: "" });
				setView("root");
			};
			const pickEffort = (nextEffort) => {
				onChange({ provider, model, effort: nextEffort });
				setView("root");
			};
			const check = h("svg", { width: 14, height: 14, viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true" },
				h("path", { d: "m2.9 7.4 2.7 2.7 5.5-6.2", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }));
			const panelProps = { className: "dshCron_mpanel", style: menuStyle };
			let panel = null;
			if (open && view === "root") {
				panel = h("div", panelProps,
					h("button", { type: "button", className: "dshCron_mrow", onClick: () => setView("model") },
						h("span", { className: "dshCron_mrowLabel" }, t("form.model")),
						h("span", { className: "dshCron_mrowValue" }, modelName),
						h("span", { className: "dshCron_mrowChevron" }, h(IconChevron, { size: 13 }))),
					h("button", { type: "button", className: "dshCron_mrow", onClick: () => setView("effort") },
						h("span", { className: "dshCron_mrowLabel", style: { flex: 1 } }, t("form.effort")),
						h("span", { className: "dshCron_mrowValue dshCron_mrowValueEnd", style: { flex: "none" } }, effortName),
						h("span", { className: "dshCron_mrowChevron" }, h(IconChevron, { size: 13 }))));
			} else if (open && view === "model") {
				panel = h("div", panelProps,
					h("button", { type: "button", className: "dshCron_mitem", onClick: () => pick("", "") },
						h("span", { className: model === "" ? "dshCron_mitemName dshCron_mitemOn" : "dshCron_mitemName" },
							selection !== undefined ? t("form.inherit", { name: chosen?.name ?? selection.model }) : t("form.inherit.bare")),
						model === "" ? h("span", { className: "dshCron_mitemOn", style: { display: "inline-flex", flex: "none" } }, check) : null),
					...models.flatMap((entry, index) => {
						const caption = providers.length > 1 && (index === 0 || models[index - 1].provider !== entry.provider)
							? [h("div", { key: `cap-${entry.provider}`, className: "dshCron_mcaption" }, entry.providerName ?? entry.provider)]
							: [];
						const selected = model === entry.id && (provider === "" || provider === entry.provider);
						return [...caption, h("button", {
							key: `${entry.provider}/${entry.id}`,
							type: "button",
							className: "dshCron_mitem",
							onClick: () => pick(entry.provider, entry.id),
						},
							h("span", { className: selected ? "dshCron_mitemName dshCron_mitemOn" : "dshCron_mitemName", title: entry.id }, entry.name ?? entry.id),
							selected ? h("span", { className: "dshCron_mitemOn", style: { display: "inline-flex", flex: "none" } }, check) : null)];
					}));
			} else if (open && view === "effort") {
				const efforts = chosen?.efforts ?? [];
				panel = h("div", panelProps,
					h("button", { type: "button", className: "dshCron_mitem", onClick: () => pickEffort("") },
						h("span", { className: effort === "" ? "dshCron_mitemName dshCron_mitemOn" : "dshCron_mitemName" }, t("form.inherit.bare")),
						effort === "" ? h("span", { className: "dshCron_mitemOn", style: { display: "inline-flex", flex: "none" } }, check) : null),
					...efforts.map((entry) => h("button", {
						key: entry.id,
						type: "button",
						className: "dshCron_mitem",
						onClick: () => pickEffort(entry.id),
					},
						h("span", { className: effort === entry.id ? "dshCron_mitemName dshCron_mitemOn" : "dshCron_mitemName" }, entry.name ?? entry.id),
						effort === entry.id ? h("span", { className: "dshCron_mitemOn", style: { display: "inline-flex", flex: "none" } }, check) : null)));
			}
			return h("div", { ref: rootRef, className: "dshCron_mwrap" },
				h("button", {
					type: "button",
					className: size === "sm" ? "dshCron_chip dshCron_chipSm" : "dshCron_chip",
					"aria-expanded": open,
					"aria-label": t("form.model"),
					onClick: () => {
						setView("root");
						setOpen((value) => !value);
					},
				},
					h("span", { className: "dshCron_chipName" }, modelName),
					h("span", { className: "dshCron_chipEffort" }, effortName),
					h("span", { className: "dshCron_chipChevron" }, h(IconChevron, { size: 12, rotate: open ? -90 : 90 }))),
				panel);
		}
		/**
		* The create/edit dialog: the shipped Modal around the config-shaped
		* form. `initial` (a raw manual spec) switches it to edit mode — the
		* name freezes and submit goes to the update route.
		*/
		function JobDialog({ t, workspaces, defaultCwd, initial, onClose, onSaved }) {
			const editing = initial !== undefined;
			const [name, setName] = react.useState(initial?.name ?? "");
			const [description, setDescription] = react.useState(initial?.description ?? "");
			const [derived] = react.useState(() => deriveTrigger(initial?.schedule));
			const [trigMode, setTrigMode] = react.useState(derived.mode);
			const [trigger, setTrigger] = react.useState(derived.sub);
			const [minute, setMinute] = react.useState(derived.minute);
			const [timeOfDay, setTimeOfDay] = react.useState(derived.time);
			const [weekday, setWeekday] = react.useState(derived.weekday);
			const [cron, setCron] = react.useState(derived.cron);
			// Not user-editable: new jobs take the browser's zone, edits keep the job's own.
			const [timeZone] = react.useState(() => {
				if (typeof initial?.schedule?.timeZone === "string") return initial.schedule.timeZone;
				try {
					return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Asia/Shanghai";
				} catch {
					return "Asia/Shanghai";
				}
			});
			const [everySeconds, setEverySeconds] = react.useState(derived.everySeconds);
			const [at, setAt] = react.useState(derived.at);
			const [taskKind, setTaskKind] = react.useState(initial?.task?.kind ?? "agent");
			const [prompt, setPrompt] = react.useState(initial?.task?.prompt ?? "");
			const [preset, setPreset] = react.useState(initial?.task?.preset ?? "");
			const [access, setAccess] = react.useState(initial?.task?.access ?? "");
			const [modelSel, setModelSel] = react.useState({
				provider: initial?.task?.provider ?? "",
				model: initial?.task?.model ?? "",
				effort: initial?.task?.effort ?? "",
			});
			const [options, setOptions] = react.useState(null);
			react.useEffect(() => {
				let live = true;
				(async () => {
					try {
						const response = await fetch(new URL(OPTIONS_PATH, location.origin), { headers: { accept: "application/json" } });
						if (!response.ok) return;
						const value = await response.json();
						if (live) setOptions(value);
					} catch {
						// the dialog stays usable with inherit-default choices only
					}
				})();
				return () => {
					live = false;
				};
			}, []);
			const [argv, setArgv] = react.useState(Array.isArray(initial?.task?.argv) ? initial.task.argv.join(" ") : "");
			const [cwd, setCwd] = react.useState(initial?.task?.cwd ?? defaultCwd ?? "");
			const [cwdEdited, setCwdEdited] = react.useState(editing);
			// The session snapshot can settle after this form mounts; follow the
			// default until the user has touched the field themselves.
			react.useEffect(() => {
				if (!cwdEdited && typeof defaultCwd === "string" && defaultCwd !== "") setCwd(defaultCwd);
			}, [defaultCwd, cwdEdited]);
			const [timeout, setTimeoutSeconds] = react.useState(String(initial?.task?.timeoutSeconds ?? 1800));
			const [overlap, setOverlap] = react.useState(initial?.policy?.overlap ?? "skip");
			const [misfire, setMisfire] = react.useState(initial?.policy?.misfire ?? "skip");
			const [picking, setPicking] = react.useState(false);
			const [submitting, setSubmitting] = react.useState(false);
			const [fault, setFault] = react.useState(null);
			const clockOk = /^\d{2}:\d{2}$/.test(timeOfDay) && timeZone.trim() !== "";
			const triggerReady = trigMode === "hourly"
				? /^\d{1,2}$/.test(minute.trim()) && Number(minute) <= 59 && timeZone.trim() !== ""
				: trigMode !== "custom"
					? clockOk
					: trigger === "cron" ? cron.trim() !== "" && timeZone.trim() !== "" : trigger === "every" ? Number(everySeconds) >= 60 : at !== "";
			const ready = name.trim() !== ""
				&& triggerReady
				&& (taskKind === "agent" ? prompt.trim() !== "" : argv.trim() !== "");
			const submit = async () => {
				if (!ready || submitting) return;
				setSubmitting(true);
				setFault(null);
				// The presets compile to plain cron shapes deriveTrigger can read back.
				const [clockHour, clockMinute] = timeOfDay.split(":").map(Number);
				const presetCron = trigMode === "hourly"
					? `${Number(minute)} * * * *`
					: trigMode === "daily"
						? `${clockMinute} ${clockHour} * * *`
						: trigMode === "weekdays"
							? `${clockMinute} ${clockHour} * * 1-5`
							: `${clockMinute} ${clockHour} * * ${weekday}`;
				const schedule = trigMode !== "custom"
					? { cron: presetCron, timeZone: timeZone.trim() }
					: trigger === "cron"
						? { cron: cron.trim(), timeZone: timeZone.trim() }
						: trigger === "every"
							? { everySeconds: Number(everySeconds) }
							: { at: new Date(at).toISOString() };
				const task = {
					kind: taskKind,
					...(taskKind === "agent" ? { prompt: prompt.trim() } : { argv: argv.trim().split(/\s+/) }),
					...(cwd.trim() === "" ? {} : { cwd: cwd.trim() }),
					...(taskKind === "agent" ? {
						...(preset === "" ? {} : { preset }),
						...(access === "" ? {} : { access }),
						...(modelSel.provider === "" ? {} : { provider: modelSel.provider }),
						...(modelSel.model === "" ? {} : { model: modelSel.model }),
						...(modelSel.effort === "" ? {} : { effort: modelSel.effort }),
					} : {}),
					timeoutSeconds: Number(timeout) > 0 ? Number(timeout) : 1800,
				};
				const spec = {
					name: name.trim(),
					...(description.trim() === "" ? {} : { description: description.trim() }),
					schedule,
					task,
					policy: { overlap, misfire },
				};
				const outcome = editing
					? await postAction(UPDATE_PATH, { job: name.trim(), spec })
					: await postAction(JOBS_PATH, { spec });
				setSubmitting(false);
				if (!outcome.ok) {
					setFault(outcome.message);
					return;
				}
				onSaved();
			};
			const field = (label, control, hint) => h("div", { className: "dshCron_field" },
				h("span", { className: "dshCron_lbl" }, label),
				control,
				hint !== undefined ? h("span", { className: "dshCron_hint" }, hint) : null);
			return h(react.Fragment, {},
				h(primitives.Modal, {
					open: true,
					onClose,
					closeLabel: t("form.cancel"),
					title: editing ? t("form.title.edit") : t("form.title"),
					footer: h(react.Fragment, {},
						h(primitives.Button, { variant: "outline", onClick: onClose }, t("form.cancel")),
						h(primitives.Button, { variant: "primary", disabled: !ready || submitting, onClick: submit },
							submitting ? t("form.submitting") : editing ? t("form.save") : t("form.submit"))),
				},
					h("div", { className: "dshCron_form" },
						field(t("form.name"), h("input", {
							className: "dshCron_input dshCron_mono",
							value: name,
							placeholder: "weekly-deps-audit",
							disabled: editing,
							onChange: (event) => setName(event.target.value),
						}), editing ? undefined : t("form.name.hint")),
						field(t("form.desc"), h("input", {
							className: "dshCron_input",
							value: description,
							placeholder: t("form.desc.ph"),
							onChange: (event) => setDescription(event.target.value),
						})),
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
							h("div", { className: "dshCron_editor" },
								taskKind === "agent"
									? h("textarea", { className: "dshCron_editorText", value: prompt, placeholder: t("form.prompt.ph"), "aria-label": t("form.prompt"), onChange: (event) => setPrompt(event.target.value) })
									: h("input", { className: "dshCron_editorText dshCron_mono", value: argv, placeholder: "/bin/date -u", "aria-label": t("form.argv"), onChange: (event) => setArgv(event.target.value) }),
								taskKind === "agent" ? (() => {
									// Mirror the official preset UI: localize copy for shipped presets only,
									// never user-authored metadata (trust !== "system").
									const localizePreset = (entry) =>
										entry.trust === "system" && ["standard", "code", "minimal", "cordis"].includes(entry.id)
											? { ...entry, name: t(`preset.${entry.id}.name`), description: t(`preset.${entry.id}.description`) }
											: entry;
									const presetList = (options?.presets ?? []).map(localizePreset);
									const inheritLabel = (list, id) => {
										const name = list?.find((entry) => entry.id === id)?.name ?? id;
										return name !== undefined ? t("form.inherit", { name }) : t("form.inherit.bare");
									};
									const presetInherit = inheritLabel(presetList, options?.defaults?.preset);
									const accessInherit = inheritLabel(options?.access, options?.defaults?.access);
									const chosenPreset = presetList.find((entry) => entry.id === preset);
									const chosenAccess = options?.access?.find((entry) => entry.id === access);
									return h("div", { className: "dshCron_editorBar" },
										h("select", {
											className: "dshCron_tbSelect",
											value: preset,
											"aria-label": t("form.preset"),
											title: preset === "" ? presetInherit : chosenPreset?.description ?? chosenPreset?.name,
											onChange: (event) => setPreset(event.target.value),
										},
											h("option", { value: "" }, presetInherit),
											...presetList.map((entry) => h("option", { key: entry.id, value: entry.id, title: entry.description }, entry.name))),
										h("select", {
											className: "dshCron_tbSelect",
											value: access,
											"aria-label": t("form.access"),
											title: access === "" ? accessInherit : chosenAccess?.description ?? chosenAccess?.name,
											onChange: (event) => setAccess(event.target.value),
										},
											h("option", { value: "" }, accessInherit),
											...(options?.access ?? []).map((entry) => h("option", { key: entry.id, value: entry.id, title: entry.description }, entry.name))),
										h("span", { className: "dshCron_editorSpacer" }),
										h(ModelChip, {
											t,
											options,
											provider: modelSel.provider,
											model: modelSel.model,
											effort: modelSel.effort,
											size: "sm",
											menuStyle: { top: "auto", bottom: "calc(100% + 4px)", left: "auto", right: 0, width: "min(300px, calc(100vw - 48px))" },
											onChange: setModelSel,
										}));
								})() : null,
								h("div", { className: "dshCron_editorBar" },
									workspaces !== undefined ? h("button", {
										type: "button",
										className: "dshCron_cwdBtn",
										"aria-label": t("form.browse"),
										title: t("form.browse"),
										onClick: () => setPicking(true),
									}, h(IconFolder, {})) : h("span", { className: "dshCron_dirIcon" }, h(IconFolder, { size: 15 })),
									h("input", {
										className: "dshCron_tbInput dshCron_mono",
										value: cwd,
										placeholder: "/path/to/project",
										"aria-label": t("form.cwd"),
										title: t("form.cwd.hint"),
										onChange: (event) => {
											setCwdEdited(true);
											setCwd(event.target.value);
										},
									})))),
						(() => {
							// The time zone never shows in the form: new jobs take the browser's
							// current zone, edited jobs keep the zone they were created with.
							// Narrow-content inputs get intrinsic widths instead of filling the row.
							const clockInput = h("input", { className: "dshCron_input dshCron_mono", style: { flex: "0 0 auto", width: "128px" }, type: "time", value: timeOfDay, "aria-label": t("form.timeOfDay"), onChange: (event) => setTimeOfDay(event.target.value) });
							return h("div", { className: "dshCron_field" },
								h("span", { className: "dshCron_lbl" }, t("form.trigger")),
								h(Seg, {
									options: [
										{ value: "hourly", label: t("form.trigger.hourly") },
										{ value: "daily", label: t("form.trigger.daily") },
										{ value: "weekdays", label: t("form.trigger.weekdays") },
										{ value: "weekly", label: t("form.trigger.weekly") },
										{ value: "custom", label: t("form.trigger.custom") },
									],
									value: trigMode,
									onChange: setTrigMode,
								}),
								trigMode === "hourly" ? h("div", { className: "dshCron_inputRow" },
									h("input", { className: "dshCron_input dshCron_mono", style: { flex: "0 0 auto", width: "104px" }, type: "number", min: 0, max: 59, value: minute, "aria-label": t("form.minute"), onChange: (event) => setMinute(event.target.value) }),
									h("span", { className: "dshCron_unit" }, t("form.minute.unit"))) : null,
								trigMode === "daily" || trigMode === "weekdays" ? h("div", { className: "dshCron_inputRow" },
									clockInput) : null,
								trigMode === "weekly" ? h("div", { className: "dshCron_inputRow" },
									h("select", { className: "dshCron_input", style: { flex: "0 0 auto", width: "auto" }, value: weekday, "aria-label": t("form.weekday"), onChange: (event) => setWeekday(event.target.value) },
										...["1", "2", "3", "4", "5", "6", "0"].map((day) => h("option", { key: day, value: day }, t(`weekday.${day}`)))),
									clockInput) : null,
								trigMode === "custom" ? h("div", { className: "dshCron_inputRow" },
									h("select", { className: "dshCron_input", style: { flex: "0 0 auto", width: "auto" }, value: trigger, "aria-label": t("form.trigger.kind"), onChange: (event) => setTrigger(event.target.value) },
										h("option", { value: "cron" }, t("form.trigger.cron")),
										h("option", { value: "every" }, t("form.trigger.every")),
										h("option", { value: "at" }, t("form.trigger.at"))),
									trigger === "cron" ? h("input", { className: "dshCron_input dshCron_mono", style: { flex: 1 }, value: cron, placeholder: "0 7 * * *", "aria-label": t("form.cron"), onChange: (event) => setCron(event.target.value) }) : null,
									trigger === "every" ? h(react.Fragment, {},
										h("input", { className: "dshCron_input dshCron_mono", style: { flex: "0 0 auto", width: "104px" }, type: "number", min: 60, value: everySeconds, "aria-label": t("form.every"), onChange: (event) => setEverySeconds(event.target.value) }),
										h("span", { className: "dshCron_unit" }, t("form.every.unit"))) : null,
									trigger === "at" ? h("input", { className: "dshCron_input", style: { flex: "0 0 auto", width: "208px" }, type: "datetime-local", value: at, "aria-label": t("form.at"), onChange: (event) => setAt(event.target.value) }) : null) : null);
						})(),
						h("div", { className: "dshCron_inputRow" },
							// Same fixed width as the trigger presets' narrow inputs.
							field(t("form.timeout"), h("input", { className: "dshCron_input dshCron_mono", style: { width: "104px" }, type: "number", min: 1, value: timeout, onChange: (event) => setTimeoutSeconds(event.target.value) })),
							field(t("form.overlap"), h("select", { className: "dshCron_input", style: { width: "104px" }, value: overlap, onChange: (event) => setOverlap(event.target.value) },
								h("option", { value: "skip" }, t("form.overlap.skip")),
								h("option", { value: "queue" }, t("form.overlap.queue")),
								h("option", { value: "replace" }, t("form.overlap.replace")))),
							field(t("form.misfire"), h("select", { className: "dshCron_input", style: { width: "104px" }, value: misfire, onChange: (event) => setMisfire(event.target.value) },
								h("option", { value: "skip" }, t("form.misfire.skip")),
								h("option", { value: "runOnce" }, t("form.misfire.runOnce"))))),
						fault !== null ? h("p", { className: "dshCron_note dshCron_noteError", role: "alert", style: { padding: 0 } }, fault) : null)),
				picking && workspaces !== undefined ? h(DirPicker, {
					workspaces,
					t,
					initialPath: cwd.trim(),
					onPick: (path) => {
						setCwdEdited(true);
						setCwd(path);
						setPicking(false);
					},
					onCancel: () => setPicking(false),
				}) : null);
		}
		/** Order-by menu behind the header's view-options button (workspace ViewOptionsMenu anatomy). */
		function ViewOptionsMenu({ orderBy, onPick, t }) {
			const [open, setOpen] = react.useState(false);
			return h(primitives.Menu, {
				open,
				onClose: () => setOpen(false),
				items: [
					{ type: "label", id: "order-by", text: t("orderBy.label") },
					...ORDER_IDS.map((id) => ({ id, label: t(`orderBy.${id}`) })),
				],
				selectedIds: [orderBy],
				onSelect: (id) => {
					if (ORDER_IDS.includes(id)) onPick(id);
					setOpen(false);
				},
				align: "end",
				dense: true,
				portal: true,
				anchor: h("button", {
					type: "button",
					className: "dshCron_headBtn",
					"aria-label": t("view.label"),
					title: t("view.label"),
					onClick: () => setOpen((value) => !value),
				}, h(primitives.IconPersonalizationOutline16, {})),
			});
		}
		/** Initial run-history window per expanded job; "show more" grows it. */
		const RUNS_PAGE = 5;
		/**
		* The sidebar section: a Workspaces-grade header (label, running
		* count, expandable search, +) over the job list. One job expands at
		* a time into its run history; an agent run opens its session.
		*/
		function CronSection({ wide, t, workspaces, openSession, useSessions, useWorkspaces }) {
			const [snapshot, setSnapshot] = react.useState(null);
			const [searchOpen, setSearchOpen] = react.useState(false);
			const [query, setQuery] = react.useState("");
			const [expandedJob, setExpandedJob] = react.useState(null);
			const [runLimit, setRunLimit] = react.useState(RUNS_PAGE);
			const [runPage, setRunPage] = react.useState(null);
			const [confirmDelete, setConfirmDelete] = react.useState(null);
			const [dialog, setDialog] = react.useState(null);
			// The Order by choice persists per browser; storage faults (private
			// mode, blocked site data) degrade to the smart default silently.
			const [orderBy, setOrderBy] = react.useState(() => {
				try {
					const stored = localStorage.getItem(ORDER_STORE);
					return ORDER_IDS.includes(stored) ? stored : "smart";
				} catch {
					return "smart";
				}
			});
			const pickOrder = react.useCallback((id) => {
				setOrderBy(id);
				try {
					localStorage.setItem(ORDER_STORE, id);
				} catch {
					// keep the in-memory choice
				}
			}, []);
			const [actionFault, setActionFault] = react.useState(null);
			const [nowMs, setNowMs] = react.useState(() => Date.now());
			const searchRef = react.useRef(null);
			// The slot registration stays on sidebar.footer.action, but the
			// section renders right below the workspaces slot: a holder div is
			// inserted after that slot's wrapper and the tree portals into it.
			// When the anchor is missing the section falls back to the footer.
			const [holder, setHolder] = react.useState(null);
			react.useEffect(() => {
				if (!wide) return;
				let node = null;
				const place = () => {
					const anchor = document.querySelector("div[data-slot=\"sidebar.workspaces\"]");
					if (anchor === null || anchor.parentElement === null) return;
					if (node === null) {
						node = document.createElement("div");
						node.className = "dshCron_holder";
					}
					anchor.insertAdjacentElement("afterend", node);
					setHolder(node);
				};
				place();
				// A sidebar re-render can drop the holder; re-attach quietly.
				const timer = setInterval(() => {
					if (node === null || !node.isConnected) place();
				}, 5e3);
				return () => {
					clearInterval(timer);
					node?.remove();
					setHolder(null);
				};
			}, [wide]);
			const refresh = react.useCallback(async () => {
				const degrade = (error) => {
					// A failed refresh keeps the last good data on screen; the
					// hard error state is only for a section that never loaded.
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
				const timer = setInterval(refresh, 15e3);
				return () => {
					clearInterval(timer);
				};
			}, [refresh]);
			const jobs = react.useMemo(() => sortJobs(snapshot?.data?.jobs ?? [], orderBy), [snapshot, orderBy]);
			const runs = snapshot?.data?.runs ?? [];
			const specs = snapshot?.data?.specs ?? {};
			// The run-detail page portals over the center column: a holder div
			// appended to the conversation slot's parent (positioned relative
			// via the :has rule in the stylesheet). Mounted only while a run
			// is open; the re-attach timer survives center-column re-renders.
			const pageOpen = runPage !== null;
			const [pageHolder, setPageHolder] = react.useState(null);
			react.useEffect(() => {
				if (!pageOpen) return;
				let node = null;
				const place = () => {
					const anchor = document.querySelector("div[data-slot=\"conversation\"]");
					if (anchor === null || anchor.parentElement === null) return;
					if (node === null) {
						node = document.createElement("div");
					}
					anchor.parentElement.appendChild(node);
					setPageHolder(node);
				};
				place();
				const timer = setInterval(() => {
					if (node === null || !node.isConnected) place();
				}, 5e3);
				const onKey = (event) => {
					if (event.key === "Escape") setRunPage(null);
				};
				// Opening the session that is already current moves nothing in the
				// sessions store, so that navigation never reaches the anchor effect
				// below: the sidebar's own session rows dismiss the page here.
				// role=treeitem with aria-selected is exactly the rows that open a
				// session (session rows and search hits) — project rows carry
				// aria-expanded instead. A press on a row's action button is not
				// navigation and leaves the page alone.
				const onPointerDown = (event) => {
					const target = event.target;
					if (!(target instanceof Element)) return;
					const row = target.closest("[role=\"treeitem\"][aria-selected]");
					if (row === null) return;
					const button = target.closest("button");
					if (button !== null && button !== row) return;
					setRunPage(null);
				};
				window.addEventListener("keydown", onKey);
				window.addEventListener("pointerdown", onPointerDown, true);
				return () => {
					clearInterval(timer);
					window.removeEventListener("keydown", onKey);
					window.removeEventListener("pointerdown", onPointerDown, true);
					node?.remove();
					setPageHolder(null);
				};
			}, [pageOpen]);
			// The open record re-derives from every snapshot so a live run's
			// page follows it to settlement; a record pruned out of the wire
			// window closes the page instead of freezing a stale copy.
			const pageRecord = runPage === null ? undefined : runs.find((record) => record.job === runPage.job && record.seq === runPage.seq);
			react.useEffect(() => {
				if (runPage !== null && snapshot?.data !== undefined && pageRecord === undefined) setRunPage(null);
			}, [runPage, snapshot, pageRecord]);
			// While the open detail page tracks a run in flight, poll fast so
			// the live output tail streams; the 15s baseline resumes at settlement.
			const pageRunning = pageRecord?.status === "running";
			react.useEffect(() => {
				if (pageRunning !== true) return;
				const timer = setInterval(refresh, 2e3);
				return () => {
					clearInterval(timer);
				};
			}, [pageRunning, refresh]);
			const runningCount = jobs.filter((job) => job.running === true).length;
			react.useEffect(() => {
				if (runningCount === 0) return;
				setNowMs(Date.now());
				const timer = setInterval(() => {
					setNowMs(Date.now());
				}, 1e3);
				return () => {
					clearInterval(timer);
				};
			}, [runningCount]);
			react.useEffect(() => {
				if (confirmDelete === null) return;
				const timer = setTimeout(() => setConfirmDelete(null), 5e3);
				return () => {
					clearTimeout(timer);
				};
			}, [confirmDelete]);
			react.useEffect(() => {
				if (searchOpen) searchRef.current?.focus();
			}, [searchOpen]);
			const currentSession = useSessions((state) => state.current);
			// The page portals over the center column, so a host navigation there
			// has to dismiss it or the conversation stays buried: the page carries
			// the session that was current when it opened, and the center moving to
			// another one (a sidebar row, an agent run row, a freshly forked
			// session) hands the column back to the conversation.
			react.useEffect(() => {
				if (runPage === null || runPage.session === currentSession) return;
				setRunPage(null);
			}, [runPage, currentSession]);
			// The create form's working-directory default — the agent's own
			// directory: the current session's cwd first, then the workspace
			// holding that session, then a lone workspace when nothing is current.
			const sessionCwd = useSessions((state) => state.current === undefined ? undefined : state.byId?.[state.current]?.cwd);
			const workspaceItems = useWorkspaces((state) => state.items);
			const defaultCwd = react.useMemo(() => {
				if (typeof sessionCwd === "string" && sessionCwd !== "") return sessionCwd;
				const list = workspaceItems ?? [];
				const mine = currentSession === undefined
					? undefined
					: list.find((workspace) => Array.isArray(workspace.sessionIds) && workspace.sessionIds.includes(currentSession));
				return mine?.path ?? (list.length === 1 ? list[0].path : undefined) ?? "";
			}, [sessionCwd, workspaceItems, currentSession]);
			const act = react.useCallback(async (path, body) => {
				setActionFault(null);
				const outcome = await postAction(path, body);
				if (!outcome.ok) setActionFault(t("action.failed", { message: outcome.message }));
				refresh();
			}, [refresh, t]);
			const onMenu = react.useCallback((job, id) => {
				if (id === "run") act(RUN_NOW_PATH, { job: job.name });
				else if (id === "stop") act(STOP_PATH, { job: job.name });
				else if (id === "pause") act(ENABLE_PATH, { job: job.name, enabled: false });
				else if (id === "resume") act(ENABLE_PATH, { job: job.name, enabled: true });
				else if (id === "edit") {
					const spec = specs[job.name];
					if (spec !== undefined) setDialog({ mode: "edit", spec });
				}
				else if (id === "delete") setConfirmDelete(job.name);
			}, [act, specs]);
			const onToggle = react.useCallback((name) => {
				setConfirmDelete(null);
				setRunLimit(RUNS_PAGE);
				setExpandedJob((previous) => previous === name ? null : name);
			}, []);
			if (!wide) return null;
			const trimmed = query.trim().toLowerCase();
			const visible = trimmed === "" ? jobs : jobs.filter((job) => job.name.toLowerCase().includes(trimmed));
			let body;
			if (snapshot?.error !== undefined) {
				body = h("p", { className: "dshCron_note dshCron_noteError", role: "alert" }, t(snapshot.error === "unavailable" ? "error.unavailable" : "error.network"));
			} else if (jobs.length === 0) {
				body = h("p", { className: "dshCron_note" }, t("empty.jobs"));
			} else if (visible.length === 0) {
				body = h("p", { className: "dshCron_note" }, t("empty.search"));
			} else {
				body = visible.flatMap((job) => {
					const jobRuns = runs.filter((record) => record.job === job.name);
					const lastRecord = job.lastRun === undefined ? undefined : jobRuns.find((record) => record.seq === job.lastRun.seq);
					const row = h(JobRow, {
						key: job.name,
						job,
						expanded: expandedJob === job.name,
						lastRecord,
						nowMs,
						confirmDelete: confirmDelete === job.name,
						t,
						onToggle,
						onMenu,
						onConfirmDelete: (name) => {
							setConfirmDelete(null);
							act(DELETE_PATH, { job: name });
							if (expandedJob === name) setExpandedJob(null);
						},
					});
					if (expandedJob !== job.name) return [row];
					const shown = jobRuns.slice(0, runLimit);
					const rest = jobRuns.length - shown.length;
					return [
						row,
						...shown.map((record) => h(RunRow, {
							key: `${record.job}#${record.seq}`,
							record,
							selected: (record.sessionId !== undefined && record.sessionId === currentSession)
								|| (runPage !== null && runPage.job === record.job && runPage.seq === record.seq),
							nowMs,
							t,
							onOpenSession: (sessionId) => {
								const opened = openSession(sessionId);
								if (opened) setRunPage(null);
								return opened;
							},
							onOpenPage: (target) => {
								setRunPage((previous) => previous !== null && previous.job === target.job && previous.seq === target.seq
									? null
									: { job: target.job, seq: target.seq, session: currentSession });
							},
						})),
						jobRuns.length === 0 ? h("p", { key: `${job.name}-empty`, className: "dshCron_note", style: { paddingLeft: 28 } }, t("runs.empty")) : null,
						rest > 0 ? h("button", {
							key: `${job.name}-more`,
							type: "button",
							className: "dshCron_more",
							onClick: () => setRunLimit(runLimit + 20),
						}, t("runs.more", { count: rest })) : null,
					].filter((node) => node !== null);
				});
			}
			const section = h("div", { className: "dshCron_section" },
				h("div", { className: "dshCron_head" },
					searchOpen
						? h("div", {
							className: "dshCron_searchBox",
							// Blur bubbles in React (focusout); close only when focus
							// leaves the whole box, not when it moves between the input
							// and the buttons inside it.
							onBlur: (event) => {
								if (event.currentTarget.contains(event.relatedTarget)) return;
								setSearchOpen(false);
								setQuery("");
							},
						},
							h("button", {
								type: "button",
								className: "dshCron_headBtn",
								"aria-label": t("section.search.close"),
								onMouseDown: (event) => event.preventDefault(),
								onClick: () => {
									setSearchOpen(false);
									setQuery("");
								},
							}, h(primitives.IconSearchOutline16, { size: 16 })),
							h("input", {
								ref: searchRef,
								className: "dshCron_searchInput",
								value: query,
								placeholder: t("section.search"),
								"aria-label": t("section.search.aria"),
								onChange: (event) => setQuery(event.target.value),
								onKeyDown: (event) => {
									if (event.key === "Escape") {
										setSearchOpen(false);
										setQuery("");
									}
								},
							}),
							query !== "" ? h("button", {
								type: "button",
								className: "dshCron_headBtn",
								"aria-label": t("section.search.close"),
								onMouseDown: (event) => event.preventDefault(),
								onClick: () => setQuery(""),
							}, h(primitives.IconCloseOutline16, { size: 14 })) : null)
						: h(react.Fragment, {},
							h("span", { className: "dshCron_headTitle" },
								h("span", { className: "dshCron_headLabel" }, t("section.title")),
								h("span", { className: "dshCron_headCount" }, runningCount > 0 ? t("section.running", { count: runningCount }) : "")),
							h("button", {
								type: "button",
								className: "dshCron_headBtn",
								"aria-label": t("section.search.aria"),
								title: t("section.search"),
								onClick: () => setSearchOpen(true),
							}, h(primitives.IconSearchOutline16, { size: 16 })),
							h(ViewOptionsMenu, { orderBy, onPick: pickOrder, t }),
							h("button", {
								type: "button",
								className: "dshCron_headBtn",
								"aria-label": t("section.add"),
								title: t("section.add"),
								onClick: () => setDialog({ mode: "new" }),
							}, h(primitives.IconPlusOutline16, { size: 16 })))),
				actionFault !== null ? h("p", { className: "dshCron_note dshCron_noteError", role: "alert", style: { paddingTop: 0, paddingBottom: 2 } }, actionFault) : null,
				h("div", { className: "dshCron_list" }, body),
				dialog !== null ? h(JobDialog, {
					t,
					workspaces,
					defaultCwd,
					initial: dialog.mode === "edit" ? dialog.spec : undefined,
					onClose: () => setDialog(null),
					onSaved: () => {
						setDialog(null);
						refresh();
					},
				}) : null,
				pageRecord !== undefined && pageHolder !== null ? reactDom.createPortal(h(CommandRunPage, {
					record: pageRecord,
					spec: specs[pageRecord.job],
					nowMs,
					t,
					onClose: () => setRunPage(null),
				}), pageHolder) : null);
			return holder !== null ? reactDom.createPortal(section, holder) : section;
		}
		//#endregion
		//#region plugin
		/** Dictionary namespace owned by this plugin. */
		const NS = "cron";
		/** Required client services: slot/locale registration, the directory picker's data plane, and session open. */
		const inject = ["slots", "locale", "workspaces", "sessions"];
		/** Register dictionaries and the sidebar section (foot slot, above settings). */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "cron: dictionaries");
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "cron-jobs",
				order: 20,
				locale: NS,
				inject: () => ({
					workspaces: ctx.workspaces,
					openSession: (sessionId) => {
						try {
							ctx.sessions.open(sessionId);
							return true;
						} catch (error) {
							console.warn("cron: open session failed:", error);
							return false;
						}
					},
				}),
			}, CronSection));
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
