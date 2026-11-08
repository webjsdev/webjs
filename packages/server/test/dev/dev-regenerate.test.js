/**
 * Unit tests for on-request regeneration (#967) and the build record that
 * decides freshness (#1672): the generic, styling-agnostic mechanism that
 * rebuilds a stale build output (a scaffold's static `public/tailwind.css`) ON
 * REQUEST instead of relying on a live `tailwindcss --watch`.
 *
 * `spawn` is injected so no real compiler runs. The stub stands in for the
 * command: it writes (or does not write) the output, then exits the way the
 * case needs. Real files carry the mtimes, so the fingerprints are exercised
 * directly.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir, utimes, stat, readFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';

import {
  readRegenerateRules,
  maybeRegenerate,
  regenerateOutputs,
  regenerateStatus,
  regenerateState,
  readRegenerateManifest,
  isRegenerateOutputPath,
  REGENERATE_MANIFEST,
  _resetInFlight,
} from '../../src/dev-regenerate.js';

const tmps = [];
async function tmpApp(pkg = { name: 'x' }) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-regen-'));
  tmps.push(dir);
  await writeFile(join(dir, 'package.json'), JSON.stringify(pkg), 'utf8');
  return dir;
}

afterEach(async () => {
  _resetInFlight();
  while (tmps.length) await rm(tmps.pop(), { recursive: true, force: true });
});

const TW = {
  output: 'public/tailwind.css',
  command: 'tailwindcss -i ./public/input.css -o ./public/tailwind.css --minify',
  inputs: ['app', 'components', 'public/input.css'],
};

/**
 * A spawn stub standing in for the rule's command. By default it writes the
 * output (as the Tailwind CLI does once the output was moved aside) and exits
 * 0. `write: false` writes nothing, `code` / `signal` set the exit, `error`
 * emits a spawn error instead, and `during` runs while the "compile" is in
 * flight.
 */
function stubSpawn(dir, { write = '.built{}', code = 0, signal = null, error = false, during, output = TW.output } = {}) {
  const calls = [];
  const spawn = (command, opts) => {
    calls.push({ command, cwd: opts.cwd, PATH: opts.env.PATH });
    const child = new EventEmitter();
    child.pid = 1;
    setTimeout(async () => {
      if (during) await during(calls.length);
      if (error) return child.emit('error', new Error('spawn sh ENOENT'));
      if (write !== false) await writeFile(join(dir, output), write, 'utf8');
      child.emit('exit', signal ? null : code, signal);
    }, 0);
    return child;
  };
  return { spawn, calls };
}

/** An app with sources and an existing output. */
async function app() {
  const dir = await tmpApp();
  await mkdir(join(dir, 'app'), { recursive: true });
  await mkdir(join(dir, 'public'), { recursive: true });
  await writeFile(join(dir, 'public', 'input.css'), '@import "tailwindcss";', 'utf8');
  await writeFile(join(dir, 'app', 'page.ts'), 'export default () => 1;', 'utf8');
  await writeFile(join(dir, 'public', 'tailwind.css'), '.old{}', 'utf8');
  return dir;
}

const warnings = () => {
  const list = [];
  return { list, warn: (m) => list.push(m) };
};

test('readRegenerateRules: parses, normalizes a leading slash, defaults inputs', async () => {
  const dir = await tmpApp({
    name: 'x',
    webjs: { dev: { regenerate: [{ output: '/public/tailwind.css', command: 'build-css' }] } },
  });
  const rules = await readRegenerateRules(dir);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].output, 'public/tailwind.css');
  assert.equal(rules[0].command, 'build-css');
  assert.deepEqual(rules[0].inputs, []);
});

test('readRegenerateRules: drops malformed entries and missing block', async () => {
  assert.deepEqual(await readRegenerateRules(await tmpApp({ name: 'x' })), []);
  const dir = await tmpApp({
    name: 'x',
    webjs: { dev: { regenerate: [{ output: 'a.css' }, { command: 'b' }, 42, TW] } },
  });
  const rules = await readRegenerateRules(dir);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].output, 'public/tailwind.css');
});

