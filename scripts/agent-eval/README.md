# Agent eval

Measures the claim WebJs is built on: an agent that knows Lit and the Next.js
App Router writes correct WebJs from the brief alone.

For each task in `tasks.mjs` the runner scaffolds a fresh full-stack app, clears
the feature gallery so the brief in the app's `AGENTS.md` is the only WebJs
documentation in the project, and runs an agent CLI inside it with the task's
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
