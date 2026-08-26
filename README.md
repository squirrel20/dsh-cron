# dsh-cron

DeepSeek Harness (dsh) 的无人值守定时任务插件：按 cron 表达式 / 固定周期 / 一次性时刻，定时跑 **agent 任务**（新建一次性 agent 执行 prompt，走完整 dsh 工具链）或 **command 任务**（直接跑脚本）。与 `@deepseek-ai/dsh-schedule` 互补——那是会话内的持久提醒，这是 host 面的作业调度器：作业不属于任何交互会话，进程常驻期间自动执行。

## 能力

- **三种触发**：`cron`（5 字段表达式 + 显式 IANA `timeZone`，绝不读进程时区）、`everySeconds`（锚点对齐周期，最短 60s）、`at`（RFC 3339 一次性时刻，必须带 Z/偏移量）。
- **两种任务**：`agent`（`ctx.agents.create` 新建一次性 agent，提交 prompt，等 quiescence，取最后一条 assistant 文本作 summary，dispose 收尾——即 dsh-headless 的 one-shot 配方）；`command`（spawn 子进程，记录 exit code 与输出尾部）。
- **持久状态**：作业 dispatch 状态与运行历史存 storage domain 层（`ctx.storage.domain`，domain 名 `cron`），不进会话事件日志。
- **可靠性语义**：每个发生点 at-most-once（先落盘 `lastFiredMs` 再执行）；错过的发生点绝不逐个补跑（misfire 策略最多补一次、取最新一个到期点）；宕机中断的运行在下次启动时修复为 `aborted`。
- **策略**：`overlap: skip | queue | replace`（上一轮未跑完时跳过 / 排队最新一个 / 掐掉重来）；`misfire: skip | runOnce`（停机期间错过的发生点忽略 / 补跑一次）。
- **交付**：可选 delivery 命令，运行记录以 JSON 从 stdin 喂入（默认仅失败时触发）。
- **时钟纪律**（承自 dsh-schedule）：长等待拆段、每次唤醒重读墙钟——回拨不会提前触发，前跳按 overdue 处理。

## 安装

profile 的 `package.json`：

```jsonc
{
  "dependencies": { "dsh-cron": "link:/path/to/dsh-cron" },   // 或 npm/git 来源
  "dsh": { "profile": { "bundles": [ /* …既有 bundles… */, "dsh-cron" ] } }
}
```

然后在 profile 的 `cordis.patch.yml` 里覆盖 config 声明作业：

```yaml
- id: dsh-cron
  config:
    maxConcurrentRuns: 1
    historyLimit: 50
    jobs:
      - name: daily-log-review
        schedule: { cron: "0 7 * * *", timeZone: "Asia/Shanghai" }
        task:
          kind: agent
          prompt: 读取 logs/ 下昨日日志，总结异常并给出处置建议。
          cwd: /path/to/project
          timeoutSeconds: 1800
        policy: { overlap: skip, misfire: skip }
        delivery:
          argv: ["/usr/local/bin/notify", "--stdin"]
          onlyOnFailure: true
      - name: heartbeat
        schedule: { everySeconds: 3600 }
        task: { kind: command, argv: ["./scripts/heartbeat.sh"], cwd: /path/to/project }
```

作业配置错误（重名、非法表达式、缺时区等）在挂载期 fail loud，不会静默吞掉。

## 运行记录

`runs` 表按 `<job>#<seq>` 存最近 `historyLimit` 条：

```jsonc
{
  "job": "daily-log-review", "seq": 42,
  "target": "2026-08-26T23:00:00.000Z",       // 该发生点
  "startedAt": "…", "finishedAt": "…",
  "status": "ok",                              // ok|failed|timeout|skipped-overlap|replaced|aborted
  "summary": "…",                              // agent 最后回复 / 命令输出尾部（截断）
  "sessionId": "cron-daily-log-review-…"       // agent 任务的会话，可在 ~/.dsh/sessions 复查
}
```

## 边界与已知限制

- agent 任务的 prompt 带固定 `[CRON RUN]` framing，明示无人值守、禁止提问。
- 一次性会话 dispose 后仍留在磁盘上供复查；本插件不做会话文件 GC。
- 作业只来自插件 config（声明式）；对话式管理工具（`cron_list` / `cron_run_now` 等）留待后续版本。
- `queue` 深度为 1：只保留最新一个被挤压的发生点。

## 测试

```sh
npm test   # 调度数学（cron 解析、时区、锚点对齐、misfire 折叠）的单元测试
```