test('maybeRegenerate: builds a MISSING output with a local-bin PATH, and records it', async () => {
  const dir = await app();
  await unlink(join(dir, 'public', 'tailwind.css'));
  const { spawn, calls } = stubSpawn(dir);
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(calls.length, 1);
  assert.match(calls[0].command, /tailwindcss/);
  assert.match(calls[0].PATH, /node_modules/);
  const m = await readRegenerateManifest(dir);
  assert.equal(m.outputs['public/tailwind.css'].command, TW.command);
});

test('regenerateState: a missing output is decided without walking the inputs', async () => {
  const dir = await app();
  await unlink(join(dir, 'public', 'tailwind.css'));
  const r = await regenerateState(dir, TW);
  assert.equal(r.state, 'missing');
  assert.equal(r.inputs, undefined, 'no input fingerprint was computed');
});

test('maybeRegenerate: an output with no record is built once, then fresh', async () => {
  const dir = await app();
  const { spawn, calls } = stubSpawn(dir);
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(calls.length, 1);
});

test('maybeRegenerate: a rebuild with UNCHANGED bytes is fresh on the next request (#1672)', async () => {
  const dir = await app();
  const { spawn, calls } = stubSpawn(dir, { write: '.same{}' });
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  // An edit that adds no class: the compiler writes the same bytes again.
  await writeFile(join(dir, 'app', 'page.ts'), 'export default () => 2;', 'utf8');
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(calls.length, 2, 'the edit rebuilt once');
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(calls.length, 2, 'and the identical output is not rebuilt again');
  assert.equal(await readFile(join(dir, 'public', 'tailwind.css'), 'utf8'), '.same{}');
});

test('maybeRegenerate: the command must WRITE the output, which was moved aside (#1672)', async () => {
  const dir = await app();
  let presentDuringCompile = null;
  const { spawn } = stubSpawn(dir, {
    during: () => { presentDuringCompile = existsSync(join(dir, 'public', 'tailwind.css')); },
  });
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(presentDuringCompile, false, 'a skip-unchanged compiler has to write it');
  assert.equal(await readFile(join(dir, 'public', 'tailwind.css'), 'utf8'), '.built{}');
  assert.equal(existsSync(join(dir, '.webjs', 'regenerate', encodeURIComponent(TW.output))), false, 'no backup left behind');
});

test('maybeRegenerate: exit 0 WITHOUT writing the output is not recorded, restores, and warns (#1672)', async () => {
  const dir = await app();
  const { list, warn } = warnings();
  // A rule whose `output` is not the path its command writes.
  const { spawn, calls } = stubSpawn(dir, { write: false });
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn, warn });
  assert.equal(await readFile(join(dir, 'public', 'tailwind.css'), 'utf8'), '.old{}', 'the previous output is served');
  assert.equal((await readRegenerateManifest(dir)).outputs['public/tailwind.css'], undefined);
  assert.match(list[0], /exited 0 but did not write public\/tailwind\.css/);
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn, warn });
  assert.equal(calls.length, 2, 'the misconfiguration stays visible: it retries');
  assert.equal(list.length, 2, 'and warns each time');
});

test('maybeRegenerate: a FAILED command restores the previous output and records nothing', async () => {
  const dir = await app();
  const { spawn, calls } = stubSpawn(dir, { write: '.partial', code: 1 });
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(await readFile(join(dir, 'public', 'tailwind.css'), 'utf8'), '.old{}', 'last good output, not a partial');
  assert.equal((await readRegenerateManifest(dir)).outputs['public/tailwind.css'], undefined);
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(calls.length, 2, 'retried');
});

test('maybeRegenerate: a spawn ERROR is never recorded (#1672)', async () => {
  const dir = await app();
  const { spawn, calls } = stubSpawn(dir, { error: true });
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(await readFile(join(dir, 'public', 'tailwind.css'), 'utf8'), '.old{}');
  assert.equal((await readRegenerateManifest(dir)).outputs['public/tailwind.css'], undefined);
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(calls.length, 2);
});

