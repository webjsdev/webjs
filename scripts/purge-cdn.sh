#!/usr/bin/env bash
# Purge the webjs.dev Cloudflare cache once the website's Railway deploy of a
# commit is live (#1593). This is `.github/workflows/purge-cdn.yml` run from
# the maintainer's machine: Actions is for publishing only now.
#
#   scripts/purge-cdn.sh            # wait for origin/main's deploy, then purge
#   scripts/purge-cdn.sh <sha>      # wait for that commit's deploy
#   scripts/purge-cdn.sh --now      # purge without waiting for a deploy
#   scripts/purge-cdn.sh --dry-run  # find the deploy status, purge nothing
#
# Why it waits: the edge caches the website with a long TTL and Railway
# deploys main on its own a few minutes after a merge. A purge before the new
# deploy is live re-caches the OLD bytes; a purge for a deploy that was
# SKIPPED, FAILED or never came costs a cold cache for nothing. So it polls
# the Railway API for the deployment whose commitHash is the commit, purges
# on SUCCESS only, then compares the edge's ETag with the origin's.
#
# Credentials, never printed: CLOUDFLARE_API_TOKEN (Zone / Cache Purge on
# webjs.dev) from the environment; RAILWAY_TOKEN from the environment, else
# the `railway login` token in ~/.railway/config.json.
set -euo pipefail

ZONE_ID=46692b879a06f3a6a987b99915560393
RAILWAY_API=https://backboard.railway.com/graphql/v2
RAILWAY_PROJECT_ID=1d05ab75-b64e-4920-94ef-1ca7d04778fc
RAILWAY_ENVIRONMENT_ID=2e30b2f6-d166-48d3-9ae7-17176fb0942f
RAILWAY_SERVICE_ID=2eb044b7-8698-43d3-959b-37c8925eb653
ORIGIN=https://webjs.up.railway.app
WAIT_BUDGET="${WAIT_BUDGET:-900}"

now=0 dry=0 sha=""
for a in "$@"; do
  case "$a" in
    --now) now=1 ;;
    --dry-run) dry=1 ;;
    -h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) sha="$a" ;;
  esac
done

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && [ "$dry" = 0 ]; then
  echo "purge-cdn: CLOUDFLARE_API_TOKEN is not set (a token scoped to Zone / Cache Purge on webjs.dev)" >&2
  exit 1
fi

if [ "$now" = 0 ]; then
  if [ -z "$sha" ]; then
    git fetch -q origin main
    sha="$(git rev-parse origin/main)"
  fi
  token="${RAILWAY_TOKEN:-}"
  if [ -z "$token" ] && [ -f "$HOME/.railway/config.json" ]; then
    token="$(node -e 'const c=require(process.argv[1]);process.stdout.write((c.user&&(c.user.token||c.user.accessToken))||"")' "$HOME/.railway/config.json")"
  fi
  [ -n "$token" ] || { echo "purge-cdn: no RAILWAY_TOKEN and no railway login; run 'railway login' or pass --now" >&2; exit 1; }

  query='query deployments($input: DeploymentListInput!, $first: Int) { deployments(input: $input, first: $first) { edges { node { id status createdAt meta } } } }'
  payload=$(jq -n --arg q "$query" --arg p "$RAILWAY_PROJECT_ID" --arg e "$RAILWAY_ENVIRONMENT_ID" --arg s "$RAILWAY_SERVICE_ID" \
    '{query: $q, variables: {first: 30, input: {projectId: $p, environmentId: $e, serviceId: $s}}}')
  railway_query() {
    local hdr out
    # A project token and a user token travel in different headers; try both.
    for hdr in "Project-Access-Token: ${token}" "Authorization: Bearer ${token}"; do
      out=$(curl -sS --max-time 20 -X POST "$RAILWAY_API" -H "$hdr" -H "Content-Type: application/json" --data "$payload" 2>/dev/null || true)
      if [ -n "$out" ] && [ "$(printf '%s' "$out" | jq -r '.errors == null' 2>/dev/null || echo false)" = true ]; then
        printf '%s' "$out"; return 0
      fi
    done
    return 1
  }

  echo "purge-cdn: waiting for the Railway deploy of ${sha:0:12} (up to $(( WAIT_BUDGET / 60 ))m)"
  deadline=$(( $(date +%s) + WAIT_BUDGET ))
  answered=0
  while :; do
    if [ "$(date +%s)" -ge "$deadline" ]; then
      [ "$answered" = 1 ] || { echo "purge-cdn: the Railway API never answered; the token may be expired" >&2; exit 1; }
      echo "purge-cdn: no terminal deploy status for ${sha:0:12} in time; not purging (re-run later, or --now)"
      exit 0
    fi
    if resp=$(railway_query); then
      answered=1
      status=$(printf '%s' "$resp" | jq -r --arg sha "$sha" '
        [ .data.deployments.edges[]?.node
          | . as $n
          | ((.meta // {}) | if type == "string" then (fromjson? // {}) else . end) as $m
          | select(($m.commitHash // "") == $sha) | $n.status ] | first // ""')
      case "$status" in
        SUCCESS) echo "purge-cdn: deploy SUCCESS; purging"; break ;;
        SKIPPED) echo "purge-cdn: Railway skipped this commit; the origin is unchanged, nothing to purge"; exit 0 ;;
        FAILED|CRASHED|REMOVED) echo "purge-cdn: deploy ${status}; no new bytes at the origin, not purging"; exit 0 ;;
        "") echo "  no deployment recorded for this commit yet" ;;
        *) echo "  deployment ${status}" ;;
      esac
    else
      echo "  Railway API not answering cleanly yet"
    fi
    sleep 15
  done
fi

if [ "$dry" = 1 ]; then echo "purge-cdn: --dry-run, not purging"; exit 0; fi

response=$(curl --fail-with-body -sS -X POST \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}')
if [ "$(printf '%s' "$response" | jq -r '.success' 2>/dev/null || echo false)" != true ]; then
  echo "purge-cdn: Cloudflare rejected the purge:" >&2
  printf '%s' "$response" | jq -c '.errors' >&2 || true
  exit 1
fi
echo "purge-cdn: cache purged for webjs.dev"

sleep 20
etag_of() { curl -fsS -I --max-time 10 "$1" 2>/dev/null | tr -d '\r' | awk 'tolower($1)=="etag:"{print $2}' || true; }
o=$(etag_of "$ORIGIN/public/tailwind.css"); e=$(etag_of "https://webjs.dev/public/tailwind.css")
if [ -z "$o" ] || [ -z "$e" ]; then
  echo "purge-cdn: could not compare ETags (inconclusive; the purge itself succeeded)"
elif [ "$o" != "$e" ]; then
  echo "purge-cdn: edge and origin ETags still differ for /public/tailwind.css (a slow pop, or re-run)"
else
  echo "purge-cdn: the edge matches the origin"
fi
