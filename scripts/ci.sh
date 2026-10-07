#!/usr/bin/env bash
# Local CI: the merge gate for this repository (#1593).
#
# GitHub Actions no longer runs `.github/workflows/ci.yml` on a push or a pull
# request. The same jobs run here, through the root `webjs.ci` step list in
# package.json (`npm run ci`, #1471/#1474), which mirrors ci.yml job for job:
# conventions, unit + integration, Bun parity, browser (web-test-runner), e2e
# on Node and Bun, the core dist build, the in-repo app tests, the Postgres
# round-trip and the Docker image build. This wrapper adds the parts a gate
# needs on top of that list: a log on disk, a pass marker per commit, a list
# of the step titles and a release mode.
#
#   scripts/ci.sh                    # the whole list (what ci-merge.sh runs)
#   scripts/ci.sh --only Gate        # one step or group by title; commas or
#   scripts/ci.sh --only A,B         #   repeated --only for several
#   scripts/ci.sh --list             # print the step and group titles
#   scripts/ci.sh --release          # the whole list, then `npm run
#                                    #   release:gate` when package.json has
#                                    #   one; run it before a release PR merges
#   scripts/ci.sh --fail-fast        # stop at the first failing step
#   scripts/ci.sh --nightly          # ONLY the live jspm CDN contract tests
#                                    #   (was the nightly vendor-cdn.yml job):
#                                    #   network-bound, so never part of the
#                                    #   merge gate; run it daily or before a
#                                    #   vendor-resolver change merges
#
# Output goes to the terminal and to ${TMPDIR:-/tmp}/webjs-ci-<sha>/ci.log.
# A green FULL run on a clean tree with a real install writes a PASS marker
# there, which the pre-push hook and ci-merge.sh reuse so one commit is not
# tested twice. Run it from a real install: in a worktree linked with
# `npm run worktree:link`, bare `@webjsdev/*` specifiers resolve into the
# primary checkout and part of the run tests the wrong source.
set -uo pipefail

cd "$(dirname "$0")/.."

list=0 release=0 nightly=0
args=()
partial=0
while [ $# -gt 0 ]; do
  case "$1" in
    --list) list=1 ;;
    --release) release=1 ;;
    --nightly) nightly=1 ;;
    -f|--fail-fast) args+=(--fail-fast); partial=1 ;;
    --only)
      [ $# -ge 2 ] || { echo "scripts/ci.sh: --only needs a title" >&2; exit 2; }
      IFS=',' read -ra titles <<< "$2"
      for t in "${titles[@]}"; do args+=(--only "$t"); done
      partial=1
      shift ;;
    -h|--help) sed -n '2,34p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "scripts/ci.sh: unknown argument '$1' (see --help)" >&2; exit 2 ;;
  esac
  shift
done

if [ "$list" = 1 ]; then
  node -e '
    const steps = require("./package.json").webjs.ci.steps;
    const walk = (list, depth) => {
      for (const s of list) {
        console.log("  ".repeat(depth) + s.title + (s.steps ? "  (group)" : ""));
        if (s.steps) walk(s.steps, depth + 1);
      }
    };
    walk(steps, 0);
  '
  exit 0
fi

if [ "$nightly" = 1 ]; then
  # The live jspm contract (#1150, #446). A `] SKIP ` marker means jspm could
  # not answer, which is upstream trouble rather than a regression, so it is
  # reported, not failed; WEBJS_FAIL_ON_SKIP=1 promotes it to a failure.
  sha="$(git rev-parse HEAD)"
  dir="${TMPDIR:-/tmp}/webjs-ci-${sha:0:12}"; mkdir -p "$dir"; log="$dir/live.log"
  WEBJS_REQUIRE_NETWORK=1 node --test \
    packages/server/test/vendor/jspm-cdn.live.test.js \
    test/vendor-cli/vendor-pin.live.test.mjs 2>&1 | tee "$log"
  rc=${PIPESTATUS[0]}
  skipped=$(grep -c '] SKIP ' "$log" || true)
  if [ "${skipped:-0}" != 0 ]; then
    echo "warning: jspm.io could not answer ${skipped} live check(s); not a regression, but if it repeats for days the live coverage has stopped running."
    grep '] SKIP ' "$log" || true
  fi
  [ "$rc" = 0 ] && echo "LIVE CDN CONTRACT PASS  log: $log" || echo "LIVE CDN CONTRACT FAIL  log: $log"
  exit "$rc"
fi

# These two flip output formats that type guards in the list parse (see
# framework-dev.md, "Local prerequisites"), so they never reach the run.
unset FORCE_COLOR PORT

sha="$(git rev-parse HEAD)"
dir="${TMPDIR:-/tmp}/webjs-ci-${sha:0:12}"
mkdir -p "$dir"
log="$dir/ci.log"

linked=0
[ -L node_modules ] && linked=1
dirty=0
[ -n "$(git status --porcelain --untracked-files=no)" ] && dirty=1

[ "$linked" = 1 ] && echo "note: node_modules is a symlink (npm run worktree:link); bare @webjsdev/* imports run the PRIMARY checkout's source, so this run is partly vacuous. scripts/ci-merge.sh runs on a real install." >&2
[ "$dirty" = 1 ] && echo "note: the tree has uncommitted changes; this run tests them, not ${sha:0:12}." >&2

start=$(date +%s)
node packages/cli/bin/webjs.js ci "${args[@]}" 2>&1 | tee "$log"
rc=${PIPESTATUS[0]}

if [ "$rc" = 0 ] && [ "$release" = 1 ]; then
  if node -e 'process.exit(require("./package.json").scripts?.["release:gate"] ? 0 : 1)'; then
    echo; echo "== release gate (npm run release:gate)" | tee -a "$log"
    npm run release:gate 2>&1 | tee -a "$log"
    rc=${PIPESTATUS[0]}
  else
    echo "release gate: package.json declares no release:gate script yet; the full list above is the gate." | tee -a "$log"
  fi
fi
secs=$(( $(date +%s) - start ))

rm -f "$dir/PASS"
if [ "$rc" = 0 ] && [ "$partial" = 0 ] && [ "$linked" = 0 ] && [ "$dirty" = 0 ]; then
  echo "$secs" > "$dir/PASS"
fi

echo
if [ "$rc" = 0 ]; then
  echo "LOCAL CI PASS  ${sha:0:12}  (${secs}s)  log: $log"
else
  echo "LOCAL CI FAIL  ${sha:0:12}  (${secs}s)  log: $log"
fi
exit "$rc"
