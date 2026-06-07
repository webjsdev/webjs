/**
 * Node wrapper that runs the webjs.nvim headless self-test (Phase 4 of #381).
 *
 * The real assertions live in `selftest.lua` and run inside Neovim (the only
 * place the plugin's Lua + treesitter injections can execute). This wrapper
 * spawns `nvim --headless -l selftest.lua`, asserts a clean exit and the
 * `ALL PASS` marker, and SKIPS when Neovim is not installed so CI without
 * Neovim stays green. Run locally with `node --test` (or the repo `npm test`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const hasNvim = spawnSync('nvim', ['--version'], { encoding: 'utf8' }).status === 0;

test('webjs.nvim headless self-test (skipped without nvim)', { skip: hasNvim ? false : 'nvim not installed' }, () => {
  const res = spawnSync('nvim', ['--headless', '-l', join(DIR, 'selftest.lua')], { encoding: 'utf8' });
  const out = (res.stdout || '') + (res.stderr || '');
  assert.equal(res.status, 0, `nvim self-test exited ${res.status}:\n${out}`);
  assert.match(out, /ALL PASS/, `expected ALL PASS:\n${out}`);
});
