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

--- Register user commands. Safe to call multiple times.
function M.setup(opts)
  M.config = vim.tbl_deep_extend('force', M.config, opts or {})

  vim.api.nvim_create_user_command('WebjsCheck', function()
    require('webjs.check').check(M.config.cmd, vim.fn.getcwd())
  end, { desc = 'Run `webjs check` and load violations into diagnostics + quickfix' })

  return M
end

return M
