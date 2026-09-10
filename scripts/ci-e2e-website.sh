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
# - Two things a fresh CI runner never had to guard against. A server ALREADY
#   on :5001 (a machine that was just editing the website) would answer the
#   probe first try while ours died with EADDRINUSE, and the step would report
#   on that server rather than this tree, so it is refused. And the website's
#   dev script is `webjs dev --port ${PORT:-5001}`, so a shell exporting PORT
#   would put the server elsewhere and the probe would wait out its two
#   minutes; the port is pinned.

set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
LOG="${TMPDIR:-/tmp}/webjs-ci-website-dev-$$.log"
cd "$ROOT"

if curl -sf -o /dev/null http://localhost:5001/ui/button; then
  echo "something already answers on :5001; stop it first, or this step tests that server instead of this tree" >&2
  exit 1
fi

PORT=5001 setsid npm run dev --workspace=@webjsdev/website > "$LOG" 2>&1 < /dev/null &
server_pid=$!
trap 'rc=$?; if [ "$rc" -ne 0 ]; then echo "--- website dev server log ---"; tail -n 200 "$LOG" || true; fi; kill -- -"$server_pid" 2>/dev/null || true; rm -f "$LOG"; exit "$rc"' EXIT

for _ in $(seq 1 60); do
  curl -sf -o /dev/null http://localhost:5001/ui/button && break
  sleep 2
done
curl -sf -o /dev/null http://localhost:5001/ui/button \
  || { echo "website dev server never came up"; exit 1; }

node --test test/e2e/form-submission-and-race.test.mjs
