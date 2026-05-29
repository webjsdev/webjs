/**
 * Unit tests for the serve-time import stripper. It removes side-effect
 * imports of elidable components so the browser never downloads them,
 * while leaving binding imports and non-elidable imports intact.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { elideImportsFromSource } from '../../src/component-elision.js';

const appDir = '/app';
const BADGE = '/app/components/badge.js';
const COUNTER = '/app/components/counter.js';

// Deterministic resolver: './components/badge.js' from /app/page.js -> /app/components/badge.js
function resolver(spec, fromFile) {
  return spec.replace(/^\.\//, '/app/').replace(/^\.\.\//, '/app/');
}

const graph = new Map([['/app/page.js', new Set([BADGE, COUNTER])]]);
const elidable = new Set([BADGE]);

test('side-effect import of an elidable component is stripped', () => {
  const src = [
    `import { html } from '@webjsdev/core';`,
    `import './components/badge.js';`,
    `import './components/counter.js';`,
    `export default () => html\`<x-badge></x-badge>\`;`,
  ].join('\n');
  const out = elideImportsFromSource(src, '/app/page.js', graph, elidable, resolver, appDir);
  assert.doesNotMatch(out, /import '\.\/components\/badge\.js'/);
  assert.match(out, /webjs: elided display-only component/);
  // Non-elidable import survives.
  assert.match(out, /import '\.\/components\/counter\.js'/);
  // Line count preserved so any positions downstream stay stable.
  assert.equal(out.split('\n').length, src.split('\n').length);
});

test('binding import of an elidable component is NOT stripped', () => {
  const src = `import { Badge } from './components/badge.js';\nconst x = Badge;`;
  const out = elideImportsFromSource(src, '/app/page.js', graph, elidable, resolver, appDir);
  assert.equal(out, src);
});

test('fast path: empty elidable set returns source unchanged', () => {
  const src = `import './components/badge.js';`;
  const out = elideImportsFromSource(src, '/app/page.js', graph, new Set(), resolver, appDir);
  assert.equal(out, src);
});

test('importer not in the module graph is returned unchanged', () => {
  const src = `import './components/badge.js';`;
  const out = elideImportsFromSource(src, '/app/other.js', graph, elidable, resolver, appDir);
  assert.equal(out, src);
});

test('importer with no elidable dependency skips the rewrite', () => {
  const g = new Map([['/app/page.js', new Set([COUNTER])]]);
  const src = `import './components/counter.js';`;
  const out = elideImportsFromSource(src, '/app/page.js', g, elidable, resolver, appDir);
  assert.equal(out, src);
});

test('an import-looking line inside a template literal is NOT stripped', () => {
  // A docs page demonstrating the feature might render the literal text
  // `import './components/badge.js';` inside an html`` template. The
  // stripper must not rewrite it, even though the specifier resolves to
  // an elidable file. Only the real top-level import is removed.
  const src = [
    `import './components/badge.js';`,
    'export default () => html`',
    `  <pre>import './components/badge.js';</pre>`,
    '`;',
  ].join('\n');
  const out = elideImportsFromSource(src, '/app/page.js', graph, elidable, resolver, appDir);
  // The real top-level import is gone.
  assert.match(out, /webjs: elided display-only component/);
  // The text inside the template survives verbatim.
  assert.match(out, /<pre>import '\.\/components\/badge\.js';<\/pre>/);
});

test('an import-looking line inside a comment is NOT stripped', () => {
  const src = [
    `// import './components/badge.js';`,
    `import './components/counter.js';`,
  ].join('\n');
  const out = elideImportsFromSource(src, '/app/page.js', graph, elidable, resolver, appDir);
  assert.match(out, /\/\/ import '\.\/components\/badge\.js';/);
  assert.match(out, /import '\.\/components\/counter\.js';/);
});

test('double-quoted and semicolon-less side-effect imports are handled', () => {
  const src = `import "./components/badge.js"\nimport './components/counter.js';`;
  const out = elideImportsFromSource(src, '/app/page.js', graph, elidable, resolver, appDir);
  assert.doesNotMatch(out, /badge\.js/);
  assert.match(out, /counter\.js/);
});
