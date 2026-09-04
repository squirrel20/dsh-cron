# dsh-cron

English | [简体中文](README.zh-CN.md)

Unattended scheduled-jobs plugin for DeepSeek Harness (dsh): run **agent tasks** (spawn a one-shot agent to execute a prompt through the full dsh toolchain) or **command tasks** (run a script directly) on a cron expression, a fixed interval, or a one-time instant. Complementary to `@deepseek-ai/dsh-schedule` — that one is persistent in-session reminders, this one is a host-side job scheduler: jobs belong to no interactive session and fire automatically while the process is up.

![Sidebar job list with expanded run history; clicking an agent run opens the full session replay](assets/demo-run-session.png)

## UI

- **Sidebar section**: status dot (last result) + next-trigger time, live elapsed timer while running; rows expand into run history; clicking an agent run jumps straight to that run's full session, and clicking a command run opens a run-detail page over the center column (status, duration, exit code, command, output tail).
- **Create / edit modal**: trigger presets (hourly / daily / weekdays / weekly, with cron expression / interval / one-shot tucked into a custom tier), task kind, mode / permission / model knobs (blank = inherit defaults), working directory, timeout, and overlap / misfire policies — all on one screen; the time zone is taken silently from the browser (edits keep the job's own).

| Create a job | Row actions |
| --- | --- |
| ![Create-job modal](assets/demo-new-job.png) | ![Run now / pause / edit / delete](assets/demo-row-menu.png) |

## Features

- **Three trigger kinds**: `cron` (5-field expression + explicit IANA `timeZone`; the process time zone is never consulted), `everySeconds` (anchor-aligned interval, 60s minimum), `at` (one-time RFC 3339 instant; a Z or numeric offset is required).
- **Three ways to declare a job**: profile config (declarative, versioned with the profile), the runtime overlay (`+` in the sidebar, or `cron_create` from a session — persisted as "manual" jobs), and other plugins through the `cron` service (`ctx.cron.registerJob`, see [Adding jobs from a plugin](#adding-jobs-from-a-plugin)).
- **Two task kinds**: `agent` (create a one-shot agent via `ctx.agents.create`, submit the prompt, wait for quiescence, take the last assistant message as the summary, dispose to finish — i.e. the dsh-headless one-shot recipe); `command` (spawn a child process, record exit code and output tail).
- **Persistent state**: job dispatch state and run history live in the storage domain layer (`ctx.storage.domain`, domain name `cron`), never in session event logs.
- **Reliability semantics**: at-most-once per occurrence (`lastFiredMs` is persisted before execution); missed occurrences are never replayed one by one (the misfire policy runs at most once, against the latest due occurrence); runs interrupted by a crash are repaired to `aborted` on the next startup.
- **Policies**: `overlap: skip | queue | replace` (when the previous run is still going: skip / queue the latest one occurrence / kill and restart); `misfire: skip | runOnce` (occurrences missed while the process was down: ignore / catch up once).
- **Delivery**: optional delivery command; the run record is fed as JSON on stdin (fires only on failure by default).
- **Clock discipline** (inherited from dsh-schedule): long waits are chunked and the wall clock is re-read on every wake-up — a backwards clock jump never fires early, a forwards jump is handled as overdue.

## Installation

### From the Plugin Market

With [dsh-market](https://github.com/dsh-market/dsh-market) installed, open **Settings → Plugin Market**, search **dsh-cron**, and install with one click — the market adds both the dependency and the profile bundle entry for you, and most installs go live after a page refresh.

Or install the release tarball from the command line (this only runs the package install — add `"dsh-cron"` to `dsh.profile.bundles` yourself, as shown below):

```sh
dsh plugin --profile web add https://github.com/squirrel20/dsh-cron/releases/latest/download/dsh-cron.tgz
```

> The npm package named `dsh-cron` is an unrelated project — install from the market or the release tarball, not from the npm registry.

### From source

In your profile's `package.json`:

```jsonc
{
  "dependencies": { "dsh-cron": "link:/path/to/dsh-cron" },   // or a git checkout / release tarball
  "dsh": { "profile": { "bundles": [ /* …existing bundles… */, "dsh-cron" ] } }
}
```

### Config-declared jobs (optional)

Declare always-on jobs by overriding the config in the profile's `cordis.patch.yml` — or skip this entirely and create jobs from the UI or a session (see [Usage](#usage)):

```yaml
- id: dsh-cron
  config:
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
    sessionGc:            # optional; defaults: enabled: true, graceMinutes: 30, root: ~/.dsh/sessions
      enabled: true
      graceMinutes: 30
```

Job misconfiguration (duplicate names, invalid expressions, missing time zone, …) fails loud at mount time — it is never swallowed silently.

The same block takes an optional `maxConcurrentRuns`: **`0` (the default) means unbounded** — unrelated jobs have no reason to queue behind each other, and a job's own overlap is already governed by `policy.overlap`. Set a positive number only to deliberately cap host-wide load; `1` serializes every job, so jobs due at the same minute run one after another.

## Usage

### Adding a job by hand

Click **`+`** in the sidebar's **Cron Jobs** section header. The New job dialog configures everything on one screen:

- **Name** — letters (any script), digits, `-` and `_`; no spaces.
- **Trigger** — `cron` (5-field expression + IANA time zone), `interval`, or `one-shot`.
- **Task** — `agent` (a prompt executed unattended through the full dsh toolchain) or `command` (an argv to spawn).
- **Preset / Access / Model** — leave blank to inherit the host defaults.
- **Working directory** — type a path or browse via the folder icon.
- **Timeout, On overlap, On misfire** — see [Features](#features) for the policy semantics.

**Create & enable** persists the job (a "manual" chip marks it apart from config-declared jobs). Afterwards, each row's `⋯` menu offers **Run now / Pause schedule / Edit job / Delete job**; clicking a row expands its run history; clicking an agent run opens that run's full session replay, and clicking a command run (or a pruned-session agent run) opens its run-detail page over the center column.

### Adding a job from a session

Just ask the agent in any session:

> Every Monday at 07:00 review our outdated dependencies and save an upgrade checklist to reports/deps-audit.md.

The bundled **cron-create** skill (auto-registered when the host has a skill registry) walks the model through collect → confirm → create → verify, calling the `cron_create` tool under the hood; `cron_delete` removes a manual job the same way. Jobs created from a session are ordinary manual jobs — the exact same overlay the web dialog writes — so they show up in the sidebar immediately and can be edited there later. The read/steer tools (`cron_list`, `cron_runs`, `cron_run_now`, `cron_enable`, `cron_disable`) work on config-declared jobs too.

### Adding jobs from a plugin

A schedule often belongs with a piece of software rather than with one host: the package that ships a refresh script also knows how often it should run. Such a package can register its own jobs — installing it creates them, unmounting it retires them, and nobody transcribes a spec into a dialog on every machine.

The provider injects the `cron` service and registers inside an effect, exactly like a `dsh-ingest` source plugin:

```js
export const name = "cron-source-kb";
export const inject = ["cron"];

export function apply(ctx, config) {
  ctx.effect(() => ctx.cron.registerJobs([
    {
      name: "kb-refresh",
      description: "Re-index the knowledge base",
      schedule: { cron: "30 7 * * *", timeZone: "Asia/Shanghai" },
      task: { kind: "command", argv: ["/bin/sh", `${config.repoRoot}/scripts/kb-refresh.sh`] },
      policy: { overlap: "skip", misfire: "runOnce" },
    },
  ], { owner: "dsh-cron-source-kb" }), "kb.cron()");
}
```

- The spec is the same vocabulary config and `cron_create` use, and it is validated **synchronously**: a bad schedule throws inside the provider's own `apply`, naming the field.
- `owner` is required — the overlay uses it to tell the user which package brought a job.
- `registerJob` returns a disposer (`registerJobs` returns one for the batch, and rolls back if any member is defective, so a provider never mounts half its schedules).
- Registering may precede dsh-cron's own startup; registrations attach as soon as the scheduler is ready and are replayed if dsh-cron reloads.
- Names must be free: a name declared in profile config, or already registered by another provider, throws rather than silently losing to mount order.

Plugin jobs are ordinary jobs in the list — the same run history, run-now, pause and session jump-through — but they are **read-only** in the overlay and to `cron_create` / `cron_delete`: editing means editing the provider, and removing means uninstalling it (`updateJob` / `cron_delete` answer `plugin_job`). Pausing is the exception: an enable override is the user's, and it survives re-registration.

A runnable copy of the provider above lives in [`examples/dsh-cron-source-demo`](examples/dsh-cron-source-demo) — add it to a profile's `dependencies` and `dsh.profile.bundles` to watch a plugin job appear.

Unmounting a provider stops its jobs but keeps their dispatch state and whole run history — reinstalling resumes the same job rather than starting a stranger under its name. What is left behind shows as an **orphan** row (marked "plugin gone", sorted last, no next occurrence) whose only action is **Delete job**, which clears that leftover history for good.

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

- Agent runs carry a fixed `[CRON RUN]` framing that states the run is unattended and questions are forbidden. It is injected as a scoped system-prompt section, so the user message holds only the job's prompt; hosts without the system-prompt service fall back to prepending it to the message.
- Config jobs come from plugin config (declarative); the conversational tools (`cron_list` / `cron_runs` / `cron_run_now` / `cron_enable` / `cron_disable`) observe and steer them but never create or delete them. Runtime "manual" jobs are the exception: `cron_create` / `cron_delete` manage those from a session, guided by the bundled `cron-create` skill (registered into the host's skill registry when one exists), through the same `manual`-table overlay as the web dialog.
- Plugin-registered jobs (`source: "plugin"`) are owned by their provider package: they can be run, paused and inspected, but not edited or deleted from the overlay or a session — that is what installing and uninstalling the provider is for. Unmounting a provider leaves an orphan row holding the job's history until the user deletes it.
- `queue` depth is 1: only the single latest squeezed-out occurrence is kept.

## Web overlay

When the profile includes `@deepseek-ai/dsh-web-app`, the plugin also ships a
sidebar overlay: a clock badge at the sidebar foot opens a panel listing
every job (kind, schedule, next occurrence, latest outcome); a job row
drills into its recent run history; clicking a command run (or an agent
run whose session was pruned) opens a run-detail page over the center
column — status, scheduled/start/finish instants, duration, exit code,
argv, and the stored summary tail. Rows carry hover actions — run an idle job
now (the `cron_run_now` semantics), or stop the run in flight (the record
settles as `killed`; later occurrences are untouched). The panel's `+`
opens a create form (name; trigger presets — hourly/daily/weekdays/weekly,
compiled to plain cron shapes and mapped back onto the presets on edit, with
cron expression/interval/one-shot in a custom tier and the time zone taken
silently from the browser; agent/command task; working directory with a
browse dialog over the host's directory capability; timeout; overlap/misfire
policy); created jobs persist in the
storage domain's `manual` table, re-normalize on every boot, and show a
"manual" chip beside config-declared jobs — a config job with the same name
wins and evicts the manual copy. A manual job's drill-in view carries a
two-click delete (trash, then confirm) that drops the job and its whole run
ledger; config jobs and jobs with a run in flight are refused.

The browser half is `lib/client.js` (declared via `exports["./client"]` +
the `dsh.client` package field). The host half (`lib/web.js`) serves
`GET /dsh-cron/api/state` plus four writes — `POST …/run-now`, `…/stop`,
`…/jobs`, `…/delete` — which demand `application/json` bodies so cross-site simple
requests die before dispatch; routes register on `ctx.webServer` only while
a webserver is present, so headless profiles mount unchanged.

## Tests

```sh
npm test   # unit tests for the scheduling math (cron parsing, time zones, anchor alignment, misfire collapsing)
```
