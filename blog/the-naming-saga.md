---
title: "Publishing an npm Package: The Naming Saga (wjs, webjscli, and how we ended up at webjsdev)"
date: 2026-05-22T20:00:00+05:30
slug: the-naming-saga
description: "Publishing an npm package taught me how the typosquatting similarity filter blocks names like wjs and webjscli, plus the create-* convention and what we shipped."
tags: npm, packages, scaffold, naming
author: Vivek
---

Publishing a package on npm sounds like a single command. Then the registry rejects your chosen name for being "too similar" to a package you have never heard of, and a quick two-package afternoon turns into an hour of rolling releases back and forth. This is that story.

The plan was simple. Ship `npx create-webjs-app@latest my-app` as the homepage hero. Ship a short `wjs` alias for the CLI so people who installed it globally would not have to type `webjs` everywhere. Two packages, one PR, done.

The PR is open at [#72](https://github.com/webjsdev/webjs/pull/72). It took 14 commits over several hours, mostly because of npm's naming policy.

# What I tried first

The initial design had three packages:

- `@webjsdev/cli` (scoped, the canonical CLI). Already published.
- `create-webjs-app` (unscoped). The npx scaffolder, mirroring `create-next-app`.
- `wjs` (unscoped). A thin shim re-exporting `@webjsdev/cli/bin/webjs.js`. `npx wjs create my-app` would work without installing anything globally, and `npm i -g wjs` would put `wjs` on PATH for repeat use.

The `wjs` package was the keystroke saver. Three characters instead of seven on the daily commands.

# What npm said

When I tried `npm publish` for `wjs`:

```
npm error code E403
npm error 403 Forbidden - PUT https://registry.npmjs.org/wjs
- Package name too similar to existing packages w-js, w.js
```

npm's naming policy treats `-` and `.` as equivalent to nothing for the similarity check. `wjs`, `w-js`, and `w.js` are all the same name to the filter. Both `w-js` and `w.js` existed (different projects, low download counts), so `wjs` got flagged as typosquatting (registering a name close to a popular one to catch people's typos).

I had not planned for this. The 24-hour tombstone-after-unpublish window I knew about. The similarity filter was new to me.

# What I tried second

OK, scrap `wjs`. Pick a different short name.

`webjscli` was the obvious next try. It is descriptive ("WebJs cli"), matches the scoped `@webjsdev/cli` minus the scope, eight characters. I built the package, tried `npm publish`.

```
npm error code E403
npm error 403 Forbidden - PUT https://registry.npmjs.org/webjscli
- Package name too similar to existing package webjs-cli
```

Same filter. `webjs-cli` already existed (yet another low-traffic project). The hyphen-equivalence treated `webjscli` as a near-duplicate.

# What I tried third

`webjsdev` was the next name on my list. It matches the existing `@webjsdev` npm org (which I already own), reads as "WebJs developer," and is far enough from any neighbor that the filter should not block it.

It published. Cleanly. Took thirty seconds.

I had spent about an hour rolling and unrolling the previous two packages. I now had a working unscoped CLI alias under the name `webjsdev`. `npm i -g webjsdev` installs a `webjs` binary (the bin entry in the package). The script is a one-line ESM re-export of `@webjsdev/cli/bin/webjs.js`. Same script, just under an unscoped install path.

`npx webjsdev create my-app` works too, via npx's single-bin fallback (the package declares one bin, npx runs it regardless of name match).

# The create-* part of the story

`create-webjs-app` was easier. The name was available, the conventional `npx create-<framework>-app` pattern matched what `create-next-app` / `create-remix` / `create-react-app` users expect. Published `create-webjs-app@0.1.0` and called it done.

Except I realized npm's `npm create <suffix>` shorthand turns `npm create webjs-app@latest` into `npx create-webjs-app@latest`, and the suffix `webjs-app` reads awkwardly when combined with the app name. `npm create webjs-app@latest my-app` says "webjs-app" and "my-app" in the same line, repeating the word "app."

