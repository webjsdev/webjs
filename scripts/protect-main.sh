#!/usr/bin/env bash
# The merge gate for main: an approving CODEOWNER review plus a green LOCAL CI
# run recorded on the PR head (#1474, #1593). Run once (needs repo admin);
# re-running is idempotent.
#
# Local CI is the gate (the Rails 8.1 posture). `scripts/ci-merge.sh` runs
# `scripts/ci.sh` (the root `webjs.ci` list, every job ci.yml defines) on the
# PR head and posts the verdict as the `local-ci` commit status, which this
# script makes the one required status check. A later push has no `local-ci`
# status until the list is run on it again, so a stale green never carries
# forward, and `strict` keeps the head current with main.
#
# The six GitHub Actions job names were required here until #1593; ci.yml
# now runs only by hand (workflow_dispatch), so requiring them would block
# every merge. `npm run ci -- --signoff` (gh-signoff's `signoff` status) was
# the earlier plan for the same switch and is not required by anything.
#
# NOTE on the review requirement: GitHub does not let a PR author approve
# their own PR, and this repo is effectively a solo org. enforce_admins is
# left false so the org owner can still merge via the admin bypass (a
# confirm step), which keeps the approval as a visible speed-bump without
# locking solo PRs. Flip enforce_admins to true only once a second reviewer
# (a human or a bot account) exists to provide the non-author approval.
#
# NOTE on require_code_owner_reviews: it is paired with .github/CODEOWNERS,
# which names @vivek7405 for every path. Without that file the setting matches
# nothing and silently does nothing, so the two ship together. With both in
# place, the one required approval must come from the maintainer, which is
# what stops two drive-by contributors from approving each other onto main.
#
# NOTE on required_conversation_resolution: a PUT replaces the whole object,
# so every setting main carries is restated here, or the PUT turns it off.

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
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": true
  },
  "required_conversation_resolution": true,
  "restrictions": null
}
JSON

echo "main is now protected: 1 approving CODEOWNER review + a green local-ci status (scripts/ci-merge.sh) before merge."
