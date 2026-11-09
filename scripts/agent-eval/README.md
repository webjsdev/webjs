# Agent eval

Measures the claim WebJs is built on: an agent that knows Lit and the Next.js
App Router writes correct WebJs from the brief alone.

For each task in `tasks.mjs` the runner scaffolds a fresh full-stack app, whose
only WebJs documentation is the brief in its `AGENTS.md`, and runs an agent CLI inside it with the task's
prompt. The prompts name no WebJs API. Then it grades the app:

- `webjs check` reports no violation,
- the app boots in production mode,
- every HTTP probe of the task holds (status, body, redirect target, and for a
  form task, a real no-JS submission of the page's first form).

```sh
node scripts/agent-eval/run.mjs                        # every task, Claude Code
node scripts/agent-eval/run.mjs --task guestbook-action
node scripts/agent-eval/run.mjs --agent "codex exec {prompt}"
node scripts/agent-eval/run.mjs --keep                 # keep the apps to inspect
```

`--agent` is a command line in which `{prompt}` becomes the prompt as one
argument (appended when absent). The default is
`claude -p {prompt} --permission-mode bypassPermissions`. `--timeout <s>` caps
each agent run (default 900). The pass table goes to stdout and the full result,
including every violation and failed probe, to `agent-eval-results.json`.

It runs from a real install of this repo (the app links the repo's
`node_modules`, so the agent reads the framework source of this branch). It is
local only: it calls a model, costs money per run, and varies between runs. CI
covers the same surfaces deterministically with the muscle-memory corpus in
`test/muscle-memory/`, and `test/agent-eval/` runs this harness with a fake agent
so the graders themselves are tested.

To add a task, give it a prompt a person would write and probes that only a
working feature satisfies.

## First-draft replay

`replay.mjs` answers a different question: did the agent's code pass the
FIRST time, on this branch? A build iterates until it passes, so a pass rate
on the finished app hides every fix-up turn. The replay rebuilds each recorded
build as it was first written and grades that draft against the current
branch, with no model call, so a framework change can be measured for free.

```sh
node scripts/agent-eval/replay.mjs --corpus corpus.json          # [{ name, transcript, app }]
node scripts/agent-eval/replay.mjs --transcript t.jsonl --app <dir>
```

The draft is the agent's own Write / Edit calls replayed onto the app's root
(scaffold) commit, up to the first `webjs check`, typecheck or test run that
follows the agent's last new file. After its first verification only
first-time file writes are kept: an edit then is likely a correction prompted
by that run. Generated files the agent did not author (the UI kit `webjs ui
add` copies in) come from the finished app, a migration is regenerated with
`webjs db generate`, and only the tests the agent wrote are run. It then runs
this branch's `webjs check`, `webjs typecheck` and server tests and prints
which drafts pass. `edit misses` counts edits whose `old_string` was not found
in the replayed file, a sign the draft diverged from what the agent saw.

## Clean multi-feature builds

`build.mjs` runs the spec-sized builds the first-draft numbers come from. A
headless `claude -p` builds one spec from `specs/` (Roomly, Pollster, Trackr,
Inbox) in a fresh scaffold OUTSIDE this repo, with `--setting-sources
project,local` and `--strict-mcp-config` over the app's own `.claude.json`, so
only what a real scaffold ships applies: none of the machine's user settings,
hooks, skills or MCP servers. The transcript is stream-json, so `replay.mjs`
reads it as it is.

```sh
node scripts/agent-eval/build.mjs --spec roomly                          # 1 build, Haiku
node scripts/agent-eval/build.mjs --spec inbox --runs 3 --jobs 3
node scripts/agent-eval/build.mjs --spec roomly --framework ../webjs-main --label before
node scripts/agent-eval/build.mjs --summary <out-dir>                    # the table again
```

Each build gets `result.json`: whether the agent's FIRST check, typecheck and
test run passed, the first draft replayed and graded on this branch, the
finished app graded, edits after the first failed check (`rework`), tool calls,
tokens and minutes. `--framework` points at another checkout for a baseline arm;
it scaffolds and links that checkout's framework.
