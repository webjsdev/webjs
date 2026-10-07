#!/usr/bin/env bash
# The merge gate for main: a green LOCAL CI run recorded on the PR head
# (#1593), and nothing else. Run once (needs repo admin); re-running is
# idempotent.
#
# Local CI is the gate. `scripts/ci-merge.sh` runs `scripts/ci.sh` (the root
# `webjs.ci` list, every job ci.yml defines) on the PR head and posts the
# verdict as the `local-ci` commit status, which this script makes the one
# required status check. A later push has no `local-ci` status until the list
# is run on it again, so a stale green never carries forward, and `strict`
# keeps the head current with main.
#
# NO REVIEW REQUIREMENT, and none may be added here. The owner reviews pull
# requests outside the merge path, and agents merge their own work through
# ci-merge.sh: a required approval (or required conversation resolution)
# blocked every agent merge, because GitHub does not let a PR's author
# approve it. A PUT replaces the whole protection object, so writing
# `required_pull_request_reviews: null` and
# `required_conversation_resolution: false` here is what keeps them off.
#
# The six GitHub Actions job names were required until #1593; ci.yml now runs
# only by hand (workflow_dispatch), so requiring them would block every merge.
# Run this AFTER the PR that adds scripts/ci-merge.sh has merged.

set -euo pipefail

REPO="webjsdev/webjs"
CONTEXTS='["local-ci"]'

gh api -X PUT "repos/${REPO}/branches/main/protection" \
  --input - <<JSON
{
  "required_status_checks": {
    "strict": true,
    "contexts": ${CONTEXTS}
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "required_conversation_resolution": false,
  "restrictions": null
}
JSON

echo "main is now protected: a green local-ci status (scripts/ci-merge.sh) before merge; no review requirement."
