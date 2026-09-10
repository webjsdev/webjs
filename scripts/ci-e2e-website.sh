#!/usr/bin/env bash
#
# The form-submission + scroll-restoration e2e (#1310) as a LOCAL CI step
# (#1474). It needs the WEBSITE dev server up on its fixed port, so this
# mirrors the CI step exactly: start `npm run dev --workspace=@webjsdev/website`
# in its own process GROUP with its output in a file, wait for /ui/button to
# answer, run the test, and take the whole group down however the step ends.
#
# Why each part is the way it is (all measured, in CI or locally):
# - The server log goes to a FILE, not this step's stdout. A background child
#   that keeps the stdout pipe open outlives the script and stalls the step;
#   run inline, the identical flow hung for ten minutes after the tests had
#   passed, with the server still listening.
# - `setsid` puts the server in its own process group and the trap signals the
#   whole group. `webjs dev` spawns a watcher which spawns the listener, so
#   killing only the npm pid leaves the port held.
# - `trap ... EXIT` keeps the test's exit code: under `set -e` a failing test
#   aborts the script before any trailing cleanup line could run.
# - On a failure the server log is printed, so a boot failure, a build failure,
#   or a 500 on /ui/button does not fail the step with its cause in a file
#   nobody reads.

set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
LOG="${TMPDIR:-/tmp}/webjs-ci-website-dev-$$.log"
cd "$ROOT"

setsid npm run dev --workspace=@webjsdev/website > "$LOG" 2>&1 < /dev/null &
server_pid=$!
trap 'rc=$?; if [ "$rc" -ne 0 ]; then echo "--- website dev server log ---"; tail -n 200 "$LOG" || true; fi; kill -- -"$server_pid" 2>/dev/null || true; rm -f "$LOG"; exit "$rc"' EXIT

for _ in $(seq 1 60); do
  curl -sf -o /dev/null http://localhost:5001/ui/button && break
  sleep 2
done
curl -sf -o /dev/null http://localhost:5001/ui/button \
  || { echo "website dev server never came up"; exit 1; }

node --test test/e2e/form-submission-and-race.test.mjs
