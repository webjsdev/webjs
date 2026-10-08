#!/usr/bin/env bash
# Merge a pull request once its GitHub CI is green.
#
#   scripts/ci-merge.sh            # the open PR for the current branch
#   scripts/ci-merge.sh 1234       # a PR by number
#
# GitHub Actions is the only CI (.github/workflows/ci.yml, on every PR and
# every push to main; nothing runs locally, #1627). This script:
#   1. resolves the PR and its head commit,
#   2. waits for the PR's required GitHub checks on that head
#      (gh pr checks --watch --required) and stops if any fails,
#   3. squash-merges with --delete-branch --match-head-commit <sha>, so a push
#      that lands while it waited is never merged on the older verdict.
# A release PR merges the same way; scripts/release.sh runs the release gate
# (node scripts/release-gate.mjs) on the merged commit before publishing.
# Never --admin: main requires the six CI checks and no review
# (scripts/protect-main.sh), so anything else blocking the merge is a real
# problem to report, not to bypass.
# After the merge it starts scripts/purge-cdn.sh for the merge commit in the
# background when CLOUDFLARE_API_TOKEN is set.
set -euo pipefail

REPO="webjsdev/webjs"
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR
root="$(git rev-parse --show-toplevel)"
cd "$root"

pr=""
for a in "$@"; do
  case "$a" in
    -h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) pr="$a" ;;
  esac
done

if [ -z "$pr" ]; then
  branch="$(git branch --show-current)"
  [ -n "$branch" ] || { echo "ci-merge: detached HEAD; pass a PR number" >&2; exit 2; }
  pr="$(gh api "repos/$REPO/pulls?head=webjsdev:$branch&state=open" --jq '.[0].number // empty')"
  [ -n "$pr" ] || { echo "ci-merge: no open PR for branch $branch" >&2; exit 2; }
fi

read -r state sha ref < <(gh api "repos/$REPO/pulls/$pr" --jq '"\(.state) \(.head.sha) \(.head.ref)"')
[ "$state" = open ] || { echo "ci-merge: PR #$pr is $state" >&2; exit 2; }
echo "ci-merge: PR #$pr ($ref) at ${sha:0:12}"

echo "ci-merge: waiting for the required GitHub checks on ${sha:0:12}"
# --watch exits non-zero when a check fails; give the runs a moment to register.
sleep 10
if ! gh pr checks "$pr" --repo "$REPO" --required --watch --fail-fast --interval 30; then
  echo "ci-merge: a required check failed on ${sha:0:12}; not merging (gh pr checks $pr)" >&2
  exit 1
fi
now="$(gh api "repos/$REPO/pulls/$pr" --jq .head.sha)"
[ "$now" = "$sha" ] || { echo "ci-merge: PR #$pr got a new commit while waiting; run this again" >&2; exit 1; }

echo "ci-merge: GitHub CI is green; merging #$pr"
gh pr merge "$pr" --repo "$REPO" --squash --delete-branch --match-head-commit "$sha"

merged="$(gh api "repos/$REPO/pulls/$pr" --jq '.merge_commit_sha // empty' 2>/dev/null | tail -n1)"
if [ -n "$merged" ] && [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -f "$root/scripts/purge-cdn.sh" ]; then
  plog="$HOME/agent-scratch/webjs-purge-${merged:0:12}.log"
  mkdir -p "$HOME/agent-scratch"
  setsid nohup bash "$root/scripts/purge-cdn.sh" "$merged" >"$plog" 2>&1 < /dev/null &
  echo "ci-merge: CDN purge for ${merged:0:12} runs in the background once the deploy is live: $plog"
elif [ -n "$merged" ]; then
  echo "ci-merge: CLOUDFLARE_API_TOKEN is not set; purge the CDN later with scripts/purge-cdn.sh ${merged:0:12}"
fi
case "$ref" in chore/release-*) echo "ci-merge: release PR merged; publish it with scripts/release.sh from a checkout of origin/main" ;; esac
