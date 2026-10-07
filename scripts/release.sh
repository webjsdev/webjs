#!/usr/bin/env bash
# Cut a release from the maintainer's machine (#1593). GitHub Actions does ONE
# thing in a release now, the npm publish itself, because npm trusted
# publishing (OIDC, with provenance) is bound to .github/workflows/release.yml.
# Everything around it runs here.
#
# The flow, end to end:
#   1. A release PR (branch chore/release-*, title "chore: release ...")
#      bumps the versions; the pre-commit hook writes changelog/<pkg>/<v>.md.
#   2. `scripts/ci-merge.sh <N> --release` runs the full local list plus the
#      release gate on the PR head and squash-merges it when green.
#   3. `scripts/release.sh` on the merged main (this script):
#        - finds the changelog files the head commit added (or takes paths),
#        - refuses unless local CI is green on that commit (runs
#          `scripts/ci.sh --release` unless a PASS marker already exists),
#        - pushes the tag publish-<sha12>, which triggers release.yml to
#          publish exactly those packages to npm and GitHub Packages and
#          lockstep-publish the wrappers when cli moved,
#        - waits until `npm view` shows every new version,
#        - creates the GitHub Releases (scripts/publish-release.js, gh CLI),
#        - purges the webjs.dev CDN once the website deploy is live
#          (scripts/purge-cdn.sh).
#   Every step is idempotent, so re-running after a partial failure is safe.
#
#   scripts/release.sh                      # the head commit of origin/main
#   scripts/release.sh changelog/core/0.7.65.md changelog/cli/0.10.70.md
#   scripts/release.sh --no-purge           # skip the CDN purge
#
# Credentials stay where they are: gh's login (tag push, releases), the npm
# registry is only read, CLOUDFLARE_API_TOKEN for the purge. Nothing here
# prints a token.
set -euo pipefail

REPO="webjsdev/webjs"
cd "$(git rev-parse --show-toplevel)"

purge=1 files=()
for a in "$@"; do
  case "$a" in
    --no-purge) purge=0 ;;
    -h|--help) sed -n '2,33p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    changelog/*.md) files+=("$a") ;;
    *) echo "release: unknown argument '$a'" >&2; exit 2 ;;
  esac
done

git fetch -q origin main --tags
sha="$(git rev-parse origin/main)"
[ "$(git rev-parse HEAD)" = "$sha" ] || {
  echo "release: check out origin/main first (HEAD is $(git rev-parse --short=12 HEAD), main is ${sha:0:12}); a detached worktree is fine:" >&2
  echo "  git worktree add --detach ../webjs-release origin/main && cd ../webjs-release && npm ci" >&2
  exit 2
}
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "release: the tree has uncommitted changes" >&2; exit 2; }

if [ ${#files[@]} -eq 0 ]; then
  mapfile -t files < <(git diff --name-only --diff-filter=A HEAD~1 HEAD -- 'changelog/**.md' | grep -v '/README.md$' || true)
fi
[ ${#files[@]} -gt 0 ] || { echo "release: HEAD adds no changelog/<pkg>/<version>.md; nothing to release"; exit 0; }
echo "release: ${sha:0:12} releases:"; printf '  %s\n' "${files[@]}"

# 1. The gate, on the exact commit being published.
if [ -f "${TMPDIR:-/tmp}/webjs-ci-${sha:0:12}/PASS" ]; then
  echo "release: local CI already green on ${sha:0:12}"
else
  bash scripts/ci.sh --release
fi

# 2. The tag that makes release.yml publish. The workflow diffs HEAD~1..HEAD
#    at the tag, so it publishes exactly what this commit added.
tag="publish-${sha:0:12}"
if git ls-remote --exit-code --tags origin "refs/tags/$tag" >/dev/null 2>&1; then
  echo "release: $tag already pushed"
else
  git tag "$tag" "$sha"
  git push -q origin "refs/tags/$tag"
  echo "release: pushed $tag; release.yml publishes to npm"
fi

# 3. Wait for the registry to serve every new version.
pkg_of() {
  # changelog/<short>/<version>.md -> the package name in its frontmatter,
  # else @webjsdev/<short>.
  local f="$1" name
  name=$(awk '/^package:/ {print $2; exit}' "$f" | tr -d '"')
  [ -n "$name" ] || name="@webjsdev/$(basename "$(dirname "$f")")"
  case "$name" in @*|*/*) ;; *) name="@webjsdev/$name" ;; esac
  printf '%s' "$name"
}
for f in "${files[@]}"; do
  if awk '/^---/{n++; next} n==1' "$f" | grep -qE '^npm: *false'; then
    echo "release: $f is not an npm package (npm: false); nothing to wait for"; continue
  fi
  name="$(pkg_of "$f")"; version="$(basename "$f" .md)"
  for i in $(seq 1 60); do
    [ "$(npm view "${name}@${version}" version 2>/dev/null || true)" = "$version" ] && break
    [ "$i" = 60 ] && { echo "release: ${name}@${version} is not on npm after 15 minutes; check the release.yml run: gh run list --workflow release.yml" >&2; exit 1; }
    [ "$i" = 1 ] && echo "release: waiting for ${name}@${version} on npm"
    sleep 15
  done
  echo "release: ${name}@${version} is on npm"
done

# 4. GitHub Releases, one per changelog file (idempotent).
for f in "${files[@]}"; do node scripts/publish-release.js "$f"; done

# 5. The CDN, once the website's deploy of this commit is live.
if [ "$purge" = 1 ]; then
  bash scripts/purge-cdn.sh "$sha" || echo "release: the CDN purge did not complete; run scripts/purge-cdn.sh $sha again later" >&2
fi
echo "release: done"
