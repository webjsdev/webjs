#!/usr/bin/env bash
# The merge gate for main: the six GitHub CI job checks from ci.yml, green on
# the PR head, and nothing else. Run once (needs repo admin); re-running is
# idempotent.
#
# CI runs on GitHub Actions (free on this public repository). The contexts
# are ci.yml's job `name:` values, which GitHub keys a required check on
# exactly; a rename in ci.yml must be made here too. `strict` keeps the head
# current with main. scripts/ci-merge.sh waits for these and merges.
#
# NO REVIEW REQUIREMENT, and none may be added here. The owner reviews pull
# requests outside the merge path, and agents merge their own work through
# ci-merge.sh: a required approval (or required conversation resolution)
# blocked every agent merge, because GitHub does not let a PR's author
# approve it. A PUT replaces the whole protection object, so writing
# `required_pull_request_reviews: null` and
# `required_conversation_resolution: false` here is what keeps them off.

set -euo pipefail

REPO="webjsdev/webjs"
CONTEXTS='[
      "Conventions (webjs check)",
      "Unit + integration (node --test)",
      "Browser (web-test-runner / Playwright)",
      "E2E (Puppeteer against the blog example)",
      "Build (@webjsdev/core dist)",
      "In-repo app tests (website + blog + gallery)"
    ]'

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

echo "main is now protected: the six GitHub CI checks green before merge (scripts/ci-merge.sh); no review requirement."
