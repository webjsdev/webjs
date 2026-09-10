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
# The driver follows the CI job's posture exactly: `npm install --no-save`
# into the repo's own node_modules, which is where `drizzle-orm/node-postgres`
# resolves `pg` from (a link under test/pg/ satisfies the test's own import
# but not drizzle's, measured). That install is REFUSED when node_modules is a
# symlink, because a linked worktree's tree belongs to the primary checkout
# and an install through the link damages it (#1442); the rule is already
# "sign off from a real install", and this step is where it bites.
#
# `WEBJS_DOCKER` names the command that reaches a daemon (`sudo -n docker`,
# `podman`); the default `docker` needs the user in the `docker` group. The
# step is deliberately NOT auto-skipped without Docker, because a silently
# skipped engine check is a false green.

set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
NAME="webjs-ci-postgres-$$"
PORT="${WEBJS_PG_PORT:-55432}"
DOCKER="${WEBJS_DOCKER:-docker}"

if ! command -v "${DOCKER%% *}" >/dev/null 2>&1; then
  echo "ci-postgres: ${DOCKER%% *} is not on PATH; the Postgres round-trip needs a Docker daemon (or a CI job with a service container)." >&2
  exit 1
fi
if [ -L "$ROOT/node_modules" ]; then
  echo "ci-postgres: $ROOT/node_modules is a symlink (a linked worktree). The pg driver is installed --no-save into node_modules, which must not happen through a link (#1442). Run this step from a real install." >&2
  exit 1
fi

cleanup() { $DOCKER rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

cd "$ROOT"
if [ ! -d node_modules/pg ]; then
  npm install --no-save --no-audit --no-fund --loglevel=error 'pg@^8.13.0'
fi

$DOCKER run -d --rm --name "$NAME" \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=webjs_test \
  -p "127.0.0.1:${PORT}:5432" postgres:16 >/dev/null

# Same readiness probe the CI service container declares, up to ~50s.
for _ in $(seq 1 50); do
  if $DOCKER exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
if ! $DOCKER exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; then
  echo "ci-postgres: postgres:16 did not become ready in time" >&2
  $DOCKER logs "$NAME" >&2 || true
  exit 1
fi

WEBJS_PG_URL="postgres://postgres:postgres@127.0.0.1:${PORT}/webjs_test" \
  node --test test/pg/pg-roundtrip.test.mjs
