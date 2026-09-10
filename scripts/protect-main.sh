#!/usr/bin/env bash
# The merge gate for main: an approving CODEOWNER review, plus a green LOCAL
# CI run signed off on the pushed head (#1474), plus, during the transition,
# the GitHub Actions checks. Run once (needs repo admin). Re-running is
# idempotent.
#
# Local CI is the gate (the Rails 8.1 posture). `npm run ci -- --signoff` runs
# the root `webjs.ci` list and, only when every step passes, `gh signoff`
# posts a green `signoff` commit status on the pushed head. `gh signoff
# install` (below) makes that status required through a repository ruleset,
# so a branch whose head has not passed local CI cannot be merged, whoever
# forgot. A later push has no signoff until the list is run again on it.
#
# TRANSITION. The six Actions job names stay required until a few PRs have
# merged on signoff alone, then they come out:
#
#   bash scripts/protect-main.sh                # transition: Actions + signoff
#   bash scripts/protect-main.sh --local-only   # final: signoff only
#
# `--local-only` keeps the review requirement and the signoff ruleset and
# requires no Actions context, which is what lets `.github/workflows/ci.yml`
# be demoted to a non-required second opinion or deleted. The job names below
# must match the `name:` of each job in ci.yml exactly, because GitHub keys
# required status checks on the job display name (a rename left one required
# check unreportable from #1371 until #1472 corrected it).
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
# NOTE on the signoff ruleset: `gh signoff install` (basecamp/gh-signoff)
# adds the `signoff` context to a repository ruleset rather than to this
# branch-protection object, and it is idempotent, so this script stays the
# single place the gate is declared even though two GitHub objects carry it.

set -euo pipefail

REPO="webjsdev/webjs"
MODE="transition"
[ "${1:-}" = "--local-only" ] && MODE="local-only"

if [ "$MODE" = "local-only" ]; then
  CONTEXTS='[]'
else
  CONTEXTS='[
      "Conventions (webjs check)",
      "Unit + integration (node --test)",
      "Browser (web-test-runner / Playwright)",
      "E2E (Puppeteer against the blog example)",
      "Build (@webjsdev/core dist)",
      "In-repo app tests (website + blog + gallery)"
    ]'
fi

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
  "restrictions": null
}
JSON

if ! gh extension list 2>/dev/null | grep -q 'basecamp/gh-signoff'; then
  gh extension install basecamp/gh-signoff
fi
# The extension takes no --repo (only --branch); it resolves the repository
# through `gh api repos/:owner/:repo`, which GH_REPO overrides.
GH_REPO="$REPO" gh signoff install

if [ "$MODE" = "local-only" ]; then
  echo "main is now protected: 1 approving CODEOWNER review + a signed-off local CI run (npm run ci -- --signoff) before merge. No Actions check is required."
else
  echo "main is now protected: 1 approving CODEOWNER review + a signed-off local CI run (npm run ci -- --signoff) + the Actions checks (transition) before merge."
fi
