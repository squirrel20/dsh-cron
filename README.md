# dsh-cron

English | [简体中文](README.zh-CN.md)

Unattended scheduled-jobs plugin for DeepSeek Harness (dsh): run **agent tasks** (spawn a one-shot agent to execute a prompt through the full dsh toolchain) or **command tasks** (run a script directly) on a cron expression, a fixed interval, or a one-time instant. Complementary to `@deepseek-ai/dsh-schedule` — that one is persistent in-session reminders, this one is a host-side job scheduler: jobs belong to no interactive session and fire automatically while the process is up.

## Features

- **Three trigger kinds**: `cron` (5-field expression + explicit IANA `timeZone`; the process time zone is never consulted), `everySeconds` (anchor-aligned interval, 60s minimum), `at` (one-time RFC 3339 instant; a Z or numeric offset is required).
- **Two task kinds**: `agent` (create a one-shot agent via `ctx.agents.create`, submit the prompt, wait for quiescence, take the last assistant message as the summary, dispose to finish — i.e. the dsh-headless one-shot recipe); `command` (spawn a child process, record exit code and output tail).
- **Persistent state**: job dispatch state and run history live in the storage domain layer (`ctx.storage.domain`, domain name `cron`), never in session event logs.
- **Reliability semantics**: at-most-once per occurrence (`lastFiredMs` is persisted before execution); missed occurrences are never replayed one by one (the misfire policy runs at most once, against the latest due occurrence); runs interrupted by a crash are repaired to `aborted` on the next startup.
- **Policies**: `overlap: skip | queue | replace` (when the previous run is still going: skip / queue the latest one occurrence / kill and restart); `misfire: skip | runOnce` (occurrences missed while the process was down: ignore / catch up once).
- **Delivery**: optional delivery command; the run record is fed as JSON on stdin (fires only on failure by default).
- **Clock discipline** (inherited from dsh-schedule): long waits are chunked and the wall clock is re-read on every wake-up — a backwards clock jump never fires early, a forwards jump is handled as overdue.

## Installation

In your profile's `package.json`:

```jsonc
{
  "dependencies": { "dsh-cron": "link:/path/to/dsh-cron" },   // or an npm/git source
  "dsh": { "profile": { "bundles": [ /* …existing bundles… */, "dsh-cron" ] } }
}
```

Then declare jobs by overriding the config in the profile's `cordis.patch.yml`:

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
          prompt: Read yesterday's logs under logs/, summarize anomalies and suggest remediations.
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

Job misconfiguration (duplicate names, invalid expressions, missing time zone, …) fails loud at mount time — it is never swallowed silently.

## Run records

The `runs` table keeps the most recent `historyLimit` entries keyed by `<job>#<seq>`:

```jsonc
{
  "job": "daily-log-review", "seq": 42,
  "target": "2026-08-26T23:00:00.000Z",       // the occurrence this run is for
  "startedAt": "…", "finishedAt": "…",
  "status": "ok",                              // ok|failed|timeout|skipped-overlap|replaced|aborted
  "summary": "…",                              // agent's last reply / command output tail (truncated)
  "sessionId": "cron-daily-log-review-…"       // agent task's session, inspectable under ~/.dsh/sessions
}
```

## Boundaries and known limitations

- Agent task prompts carry a fixed `[CRON RUN]` framing that states the run is unattended and questions are forbidden.
- One-shot sessions remain on disk after dispose for inspection; this plugin does not GC session files.
- Jobs come from plugin config only (declarative); conversational management tools (`cron_list` / `cron_run_now`, …) are left for a future version.
- `queue` depth is 1: only the single latest squeezed-out occurrence is kept.

## Tests

```sh
npm test   # unit tests for the scheduling math (cron parsing, time zones, anchor alignment, misfire collapsing)
```
