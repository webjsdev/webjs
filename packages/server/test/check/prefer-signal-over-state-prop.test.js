/**
 * Tests for prefer-signal-over-state-prop. webjs reserves reactive properties
 * for attribute-backed values; internal reactive state with no attribute is a
 * signal (invariant 5). A `state: true` reactive property is the lit idiom
 * webjs replaces with a signal.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { checkConventions } from '../../src/check.js';

async function appWith(rel, contents) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-ss-'));
  const filePath = join(dir, rel);
  await mkdir(filePath.slice(0, filePath.lastIndexOf('/')), { recursive: true });
  await writeFile(filePath, contents);
  return dir;
}
const find = (vs, file) => vs.filter((v) => v.rule === 'prefer-signal-over-state-prop' && v.file.includes(file));

test('flags a state: true reactive property', async () => {
  const dir = await appWith('components/s.ts', `
import { WebComponent, html } from '@webjsdev/core';
export class S extends WebComponent {
  static properties = { open: { type: Boolean, state: true } };
  declare open;
  render() { return html\`<p></p>\`; }
}
S.register('s-el');
`);
  try {
    assert.equal(find(await checkConventions(dir), 's.ts').length, 1, 'state: true must be flagged');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('counterfactual: a signal-backed component (no state: true) is not flagged', async () => {
  const dir = await appWith('components/sig.ts', `
import { WebComponent, html, signal } from '@webjsdev/core';
export class Sig extends WebComponent {
  open = signal(false);
  render() { return html\`<p>\${this.open.get()}</p>\`; }
}
Sig.register('sig-el');
`);
  try {
    assert.equal(find(await checkConventions(dir), 'sig.ts').length, 0, 'a signal is the correct, unflagged form');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('does not flag an attribute-backed reactive prop (reflect, no state)', async () => {
  const dir = await appWith('components/attr.ts', `
import { WebComponent, html } from '@webjsdev/core';
export class Attr extends WebComponent {
  static properties = { open: { type: Boolean, reflect: true } };
  declare open;
  constructor() { super(); this.open = false; }
  render() { return html\`<p></p>\`; }
}
Attr.register('attr-el');
`);
  try {
    assert.equal(find(await checkConventions(dir), 'attr.ts').length, 0, 'attribute-backed reactive props are correct');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
