-- Headless self-test for webjs.nvim (Phase 4 of #381). Run via
--   nvim --headless -l packages/editors/nvim/test/selftest.lua
-- Exits non-zero (`:cq`) on any failure so a CI wrapper can detect it.

local fail = 0
local function ok(cond, msg)
  if cond then print('ok   ' .. msg) else fail = fail + 1; print('FAIL ' .. msg) end
end

-- The plugin dir is two levels up from this file.
local here = debug.getinfo(1, 'S').source:sub(2)
local plugin_dir = vim.fn.fnamemodify(here, ':h:h')
vim.opt.runtimepath:prepend(plugin_dir)

-- 1. modules load
local webjs = require('webjs')
ok(type(webjs.setup) == 'function', 'webjs.setup is a function')
local check = require('webjs.check')
ok(type(check.project) == 'function', 'webjs.check.project is a function')
ok(pcall(require, 'webjs.health'), 'webjs.health loads')

-- 2. setup registers :WebjsCheck (also auto-registered by plugin/webjs.lua)
webjs.setup({})
ok(vim.fn.exists(':WebjsCheck') == 2, ':WebjsCheck command registered')

-- 3. tsserver plugin helper is idempotent and points at the BUNDLED copy
local io = webjs.with_tsserver_plugin({})
ok(io.plugins[1].name == '@webjsdev/intellisense', 'with_tsserver_plugin injects the plugin')
ok(#webjs.with_tsserver_plugin(io).plugins == 1, 'with_tsserver_plugin is idempotent')
local loc = io.plugins[1].location
ok(vim.fn.isdirectory(loc .. '/node_modules/@webjsdev/intellisense') == 1,
  'plugin location points at the vendored bundle (works with no app dependency)')
ok(vim.fn.filereadable(loc .. '/node_modules/@webjsdev/intellisense/src/index.js') == 1,
  'bundled intellisense entry is present')

-- 4. check.project maps a violation to a quickfix entry
local _, qf = check.project({
  violations = { { rule = 'no-foo', message = 'bad', file = '/tmp/x.ts', line = 3, column = 5 } },
  summary = { count = 1 },
})
ok(#qf == 1 and qf[1].lnum == 3 and qf[1].col == 5, 'project builds a quickfix entry')
ok(qf[1].text:match('no%-foo') ~= nil, 'quickfix text carries the rule')

-- 5. the injection query is valid and injects per tag
local scm = table.concat(vim.fn.readfile(plugin_dir .. '/queries/typescript/injections.scm'), '\n')
ok(pcall(vim.treesitter.query.parse, 'typescript', scm), 'injections.scm is a valid typescript query')
vim.treesitter.query.set('typescript', 'injections', scm)

local function injected_langs(code)
  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, { code })
  vim.bo[buf].filetype = 'typescript'
  local parser = vim.treesitter.get_parser(buf, 'typescript')
  parser:parse(true)
  local set = {}
  for lang in pairs(parser:children()) do set[lang] = true end
  return set
end

ok(injected_langs('const x = html`<div></div>`;').html, 'html`` injects the html parser')
ok(injected_langs('const s = css`.a{ color: red }`;').css, 'css`` injects the css parser')
-- svg`` injects an html-family parser (Neovim maps svg -> html); either is a win.
local svg = injected_langs('const v = svg`<g></g>`;')
ok(svg.svg or svg.html, 'svg`` is injected (html or svg parser)')
-- member-tag form: `static styles = css\`\``
ok(injected_langs('class C { static styles = css`.x{}`; }').css, 'member css`` (x.css``) injects css')

print((fail == 0) and 'ALL PASS' or (fail .. ' FAILURE(S)'))
if fail > 0 then vim.cmd('cq') end
