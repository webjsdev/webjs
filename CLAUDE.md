@AGENTS.md

## GitHub Project workflow (Claude Code rule)

The webjs project board at https://github.com/orgs/webjsdev/projects/1 (backed by issues in `webjsdev/webjs`) is the **single source of truth** for outstanding work. Do NOT maintain a parallel todo list in Claude Code's internal task tracker, agent memory, or anywhere else.

The board has three Status columns: **Todo**, **In progress**, **Done**.

### Listing pending work

`gh project item-list 1 --owner webjsdev --format json` is the authoritative answer to "what's open?". Do not consult internal task lists or memory for this question.

### Filing new work

When the user describes a task that needs tracking:

```sh
gh issue create --repo webjsdev/webjs --title "..." --body "..." --label enhancement
gh project item-add 1 --owner webjsdev --url <issue-url>
```

The card lands in Todo by default. Issue bodies follow the same shape as PR descriptions: short problem statement, design rationale, acceptance-criteria checklist.

### Starting work on a tracked issue

When the user says "start work on #N" (or equivalent):

1. Create a feature branch: `git checkout -b <type>/<slug>` (e.g. `feat/dist-bundle-core`). Never edit on main.
2. Move the project card from Todo to **In progress** (see the snippet below).
3. Commit + push as usual.
4. Open the PR with `gh pr create` and put `Closes #N` in the body near the top (right after the `## Summary` heading). Multiple linked issues each get their own `Closes #N` line.

### Merging

`Closes #N` in the PR body auto-closes the linked issue on merge. The closed issue auto-moves the project card from In progress to **Done**. No manual move is needed at merge time.

### Partial PRs

A PR that does NOT fully resolve an issue MUST NOT use `Closes #N` for it. Reference the issue with a plain `#N` mention instead, e.g. "Partial fix toward #112; elision logic still needs ...".

### Moving a card to In progress via gh

`gh project item-edit` needs four IDs (project, item, field, option). Resolve them once at branch creation time:

```sh
N=<issue-number>
PROJECT_ID=$(gh project view 1 --owner webjsdev --format json --jq '.id')
ITEM_ID=$(gh project item-list 1 --owner webjsdev --format json --jq ".items[] | select(.content.number == $N) | .id")
STATUS_FIELD_ID=$(gh project field-list 1 --owner webjsdev --format json --jq '.fields[] | select(.name == "Status") | .id')
IN_PROGRESS_OPT_ID=$(gh project field-list 1 --owner webjsdev --format json --jq '.fields[] | select(.name == "Status") | .options[] | select(.name == "In progress") | .id')
gh project item-edit --project-id "$PROJECT_ID" --id "$ITEM_ID" --field-id "$STATUS_FIELD_ID" --single-select-option-id "$IN_PROGRESS_OPT_ID"
```

The same shape with the `Done` option's ID moves a card to Done manually if ever needed (rare; the `Closes #N` automation handles the merge path).
