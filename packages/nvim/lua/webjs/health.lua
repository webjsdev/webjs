-- `:checkhealth webjs`: verify the toolchain webjs.nvim needs (Phase 4, #387).

local M = {}

local function has_parser(lang)
  return pcall(vim.treesitter.language.add, lang)
end

function M.check()
  local h = vim.health or require('health')
  h.start('webjs.nvim')

  -- Node 24+ (the framework's type-stripping floor).
  local node = vim.fn.executable('node') == 1 and vim.fn.system({ 'node', '--version' }):gsub('%s+', '') or nil
  if node then
    local major = tonumber(node:match('^v(%d+)'))
    if major and major >= 24 then
      h.ok('node ' .. node .. ' (>= 24)')
    else
      h.warn('node ' .. node .. ' is below the webjs floor of 24', { 'Install Node 24+ so type-stripping works.' })
    end
  else
    h.warn('node not found on PATH', { 'Install Node 24+.' })
  end

  -- The webjs CLI (for :WebjsCheck).
  if vim.fn.executable('webjs') == 1 then
    h.ok('webjs CLI on PATH')
  else
    h.info('webjs CLI not on PATH; :WebjsCheck uses `npx webjs` or set require("webjs").config.cmd')
  end

  -- Treesitter parsers the injection queries depend on.
  for _, lang in ipairs({ 'typescript', 'javascript', 'html', 'css' }) do
    if has_parser(lang) then
      h.ok('treesitter parser: ' .. lang)
    else
      h.warn('missing treesitter parser: ' .. lang, {
        'Install it, e.g. `:TSInstall ' .. lang .. '` (nvim-treesitter).',
      })
    end
  end
  if has_parser('svg') then
    h.ok('treesitter parser: svg')
  else
    h.info('no svg parser; svg`` templates fall back to plain text (optional, `:TSInstall svg`)')
  end
end

return M
