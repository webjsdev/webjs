-- webjs.nvim: Neovim support for webjs apps (Phase 4 of #381).
--
-- Two pieces of value, mirroring the VS Code extension:
--   1. Highlighting: treesitter injection queries (shipped under queries/,
--      auto-loaded from the runtimepath) inject html / css / svg into the
--      `html` / `css` / `svg` tagged templates. No setup() call needed.
--   2. Intelligence: the standalone `@webjsdev/ts-plugin` tsserver plugin
--      surfaced through your LSP, plus a `:WebjsCheck` diagnostics source.
--
-- `setup()` is OPTIONAL: it only registers the user commands and applies
-- config. Highlighting works the moment the plugin is on the runtimepath.

local M = {}

M.config = {
  -- The webjs CLI used by :WebjsCheck. Override if not on PATH.
  cmd = 'webjs',
}

--- The tsserver plugin spec to add to your LSP's `init_options.plugins`, so
--- the webjs language service loads even without editing `tsconfig.json`.
--- `location` resolves `@webjsdev/ts-plugin` from the app's node_modules.
--- @param root string|nil project root (defaults to cwd)
--- @return table { name = '@webjsdev/ts-plugin', location = string }
function M.tsserver_plugin(root)
  root = root or vim.fn.getcwd()
  return {
    name = '@webjsdev/ts-plugin',
    -- ts_ls resolves the plugin from `location`'s node_modules; pointing at
    -- the project root is enough.
    location = root,
  }
end

--- Convenience: merge the webjs tsserver plugin into an existing ts_ls
--- `init_options` table (creating `plugins` if absent), idempotently.
--- @param init_options table|nil
--- @return table the same (or a new) init_options with the plugin present
function M.with_tsserver_plugin(init_options, root)
  init_options = init_options or {}
  init_options.plugins = init_options.plugins or {}
  for _, p in ipairs(init_options.plugins) do
    if p.name == '@webjsdev/ts-plugin' then return init_options end
  end
  table.insert(init_options.plugins, M.tsserver_plugin(root))
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
