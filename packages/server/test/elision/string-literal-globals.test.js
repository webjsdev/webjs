/**
 * A browser global's NAME inside a string literal is data, not a reference
 * (#1666). The kit's Lucide icon file carries
 * `class=${'lucide lucide-app-window' + ...}`, and the client-global scans used
 * to read string bodies and template text verbatim, so that one class string
 * marked the whole icon module as client work and every page importing it
 * shipped whole.
 *
 * Each "not flagged" test fails on the pre-fix analyser (the counterfactual):
 * it scanned a non-route module's comment-masked source and a component's
 * comment-masked source, both of which keep string and template content. The
 * "flagged" tests prove the scans still see a real reference in code, both at
 * module scope and inside a `${...}` hole, which the placeholder redaction
 * keeps as code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyzeElision, analyzeComponentSource } from '../../src/component-elision.js';

const GLOBALS = ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'customElements', 'matchMedia', 'addEventListener'];
// `customElements` is legitimate in a component (its registration), so the
// component scan omits it by design; test the rest there.
const COMPONENT_GLOBALS = GLOBALS.filter((g) => g !== 'customElements');

function graphOf(edges) {
  const g = new Map();
  for (const [from, tos] of Object.entries(edges)) g.set(from, new Set(tos));
  return g;
}

const verdict = (r, f) =>
  r.inertRouteModules.has(f) ? 'inert' : r.importOnlyRouteModules.has(f) ? 'import-only' : 'ships';

const PAGE = `
import { html } from '@webjsdev/core';
import { Icon } from '../lib/icon.js';
export default () => html\`<p>\${Icon()}</p>\`;
`;

/** Page importing one helper module whose source is `util`. */
async function pageVerdict(util, file = '/app/lib/icon.js') {
  const files = { '/app/page.js': PAGE, [file]: util };
  const r = await analyzeElision([], ['/app/page.js'], graphOf({ '/app/page.js': [file] }), async (f) => files[f], '/app');
  return verdict(r, '/app/page.js');
}

function component(renderBody, extra = '') {
  return `
import { WebComponent, html } from '@webjsdev/core';
${extra}
class XIcon extends WebComponent {
  render() { ${renderBody} }
}
XIcon.register('x-icon');
`;
}

for (const g of GLOBALS) {
  test(`helper: '${g}' inside a string in a template hole does not pin the page`, async () => {
    const util = `
import { html } from '@webjsdev/core';
export function Icon(cls = '') {
  return html\`<svg class=\${'lucide lucide-app-${g}' + (cls ? ' ' + cls : '')}></svg>\`;
}
`;
    assert.equal(await pageVerdict(util), 'inert');
  });

  test(`helper: '${g}' in a module-scope string constant and template text does not pin the page`, async () => {
    const util = `
import { html } from '@webjsdev/core';
const LABEL = "open ${g}";
const ALT = \`${g} panel\`;
export function Icon() { return html\`<span title=\${LABEL + ALT}>${g}</span>\`; }
`;
    assert.equal(await pageVerdict(util), 'inert');
  });
}

test('helper: a TypeScript icon file with the string is inert too (type-erased first)', async () => {
  const util = `
import { html } from '@webjsdev/core';
export function Icon(cls: string = ''): unknown {
  return html\`<svg class=\${'lucide lucide-app-window' + (cls ? ' ' + cls : '')}></svg>\`;
}
`;
  const files = { '/app/page.js': PAGE.replace('icon.js', 'icon.ts'), '/app/lib/icon.ts': util };
  const r = await analyzeElision([], ['/app/page.js'], graphOf({ '/app/page.js': ['/app/lib/icon.ts'] }), async (f) => files[f], '/app');
  assert.equal(verdict(r, '/app/page.js'), 'inert');
});

test('helper: a real module-scope window reference still pins the page', async () => {
  const util = `
import { html } from '@webjsdev/core';
const wide = typeof window !== 'undefined' && window.innerWidth > 800;
export function Icon() { return html\`<svg data-wide=\${wide}></svg>\`; }
`;
  assert.equal(await pageVerdict(util), 'ships');
});

test('helper: a real global inside a template hole still pins the page', async () => {
  const util = `
import { html } from '@webjsdev/core';
export function Icon() { return html\`<svg title=\${document.title}></svg>\`; }
`;
  assert.equal(await pageVerdict(util), 'ships');
});

test('helper: a global inside a function body still pins the page (unchanged)', async () => {
  const util = `
export function Icon() { return localStorage.getItem('icon'); }
`;
  assert.equal(await pageVerdict(util), 'ships');
});

for (const g of COMPONENT_GLOBALS) {
  test(`component: '${g}' inside a string in a template hole is display-only`, () => {
    const r = analyzeComponentSource(component(`return html\`<i class=\${'icon-${g}'}></i>\`;`));
    assert.equal(r.interactive, false, r.reason ?? '');
  });

  test(`component: '${g}' in template text is display-only`, () => {
    const r = analyzeComponentSource(component(`return html\`<p>${g}</p>\`;`, `const T = '${g}';`));
    assert.equal(r.interactive, false, r.reason ?? '');
  });
}

test('component: a real global inside a template hole still ships', () => {
  const r = analyzeComponentSource(component('return html`<p>${window.innerWidth}</p>`;'));
  assert.equal(r.interactive, true);
  assert.equal(r.reason, 'references a browser global at module scope');
});

test('component: a global reached through a string key on globalThis still ships', () => {
  // The redaction blanks the key, and globalThis exists on the server, so
  // this form is read from the raw source.
  for (const access of [`globalThis['matchMedia']`, `globalThis["document"]`, 'self[`navigator`]', `globalThis?.['localStorage']`]) {
    const r = analyzeComponentSource(component(`return html\`<p>\${${access} ? 'a' : 'b'}</p>\`;`));
    assert.equal(r.interactive, true, access);
    assert.equal(r.reason, 'references a browser global at module scope', access);
  }
  const plain = analyzeComponentSource(component(`return html\`<p>\${globalThis['webjsAppName'] ?? ''}</p>\`;`));
  assert.equal(plain.interactive, false, 'a key that is not a browser global stays display-only');
});

test('component: a real module-scope global still ships', () => {
  const r = analyzeComponentSource(component('return html`<p>x</p>`;', 'const nav = navigator.language;'));
  assert.equal(r.interactive, true);
});

test('component: an @event in template text still ships (template content still counts for events)', () => {
  const r = analyzeComponentSource(component('return html`<button @click=${() => {}}>window</button>`;'));
  assert.equal(r.interactive, true);
});
