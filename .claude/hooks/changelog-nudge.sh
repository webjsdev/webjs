#!/bin/bash
#
# Claude Code PreToolUse hook.
#
# Catches the case where the agent is ABOUT to commit a change that
# bumps a packages/<pkg>/package.json version but has not also
# generated a matching changelog/<pkg>/<version>.md file. Fires on
# Bash tool calls whose command starts with `git commit`.
#
# Hard block: writes a JSON hookSpecificOutput with
# "permissionDecision": "deny" so the tool call is refused and the
# agent reads the included reason. The agent should then run:
#
#   node scripts/backfill-changelog.js && git add changelog/
#
# and retry the commit.
#
# Skipped outside a git work tree and when there are no staged
# version bumps.

set -e

# Read the hook payload from stdin so we can inspect the command
# the model is about to run.
INPUT=$(cat)

# Only act on Bash tool calls whose command is `git commit ...`.
COMMAND=$(printf '%s' "$INPUT" | grep -oE '"command"\s*:\s*"[^"]+"' | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
case "$COMMAND" in
  *git*commit*) ;;
  *) exit 0 ;;
esac

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

STAGED_PKG_BUMPS=$(git diff --cached --unified=0 -- 'packages/*/package.json' 2>/dev/null \
  | awk '
      /^diff --git/ { match($0, /packages\/[^\/]+\/package.json/); pkg = substr($0, RSTART+9, RLENGTH-22); next }
      pkg && /^\+\s*"version":\s*"[^"]+"/ {
        match($0, /"[0-9]+\.[0-9]+\.[0-9]+[^"]*"/); v = substr($0, RSTART+1, RLENGTH-2);
        print pkg "@" v
      }')

if [ -z "$STAGED_PKG_BUMPS" ]; then
  exit 0
fi

MISSING=""
for bump in $STAGED_PKG_BUMPS; do
  pkg="${bump%@*}"; ver="${bump#*@}"
  if [ ! -f "changelog/$pkg/$ver.md" ]; then
    MISSING="$MISSING changelog/$pkg/$ver.md"
  fi
done

if [ -z "$MISSING" ]; then
  exit 0
fi

# Emit a JSON denial so Claude Code refuses this tool call and
# surfaces the reason to the agent.
cat <<EOF
{
  "hookSpecificOutput": {
    "permissionDecision": "deny",
    "permissionDecisionReason": "[changelog-nudge] You are committing a packages/<pkg>/package.json version bump but the matching changelog file(s) are missing:$MISSING\n\nRun: node scripts/backfill-changelog.js && git add changelog/\nThen retry the commit. To bypass (rare; emergencies only): git commit --no-verify"
  }
}
EOF
exit 0
