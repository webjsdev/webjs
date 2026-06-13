/**
 * webjs check: one-action-per-configured-file (#488). A 'use server' file with
 * verb config must export exactly one callable action.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkConventions } from '../../src/check.js';

function app(files) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-1action-'));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(dir, rel); mkdirSync(join(abs, '..'), { recursive: true }); writeFileSync(abs, body);
  }
  return dir;
}
const has = (vs) => vs.some((v) => v.rule === 'one-action-per-configured-file');

test('flags two callable functions in a configured file', async () => {
  const dir = app({ 'a.server.ts': `'use server';\nexport const method='GET';\nexport async function getA(){return 1}\nexport async function getB(){return 2}\n` });
  assert.ok(has(await checkConventions(dir)), 'should flag two actions');
  rmSync(dir, { recursive: true, force: true });
});

test('does not flag a single action with config exports', async () => {
  const dir = app({ 'a.server.ts': `'use server';\nexport const method='GET';\nexport const cache=60;\nexport const tags=(id)=>['t'+id];\nexport const validate=(x)=>x;\nexport async function getA(id){return id}\n` });
  assert.equal(has(await checkConventions(dir)), false, 'config fns are not actions');
  rmSync(dir, { recursive: true, force: true });
});

test('does not flag a file with NO verb config (legacy multi-export)', async () => {
  const dir = app({ 'a.server.ts': `'use server';\nexport async function getA(){return 1}\nexport async function getB(){return 2}\n` });
  assert.equal(has(await checkConventions(dir)), false, 'no config => unaffected');
  rmSync(dir, { recursive: true, force: true });
});

test('counts an arrow-const action too', async () => {
  const dir = app({ 'a.server.ts': `'use server';\nexport const method='POST';\nexport const doA = async (x)=>x;\nexport async function doB(){return 1}\n` });
  assert.ok(has(await checkConventions(dir)), 'arrow + fn => two actions');
  rmSync(dir, { recursive: true, force: true });
});

test('counts a paren-less single-param arrow action', async () => {
  const dir = app({ 'a.server.ts': `'use server';\nexport const method='GET';\nexport const getA = id => id;\nexport async function getB(){return 1}\n` });
  assert.ok(has(await checkConventions(dir)), 'paren-less arrow + fn => two actions');
  rmSync(dir, { recursive: true, force: true });
});

test('a plain non-function const export is not counted as an action', async () => {
  const dir = app({ 'a.server.ts': `'use server';\nexport const method='GET';\nexport const MAX = 5;\nexport async function getA(id){return id+MAX}\n` });
  assert.equal(has(await checkConventions(dir)), false, 'a value const is not an action');
  rmSync(dir, { recursive: true, force: true });
});

test('counts a TYPE-ANNOTATED arrow action (#495)', async () => {
  const dir = app({ 'a.server.ts': `'use server';\nexport const method='GET';\nexport const getA: (id: number) => Promise<number> = async (id) => id;\nexport async function getB(){return 1}\n` });
  assert.ok(has(await checkConventions(dir)), 'annotated arrow + fn => two actions');
  rmSync(dir, { recursive: true, force: true });
});

test('a function-type annotation does not break the parse (single annotated action is fine)', async () => {
  const dir = app({ 'a.server.ts': `'use server';\nexport const method='GET';\nexport const getA: (n: number) => string = (n) => String(n);\n` });
  assert.equal(has(await checkConventions(dir)), false, 'one annotated action only => not flagged');
  rmSync(dir, { recursive: true, force: true });
});

test('a plain annotated value const is still NOT counted (#495)', async () => {
  const dir = app({ 'a.server.ts': `'use server';\nexport const method='GET';\nexport const MAX: number = 5;\nexport async function getA(id){return id+MAX}\n` });
  assert.equal(has(await checkConventions(dir)), false, 'an annotated value const is not an action');
  rmSync(dir, { recursive: true, force: true });
});