The fix was to rename the package to just `create-webjs`. Then `npm create webjs@latest my-app` reads cleanly, matches Astro's `npm create astro@latest` exactly. The old name got published with `npm deprecate create-webjs-app@0.1.0 "Renamed to create-webjs. Use npm create webjs@latest <name> instead."`. The npm name stays in our control, with a redirect message.

# What we shipped

Three packages, finally:

```
@webjsdev/cli    canonical scoped CLI
create-webjs     npx scaffolder (npm create webjs@latest my-app)
webjsdev         unscoped CLI alias (npm i -g webjsdev, or npx webjsdev <cmd>)
```

All three version-lockstep with each other. A GitHub Action bumps `create-webjs` and `webjsdev` whenever `@webjsdev/cli` ships, so the version numbers stay aligned.

The deprecated names (`create-webjs-app@0.1.0`, the briefly-published `webjsdev@0.1.0` and `0.1.1` with a different bin-map shape, `@webjsdev/cli@0.8.2` which had a transitional `wjs` bin) all stay on npm with deprecation messages. The names are ours forever (npm reserves deprecated package names, so nobody else can claim them).

# What the homepage hero looks like

```
npm create webjs@latest my-app
```

That is it. One command. Auto-installs deps. Auto-prints next-step. The user sees the new directory, the install output, and a final line `cd my-app && npm run dev` that they can copy-paste.

The auto-install lives in `@webjsdev/cli`'s `scaffoldApp()` function. The CLI detects the package manager (`npm_config_user_agent` tells it pnpm / yarn / bun if the user is using one) and runs the right `<pm> install` in the new directory. Pass `--no-install` to opt out.

# Lessons

A few things I did not know going in:

- npm's name-similarity filter treats `-` and `.` as equivalent to nothing. Three-letter unscoped names with hyphenated neighbors are essentially blocked.
- `npm create <suffix>` is documented npm shorthand for `npx create-<suffix>`. Always has been. We used to recommend `npx create-webjs@latest my-app`, but `npm create webjs@latest my-app` is shorter, reads better, and works on the same package.
- The version-lockstep problem is real. npx caches per package version; if a thin wrapper points at the framework CLI, the wrapper's pkg-version is what gets cached, so the framework CLI updates do not propagate until the wrapper bumps too. The fix is a release workflow that bumps the wrappers automatically.
- `npm deprecate <pkg>@<version> "message"` keeps the name reserved forever. Use it instead of `npm unpublish` (which has a 72-hour window for packages with downloads, and the name eventually becomes claimable by others).

The whole thing was avoidable if I had checked npm name availability before designing the architecture. I now check before writing any code.

# What is on npm now

```
@webjsdev/cli         live    v0.8.5
create-webjs          live    v0.8.5
webjsdev              live    v0.8.5

@webjsdev/cli@0.8.2   deprecated (transitional wjs bin alias)
webjsdev@0.1.0        deprecated (transitional 3-bin shape)
webjsdev@0.1.1        deprecated (transitional 3-bin shape)
create-webjs-app      deprecated (renamed to create-webjs)
```

All three live packages are at the same version. The lockstep release-workflow step in `.github/workflows/release.yml` keeps them aligned automatically. Future cli bumps will trigger `create-webjs` and `webjsdev` to follow within the same minute.

# The PR description

PR #72 ends up describing all of the above, with cross-links to the side-PRs (#73 fixed the pre-commit hook so the bot could commit on main, #74 was the manual recovery bump, #75 fixed misdated changelog entries, #76 regenerated the cli changelog with proper PR/SHA links). The full arc lives in the PR conversation and the squash commit on main.

If you are publishing your own unscoped names: check the registry first, then the similarity filter (by trying a `--dry-run` publish), then commit to a name. Saves a few hours.
