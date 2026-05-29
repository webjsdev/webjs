#!/usr/bin/env bash
# Make all three CI test layers required before a PR can merge into main.
#
# This is the enforcement half of .github/workflows/ci.yml: the workflow
# RUNS the tests, this rule BLOCKS merge until unit, browser, and e2e are
# all green. Run once (needs repo admin). Re-running is idempotent.
#
#   bash scripts/protect-main.sh
#
# The contexts below must match the `name:` of each job in ci.yml exactly,
# because GitHub keys required status checks on the job display name.

set -euo pipefail

REPO="webjsdev/webjs"

gh api -X PUT "repos/${REPO}/branches/main/protection" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Conventions (webjs check)",
      "Unit + integration (node --test)",
      "Browser (web-test-runner / Playwright)",
      "E2E (Puppeteer against the blog example)",
      "Build (@webjsdev/core dist)"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
JSON

echo "main is now protected: unit, browser, and e2e must pass before merge."
