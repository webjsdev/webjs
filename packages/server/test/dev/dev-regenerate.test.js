/**
 * Unit tests for the on-request dev regeneration hook (#967): the generic,
 * styling-agnostic mechanism that rebuilds a stale build output (a scaffold's
 * static `public/tailwind.css`) ON REQUEST instead of relying on a live
 * `tailwindcss --watch` that can die mid-session and serve stale CSS.
 *
 * `spawn` is injected so no real compiler runs; mtimes are controlled with
 * real files + `utimes` so the freshness comparison is exercised directly.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir, utimes, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';

import {
  readRegenerateRules,
  maybeRegenerate,
  _resetInFlight,
} from '../../src/dev-regenerate.js';

const tmps = [];
async function tmpApp(pkg) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-regen-'));
  tmps.push(dir);
  await writeFile(join(dir, 'package.json'), JSON.stringify(pkg), 'utf8');
  return dir;
}

afterEach(async () => {
  _resetInFlight();
  while (tmps.length) await rm(tmps.pop(), { recursive: true, force: true });
});

// A spawn stub that records the commands it was asked to run and resolves the
// child immediately (exit 0). Returns a real-enough ChildProcess shape.
function recordingSpawn() {
  const calls = [];
  const spawn = (command, opts) => {
    calls.push({ command, cwd: opts.cwd, PATH: opts.env.PATH });
    const child = new EventEmitter();
    child.pid = 1234;
    // Fire exit on the next tick so the caller's `.on('exit')` is attached.
    queueMicrotask(() => child.emit('exit', 0));
    return child;
  };
  return { spawn, calls };
}

const TW = {
  output: 'public/tailwind.css',
  command: 'tailwindcss -i ./public/input.css -o ./public/tailwind.css --minify',
  inputs: ['app', 'components', 'public/input.css'],
};

test('readRegenerateRules: parses, normalizes a leading slash, defaults inputs', async () => {
  const dir = await tmpApp({
    name: 'x',
    webjs: { dev: { regenerate: [{ output: '/public/tailwind.css', command: 'build-css' }] } },
  });
  const rules = await readRegenerateRules(dir);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].output, 'public/tailwind.css'); // leading slash stripped
  assert.equal(rules[0].command, 'build-css');
  assert.deepEqual(rules[0].inputs, []); // missing inputs -> []
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

test('maybeRegenerate: runs the command when the output is MISSING', async () => {
  const dir = await tmpApp({ name: 'x' });
  await mkdir(join(dir, 'public'), { recursive: true });
  await writeFile(join(dir, 'public', 'input.css'), '@import "tailwindcss";', 'utf8');
  const { spawn, calls } = recordingSpawn();
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(calls.length, 1);
  assert.match(calls[0].command, /tailwindcss/);
  // PATH is augmented with node_modules/.bin so a local `tailwindcss` resolves.
  assert.match(calls[0].PATH, /node_modules/);
});

test('maybeRegenerate: SKIPS when the output is newer than every input (fresh)', async () => {
  const dir = await tmpApp({ name: 'x' });
  await mkdir(join(dir, 'app'), { recursive: true });
  await mkdir(join(dir, 'public'), { recursive: true });
  await writeFile(join(dir, 'app', 'page.ts'), 'export default () => 1;', 'utf8');
  await writeFile(join(dir, 'public', 'input.css'), '@import "tailwindcss";', 'utf8');
  await writeFile(join(dir, 'public', 'tailwind.css'), '/* built */', 'utf8');
  // Make the output distinctly newer than the sources.
  const past = new Date(Date.now() - 60_000);
  await utimes(join(dir, 'app', 'page.ts'), past, past);
  await utimes(join(dir, 'public', 'input.css'), past, past);
  const now = new Date();
  await utimes(join(dir, 'public', 'tailwind.css'), now, now);

  const { spawn, calls } = recordingSpawn();
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(calls.length, 0); // fresh: no compile
});

test('maybeRegenerate: RUNS when a source is newer than the output (stale)', async () => {
  const dir = await tmpApp({ name: 'x' });
  await mkdir(join(dir, 'app'), { recursive: true });
  await mkdir(join(dir, 'public'), { recursive: true });
  await writeFile(join(dir, 'public', 'input.css'), '@import "tailwindcss";', 'utf8');
  await writeFile(join(dir, 'public', 'tailwind.css'), '/* built */', 'utf8');
  // Output built in the past, a source edited now.
  const past = new Date(Date.now() - 60_000);
  await utimes(join(dir, 'public', 'input.css'), past, past);
  await utimes(join(dir, 'public', 'tailwind.css'), past, past);
  await writeFile(join(dir, 'app', 'page.ts'), 'export default () => "grid-cols-4";', 'utf8');
  const now = new Date();
  await utimes(join(dir, 'app', 'page.ts'), now, now);

  const { spawn, calls } = recordingSpawn();
  await maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn });
  assert.equal(calls.length, 1); // stale: recompiled
});

test('maybeRegenerate: no-op when no rule matches the requested path', async () => {
  const dir = await tmpApp({ name: 'x' });
  const { spawn, calls } = recordingSpawn();
  await maybeRegenerate(dir, 'public/other.css', [TW], { spawn });
  assert.equal(calls.length, 0);
});

test('maybeRegenerate: concurrent requests for the same stale output coalesce to ONE compile', async () => {
  const dir = await tmpApp({ name: 'x' });
  // No output on disk -> stale, so every call would compile without coalescing.
  let running = 0;
  let maxConcurrent = 0;
  const spawn = () => {
    running++;
    maxConcurrent = Math.max(maxConcurrent, running);
    const child = new EventEmitter();
    child.pid = 1;
    // Delay the exit so the three calls genuinely overlap.
    setTimeout(() => { running--; child.emit('exit', 0); }, 20);
    return child;
  };
  await Promise.all([
    maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn }),
    maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn }),
    maybeRegenerate(dir, 'public/tailwind.css', [TW], { spawn }),
  ]);
  assert.equal(maxConcurrent, 1); // one shared in-flight compile
});
