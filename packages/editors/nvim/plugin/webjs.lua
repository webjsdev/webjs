-- webjs.nvim plugin entry. Loaded automatically when the plugin is on the
-- runtimepath. The treesitter injection queries under queries/ are picked up
-- by Neovim without any code here; this file only registers the user commands
-- so :WebjsCheck works without an explicit require('webjs').setup() call.

if vim.g.loaded_webjs then
  return
end
vim.g.loaded_webjs = true

vim.api.nvim_create_user_command('WebjsCheck', function()
  local webjs = require('webjs')
  require('webjs.check').check(webjs.config.cmd, vim.fn.getcwd())
end, { desc = 'Run `webjs check` and load violations into diagnostics + quickfix' })
