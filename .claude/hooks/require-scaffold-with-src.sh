#!/usr/bin/env bash
#
# PreToolUse hook: BLOCK a `git commit` that changes framework FEATURE
# source but stages NO teaching surface. A scaffolded app is minimal and its
# only agent doc is the brief; agents rely on Lit and Next.js habits, and the
# feature gallery (gallery/, gallery.webjs.dev) carries a runnable demo per
# capability. So when a WebJs FEATURE is added or changed, the generator, a
# gallery demo or the brief must move too, exactly as the docs must (this is
# the scaffold twin of require-docs-with-src.sh).
#
# It fires on every commit, decides from the STAGED diff (not model
# judgement), and BLOCKS (exit 2) when framework-feature source is staged
# with no scaffold surface in the same commit.
#
# What a hook CANNOT do: know WHETHER a given change actually needs a
# scaffold demo (a bug fix, an internal perf change, or a tweak to an
# already-demoed feature may not), nor tell a real demo from a doc bullet.
# So it enforces only the FLOOR (a feature-source commit must stage SOME
# scaffold surface OR consciously opt out) and points at the
# webjs-scaffold-sync skill for the per-surface walk and the mandatory
# generate-boot-check.
#
# The TIER-2 teeth live in CI, not here: test/scaffolds/gallery-coverage.test.js
# reconciles the live framework surface (@webjsdev/core + @webjsdev/server exports
# AND the routing convention files the router parses) against
# test/scaffolds/gallery-coverage.json and FAILS when a new one is neither
# demonstrated by the gallery or a scaffold nor consciously exempted. That is the un-skippable
# gate (the analogue of a test that must exist AND pass); this hook is the fast
# commit-time reminder in front of it.
#
# Scope: only fires on `git commit` Bash calls. Inspects the STAGED diff,
# so `git add` choices drive it.
#
# Trigger (feature source that MAY need a scaffold update): the runtime +
# CLI packages' src, packages/(core|server|cli)/src/**. Editor plugins, the
# MCP, and intellisense do not shape the scaffold, so they are excluded.
#
# Satisfying surface: the scaffold itself (packages/cli/templates/**, whose
# AGENTS.md carries the brief, or packages/cli/lib/**, the generators), the
# gallery app (gallery/**), or the brief's source, packages/mcp/src/brief.js.
# The brief changes only when a Lit or Next.js habit stops producing correct
# WebJs (per-surface judgment is the scaffold-sync skill's manual walk plus
# the CI coverage gate).
#
# Allowed (exit 0): commits touching no feature src; commits that stage a
# scaffold surface alongside the source; and a change that genuinely needs
# no scaffold update (a bug fix, an internal refactor, a tweak to an
# already-demoed feature) via WEBJS_NO_SCAFFOLD_GATE=1.
#
# Rule: AGENTS.md "Code workflow" (Scaffold) + the webjs-scaffold-sync skill.

set -euo pipefail

if [ "${WEBJS_NO_SCAFFOLD_GATE:-}" = "1" ]; then
  exit 0
fi

payload=$(cat)
cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null || true)
if [ -z "$cmd" ]; then exit 0; fi

# Match `git commit` as a whole word (a real commit, not git commit-tree).
if ! printf '%s' "$cmd" | grep -Eq '(^|[^[:alnum:]-])git commit([^[:alnum:]-]|$)'; then
  exit 0
fi

# The bypass above reads this hook's OWN environment, which an agent cannot set:
# Claude Code runs hooks with the harness environment, not the command's. So the
# remedy this hook prints (re-run with WEBJS_NO_SCAFFOLD_GATE=1) also counts when it is written
# as an env assignment directly in front of the `git commit` it applies to. It
# must lead a simple command, so the same text in a commit message, an echo or a
# separate command does not count.
if printf '%s' "$cmd" | grep -Eq '(^[[:space:]]*|[;&|(][[:space:]]*)([A-Za-z_][A-Za-z0-9_]*=[^[:space:];&|]*[[:space:]]+)*WEBJS_NO_SCAFFOLD_GATE=1[[:space:]]+([A-Za-z_][A-Za-z0-9_]*=[^[:space:];&|]*[[:space:]]+)*git commit([^[:alnum:]-]|$)'; then
  exit 0
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then exit 0; fi

staged=$(git diff --cached --name-only 2>/dev/null || true)
if [ -z "$staged" ]; then exit 0; fi

# Framework FEATURE source: the runtime + CLI packages' src. A change here is
# the kind that MAY need the scaffold that teaches it to move too.
src_touched=$(printf '%s\n' "$staged" | grep -E '^packages/(core|server|cli)/src/' || true)
if [ -z "$src_touched" ]; then exit 0; fi

# Any teaching surface staged in the same commit? The scaffold
# templates/generators, the repo-root gallery/ app, or the brief's source
# (packages/mcp/src/brief.js), which the scaffold AGENTS.md carries.
scaffold_staged=$(printf '%s\n' "$staged" | grep -E '^packages/cli/(templates|lib)/|^gallery/|^packages/mcp/src/brief\.js$' || true)
if [ -n "$scaffold_staged" ]; then exit 0; fi

cat >&2 <<'EOF'
BLOCKED: this commit changes framework-feature source but stages no teaching surface.

Staged source under packages/(core|server|cli)/src/** with no generator,
gallery demo or brief change in the same commit.

If this added or changed a WebJs FEATURE (a new export/API, an html hole, a
lifecycle hook, a server-action capability, a config key, a CLI behaviour),
invoke the scaffold-sync skill, then `git add` the surface(s) and commit
again:
  packages/mcp/src/brief.js     the brief (paste it into templates/AGENTS.md too),
                                only when a Lit or Next.js habit stops working
  gallery/                      a runnable feature demo (gallery.webjs.dev)
  packages/cli/lib/create.js    the generator (layout, home, theme, schema, wiring)
  packages/cli/templates/       files copied into every new app
  (plus test/** for the assertions; a test alone does not satisfy this gate)
A feature usually needs a gallery demo and, on the docs site, the reference. The webjs-scaffold-sync skill walks every surface
AND runs the mandatory generate + boot + `webjs check` verification (the
generators emit strings, so escaping bugs only show in a freshly generated app).

Change that genuinely needs no scaffold update (a bug fix, an internal
refactor, a tweak to an already-demoed feature)? Re-run with
WEBJS_NO_SCAFFOLD_GATE=1.

Hook: .claude/hooks/require-scaffold-with-src.sh
EOF
exit 2
