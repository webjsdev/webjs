#!/usr/bin/env bash
#
# UserPromptSubmit hook: route a UI-building prompt to the design-review
# skill, so it is never silently skipped.
#
# Why this exists: a Skill is model-invoked, so it fires only when the model
# judges the prompt to match, and that judgement is exactly what fails for
# design work ("build a tic-tac-toe app" reads as backend/logic work and the
# render-and-look step gets skipped, shipping a collapsed or scaffold-looking
# UI). A hook is deterministic: it runs on every prompt, decides from the
# prompt TEXT, and injects a directive the model reads before acting. It
# cannot invoke the Skill itself (the harness forbids that); the strongest
# lever is UserPromptSubmit additionalContext.
#
# Output contract: print one JSON object with
# hookSpecificOutput.additionalContext and exit 0. Never block (exit 2 would
# erase the prompt); routing informs, it does not gate.

set -euo pipefail
payload=$(cat)
prompt=$(printf '%s' "$payload" | jq -r '.prompt // empty' 2>/dev/null || true)
[ -z "$prompt" ] && exit 0
lc=$(printf '%s' "$prompt" | tr '[:upper:]' '[:lower:]')
has() { printf '%s' "$lc" | grep -Eq "$1"; }

# UI / app-building intent: any request to build/create/change something the
# user will SEE. Broad on purpose (a false positive just reminds you to look).
if has '(build|create|make|add|design|redesign|style|implement|scaffold).{0,40}(app|page|layout|component|screen|view|board|form|dashboard|ui|site|game|list|table|card|nav|header|footer|modal|button|theme)' \
   || has '(make|help me|let'\''s).{0,20}(look|prettier|beautiful|nicer|design)' \
   || has '(tic.?tac.?toe|todo|blog|dashboard|landing|storefront|kanban|chat)'; then
  ctx="ROUTING: this prompt involves UI work. Invoke the webjs-design-review skill (Skill tool) as part of this task: after building/changing any page, layout, or component and BEFORE reporting the work done, render the app in a real browser and LOOK at every state, confirming the app owns its design (layout + palette + type, not the scaffold), nothing collapses or resizes, cells stay even, and light + dark both read. A design/layout defect has NO failing test, so the render-and-look is the only check that catches it."
  jq -n --arg c "$ctx" '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: $c}}'
fi

exit 0
