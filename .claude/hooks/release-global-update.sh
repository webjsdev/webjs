#!/usr/bin/env bash
#
# Claude Code PostToolUse hook (matcher: Bash).
#
# After a RELEASE PR (a canonical "chore: release <pkgs>" title) merges,
# the just-published packages are live on npm a minute or two later. The globally
# installed `webjs` CLI (used to scaffold / dogfood) then lags the release. This
# hook fires on that merge and injects a directive to update the global CLI on
# BOTH package managers once the publish is confirmed:
#
#   npm update -g webjsdev
#   bun add -g webjsdev
#   mise use -g npm:webjsdev@latest
#
# It REMINDS rather than runs, on purpose: those commands pull the LATEST
# PUBLISHED version, so they must run AFTER `.github/workflows/release.yml`
# publishes (verify with `npm view @webjsdev/cli version`), not at merge time.
# Only fires for a release PR (a normal PR merge is ignored). Needs `gh`.
# Disable with WEBJS_NO_RELEASE_GLOBAL_UPDATE=1.
#
# Rule: the "Update global CLI after a release" memory + the release flow in
# agent-docs/framework-dev.md.

set -uo pipefail

payload=$(cat 2>/dev/null || true)
if [ "${WEBJS_NO_RELEASE_GLOBAL_UPDATE:-}" = "1" ]; then exit 0; fi

cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null || true)
if [ -z "$cmd" ]; then exit 0; fi

# Only after a `gh pr merge`.
if ! printf '%s' "$cmd" | grep -Eq '(^|[^[:alnum:]-])gh pr merge([^[:alnum:]-]|$)'; then
  exit 0
fi
command -v gh >/dev/null 2>&1 || exit 0

# The PR number is the first bare number after `gh pr merge`.
num=$(printf '%s' "$cmd" | grep -oE 'gh pr merge[[:space:]]+#?[0-9]+' | grep -oE '[0-9]+' | head -1)
if [ -z "$num" ]; then exit 0; fi

info=$(gh pr view "$num" --json headRefName,title 2>/dev/null || true)
if [ -z "$info" ]; then exit 0; fi
head=$(printf '%s' "$info" | jq -r '.headRefName // ""' 2>/dev/null || true)
title=$(printf '%s' "$info" | jq -r '.title // ""' 2>/dev/null || true)

# A real release PR carries the canonical "chore: release <pkgs>" title (the
# release process always titles it exactly that). Match the TITLE, not the
# branch prefix: a `chore/release-*` branch that is NOT a package release (a hook
# tweak, a doc change) would otherwise fire a false reminder with nothing to
# publish. `head` is unused now but kept in the fetch for future signals.
if ! printf '%s' "$title" | grep -qiE '^chore: release '; then exit 0; fi

read -r -d '' MSG <<'EOF' || true
A release PR just merged. Once .github/workflows/release.yml has published the
new versions to npm (verify with `npm view @webjsdev/cli version` matching the
released version), update the globally installed CLI on BOTH package managers so
local scaffolding / dogfooding uses the new release:
  npm update -g webjsdev
  bun add -g webjsdev
  mise use -g npm:webjsdev@latest
Run all three AFTER the publish is confirmed, not before (they pull the latest
PUBLISHED version). The `mise use` line is the one that actually moves a
mise-shimmed `webjs` (verify with `mise which webjs`). Disable this reminder with
WEBJS_NO_RELEASE_GLOBAL_UPDATE=1.
EOF

jq -n --arg ctx "$MSG" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $ctx
  }
}' 2>/dev/null || true

exit 0
