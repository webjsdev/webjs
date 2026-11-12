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
import { symlinkSync } from 'node:fs';
import { metricsOf, promptFor, agentEnv, evalMcpConfig, freePort, linkNodeModules } from '../../scripts/agent-eval/build.mjs';

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
  // #1697: the app must boot and serve its routes, and the prompt does not
  // say how (a dev server plus curl was a loop no real user asks for).
  assert.match(p, /boot and serve its routes/);
  assert.match(p, /use port 8900/);
  assert.doesNotMatch(p, /curl/);
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

// #1697: a framework checkout whose node_modules is a link into another
// checkout (a linked worktree) must still hand the app ITS CLI through npx.
test('an eval app runs the framework under test through npx, not the checkout its .bin lives in', () => {
  const root = mkdtempSync(join(tmpdir(), 'eval-bin-'));
  try {
    const mk = (dir, ver) => {
      mkdirSync(join(dir, 'packages/cli/bin'), { recursive: true });
      writeFileSync(join(dir, 'packages/cli/package.json'), JSON.stringify({ name: '@webjsdev/cli', files: ['bin'] }));
      writeFileSync(join(dir, 'packages/cli/bin/webjs.js'), `// ${ver}\n`);
    };
    const primary = join(root, 'primary');
    const worktree = join(root, 'worktree');
    mk(primary, 'primary');
    mk(worktree, 'worktree');
    // The primary's install: npm's relative bin link and a workspace link.
    mkdirSync(join(primary, 'node_modules/.bin'), { recursive: true });
    mkdirSync(join(primary, 'node_modules/@webjsdev'), { recursive: true });
    symlinkSync('../../packages/cli', join(primary, 'node_modules/@webjsdev/cli'));
    symlinkSync('../@webjsdev/cli/bin/webjs.js', join(primary, 'node_modules/.bin/webjs'));
    mkdirSync(join(primary, 'node_modules/left-pad'));
    // The worktree: .bin linked whole into the primary, @webjsdev its own.
    mkdirSync(join(worktree, 'node_modules/@webjsdev'), { recursive: true });
    symlinkSync(join(primary, 'node_modules/.bin'), join(worktree, 'node_modules/.bin'));
    symlinkSync(join(primary, 'node_modules/left-pad'), join(worktree, 'node_modules/left-pad'));
    symlinkSync(join(worktree, 'packages/cli'), join(worktree, 'node_modules/@webjsdev/cli'));
    const app = join(root, 'app');
    mkdirSync(app);
    linkNodeModules(worktree, app);
    assert.match(readFileSync(join(app, 'node_modules/.bin/webjs'), 'utf8'), /worktree/, 'the bin resolves to the worktree CLI');
    assert.ok(existsSync(join(app, 'node_modules/left-pad')), 'other packages are still linked');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// #1697: stream-json writes one event per content block of a message, each
// with the message's full usage, so summing per event counted it 2 to 3 times.
test('usage is counted once per API message, however many blocks it has', () => {
  const block = (type) => ({ type: 'assistant', message: { id: 'msg_1', usage: { input_tokens: 10, cache_read_input_tokens: 990, output_tokens: 5 }, content: [{ type }] } });
  const { file, dir } = transcript([
    block('thinking'), block('text'),
    { type: 'assistant', message: { id: 'msg_1', usage: { input_tokens: 10, cache_read_input_tokens: 990, output_tokens: 5 }, content: [{ type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'ls' } }] } },
    { type: 'assistant', message: { id: 'msg_2', usage: { input_tokens: 20, cache_read_input_tokens: 1980, output_tokens: 7 }, content: [{ type: 'text' }] } },
    { type: 'result', duration_ms: 60_000, result: 'ok', total_cost_usd: 0.42 },
  ]);
  try {
    const m = metricsOf(file);
    assert.equal(m.inputTokens, 3000, 'msg_1 once (1000) plus msg_2 (2000), not msg_1 three times');
    assert.equal(m.outputTokens, 12);
    assert.equal(m.toolCalls, 1);
    assert.equal(m.costUsd, 0.42, 'the run cost from the result event');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// A review of #1698: a message's later events can report more output than its
// first, since usage is written as the message streams.
test('each message keeps the largest usage any of its events reports', () => {
  const ev = (out) => ({ type: 'assistant', message: { id: 'msg_1', usage: { input_tokens: 10, cache_read_input_tokens: 990, output_tokens: out }, content: [{ type: 'text' }] } });
  const { file, dir } = transcript([ev(2), ev(40), ev(15)]);
  try {
    const m = metricsOf(file);
    assert.equal(m.inputTokens, 1000);
    assert.equal(m.outputTokens, 40, 'the largest output the message reported, not its first');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
