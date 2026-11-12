/**
 * `webjs verify` (#1697): check and typecheck in parallel, then test, then the
 * app's dev before-steps and an in-process boot of every route, in one call
 * on the `webjs ci` engine. Eval agents spent about 19 late turns per build
 * starting a dev server, curling and stopping it. The engine's spawn is
 * injected, so nothing real runs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { runVerify, verifySteps, tail } from '../../packages/cli/lib/verify.js';

/**
 * A fake spawn: each command resolves to { code, output, late }, where `late`
 * is written after 'exit' and before 'close', as a real child's last stdio
 * chunks can be.
 */
function fakeSpawn(results, log) {
  return (cmd, opts) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.pid = 1;
    child.kill = () => {};
    const key = Object.keys(results).find((k) => cmd.endsWith(k));
    const r = (key && results[key]) || { code: 0, output: '' };
    log.push({ cmd, env: opts.env, at: log.length });
    setImmediate(() => {
      if (r.output) child.stdout.write(r.output);
      child.emit('exit', r.code, null);
      setImmediate(() => {
        if (r.late) child.stdout.write(r.late);
        setImmediate(() => child.emit('close', r.code, null));
      });
    });
    return child;
  };
}

const run = (results, extra = {}) => {
  const log = [];
  const lines = [];
  const p = runVerify({ appDir: '/app', cli: 'CLI', spawn: fakeSpawn(results, log), out: (s) => lines.push(s), env: {}, ...extra });
  return p.then((code) => ({ code, log, lines }));
};

test('the steps: check and typecheck in one parallel group, then test, prepare and boot', () => {
  const nodes = verifySteps('CLI', ['webjs db migrate', 'webjs regenerate']);
  assert.equal(nodes[0].kind, 'group');
  assert.equal(nodes[0].parallel, 2);
  assert.deepEqual(nodes[0].steps.map((s) => s.run), ['CLI check', 'CLI typecheck']);
  assert.deepEqual(nodes.slice(1).map((s) => s.run), ['CLI test', 'webjs db migrate && webjs regenerate', 'CLI status --boot']);
  assert.deepEqual(verifySteps('CLI', []).map((n) => n.title), ['checks', 'test', 'boot'], 'no prepare step without before-steps');
});

test('every step passes: one line each and exit 0', async () => {
  const { code, lines, log } = await run({}, { beforeSteps: ['webjs db migrate'] });
  assert.equal(code, 0);
  assert.deepEqual(lines.slice(0, 5).map((l) => l.split(/\s+/)[1]), ['check', 'typecheck', 'test', 'prepare', 'boot']);
  assert.match(lines.at(-1), /all 5 steps passed/);
  assert.equal(log.length, 5);
});

test('check and typecheck start before either finishes', async () => {
  const { log } = await run({});
  assert.deepEqual(log.slice(0, 2).map((l) => l.cmd), ['CLI check', 'CLI typecheck'], 'both spawned first, in the same group');
});

test('a failing step prints its output tail, the rest still run, and the exit is 1', async () => {
  const { code, lines } = await run({
    'CLI typecheck': { code: 2, output: 'app/page.ts(3,1): error TS2322: nope\n' },
    'CLI status --boot': { code: 1, output: 'GET /polls 500\n  Error: no such table: polls\n' },
  });
  assert.equal(code, 1);
  const text = lines.join('\n');
  assert.match(text, /FAIL {2}typecheck .*exit 2/);
  assert.match(text, /error TS2322: nope/);
  assert.match(text, /ok {4}test/, 'a later step still ran after the failure');
  assert.match(text, /no such table: polls/);
  assert.match(lines.at(-1), /2 of 4 steps failed/);
});

// The review's first finding: output written after 'exit' and before 'close'
// is the failing assertion and the run's summary, the part the tail exists for.
test('output a step writes after it exits is still in the report', async () => {
  const { lines } = await run({ 'CLI test': { code: 1, output: 'running 3 tests\n', late: 'not ok 2 - votes are counted\n# fail 1\n' } });
  const text = lines.join('\n');
  assert.match(text, /not ok 2 - votes are counted/);
  assert.match(text, /# fail 1/);
});

// A review of #1698: the ci engine sets CI=true on every step, which made an
// app's tests and boot run as CI during a local loop.
test('steps run without CI=true, unless the shell set it', async () => {
  const plain = await run({}, { env: { KEEP: '1' } });
  for (const l of plain.log) assert.equal(l.env.CI, undefined);
  const inCi = await run({}, { env: { CI: '1' } });
  for (const l of inCi.log) assert.equal(l.env.CI, '1', 'a real CI shell keeps its own value');
});

test('no step inherits a parent node --test context', async () => {
  const { log } = await run({}, { env: { NODE_TEST_CONTEXT: 'child-v8', KEEP: '1' } });
  for (const l of log) {
    assert.equal(l.env.NODE_TEST_CONTEXT, undefined);
    assert.equal(l.env.KEEP, '1');
  }
});

test('tail keeps the last lines and strips colour codes', () => {
  const out = Array.from({ length: 50 }, (_, i) => `\x1b[31mline ${i}\x1b[0m`).join('\n');
  assert.deepEqual(tail(out, 3).split('\n'), ['...', 'line 47', 'line 48', 'line 49']);
});

test('tail drops stack frames, which the code frame already locates', () => {
  const out = 'Error: kaboom\n    at Broken (file:///app/page.ts:1:42)\n    at async render (x.js:9:1)\n  GET /broken  500';
  assert.equal(tail(out), 'Error: kaboom\n  GET /broken  500');
});

// A review of #1698: the filter dropped every line starting with "at".
test('tail keeps a message line that starts with "at"', () => {
  const out = 'not ok 1 - rows\n  at least one row expected\n    at Test.run (node:internal/test_runner/test:1409:7)\n    at <anonymous>';
  assert.equal(tail(out), 'not ok 1 - rows\n  at least one row expected');
});
