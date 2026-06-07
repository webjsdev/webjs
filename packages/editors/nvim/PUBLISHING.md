# Publishing webjs.nvim

Neovim plugins are installed by Git repo (lazy.nvim / packer clone a whole
repo and add it to the runtimepath), so a monorepo subdirectory is not
directly installable. webjs.nvim is **developed here** (`packages/editors/nvim/`) and
**published to a standalone repo** `webjsdev/webjs.nvim` whose root is this
directory, via a git subtree split.

## One-time setup

Create an empty `webjsdev/webjs.nvim` repo on GitHub (no README/license; the
split carries them).

## Releasing

From the monorepo root, split `packages/editors/nvim` into a branch whose root is the
plugin, then push it to the standalone repo's `main`:

```sh
# 1. Produce a history-preserving split of just packages/editors/nvim.
git subtree split --prefix=packages/editors/nvim -b nvim-release

# 2. Push it to the standalone repo (force is fine: that repo is a mirror).
git push --force git@github.com:webjsdev/webjs.nvim.git nvim-release:main

# 3. Clean up the local split branch.
git branch -D nvim-release
```

Tag a release on the standalone repo so users can pin a version:

```sh
gh release create v0.1.0 --repo webjsdev/webjs.nvim --title v0.1.0 \
  --notes "First release: html/css/svg template highlighting, :WebjsCheck, LSP helper."
```

## Discoverability

- **lazy.nvim / packer** install by `webjsdev/webjs.nvim` directly once the
  repo exists; no registry submission is required.
- **dotfyle.com** (the de-facto Neovim plugin index) discovers plugins
  automatically from GitHub topics. Add the topics `neovim` and
  `neovim-plugin` to the `webjsdev/webjs.nvim` repo, and it appears in search.
- Optionally list it in the webjs docs Editor Setup page and the awesome-neovim
  list (PR to `rockerBOO/awesome-neovim`).

## Versioning

Keep the standalone repo's tags in step with notable plugin changes. There is
no package registry to publish to (unlike the VS Code extension), so a tagged
GitHub release is the whole release.
