#!/usr/bin/env bash
# Run local CI on a pull request's head, record the verdict on GitHub, and
# squash-merge only when it is green (#1593).
#
#   scripts/ci-merge.sh            # the open PR for the current branch
#   scripts/ci-merge.sh 1234       # a PR by number
#   scripts/ci-merge.sh 1234 --release   # also run the release gate
#
# Steps:
#   1. Resolve the PR and its head commit over REST.
#   2. Run scripts/ci.sh on exactly that commit. When the current checkout is
#      that commit, clean, and a real install, it runs here; otherwise in a
#      throwaway detached worktree with its own `npm ci`, removed afterwards.
#      A green full run already recorded for the commit (the PASS marker
#      scripts/ci.sh writes) is reused rather than repeated.
#   3. Post a `local-ci` commit status on the head: pending while it runs,
#      then success or failure. scripts/protect-main.sh makes that status the
#      required check on main.
#   4. On success only: gh pr merge --squash --delete-branch
#      --match-head-commit <sha>, so a push that lands after the run cannot
#      be merged on its verdict. When the only thing left blocking is the
#      CODEOWNER review requirement (a solo maintainer cannot approve their
#      own PR), it retries with --admin, which is the one bypass AGENTS.md
#      allows: CI is proven green on this exact head a moment earlier.
#   5. After the merge, start scripts/purge-cdn.sh for the merge commit in
#      the background (it waits for the website's Railway deploy, then purges
#      webjs.dev), when CLOUDFLARE_API_TOKEN is set. This was purge-cdn.yml.
set -euo pipefail

REPO="webjsdev/webjs"
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR
# Bun's shared transpiler cache can be poisoned machine-wide; never read it.
export BUN_RUNTIME_TRANSPILER_CACHE_PATH=0
root="$(git rev-parse --show-toplevel)"
cd "$root"

pr="" release=()
for a in "$@"; do
  case "$a" in
    --release) release=(--release) ;;
    -h|--help) sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
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

status() {
  gh api -X POST "repos/$REPO/statuses/$sha" -f state="$1" -f context=local-ci \
    -f description="$2" >/dev/null
}

marker="${TMPDIR:-/tmp}/webjs-ci-${sha:0:12}/PASS"
start=$(date +%s)
rc=0
if [ -f "$marker" ] && [ ${#release[@]} -eq 0 ]; then
  echo "ci-merge: a green full run of ${sha:0:12} is already recorded ($marker); not repeating it"
else
  status pending "local CI running on $(hostname -s)"
  here=0
  if [ "$(git rev-parse HEAD)" = "$sha" ] && [ -z "$(git status --porcelain --untracked-files=no)" ] \
     && [ -d node_modules ] && [ ! -L node_modules ]; then
    here=1
  fi
  if [ "$here" = 1 ]; then
    bash scripts/ci.sh "${release[@]}" || rc=$?
  else
    git fetch -q origin "pull/$pr/head"
    wt="$(mktemp -d "${TMPDIR:-/tmp}/webjs-ci-merge-$pr.XXXXXX")"
    cleanup() { git -C "$root" worktree remove --force "$wt" >/dev/null 2>&1 || rm -rf "$wt"; git -C "$root" worktree prune; }
    trap cleanup EXIT
    git worktree add -q --detach "$wt" "$sha"
    echo "ci-merge: running in a throwaway worktree with a real install: $wt"
    (
      cd "$wt"
      npm ci --no-audit --no-fund --loglevel=error
      if [ -f scripts/ci.sh ]; then bash scripts/ci.sh "${release[@]}"; else npm run ci; fi
    ) || rc=$?
  fi
fi
secs=$(( $(date +%s) - start ))

if [ "$rc" != 0 ]; then
  status failure "local CI failed on $(hostname -s) after ${secs}s"
  echo "ci-merge: local CI FAILED on ${sha:0:12}; not merging" >&2
  exit 1
fi
status success "local CI passed on $(hostname -s) in ${secs}s"
echo "ci-merge: local CI passed; merging #$pr"

if ! out="$(gh pr merge "$pr" --squash --delete-branch --match-head-commit "$sha" 2>&1)"; then
  echo "$out" >&2
  if printf '%s' "$out" | grep -qiE 'review|approv'; then
    echo "ci-merge: only the review requirement blocks it and CI is green on this head; merging with --admin" >&2
    gh pr merge "$pr" --squash --delete-branch --match-head-commit "$sha" --admin
  else
    exit 1
  fi
else
  printf '%s\n' "$out"
fi

merged="$(gh api "repos/$REPO/pulls/$pr" --jq '.merge_commit_sha // empty' 2>/dev/null | tail -n1)"
if [ -n "$merged" ] && [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -f "$root/scripts/purge-cdn.sh" ]; then
  plog="${TMPDIR:-/tmp}/webjs-purge-${merged:0:12}.log"
  setsid nohup bash "$root/scripts/purge-cdn.sh" "$merged" >"$plog" 2>&1 < /dev/null &
  echo "ci-merge: CDN purge for ${merged:0:12} runs in the background once the deploy is live: $plog"
elif [ -n "$merged" ]; then
  echo "ci-merge: CLOUDFLARE_API_TOKEN is not set; purge the CDN later with scripts/purge-cdn.sh ${merged:0:12}"
fi
if [ ${#release[@]} -gt 0 ]; then
  echo "ci-merge: release PR merged; publish it with scripts/release.sh from a checkout of origin/main"
fi
