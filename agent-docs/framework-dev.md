# Framework development (editing webjs itself)

Read this only when editing the webjs monorepo (this repo), not a scaffolded app. The repo is buildless: `packages/` is plain `.js` with JSDoc (never add `.ts` there); TypeScript is fine in `examples/`, `docs/`, `website/`. Each in-repo app (`website/`, `docs/`, `examples/blog/`, `packages/ui/packages/website/`) is run via its OWN `npm run dev` / `npm start`, never `webjs dev` directly, since each composes extra watchers. The sections below cover the repo-health git config, the changelog flow, and the dev error overlay.

---

### Repo health: worktree-safe git config (core.bare / hooksPath)

This repo uses git worktrees (the review subagents spawn throwaway ones under `.claude/worktrees/`). Git's worktree machinery can leave `core.bare=true` in the shared `.git/config`, which is lethal to the main checkout: every git operation that needs a work tree then fails with `fatal: this operation must be run in a work tree`. The shared value is harmless only while the main worktree carries a per-worktree override (`extensions.worktreeConfig=true` plus a `.git/config.worktree` pinning `core.bare=false`).

`scripts/git-worktree-safe.mjs` establishes that override and pins an absolute `core.hooksPath` to `.hooks` on the main worktree, where both survive a shared-config reset (which is what otherwise silently disables the framework `.hooks/pre-commit`). It runs from the root `prepare` script, so every `npm install` self-heals. Two manual entry points:

- `npm run fix:git` heals the config on demand (run it if a git command reports the work-tree error).
- `npm run check:git` asserts the invariant (`core.bare` resolves false, the framework hook is active) and exits non-zero otherwise. The regression test is `test/repo-health/git-worktree-safe.test.mjs`.

Because the pin lives in the main worktree's `config.worktree`, `git worktree add` copies it into each linked worktree, so a commit made inside a throwaway review worktree also runs the framework `.hooks/pre-commit`. That is harmless (the hook only blocks main and auto-generates a changelog on a version bump), and review subagents are read-only so they do not commit; the inheritance is noted here only so the behavior is not surprising.

The fix only repairs the LOCAL checkout. Commits and branches are always safe on GitHub regardless.

---

### Changelog: per-package, per-version, auto-generated

webjs ships per-package per-version changelogs under `changelog/<pkg>/<version>.md`. The model: **a version bump is the trigger**. When any commit on `main` changes the `version` field in `packages/<pkg>/package.json`, the scripts/backfill-changelog.js generator emits a new `changelog/<pkg>/<version>.md` summarising every conventional-commit (`feat:` / `fix:` / `breaking:` / `perf:`) that landed in that package since the prior bump. The website renders the union of all packages' files at `/changelog`.

**How it works for AI agents and humans:**

1. Bump the `version` field in a `packages/<pkg>/package.json` and stage the change.
2. Run `git commit` as usual. The `.hooks/pre-commit` hook detects the staged bump, runs `node scripts/backfill-changelog.js` automatically, stages the resulting `changelog/<pkg>/<version>.md`, and lets the commit proceed. The bump and its release notes land in the same commit.
3. Optionally review and edit the generated file before pushing. The script's body excerpts are the first lines of each commit message; for `breaking` entries especially, add migration notes by hand. Re-runs are idempotent (existing files are never overwritten), so hand-edits survive.
4. Never edit `changelog/<pkg>/<version>.md` for a version that has already been published. Bump the version and edit `changelog/<pkg>/<next>.md` instead.

If the package has zero `feat:` / `fix:` / `breaking:` / `perf:` commits in the range (a release-only bump with no user-facing changes), the script writes nothing and the hook fails the commit. Either add a hand-written entry, downgrade the bump if it was unintentional, or `git commit --no-verify` to bypass.

The whole flow is tool-agnostic: the universal pre-commit hook fires for every `git commit`, regardless of who or what is running it. AI agents using Claude Code, Cursor, Copilot, Aider, etc. all get the same behavior, as do human contributors.

**npm publishes AND GitHub Releases are auto-created from the same files.** The `.github/workflows/release.yml` workflow watches for new `changelog/**.md` files added in a push to `main`. For each new file:

1. `scripts/publish-npm.js` parses the frontmatter, checks `npm view @webjsdev/<pkg>@<version>`; if the version is not yet on the registry, it runs `npm publish --workspace=@webjsdev/<pkg> --access=public`. Idempotent: already-published versions are skipped.
2. `scripts/publish-release.js` composes a tag `<pkg>@<version>` (e.g. `core@0.6.0`), title `@webjsdev/<pkg> <version>`, body (the markdown after frontmatter), then runs `gh release create`. Idempotent: existing release tags are skipped.

npm runs first; if it fails (auth, network, transient registry error), the GitHub Release step is skipped and the workflow fails. After fixing, a re-run picks up where it left off: the npm-side check makes the completed package a no-op and only the missing release lands.

The workflow uses `NPM_TOKEN` (repo secret) and the auto-provisioned `GITHUB_TOKEN`. Free for public repos.

---

## Dev error overlay: rich, pushed live over SSE (dev-only) (#264)

In development, three error sources push a structured error frame to the open tab over the existing live-reload SSE channel (a distinct `webjs-error` event, NOT EventSource's native `error`), and a small dev-only client renders a plain-DOM overlay without a manual reload: an SSR render crash (a page / layout throws, or the no-browser-globals walker trips), a non-erasable-TypeScript strip failure (which breaks only the CLIENT module fetch, so the page still SSRs but hydration is silently dead, the exact gap this closes), and a failed rebuild (previously only logged server-side). The overlay carries the message, the parsed `file:line:column`, a source code frame of the offending line with context, and for a TS strip the no-non-erasable hint surfaced in the UI rather than buried in a JS comment. A successful rebuild clears it (the reload also dismisses any on-screen overlay), and the current frame is replayed to a tab connecting after the breaking edit.

The overlay client uses `textContent` throughout (never `innerHTML`), so the error content cannot inject markup. It is **strictly dev-only**: `reportDevError` early-returns when `!dev`, `/__webjs/reload.js` 404s in prod, and the prod 500 stays terse (only `error.message`, never the stack or a file path), so no source leaks. An embedding host can observe the same frames via the `onDevError` option on `createRequestHandler` / `startServer`. Mechanism: `buildDevErrorFrame` in `packages/server/src/dev-error.js`, `reportDevError` + the SSE push in `packages/server/src/dev.js`, the SSR-catch hook in `packages/server/src/ssr.js`.
