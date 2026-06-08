# webjs.nvim

Neovim support for [webjs](https://github.com/webjsdev/webjs) apps, the Neovim
counterpart to the `webjs` VS Code extension. Two pieces:

- **In-template highlighting.** Treesitter injection queries highlight the
  markup inside `` html`…` ``, `` css`…` ``, and `` svg`…` `` tagged templates
  as HTML / CSS / SVG. No Lit plugin, no config.
- **Language intelligence.** Surfaces the standalone `@webjsdev/intellisense`
  tsserver plugin through your LSP (go-to-definition on tags / attributes /
  CSS classes, binding-aware completions, in-template diagnostics, hover),
  plus a `:WebjsCheck` command that loads `webjs check` violations into
  diagnostics and the quickfix list.

## Requirements

- Neovim 0.10+.
- Treesitter parsers for `typescript`, `javascript`, `html`, `css` (via
  [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter):
  `:TSInstall typescript javascript html css`). `svg` is optional.
- For intelligence: Node 24+, `typescript` in your app, and an LSP client for
  `tsserver` (`ts_ls` via `nvim-lspconfig`, or `typescript-tools.nvim`).
  `@webjsdev/intellisense` is **bundled inside this plugin**, so it works even
  with no `@webjsdev/intellisense` in the app (e.g. before `npm install`).

Run `:checkhealth webjs` to verify all of the above.

## Install

### lazy.nvim

```lua
{
  'webjsdev/webjs.nvim',
  ft = { 'typescript', 'javascript' },
  opts = {},   -- calls require('webjs').setup()
}
```

### packer.nvim

```lua
use({ 'webjsdev/webjs.nvim', config = function() require('webjs').setup() end })
```

Highlighting works as soon as the plugin is on the runtimepath (the injection
queries auto-load). `setup()` is only needed to register `:WebjsCheck`.

## Language-service intelligence

webjs.nvim **bundles** `@webjsdev/intellisense` (standalone, no Lit dependency)
and exposes it to your TypeScript LSP, pointing the plugin probe location at the
bundled copy. That works with **nothing in the app** (no `@webjsdev/intellisense`
dependency, no `tsconfig.json` edit). If the app DOES wire the plugin via
`tsconfig.json` `plugins` (the `webjs create` scaffold does), that is fine too:
`tsserver` dedupes by name, so there is no double-load.

**Two LSPs load tsserver plugins differently, so pick the helper for yours.**

### vtsls (LazyVim's default TypeScript LSP)

vtsls loads plugins via `settings.vtsls.tsserver.globalPlugins`. With LazyVim,
configure the `vtsls` server through `nvim-lspconfig` `opts.servers`:

```lua
-- ~/.config/nvim/lua/plugins/webjs.lua
return {
  { 'webjsdev/webjs.nvim', ft = { 'typescript', 'javascript' }, opts = {} },

  -- treesitter parsers the html/css template injections need
  { 'nvim-treesitter/nvim-treesitter', opts = function(_, o)
      o.ensure_installed = o.ensure_installed or {}
      vim.list_extend(o.ensure_installed, { 'html', 'css' })
    end },

  -- the webjs intelligence plugin, into vtsls
  { 'neovim/nvim-lspconfig', opts = { servers = { vtsls = {
      settings = require('webjs').with_vtsls_plugin(),
  } } } },
}
```

`with_vtsls_plugin(settings?)` merges `{ name, location, enableForWorkspaceTypeScriptVersions = true }`
into an existing (or new) `settings` table, idempotently.

### ts_ls (a.k.a. `tsserver`) / typescript-tools.nvim

ts_ls loads plugins via `init_options.plugins`:

```lua
require('lspconfig').ts_ls.setup({
  init_options = require('webjs').with_tsserver_plugin(),
})
```

After either, point your LSP at the **workspace's** `node_modules/typescript`
and `:LspRestart` once. Highlighting (the treesitter injection) is **independent**
of this LSP wiring and works as soon as the plugin loads, given the `html` / `css`
parsers above.

## Commands

| Command | Effect |
|---|---|
| `:WebjsCheck` | Run `webjs check --json` in the cwd, load violations into `vim.diagnostic` + the quickfix list (`:copen`). |
| `:checkhealth webjs` | Verify Node, the webjs CLI, and the treesitter parsers. |

## Configuration

```lua
require('webjs').setup({
  cmd = 'webjs',   -- the webjs CLI for :WebjsCheck (e.g. 'npx' wrappers, or an absolute path)
})
```

## Notes

- `${…}` substitutions inside a template render as template text in the
  injected language rather than re-highlighted TypeScript. This is a
  treesitter injection limitation; the VS Code extension scopes them
  precisely.
- `svg`` `` templates inject the HTML parser (Neovim maps `svg` to `html`),
  which highlights SVG tags and attributes correctly.

## Development

This plugin is developed in the webjs monorepo at `packages/editors/nvim/` and
published to the standalone `webjsdev/webjs.nvim` repo for lazy.nvim / packer
discovery (see `PUBLISHING.md`). The headless test suite is
`test/selftest.lua` (run `nvim --headless -l packages/editors/nvim/test/selftest.lua`),
wrapped by `test/nvim.test.mjs` for the repo's `npm test`.

License: MIT.
