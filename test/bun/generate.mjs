/**
 * Cross-runtime proof of `webjs generate` (#1692): the generator, the
 * `db generate` it spawns with the current runtime, and the generated tests
 * (which `webjs test` runs under `bun test` on Bun and `node --test` on Node)
 * all work on this runtime. Run under both:
 *
 *   node test/bun/generate.mjs
 *   bun  test/bun/generate.mjs
 *
 * A plain assert script (not node:test) so the SAME file runs on both
 * runtimes; it exits non-zero on failure and spawns the real CLI by path,
 * with the fixture's node_modules linked to this checkout's.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scaffoldApp } from '../../packages/cli/lib/create.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = join(ROOT, 'packages/cli/bin/webjs.js');
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

const env = { ...process.env };
delete env.DATABASE_URL;
delete env.WEBJS_TEST_DB;
delete env.NODE_TEST_CONTEXT;

const cwd = mkdtempSync(join(tmpdir(), 'webjs-generate-bun-'));
try {
  const log = console.log;
  console.log = () => {};
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack', install: false });
  } finally {
    console.log = log;
  }
  const app = join(cwd, 'demo');
  symlinkSync(join(ROOT, 'node_modules'), join(app, 'node_modules'));
  const cli = (...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: app, env, encoding: 'utf8' });
  const out = (r) => r.stdout + r.stderr;

  const post = cli('g', 'scaffold', 'post', 'title:string!', 'body:text', 'published:boolean', 'slug:string:uniq');
  assert.equal(post.status, 0, out(post));
  assert.ok(existsSync(join(app, 'db', 'migrations')), 'db generate ran under ' + runtime);
  const product = cli('g', 'resource', 'product', 'name:string!', 'price:float');
  assert.equal(product.status, 0, out(product));

  const tests = cli('test', '--server');
  assert.equal(tests.status, 0, out(tests));
  const text = out(tests);
  // `bun test` names the files it ran; `node --test` names each passing test.
  if (process.versions.bun) {
    assert.match(text, /test\/posts\/posts\.test\.ts:/);
    assert.match(text, /test\/products\/products\.test\.ts:/);
    assert.match(text, /\n\s*0 fail\n/);
  } else {
    assert.match(text, /create, show, edit and delete a post through its forms/);
    assert.match(text, /create, read, update and delete a product over JSON/);
  }
  console.log(`ok generate: scaffold and resource output passes its tests on ${runtime}`);
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
