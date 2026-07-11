#!/bin/bash
#
# guard-main-merge.sh (Claude Code PreToolUse hook)
#
# Intercepts Bash commands. Rules:
#   - git merge -> ask (merging to parent branch needs approval)
#   - git push on a feature branch -> allow (free to push feature work)
#   - git push targeting main -> ask (should go through the merge flow)
#   - Bypass mode -> allow everything
#
# On a feature branch, commit and push are completely free, no prompts.
# The only prompt is when merging into main/master.

COMMAND=$(jq -r '.tool_input.command // empty')
[ -z "$COMMAND" ] && exit 0

# Bypass mode: full autonomy
SETTINGS="$HOME/.claude/settings.json"
if [ -f "$SETTINGS" ]; then
  BYPASS=$(jq -r '.skipDangerousModePermissionPrompt // false' "$SETTINGS" 2>/dev/null)
  if [ "$BYPASS" = "true" ]; then
    exit 0
  fi
fi

NORMALIZED=$(printf '%s' "$COMMAND" | tr -s '[:space:]' ' ')

ask_with_reason() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

# git merge always asks (this is the merge-to-parent approval)
if [[ "$NORMALIZED" == *"git merge"* ]]; then
  ask_with_reason "This command contains 'git merge'. Merging requires approval. After merging, should the source branch be deleted or kept? Approve to proceed."
fi

# git push targeting main asks (should merge, not push directly)
if [[ "$NORMALIZED" == *"git push"* ]] && [[ "$NORMALIZED" == *"main"* ]]; then
  ask_with_reason "This looks like 'git push' targeting main. Approve to proceed."
fi

# Everything else (including git push on feature branches) is allowed
exit 0
