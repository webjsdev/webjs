/**
 * Tests for the prefer-reactive-prop-over-getattribute rule. webjs components
 * are lit-shaped: read own config through a reactive property, not via the
 * vanilla this.getAttribute('name'). The rule flags literal, non-allowlisted
 * own-attribute reads and steers to a reactive prop.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { checkConventions } from '../../src/check.js';

async function appWith(rel, contents) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-rp-'));
  const filePath = join(dir, rel);
  await mkdir(filePath.slice(0, filePath.lastIndexOf('/')), { recursive: true });
  await writeFile(filePath, contents);
  return dir;
}
const find = (vs, file) => vs.filter((v) => v.rule === 'prefer-reactive-prop-over-getattribute' && v.file.includes(file));

test('flags this.getAttribute for own config in a component', async () => {
  const dir = await appWith('components/tip.ts', `
import { WebComponent, html } from '@webjsdev/core';
export class Tip extends WebComponent {
  show() {
    const d = Number(this.getAttribute('delay-duration') ?? 700);
    return d;
  }
  render() { return html\`<p></p>\`; }
}
Tip.register('tip-el');
`);
  try {
    const v = find(await checkConventions(dir), 'tip.ts');
    assert.ok(v.some((x) => x.message.includes("this.getAttribute('delay-duration')")), 'own-config getAttribute flagged');
    assert.ok(v.some((x) => x.fix.includes('delayDuration')), 'fix names the camelCase reactive prop');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('does NOT flag allowlisted standard attributes (class) or aria-/data-', async () => {
  const dir = await appWith('components/ok.ts', `
import { WebComponent, html } from '@webjsdev/core';
export class Ok extends WebComponent {
  render() {
    const c = this.getAttribute('class') ?? '';
    const a = this.getAttribute('aria-label');
    const d = this.getAttribute('data-x');
    return html\`<p>\${c}\${a}\${d}</p>\`;
  }
}
Ok.register('ok-el');
`);
  try {
    assert.equal(find(await checkConventions(dir), 'ok.ts').length, 0, 'class / aria-* / data-* must not be flagged');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('does NOT flag a read off another element, or a dynamic name', async () => {
  const dir = await appWith('components/other.ts', `
import { WebComponent, html } from '@webjsdev/core';
export class Other extends WebComponent {
  _read(host, key) {
    const a = host.getAttribute('side');     // another element
    const b = this.getAttribute(key);        // dynamic name
    return [a, b];
  }
  render() { return html\`<p></p>\`; }
}
Other.register('other-el');
`);
  try {
    assert.equal(find(await checkConventions(dir), 'other.ts').length, 0, 'another element + dynamic name must not be flagged');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('counterfactual control: a reactive-prop component is not flagged', async () => {
  const dir = await appWith('components/clean.ts', `
import { WebComponent, html } from '@webjsdev/core';
export class Clean extends WebComponent {
  static properties = { delayDuration: { type: Number } };
  declare delayDuration;
  constructor() { super(); this.delayDuration = 700; }
  show() { return this.delayDuration; }
  render() { return html\`<p></p>\`; }
}
Clean.register('clean-el');
`);
  try {
    assert.equal(find(await checkConventions(dir), 'clean.ts').length, 0, 'reading the reactive prop is the correct, unflagged form');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
