#!/usr/bin/env bash
#
# UserPromptSubmit hook: route every prompt to the skills it matches, so a
# relevant skill is never silently skipped.
#
# Why this exists: a Skill is model-invoked. It fires only when the model
# judges the request to match the skill's triggers, and that judgement can
# be wrong. In one session a "can we add prefetch, verify in the remix
# repo, let me know" request was treated as pure research, so the
# webjs-file-issue workflow was skipped and code investigation started with
# no tracked issue. Skill descriptions and AGENTS.md prose are advisory;
# only a hook is deterministic. This hook closes the gap the same way the
# em-dash hook does: it runs on every prompt, decides from the prompt TEXT
# (not from model judgement), and injects a high-priority directive.
#
# What it can and cannot do (verified against the Claude Code hooks
# reference): a hook CANNOT invoke a Skill tool-call itself. The strongest
# deterministic lever is UserPromptSubmit additionalContext, injected as a
# system reminder the model reads before acting. So this hook does two
# things on every webjs prompt:
#
#   1. KEYWORD ROUTING. Match the prompt against each skill's documented
#      triggers. For each hit, name the skill and direct that it be
#      invoked via the Skill tool BEFORE any other work.
#   2. STANDING RULE. Always inject the generic policy: before acting,
#      check the available skills and invoke any whose purpose matches the
#      request, because skills encode required workflow. This catches the
#      case keyword routing misses, where a research or design request
#      turns into tracked work mid-stream.
#
# The rule is generic across ALL skills by design. It is NOT a rule about
# any single skill or about filing GitHub issues specifically; it enforces
# that whatever the matching skill says is followed.
#
# Output contract: print one JSON object with
# hookSpecificOutput.additionalContext and exit 0. The hook never blocks a
# prompt (exit 2 would erase it); routing must inform, not gate, since the
# model still owns the Skill call.

set -euo pipefail

payload=$(cat)

prompt=$(printf '%s' "$payload" | jq -r '.prompt // empty' 2>/dev/null || true)
if [ -z "$prompt" ]; then
  exit 0
fi

# Case-fold once for matching. Keep the original only for nothing; all
# matches are case-insensitive.
lc=$(printf '%s' "$prompt" | tr '[:upper:]' '[:lower:]')

# has PATTERN: extended-regex test against the lowercased prompt.
has() { printf '%s' "$lc" | grep -Eq "$1"; }

# Accumulate the per-skill routing lines that fired.
matches=""
add_match() { matches="${matches}${matches:+$'\n'}- $1"; }

# --- webjs-file-issue: create new tracked work --------------------------
# Triggers per its SKILL.md: file a task, create an issue, track as a todo,
# add to the todo list, open an issue, make this an issue, file a bug, add
# a new task.
if has '(file|open|create|add|make).{0,20}(task|issue|todo|bug)' \
   || has 'track (this|it|that).{0,12}(as|on|in).{0,12}(todo|issue|board)' \
   || has 'add (a )?new (task|todo|item)' \
   || has 'make (this|it) (an? )?issue'; then
  add_match "webjs-file-issue: the request involves creating new tracked work. Invoke the webjs-file-issue skill (it files the GitHub issue, assigns vivek7405, adds it to the board) BEFORE writing code for that work."
fi

# --- webjs-start-work: begin a tracked issue ----------------------------
# Triggers: work on #N, start work on issue N, tackle #N, pick up #N,
# begin issue N, let's work on the X issue.
if has '(work on|start work|pick up|tackle|begin).{0,24}#?[0-9]+' \
   || has '(start|begin|pick up).{0,16}(work|issue|the .* issue)' \
   || has "let'?s (work on|start)"; then
  add_match "webjs-start-work: the request is to begin a tracked issue. Invoke the webjs-start-work skill (it branches off main, moves the card to In progress, sets up the workspace) BEFORE starting the work."
fi

# --- webjs-list-todos: what is open / pending ---------------------------
# Triggers: what's open, what's pending, list todos, current todo, what
# should I work on, show open issues, what's in progress, on the board.
if has "what'?s (open|pending|in progress|on the board|next)" \
   || has '(list|show).{0,16}(todo|open issue|pending|board)' \
   || has '(current|open|pending) (todo|issue|work|item)' \
   || has 'what should i work on'; then
  add_match "webjs-list-todos: the request asks what work is open or pending. Invoke the webjs-list-todos skill (it reads the project board, the source of truth) instead of guessing."
fi

# --- use-railway: infra / deploy ----------------------------------------
# Triggers: railway, deploy, redeploy, service(s), environment, bucket,
# object storage, build failure, infrastructure.
if has '(railway|redeploy|deploy(ed|ment)?|provision)' \
   || has '(object storage|bucket|infrastructure)' \
   || has '(build|deploy) (failure|failed|error)'; then
  add_match "use-railway: the request touches deployment or infrastructure. Invoke the use-railway skill for any Railway operation rather than ad-hoc commands."
fi

# --- webjs-research-record: research / design / decision writeup --------
# Triggers: research whether/into X, investigate X and write it up,
# evaluate X vs Y, a design/decision record, write up the design, spike X.
# The deliverable is a writeup with no code diff. It belongs in a CLOSED
# `research`-labeled issue (the same issue if one already exists in the
# backlog), never a file under agent-docs and never a comment on an
# unrelated PR (the #548 mistake this routing prevents).
if has 'research (whether|if|into|on|the|to|question)' \
   || has '(design|decision|research) (record|note|write-?up|history|doc)' \
   || has 'write ?(up|out)? ?(the |a )?(design|decision|research)' \
   || has 'investigate.{0,80}(write|design|approach|record|decision|trade-?off)' \
   || has '(evaluate|compare).{0,40}(vs|versus|against)' \
   || has 'spike (on|the|a|into|[a-z])'; then
  add_match "webjs-research-record: the deliverable is a research/design/decision writeup with no code diff. Invoke the webjs-research-record skill. The record lives in a \`research\`-labeled issue (append to the existing backlog issue if there is one, else create one), writeup in the body + comments, then CLOSE it. NOT a file under agent-docs/, NOT a PR, NOT a comment on an unrelated PR. File the follow-up implementation via webjs-file-issue."
fi

# Assemble the additional context. The standing rule is always present; the
# per-skill routing block appears only when something matched.
read -r -d '' standing <<'EOF' || true
webjs skill policy (enforced, read before acting):
Before doing the work in this prompt, check the available skills. If the
request matches ANY skill's purpose, you MUST invoke that skill via the
Skill tool BEFORE other work. Skills encode required project workflow;
skipping a matching skill is a policy violation, not a shortcut. This holds
even when the prompt reads as research, a question, or a design ask but the
work it leads to is something a skill governs (for example, investigation
that turns into new tracked work must still go through the issue-filing
skill before code is written). Treat the routing below as authoritative for
THIS prompt.
EOF

if [ -n "$matches" ]; then
  ctx="${standing}"$'\n\n'"Skills matched by this prompt:"$'\n'"${matches}"
else
  ctx="${standing}"$'\n\n'"No skill triggers matched by keyword. Still apply the policy above: if you determine mid-task that the work matches a skill, invoke it before proceeding."
fi

jq -n --arg ctx "$ctx" '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: $ctx
  }
}'
exit 0
