-- `webjs check` integration: run the correctness validator and surface its
-- violations as Neovim diagnostics + a quickfix list. Part of #387.

local M = {}

local ns = vim.api.nvim_create_namespace('webjs-check')

--- Map a `webjs check --json` violation to a vim.diagnostic entry.
--- A violation has { rule, message, file, line, column, fix }.
local function to_diagnostic(v, bufnr)
  return {
    bufnr = bufnr,
    lnum = math.max((tonumber(v.line) or 1) - 1, 0),
    col = math.max((tonumber(v.column) or 1) - 1, 0),
    severity = vim.diagnostic.severity.ERROR,
    source = 'webjs check',
    code = v.rule,
    message = v.fix and (v.message .. '\n  fix: ' .. v.fix) or v.message,
  }
end

--- Run `<cmd> check --json` in `cwd` and dispatch the parsed result to `done`.
--- `done(err, result)` where result is the decoded `{ violations, summary }`.
function M.run(cmd, cwd, done)
  local out = {}
  local err = {}
  local jobid = vim.fn.jobstart({ cmd, 'check', '--json' }, {
    cwd = cwd,
    stdout_buffered = true,
    stderr_buffered = true,
    on_stdout = function(_, data) for _, l in ipairs(data) do out[#out + 1] = l end end,
    on_stderr = function(_, data) for _, l in ipairs(data) do err[#err + 1] = l end end,
    on_exit = function()
      local text = table.concat(out, '\n')
      local ok, decoded = pcall(vim.json.decode, text)
      if not ok then
        done('could not parse `' .. cmd .. ' check --json` output: ' .. table.concat(err, '\n'))
        return
      end
      done(nil, decoded)
    end,
  })
  if jobid <= 0 then
    done('failed to spawn `' .. cmd .. '` (is it installed / on PATH?)')
  end
end

--- Project the violations onto Neovim diagnostics, keyed by file, and build a
--- quickfix list. Pure: takes the decoded result, returns the qflist items.
--- Exposed for testing without spawning a job.
function M.project(result)
  local violations = (result and result.violations) or {}
  local by_buf = {}
  local qf = {}
  for _, v in ipairs(violations) do
    local bufnr = v.file and vim.fn.bufadd(v.file) or 0
    if v.file then vim.fn.bufload(bufnr) end
    by_buf[bufnr] = by_buf[bufnr] or {}
    table.insert(by_buf[bufnr], to_diagnostic(v, bufnr))
    qf[#qf + 1] = {
      filename = v.file,
      lnum = tonumber(v.line) or 1,
      col = tonumber(v.column) or 1,
      text = '[' .. (v.rule or 'webjs') .. '] ' .. (v.message or ''),
      type = 'E',
    }
  end
  return by_buf, qf
end

--- Full flow: run check, set diagnostics, populate the quickfix list, notify.
function M.check(cmd, cwd)
  M.run(cmd, cwd, function(err, result)
    vim.schedule(function()
      if err then
        vim.notify('[webjs] ' .. err, vim.log.levels.ERROR)
        return
      end
      local by_buf, qf = M.project(result)
      vim.diagnostic.reset(ns)
      for bufnr, diags in pairs(by_buf) do
        if bufnr and bufnr > 0 then vim.diagnostic.set(ns, bufnr, diags) end
      end
      vim.fn.setqflist(qf, 'r')
      local n = (result.summary and result.summary.count) or #qf
      if n == 0 then
        vim.notify('[webjs] check passed: no violations', vim.log.levels.INFO)
      else
        vim.notify('[webjs] check found ' .. n .. ' violation(s); see :copen', vim.log.levels.WARN)
      end
    end)
  end)
end

M.namespace = ns
return M
