#!/usr/bin/env bash
# Guardrail: never merge a WebJs PR over failing CI with `gh pr merge --admin`.
#
# Why: --admin bypasses branch protection, so a red build lands on main and
# every later PR inherits the failure. That is how main went red in October
# 2026 (several PRs merged with --admin over failing jobs). A PR merges only
# when its CI is green; fix the failure, never route around it.
#
# Judges a COMMAND, not a token: only a `gh pr merge` invocation that carries
# `--admin` is blocked, so a commit message or a grep that mentions the flag is
# unaffected. Escape hatch for an owner-approved emergency:
# WEBJS_ALLOW_ADMIN_MERGE=1.
#
# PreToolUse contract: exit 0 = allow, exit 2 = block (message on stderr).
set -euo pipefail

[ "${WEBJS_ALLOW_ADMIN_MERGE:-0}" = "1" ] && exit 0

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
[ -z "$cmd" ] && exit 0

# Split on shell separators so each segment is judged as its own command, then
# look for a segment that STARTS with `gh pr merge` (after optional env
# assignments) and carries --admin.
if printf '%s\n' "$cmd" | tr ';&|' '\n\n\n' \
  | grep -Eq '^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*gh[[:space:]]+pr[[:space:]]+merge([[:space:]].*)?[[:space:]]--admin([[:space:]=]|$)'; then
  cat >&2 <<'MSG'
BLOCKED: `gh pr merge --admin` merges over failing CI.

A WebJs PR merges only when its CI is green (AGENTS.md, "Git workflow").
Fix the failing check on the branch, re-run CI, then merge without --admin.
If the failure is on main already, fix main first rather than stacking on it.
Owner-approved emergency only: WEBJS_ALLOW_ADMIN_MERGE=1.
MSG
  exit 2
fi
exit 0
