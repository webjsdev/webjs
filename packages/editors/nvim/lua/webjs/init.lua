-- webjs.nvim: Neovim support for webjs apps (Phase 4 of #381).
--
-- Two pieces of value, mirroring the VS Code extension:
--   1. Highlighting: treesitter injection queries (shipped under queries/,
--      auto-loaded from the runtimepath) inject html / css / svg into the
--      `html` / `css` / `svg` tagged templates. No setup() call needed.
--   2. Intelligence: the standalone `@webjsdev/intellisense` tsserver plugin
--      surfaced through your LSP, plus a `:WebjsCheck` diagnostics source.
--
-- `setup()` is OPTIONAL: it only registers the user commands and applies
-- config. Highlighting works the moment the plugin is on the runtimepath.

local M = {}

M.config = {
  -- The webjs CLI used by :WebjsCheck. Override if not on PATH.
  cmd = 'webjs',
}

--- The plugin's own root dir (…/packages/editors/nvim, or the cloned webjs.nvim repo).
local function plugin_root()
  local src = debug.getinfo(1, 'S').source:sub(2) -- this file: <root>/lua/webjs/init.lua
  return vim.fn.fnamemodify(src, ':h:h:h')
end

--- The directory webjs.nvim VENDORS @webjsdev/intellisense into. tsserver
--- resolves a plugin as `<location>/node_modules/<name>`, so this is the dir
--- whose `node_modules/@webjsdev/intellisense` holds the bundled copy.
--- @return string
function M.bundled_location()
  return plugin_root() .. '/vendor'
end

--- The tsserver plugin spec to add to your LSP's `init_options.plugins`. It
--- points at the copy of @webjsdev/intellisense BUNDLED inside webjs.nvim, so the
--- webjs language service works even when the app has no @webjsdev/intellisense
--- in node_modules (e.g. before `npm install`) and with no `tsconfig.json`
--- edit. When the app DOES wire the plugin via tsconfig, tsserver dedupes by
--- name, so there is no double-load.
--- @return table { name = '@webjsdev/intellisense', location = string }
function M.tsserver_plugin()
  return {
    name = '@webjsdev/intellisense',
    location = M.bundled_location(),
  }
end

--- Convenience: merge the webjs tsserver plugin into an existing ts_ls
--- `init_options` table (creating `plugins` if absent), idempotently.
--- @param init_options table|nil
--- @return table the same (or a new) init_options with the plugin present
function M.with_tsserver_plugin(init_options)
  init_options = init_options or {}
  init_options.plugins = init_options.plugins or {}
  for _, p in ipairs(init_options.plugins) do
    if p.name == '@webjsdev/intellisense' then return init_options end
  end
  table.insert(init_options.plugins, M.tsserver_plugin())
  return init_options
end

--- The vtsls-shaped globalPlugin spec. vtsls (the LSP LazyVim's TypeScript
--- extra and many modern setups use) loads tsserver plugins via
--- `settings.vtsls.tsserver.globalPlugins`, a DIFFERENT key from ts_ls's
--- `init_options.plugins`, and needs `enableForWorkspaceTypeScriptVersions` so
--- the plugin loads against the workspace's own TypeScript too. Points at the
--- BUNDLED copy, so it works with no @webjsdev/intellisense in the app and no
--- tsconfig edit (#405).
--- @return table { name, location, enableForWorkspaceTypeScriptVersions, languages }
function M.vtsls_global_plugin()
  return {
    name = '@webjsdev/intellisense',
    location = M.bundled_location(),
    enableForWorkspaceTypeScriptVersions = true,
    languages = { 'javascript', 'typescript' },
  }
end

--- Convenience: merge the webjs tsserver plugin into a vtsls `settings` table
--- (creating `vtsls.tsserver.globalPlugins` if absent), idempotently. Use this
--- with the `vtsls` language server (LazyVim's default TypeScript LSP), where
--- `with_tsserver_plugin`'s `init_options.plugins` shape does nothing.
--- @param settings table|nil
--- @return table the same (or a new) settings with the globalPlugin present
function M.with_vtsls_plugin(settings)
  settings = settings or {}
  settings.vtsls = settings.vtsls or {}
  settings.vtsls.tsserver = settings.vtsls.tsserver or {}
  settings.vtsls.tsserver.globalPlugins = settings.vtsls.tsserver.globalPlugins or {}
  for _, p in ipairs(settings.vtsls.tsserver.globalPlugins) do
    if p.name == '@webjsdev/intellisense' then return settings end
  end
  table.insert(settings.vtsls.tsserver.globalPlugins, M.vtsls_global_plugin())
  return settings
end

--- Register user commands. Safe to call multiple times.
function M.setup(opts)
  M.config = vim.tbl_deep_extend('force', M.config, opts or {})

  vim.api.nvim_create_user_command('WebjsCheck', function()
    require('webjs.check').check(M.config.cmd, vim.fn.getcwd())
  end, { desc = 'Run `webjs check` and load violations into diagnostics + quickfix' })

  return M
end

return M
