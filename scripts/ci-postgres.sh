#!/usr/bin/env bash
#
# The Postgres prod-engine round-trip (#563) as a LOCAL CI step (#1474).
#
# CI runs test/pg/pg-roundtrip.test.mjs against a `postgres:16` service
# container with the `pg` driver installed ad hoc (`npm install --no-save`),
# deliberately keeping the driver out of the shared package-lock. A developer
# machine has no Postgres service (and should not need one installed), so this
# script gives the step the same engine the same way: a throwaway `postgres:16`
# container on a non-default port, waited for with pg_isready INSIDE the
# container (no client tools on the host), the test run against it, and the
# container removed on every exit path.
#
# The driver follows the same posture, without touching the repo's own
# node_modules (which in a linked worktree is the PRIMARY checkout's tree, and
# an install through it is the #1442 trap): it is installed into a scratch
# prefix and reached through a `test/pg/node_modules/pg` link, which is where
# Node's bare-specifier walk from the test file looks first. The test imports
# `pg` as an ES module, so NODE_PATH would not do. The link and the scratch
# tree are removed on exit; `node_modules/` is gitignored at every depth
# anyway. Docker must be on PATH; the step is deliberately NOT auto-skipped
# without it, because a silently skipped engine check is a false green.

set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
NAME="webjs-ci-postgres-$$"
PORT="${WEBJS_PG_PORT:-55432}"
LINK="$ROOT/test/pg/node_modules/pg"
SCRATCH=""

if ! command -v docker >/dev/null 2>&1; then
  echo "ci-postgres: docker is not on PATH; the Postgres round-trip needs it (or a CI job with a service container)." >&2
  exit 1
fi

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  rm -f "$LINK"
  rmdir "$ROOT/test/pg/node_modules" 2>/dev/null || true
  [ -n "$SCRATCH" ] && rm -rf "$SCRATCH"
}
trap cleanup EXIT

SCRATCH=$(mktemp -d -t webjs-ci-pg-XXXXXX)
npm install --prefix "$SCRATCH" --no-save --no-audit --no-fund --loglevel=error 'pg@^8.13.0'
mkdir -p "$ROOT/test/pg/node_modules"
ln -sfn "$SCRATCH/node_modules/pg" "$LINK"

docker run -d --rm --name "$NAME" \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=webjs_test \
  -p "127.0.0.1:${PORT}:5432" postgres:16 >/dev/null

# Same readiness probe the CI service container declares, up to ~50s.
for _ in $(seq 1 50); do
  if docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
if ! docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; then
  echo "ci-postgres: postgres:16 did not become ready in time" >&2
  docker logs "$NAME" >&2 || true
  exit 1
fi

cd "$ROOT"
WEBJS_PG_URL="postgres://postgres:postgres@127.0.0.1:${PORT}/webjs_test" \
  node --test test/pg/pg-roundtrip.test.mjs
