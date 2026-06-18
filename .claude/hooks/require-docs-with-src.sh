#!/usr/bin/env bash
#
# PreToolUse hook: when a `git commit` changes public-facing framework
# source but stages NO documentation surface, inject a non-blocking
# reminder naming every doc surface and the webjs-doc-sync skill.
#
# Why this exists: webjs ships docs across many surfaces (AGENTS.md +
# agent-docs/, README, the docs site under docs/app/docs/, the marketing
# website/, and the scaffold templates' per-agent rule files). The
# recurring failure is updating ONE (usually AGENTS.md) and silently
# missing the rest, so the docs site and website drift behind the
# framework. HTTP-verb server actions (#488) shipped with AGENTS.md updated
# but the docs site untouched. This hook closes that gap the same way
# require-tests-with-src.sh closes the test gap: it fires on every commit,
# decides from the STAGED diff (not model judgement), and reminds.
#
# Unlike the test gate this hook NEVER blocks (exit 2). Docs are
# conditional: a genuinely internal change (refactor, CI, release, perf
# with no behaviour change) correctly updates no doc surface, and the
# "commit per logical unit" rule means code and its docs may land in
# separate commits. So this informs; it does not gate. The substantive
# decision (which surfaces actually apply) is the webjs-doc-sync skill.
#
# Scope: only fires on `git commit` Bash calls. Inspects the STAGED diff.
# Fires only when source is staged AND no doc surface is staged in the same
# commit, so a commit that already touches docs stays quiet.

set -euo pipefail

if [ "${WEBJS_NO_DOC_REMINDER:-}" = "1" ]; then
  exit 0
fi

payload=$(cat)
cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null || true)
if [ -z "$cmd" ]; then exit 0; fi

if ! printf '%s' "$cmd" | grep -Eq '(^|[^[:alnum:]-])git commit([^[:alnum:]-]|$)'; then
  exit 0
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then exit 0; fi

staged=$(git diff --cached --name-only 2>/dev/null || true)
if [ -z "$staged" ]; then exit 0; fi

# Public-facing framework source: the runtime packages' src/ and the CLI
# lib/. A change here is the kind that MAY change a documented surface.
src_touched=$(printf '%s\n' "$staged" | grep -E '^packages/([^/]+/src|editors/[^/]+/src|cli/lib)/' || true)
if [ -z "$src_touched" ]; then exit 0; fi

# Any doc surface staged in the same commit? If so, the author is already
# updating docs; stay quiet.
doc_staged=$(printf '%s\n' "$staged" | grep -E \
  '^(AGENTS\.md|README\.md|CONVENTIONS\.md|agent-docs/|docs/|website/|packages/cli/templates/|examples/[^/]+/CONVENTIONS\.md)' || true)
if [ -n "$doc_staged" ]; then exit 0; fi

jq -n '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    additionalContext: "Reminder: this commit changes framework source but stages no doc surface. If it changed a PUBLIC or AGENT-FACING surface (an export, a CLI flag, a package.json webjs.* key, an html hole, a lifecycle hook, a convention, or the behaviour of an already-documented feature), invoke the webjs-doc-sync skill and sync EVERY applicable surface: AGENTS.md + agent-docs/*.md, README.md, the docs site (docs/app/docs/<topic>), the marketing website/, and the scaffold templates (packages/cli/templates/ per-agent rule files). Update AGENTS.md only and you reproduce the #488 gap (docs site left stale). A genuinely internal change (refactor, CI, release, perf with no behaviour change) correctly needs no doc edit; ignore this then."
  }
}'
exit 0
