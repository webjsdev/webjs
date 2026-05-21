# Changelog

webjs ships **per-package, per-version** changelog files.

```
changelog/
  README.md                this file
  core/
    0.6.0.md
    0.5.0.md
    …
  server/
    0.7.1.md
    …
  cli/
    0.7.0.md
    …
  ts-plugin/
    0.4.0.md
    …
  ui/
    0.2.0.md
    …
```

The website (`website/app/changelog/page.ts`) reads every
`<pkg>/<version>.md` at SSR time, sorts by date descending, and
renders the unified release feed.

## How a release entry gets created

The model is "**a version bump produces a changelog file**". When a
package's `package.json` `version` field changes in a commit, the
entry script:

1. Identifies the prior version of the same package on `main`.
2. Walks the commits between the prior version's bump and the new
   bump that touched files under `packages/<pkg>/`.
3. Filters to conventional-commit prefixes that matter to users:
   `feat:`, `fix:`, `breaking:`, `perf:`.
4. Groups them under `Breaking` / `Features` / `Performance` /
   `Fixes` and writes a `<version>.md` file with frontmatter
   (`package`, `version`, `date`, `commit_count`) plus a bulleted
   list of changes (PR link + commit SHA + body excerpt).

`chore:`, `refactor:`, `test:`, `docs:`, `style:`, `build:`, `ci:`
commits never appear in the changelog: those changes don't change the
package's user-facing contract.

## Entry format

```markdown
---
package: "@webjsdev/core"
version: 0.6.0
date: 2026-05-21
commit_count: 4
---

# @webjsdev/core 0.6.0

## Breaking

- **Title of the change** ([#NN](https://github.com/vivek7405/webjs/pull/NN)) [`abcd123`](https://github.com/vivek7405/webjs/commit/abcd123)
  First four lines of the commit body, indented two spaces.

## Features
…

## Fixes
…
```

Frontmatter fields:

| Field | Required | Meaning |
|---|---|---|
| `package` | yes | The fully-qualified npm name (`@webjsdev/<pkg>`). |
| `version` | yes | Semver string of the new release. |
| `date` | yes | Date of the version-bump commit, `YYYY-MM-DD`. |
| `commit_count` | yes | How many qualifying commits this version shipped. |

## Backfill + ongoing automation

A single script runs in both modes:

```sh
node scripts/backfill-changelog.js
```

It walks every package's `package.json` history, finds version
bumps, and writes a `<pkg>/<version>.md` for any version that does
not yet have one. **Files that already exist are left alone**, so
hand-curated entries survive subsequent runs (CI re-runs are safe).

Going forward, the same script runs:

- on every CI build of `main`, so a forgotten version bump
  still produces an entry without manual intervention;
- locally when an agent edits a `packages/<pkg>/package.json` to
  bump the version (the post-commit hook
  `.hooks/post-version-bump` runs the script).

The AGENTS.md rule that AI agents follow on every code-commit:

> When you bump a `packages/<pkg>/package.json` `version`, run
> `node scripts/backfill-changelog.js` (or just commit; CI will
> regenerate). The generated `changelog/<pkg>/<version>.md` file
> should be reviewed and **edited in-place** for clarity, especially
> for `breaking` entries that need migration notes. Then commit the
> changelog file alongside the version bump.

## GitHub Releases are auto-published from the same files

The `.github/workflows/release.yml` workflow watches for new
`changelog/**.md` files added in any push to `main`. For each new
file it runs `scripts/publish-release.js`, which parses the
frontmatter, composes a release tag of the shape `<pkg>@<version>`
(e.g. `core@0.6.0`) with title `@webjsdev/<pkg> <version>` and the
markdown body as release notes, and calls `gh release create`.

The publish step is idempotent: it skips any tag that already
exists, so workflow retries and force-pushes are safe. Hand-editing
a `changelog/<pkg>/<version>.md` after the release was published
does NOT update the release on GitHub. If you need to amend a
published release, edit it on the GitHub Releases UI directly (or
delete the release tag and let a fresh workflow run recreate it).

## What if the same change ships across packages

A commit that touches more than one package (e.g. a refactor that
moves code from `core` to `server`) appears in **every** affected
package's release file when each of those packages bumps its
version. That is the right shape: the same change is a user-facing
event for every package that carries it.

## Migration to the new format

The pre-0.7.1 history was backfilled in one pass. The files in
`changelog/<pkg>/` are auto-generated but can (and should) be
hand-edited to add migration notes, examples, or links to docs.
Subsequent re-runs of `scripts/backfill-changelog.js` will not
overwrite hand edits because the script skips files that already
exist.
