/**
 * `webjs verify` (#1697): check, typecheck and test, then the app's dev
 * before-steps and an in-process boot of every route, in one call. Eval agents
 * spent about 19 late turns per build starting a dev server, curling and
 * stopping it. The flow is driven with an injected runner, so nothing spawns.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runVerify, tail } from '../../packages/cli/lib/verify.js';

function harness(results) {
  const calls = [];
  const lines = [];
  const run = async (cmd, args, opts) => {
    calls.push({ cmd, args, shell: !!opts.shell, env: opts.env });
    const key = opts.shell ? cmd : args.slice(1).join(' ');
    return results[key] ?? { code: 0, output: '' };
  };
  return { calls, lines, run, out: (s) => lines.push(s) };
}

test('every step passes: one line each and exit 0', async () => {
  const h = harness({});
  const code = await runVerify({ appDir: '/app', cliBin: '/cli.js', execPath: 'node', beforeSteps: ['webjs db migrate'], run: h.run, out: h.out, env: {} });
  assert.equal(code, 0);
  assert.deepEqual(h.calls.map((c) => (c.shell ? `sh:${c.cmd}` : c.args.slice(1).join(' '))),
    ['check', 'typecheck', 'test', 'sh:webjs db migrate', 'status --boot'],
    'check, typecheck, test, then the dev before-steps, then the in-process boot');
  assert.equal(h.lines.filter((l) => l.startsWith('ok ')).length, 4);
  assert.match(h.lines.at(-1), /all 4 steps passed/);
});

test('a failing step prints its output tail, the rest still run, and the exit is 1', async () => {
  const h = harness({
    typecheck: { code: 2, output: 'app/page.ts(3,1): error TS2322: nope\n' },
    'status --boot': { code: 1, output: 'GET /polls 500\n  Error: no such table: polls\n' },
  });
  const code = await runVerify({ appDir: '/app', cliBin: '/cli.js', execPath: 'node', run: h.run, out: h.out, env: {} });
  assert.equal(code, 1);
  const text = h.lines.join('\n');
  assert.match(text, /FAIL {2}typecheck .*exit 2/);
  assert.match(text, /error TS2322: nope/, 'the failing output is shown');
  assert.match(text, /ok {4}test/, 'a later step still ran after the failure');
  assert.match(text, /no such table: polls/);
  assert.match(h.lines.at(-1), /2 of 4 steps failed/);
});

test('a failing before-step fails the boot without booting', async () => {
  const h = harness({ 'webjs db migrate': { code: 1, output: 'migration failed\n' } });
  const code = await runVerify({ appDir: '/app', cliBin: '/cli.js', execPath: 'node', beforeSteps: ['webjs db migrate'], run: h.run, out: h.out, env: {} });
  assert.equal(code, 1);
  assert.ok(!h.calls.some((c) => c.args.includes('status')), 'no boot over a half-applied schema');
  assert.match(h.lines.join('\n'), /before-step failed: webjs db migrate/);
});

test('the test step never inherits a parent node --test context', async () => {
  const h = harness({});
  await runVerify({ appDir: '/app', cliBin: '/cli.js', execPath: 'node', run: h.run, out: h.out, env: { NODE_TEST_CONTEXT: 'child-v8', KEEP: '1' } });
  for (const c of h.calls) {
    assert.equal(c.env.NODE_TEST_CONTEXT, undefined);
    assert.equal(c.env.KEEP, '1');
  }
});

test('tail keeps the last lines and strips colour codes', () => {
  const out = Array.from({ length: 50 }, (_, i) => `\x1b[31mline ${i}\x1b[0m`).join('\n');
  const t = tail(out, 3).split('\n');
  assert.deepEqual(t, ['...', 'line 47', 'line 48', 'line 49']);
});

test('tail drops stack frames, which the code frame already locates', () => {
  const out = 'Error: kaboom\n    at Broken (file:///app/page.ts:1:42)\n    at async render (x.js:9:1)\n  GET /broken  500';
  assert.equal(tail(out), 'Error: kaboom\n  GET /broken  500');
});
