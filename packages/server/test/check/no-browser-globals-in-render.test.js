/**
 * Tests for the no-browser-globals-in-render rule (issue #186). The SSR
 * pipeline runs a component's constructor and render() on a bare server-side
 * class with no DOM, so a browser global or an HTMLElement member touched
 * there throws at SSR time. The rule flags those; it must NOT flag the same
 * access in connectedCallback / lifecycle hooks (which SSR never calls).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { checkConventions } from '../../src/check.js';

async function appWith(rel, contents) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-bg-'));
  const filePath = join(dir, rel);
  await mkdir(filePath.slice(0, filePath.lastIndexOf('/')), { recursive: true });
  await writeFile(filePath, contents);
  return dir;
}
const find = (vs, file) => vs.filter((v) => v.rule === 'no-browser-globals-in-render' && v.file.includes(file));

test('flags document used in render()', async () => {
  const dir = await appWith('components/bad.ts', `
import { WebComponent, html } from '@webjsdev/core';
export class Bad extends WebComponent {
  render() {
    const w = document.querySelector('x');
    return html\`<p>\${w}</p>\`;
  }
}
Bad.register('bad-el');
`);
  try {
    const v = find(await checkConventions(dir), 'bad.ts');
    assert.ok(v.length >= 1, 'document in render must be flagged');
    assert.ok(v.some((x) => x.message.includes('document') && x.message.includes('render')), 'message names the member and method');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('flags a browser global in the constructor', async () => {
  const dir = await appWith('components/ctor.ts', `
import { WebComponent, html } from '@webjsdev/core';
export class Ctor extends WebComponent {
  constructor() {
    super();
    this.dark = matchMedia('(prefers-color-scheme: dark)').matches;
  }
  render() { return html\`<p></p>\`; }
}
Ctor.register('ctor-el');
`);
  try {
    const v = find(await checkConventions(dir), 'ctor.ts');
    assert.ok(v.some((x) => x.message.includes('matchMedia') && x.message.includes('constructor')), 'matchMedia in constructor flagged');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('flags this.attachShadow (an HTMLElement member) in render', async () => {
  const dir = await appWith('components/shadow.ts', `
import { WebComponent, html } from '@webjsdev/core';
export class Sh extends WebComponent {
  render() {
    this.attachShadow({ mode: 'open' });
    return html\`<p></p>\`;
  }
}
Sh.register('sh-el');
`);
  try {
    const v = find(await checkConventions(dir), 'shadow.ts');
    assert.ok(v.some((x) => x.message.includes('this.attachShadow')), 'this.attachShadow flagged');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('flags a browser global in willUpdate (it now runs at SSR)', async () => {
  // willUpdate runs server-side as of #217, so a browser-only API there crashes
  // SSR just like in the constructor / render. The rule must catch it.
  const dir = await appWith('components/wu.ts', `
import { WebComponent, html } from '@webjsdev/core';
export class Wu extends WebComponent {
  willUpdate() {
    this.w = window.innerWidth;
  }
  render() { return html\`<p>\${this.w}</p>\`; }
}
Wu.register('wu-el');
`);
  try {
    const v = find(await checkConventions(dir), 'wu.ts');
    assert.ok(v.some((x) => x.message.includes('window') && x.message.includes('willUpdate')), 'window in willUpdate flagged');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('does NOT flag attribute / event / internals methods in render (backed by the SSR shim)', async () => {
  // The narrowing for #217: these used to be flagged, but the server element
  // shim now backs them, so reading attributes in render and reflecting /
  // wiring internals during the SSR update cycle is legal and must not warn.
  const dir = await appWith('components/shimmed.ts', `
import { WebComponent, html } from '@webjsdev/core';
export class Shimmed extends WebComponent {
  constructor() { super(); this.addEventListener('click', () => {}); this.attachInternals(); }
  render() {
    const m = this.hasAttribute('mode') ? this.getAttribute('mode') : 'x';
    this.setAttribute('data-m', m);
    return html\`<p>\${m}</p>\`;
  }
}
Shimmed.register('shimmed-el');
`);
  try {
    const v = find(await checkConventions(dir), 'shimmed.ts');
    assert.equal(v.length, 0, `attribute/event/internals methods must NOT be flagged; got ${JSON.stringify(v.map((x) => x.message))}`);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('does NOT flag document used in connectedCallback (SSR never calls it)', async () => {
  const dir = await appWith('components/ok.ts', `
import { WebComponent, html } from '@webjsdev/core';
export class Ok extends WebComponent {
  constructor() { super(); this.w = 0; }
  connectedCallback() {
    super.connectedCallback();
    this.w = window.innerWidth;
    document.title = 'x';
  }
  firstUpdated() { this.scrollIntoView(); }
  render() { return html\`<p>\${this.w}</p>\`; }
}
Ok.register('ok-el');
`);
  try {
    const v = find(await checkConventions(dir), 'ok.ts');
    assert.equal(v.length, 0, `browser globals in connectedCallback/firstUpdated must NOT be flagged; got ${JSON.stringify(v.map((x) => x.message))}`);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('counterfactual control: a clean component is not flagged', async () => {
  const dir = await appWith('components/clean.ts', `
import { WebComponent, html } from '@webjsdev/core';
export class Clean extends WebComponent {
  static properties = { name: { type: String } };
  declare name;
  constructor() { super(); this.name = ''; }
  render() { return html\`<p>hello \${this.name}</p>\`; }
}
Clean.register('clean-el');
`);
  try {
    assert.equal(find(await checkConventions(dir), 'clean.ts').length, 0, 'a clean component must not be flagged');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('does not match a browser word inside a string or template (redacted)', async () => {
  const dir = await appWith('components/strs.ts', `
import { WebComponent, html } from '@webjsdev/core';
export class Strs extends WebComponent {
  render() {
    const label = 'open the document';
    return html\`<p>window and document are fine here: \${label}</p>\`;
  }
}
Strs.register('strs-el');
`);
  try {
    assert.equal(find(await checkConventions(dir), 'strs.ts').length, 0, 'browser words inside strings/templates must not be flagged');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