test('maybeRegenerate: a compile killed by a SIGNAL is never recorded, even if it wrote (#1672)', async () => {
  const dir = await app();
  const { spawn, calls } = stubSpawn(dir, { write: '.half', signal: 'SIGTERM' });
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(await readFile(join(dir, 'public', 'tailwind.css'), 'utf8'), '.old{}');
  assert.equal((await readRegenerateManifest(dir)).outputs['public/tailwind.css'], undefined);
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(calls.length, 2);
});

test('maybeRegenerate: an input saved DURING the compile still reads stale (#1672)', async () => {
  const dir = await app();
  const { spawn, calls } = stubSpawn(dir, {
    during: async (n) => {
      if (n === 1) await writeFile(join(dir, 'app', 'late.ts'), 'export default () => "grid-cols-3";', 'utf8');
    },
  });
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(calls.length, 2, 'the mid-compile save triggers a second compile');
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(calls.length, 2, 'and that build is then fresh');
});

test('maybeRegenerate: an input dated in the FUTURE never hides a later edit (#1672)', async () => {
  const dir = await app();
  // A file restored from a host whose clock ran a day ahead.
  const future = new Date(Date.now() + 86_400_000);
  await writeFile(join(dir, 'app', 'restored.ts'), 'export const a = 1;', 'utf8');
  await utimes(join(dir, 'app', 'restored.ts'), future, future);
  const { spawn, calls } = stubSpawn(dir);
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(calls.length, 1, 'fresh after its build');
  // A real edit now, long before the future timestamp.
  await writeFile(join(dir, 'app', 'page.ts'), 'export default () => "flex";', 'utf8');
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(calls.length, 2, 'the edit is seen');
});

test('maybeRegenerate: deleting an input makes the output stale', async () => {
  const dir = await app();
  await writeFile(join(dir, 'app', 'extra.ts'), 'export default () => "grid";', 'utf8');
  const { spawn, calls } = stubSpawn(dir);
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  await unlink(join(dir, 'app', 'extra.ts'));
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(calls.length, 2);
});

test('maybeRegenerate: a changed rule command makes the output stale', async () => {
  const dir = await app();
  const { spawn, calls } = stubSpawn(dir);
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  await maybeRegenerate(dir, 'public/tailwind.css', [{ ...TW, command: TW.command + ' --optimize' }], { spawn });
  assert.equal(calls.length, 2);
});

test('maybeRegenerate: an output rewritten by something else is stale', async () => {
  const dir = await app();
  const { spawn, calls } = stubSpawn(dir);
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  await writeFile(join(dir, 'public', 'tailwind.css'), '.hand-edited{}', 'utf8');
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(calls.length, 2);
});

test('maybeRegenerate: no-op when no rule matches the requested path', async () => {
  const dir = await app();
  const { spawn, calls } = stubSpawn(dir);
  await maybeRegenerate(dir, 'public/other.css', [TW], { spawn });
  assert.equal(calls.length, 0);
});

test('maybeRegenerate: concurrent requests for the same stale output coalesce to ONE compile', async () => {
  const dir = await app();
  let running = 0;
  let maxConcurrent = 0;
  let runs = 0;
  const spawn = () => {
    running++;
    runs++;
    maxConcurrent = Math.max(maxConcurrent, running);
    const child = new EventEmitter();
    child.pid = 1;
    setTimeout(async () => {
      await writeFile(join(dir, 'public', 'tailwind.css'), '.x{}', 'utf8');
      running--;
      child.emit('exit', 0);
    }, 20);
    return child;
  };
  await Promise.all([
    maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn }),
    maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn }),
    maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn }),
  ]);
  assert.equal(maxConcurrent, 1);
  assert.equal(runs, 1);
});

