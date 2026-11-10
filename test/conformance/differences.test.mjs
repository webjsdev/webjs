/**
 * The conformance differences manifest (#1686). Every reference behaviour
 * WebJs deliberately does not match is listed in `differences.json` with the
 * docs page and element id that state it. This fails when an entry is
 * malformed or its statement is gone from the page, so a difference cannot be
 * dropped from the docs while the code still behaves that way.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DOCS = join(here, '../../website/app/(site)/docs');
const { differences } = JSON.parse(readFileSync(join(here, 'differences.json'), 'utf8'));

test('every difference names a reference, a category and a docs statement', () => {
  assert.ok(differences.length > 0);
  const ids = new Set();
  for (const d of differences) {
    assert.ok(['next', 'lit', 'authjs'].includes(d.reference), `${d.id}: reference`);
    assert.ok(['by-design', 'not-applicable'].includes(d.category), `${d.id}: category`);
    assert.ok(typeof d.behaviour === 'string' && d.behaviour.length > 0, `${d.id}: behaviour`);
    assert.ok(!ids.has(d.id), `${d.id}: duplicate id`);
    ids.add(d.id);
  }
});

test('each stated difference is still on its docs page', () => {
  for (const d of differences) {
    const page = join(DOCS, d.doc, 'page.ts');
    assert.ok(existsSync(page), `${d.id}: docs page ${d.doc} exists`);
    const src = readFileSync(page, 'utf8');
    assert.match(src, new RegExp(`id="${d.id}"`), `${d.id}: stated on /docs/${d.doc}`);
  }
});
