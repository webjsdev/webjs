#!/usr/bin/env bash
#
# PreToolUse hook (scaffolded by `webjs create`): block a `git commit`
# that adds or changes application code without any accompanying test.
#
# webjs is AI-first: most apps are built with an AI agent, and the
# easiest corner to cut is shipping a feature with no test. This gate
# makes "every change ships with a test" a hard floor, not a suggestion.
#
# What a hook CANNOT do: judge WHICH test layer a change needs (a unit
# test vs a browser/e2e test is a judgement call). So it enforces the
# floor (some real test must accompany app code) and reminds you to add
# browser/e2e coverage for interactive surfaces. `webjs test` runs the
# actual suite in the commit hook.
#
# Scope: fires only on `git commit`. Inspects the STAGED diff.
#
# Blocks (exit 2) when the staged diff changes app code (app/, modules/,
# components/, lib/) but stages no test (test/** or *.test.* / *.spec.*).
# Allowed: commits with no app-code change, commits that stage a test
# alongside, and WEBJS_NO_TEST_GATE=1 for a genuine non-code commit.
#
# Bypass (humans, emergencies): git commit --no-verify.

set -euo pipefail

if [ "${WEBJS_NO_TEST_GATE:-}" = "1" ]; then
  exit 0
fi

payload=$(cat)
cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null || true)
if [ -z "$cmd" ]; then exit 0; fi
case "$cmd" in
  *"git commit"*) : ;;
  *) exit 0 ;;
esac

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then exit 0; fi

staged=$(git diff --cached --name-only 2>/dev/null || true)
if [ -z "$staged" ]; then exit 0; fi

# App code lives under app/, modules/, components/, lib/. A `.server.*`
# file is still app code. Match source extensions only (skip .css, .md).
app_code=$(printf '%s\n' "$staged" \
  | grep -E '^(app|modules|components|lib)/.*\.([mc]?[jt]sx?)$' || true)
if [ -z "$app_code" ]; then exit 0; fi

test_staged=$(printf '%s\n' "$staged" \
  | grep -E '(^|/)test/|\.test\.[mc]?[jt]sx?$|\.spec\.[mc]?[jt]sx?$' || true)

if [ -z "$test_staged" ]; then
  cat >&2 <<'EOF'
BLOCKED: this commit changes app code but stages no test.

You staged application code (app/, modules/, components/, lib/) with no
accompanying test. Every change ships with a test. Add or update the test
that proves the new behaviour, then `git add` it.

Pick the layer the change needs (a unit test is not always enough):
  - logic / actions / queries / utils  -> a unit test
  - a component, hydration, a server action called from the client, the
    router, anything interactive -> a browser or e2e test that asserts the
    real behaviour in a browser, not just the function in isolation.

See `webjs test` and the testing guide. Genuine non-code commit (docs,
config) that needs no test? Re-run with WEBJS_NO_TEST_GATE=1.

Hook: .claude/hooks/require-tests-with-src.sh
EOF
  exit 2
fi

# Reminder for interactive surfaces: a unit test alone rarely covers them.
interactive=$(printf '%s\n' "$app_code" | grep -E '^components/|/components/' || true)
if [ -n "$interactive" ]; then
  jq -n --arg ctx "Reminder: this commit changes component code. A unit test alone usually is not enough for an interactive component; add a browser test (webjs test --browser) that asserts the rendered/hydrated behaviour." '{
    hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: $ctx }
  }'
fi
exit 0