test('maybeRegenerate: parallel builds of DIFFERENT outputs all land in the record', async () => {
  const dir = await app();
  const rules = Array.from({ length: 6 }, (_, i) => ({
    output: `public/s${i}.css`, command: `build ${i}`, inputs: ['app'],
  }));
  const spawn = (command) => {
    const child = new EventEmitter();
    child.pid = 1;
    setTimeout(async () => {
      await writeFile(join(dir, 'public', `s${command.split(' ')[1]}.css`), command, 'utf8');
      child.emit('exit', 0);
    }, Math.random() * 10);
    return child;
  };
  await Promise.all(rules.map((r) => maybeRegenerate(dir, r.output, rules, { spawn })));
  const m = await readRegenerateManifest(dir);
  assert.deepEqual(Object.keys(m.outputs).sort(), rules.map((r) => r.output).sort());
  assert.equal(existsSync(join(dir, REGENERATE_MANIFEST)), true);
});

test('readRegenerateManifest: a malformed record reads as empty (every output rebuilds once)', async () => {
  const dir = await app();
  await mkdir(join(dir, '.webjs'), { recursive: true });
  await writeFile(join(dir, REGENERATE_MANIFEST), '{not json', 'utf8');
  assert.deepEqual(await readRegenerateManifest(dir), { version: 1, outputs: {} });
});

test('regenerateOutputs: builds what is not fresh, skips what is, rebuilds all with force', async () => {
  const dir = await app();
  const second = { output: 'public/b.css', command: 'build b', inputs: ['app'] };
  const spawn = (command) => {
    const child = new EventEmitter();
    child.pid = 1;
    setTimeout(async () => {
      await writeFile(join(dir, command === 'build b' ? 'public/b.css' : TW.output), command, 'utf8');
      child.emit('exit', 0);
    }, 0);
    return child;
  };
  const rules = [TW, second];
  let r = await regenerateOutputs(dir, { rules, spawn });
  assert.deepEqual(r.map((x) => [x.output, x.state, x.built, x.ok]), [
    ['public/tailwind.css', 'unrecorded', true, true],
    ['public/b.css', 'missing', true, true],
  ]);
  r = await regenerateOutputs(dir, { rules, spawn });
  assert.deepEqual(r.map((x) => x.built), [false, false]);
  r = await regenerateOutputs(dir, { rules, spawn, force: true });
  assert.deepEqual(r.map((x) => x.built), [true, true]);
});

test('regenerateOutputs: reports a failed rule', async () => {
  const dir = await app();
  const { spawn } = stubSpawn(dir, { code: 2, write: false });
  const [r] = await regenerateOutputs(dir, { rules: [TW], spawn });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'failed');
});

test('regenerateStatus: reads the rules from package.json and states each output', async () => {
  const dir = await app();
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'x', webjs: { dev: { regenerate: [TW, { output: 'public/none.css', command: 'x', inputs: [] }] } } }), 'utf8');
  assert.deepEqual((await regenerateStatus(dir)).map((s) => s.state), ['unrecorded', 'missing']);
  const { spawn } = stubSpawn(dir);
  await maybeRegenerate(dir, TW.output, [TW], { spawn });
  assert.deepEqual((await regenerateStatus(dir)).map((s) => s.state), ['fresh', 'missing']);
  await writeFile(join(dir, 'app', 'page.ts'), 'export default () => "p-4";', 'utf8');
  assert.equal((await regenerateStatus(dir))[0].state, 'stale');
});

test('isRegenerateOutputPath: matches a watcher filename against rule outputs (dev-reload carve-out)', () => {
  const rules = [{ output: 'public/tailwind.css', command: 'x', inputs: [] }];
  assert.equal(isRegenerateOutputPath('public/tailwind.css', rules), true);
  assert.equal(isRegenerateOutputPath('public\\tailwind.css', rules), true);
  assert.equal(isRegenerateOutputPath('app/page.ts', rules), false);
  assert.equal(isRegenerateOutputPath('public/input.css', rules), false);
  assert.equal(isRegenerateOutputPath('public/tailwind.css', []), false);
  assert.equal(isRegenerateOutputPath('', rules), false);
});

test('the output stat a record keeps is the one the build produced', async () => {
  const dir = await app();
  const { spawn } = stubSpawn(dir);
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  const st = await stat(join(dir, 'public', 'tailwind.css'));
  assert.equal((await readRegenerateManifest(dir)).outputs[TW.output].output, `${st.size}:${st.mtimeMs}`);
});
