/**
 * The clean build runner's transcript metrics (#1686): what counts as the
 * agent's FIRST check, typecheck and test run, whether each passed, and what
 * counts as rework, read from a stream-json transcript like `claude -p`
 * writes. No model is called.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { realpathSync } from 'node:fs';
import { createServer } from 'node:net';
import { metricsOf, promptFor, agentEnv, evalMcpConfig, freePort } from '../../scripts/agent-eval/build.mjs';

/** A stream-json transcript from a list of events. */
function transcript(events) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-build-metrics-'));
  const file = join(dir, 't.jsonl');
  writeFileSync(file, events.map((e) => JSON.stringify(e)).join('\n') + '\n');
  return { file, dir };
}
const use = (id, name, input) => ({ type: 'assistant', message: { usage: { input_tokens: 100, cache_read_input_tokens: 900, output_tokens: 10 }, content: [{ type: 'tool_use', id, name, input }] } });
const result = (id, text, isError = false) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: text, is_error: isError }] } });

test('the first run of each verification is what counts, and rework is an edit after a failed one', () => {
  const { file, dir } = transcript([
    { type: 'system', subtype: 'init' },
    use('w1', 'Write', { file_path: '/app/app/page.ts', content: 'x' }),
    use('w2', 'Write', { file_path: '/app/lib/a.ts', content: 'x' }),
    use('e1', 'Edit', { file_path: '/app/app/page.ts', old_string: 'x', new_string: 'y' }),
    use('c1', 'Bash', { command: 'npx webjs check' }),
    result('c1', 'webjs check: 1 violation(s) found', true),
    use('e2', 'Edit', { file_path: '/app/app/page.ts', old_string: 'y', new_string: 'z' }),
    use('c2', 'Bash', { command: 'npx webjs check' }),
    result('c2', 'webjs check: all checks pass'),
    use('t1', 'Bash', { command: 'npx webjs typecheck' }),
    result('t1', ''),
    { type: 'result', duration_ms: 120_000, result: 'Built it.' },
  ]);
  try {
    const m = metricsOf(file);
    assert.deepEqual(m.firsts, { check: false, typecheck: true, test: null }, 'the failed first check stands; the later pass does not replace it');
    assert.equal(m.rework, 1, 'the edit before the first failure is building, the one after it is rework');
    assert.equal(m.toolCalls, 7);
    assert.equal(m.inputTokens, 7000, 'fresh plus cached input');
    assert.equal(m.minutes, 2);
    assert.equal(m.report, 'Built it.');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the prompt carries the spec and names no WebJs API beyond its CLI', () => {
  const p = promptFor('Build "X", a thing.', '/tmp/app', 8900);
  assert.match(p, /Build "X", a thing\./);
  assert.match(p, /\/tmp\/app/);
  assert.match(p, /webjs dev --port 8900/);
  assert.doesNotMatch(p, /WebComponent|createAuth|html`|'use server'/, 'the frame teaches nothing the brief should');
});

test('each build gets a temp directory of its own, so concurrent builds never share a cookie jar', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eval-env-'));
  try {
    const env = agentEnv(dir);
    assert.equal(env.TMP, env.TMPDIR);
    assert.ok(existsSync(env.TMPDIR), 'and it exists');
    assert.equal(realpathSync(join(dir, 'tmp')), realpathSync(env.TMPDIR), 'linked from the build directory');
    // #1697: Playwright puts a Unix socket under TMPDIR, and a socket path
    // has a 108-byte limit, so the directory has to be short.
    assert.ok(env.TMPDIR.length < 32, `a short path (${env.TMPDIR})`);
    const other = agentEnv(join(dir, 'b'));
    assert.notEqual(other.TMPDIR, env.TMPDIR, 'a second build gets another');
    rmSync(env.TMPDIR, { recursive: true, force: true });
    rmSync(other.TMPDIR, { recursive: true, force: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('freePort hands out a port nothing is listening on', async () => {
  const port = await freePort();
  assert.ok(port > 0);
  const srv = createServer();
  await new Promise((ok, fail) => { srv.once('error', fail); srv.listen(port, '127.0.0.1', ok); });
  await new Promise((ok) => srv.close(ok));
});

test('the agent MCP config is a copy pointing Playwright at the system Chromium', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eval-mcp-'));
  try {
    const app = join(dir, 'app');
    mkdirSync(app);
    const original = { mcpServers: { playwright: { type: 'stdio', command: 'npx', args: ['@playwright/mcp@latest'] }, webjs: { command: 'npx', args: ['@webjsdev/mcp'] } } };
    writeFileSync(join(app, '.claude.json'), JSON.stringify(original));
    const file = evalMcpConfig(app, dir, '/usr/bin/chromium');
    assert.equal(file, join(dir, 'mcp.json'), 'written beside the app');
    const copy = JSON.parse(readFileSync(file, 'utf8'));
    assert.deepEqual(copy.mcpServers.playwright.args, ['@playwright/mcp@latest', '--executable-path', '/usr/bin/chromium']);
    assert.deepEqual(copy.mcpServers.webjs, original.mcpServers.webjs);
    assert.deepEqual(JSON.parse(readFileSync(join(app, '.claude.json'), 'utf8')), original, 'the app is untouched');
    // With no browser on the host the copy is the app's config as it is.
    assert.deepEqual(JSON.parse(readFileSync(evalMcpConfig(app, dir, null), 'utf8')), original);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
