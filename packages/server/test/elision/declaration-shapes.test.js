/**
 * Declarations that LOOK like top-level calls must not read as module-load
 * work (#1567).
 *
 * `hasModuleScopeSideEffect` keeps only the brace-depth-0 text of a module and
 * treats any `ident(` left there as a call that runs when the module loads. Two
 * declaration shapes leave such text behind without running anything: the
 * expression body of an arrow that initializes a declarator
 * (`export const usd = (m) => Math.round(m) / MICROS`) and a call in a
 * `function` declaration's parameter default (`now = Date.now()`). Read as
 * calls, they shipped every page that imported a formatting helper, along with
 * that page's whole import graph.
 *
 * Every declaration shape is paired with real top-level calls that must keep
 * shipping, because the cheap way to make the first half pass is to stop
 * seeing calls at all. Reverting the frame blanking in `component-elision.js`
 * reds the declaration tests and the route test and nothing else.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyzeElision, hasModuleScopeSideEffect } from '../../src/component-elision.js';

const DECLARATIONS = {
  'expression-bodied arrow': 'const MICROS = 1e6;\nexport const usd = (m) => Math.round(m) / MICROS;',
  'parenthesised arrow body': 'const one = (v) => (Array.isArray(v) ? v[0] : v);',
  'arrow body on the next line': 'export const one = (v) =>\n  Array.isArray(v) ? v[0] : v;\nexport const two = 2;',
  'leading-operator ternary body': 'const f = (v) =>\n  isX(v)\n    ? fmt(v)\n    : other(v);\n',
  'trailing-operator body': 'const ok = (v) => v.ok &&\n  check(v);',
  'async arrow and a second declarator': 'const a = async (v) => await load(v), b = (x) => g(x);',
  'curried arrow': 'const add = (a) => (b) => sum(a, b);',
  'arrow returning a constructor': 'const mk = (u) => new WebSocket(u);',
  'type-erased arrow': 'export const usd = (m        )         => Math.round(m);',
  'function parameter default': 'export function relativeTime(when, now = Date.now()) { return now - when; }',
  'parameter default calling a helper': 'export function buildSearchIndex(pages = livePages()) { return pages; }',
  'async generator parameter default': 'async function* gen(a = x()) { yield a; }',
  'block-bodied arrow': 'const f = (v) => {\n  return g(v);\n}\nconst z = 1;',
};

const CALLS = {
  'a declarator calling a helper': "const x = planById('free');",
  'a method call on data': 'export const A = LIST.filter((p) => p.ok);',
  'a bare call': 'foo();',
  'a call after an arrow statement': 'const f = () => x; f();',
  'a call on the line after an arrow (no semicolon)': 'const f = () => x\nf()',
  'a call after a block-bodied arrow': 'const f = (v) => {\n  return g(v);\n}\nfoo();',
  'an arrow IIFE': '(() => { go(); })();',
  'an immediately invoked arrow initializer': 'export const y = (() => 1)();',
  'a call in the declarator after an arrow': 'const g = (a) => a, h = init();',
  'a call in an arrow parameter default': 'const f = (a = init()) => a;',
  'a call after a postfix increment ends the body': 'const f = (v) => v++\ninit();',
  'a call after a regex literal ends the body': 'const r = () => /x/\ninit();',
  'a call after a function declaration': 'function f() {}\ninit();',
  'an invoked function expression': 'const x = function (a = 1) { return a; }();',
  'a function IIFE with a parameter default': '(function (a = b()) {})();',
  'a call after a conditional arrow': 'const k = cond ? (a) => f(a) : null;\nfoo();',
};

for (const [name, src] of Object.entries(DECLARATIONS)) {
  test(`declaration, not a load-time call: ${name}`, () => {
    assert.equal(hasModuleScopeSideEffect(src), false, src);
  });
}

for (const [name, src] of Object.entries(CALLS)) {
  test(`still a load-time call: ${name}`, () => {
    assert.equal(hasModuleScopeSideEffect(src), true, src);
  });
}

test('a page importing a formatting helper module does not ship for it', async () => {
  const format = `const MICROS = 1_000_000;
export const usd = (m) => '$' + (Math.round(m / 10_000) / 100).toFixed(2);
export function relativeTime(when, now = Date.now()) {
  return Math.round((now - when) / 1000) + 's ago';
}`;
  const page = `import { html } from '@webjsdev/core';
import { usd, relativeTime } from './format.js';
export default ({ cost, at }) => html\`<p>\${usd(cost)} \${relativeTime(at)}</p>\`;`;
  const files = { '/app/page.js': page, '/app/format.js': format };
  const r = await analyzeElision(
    [],
    ['/app/page.js'],
    new Map([['/app/page.js', new Set(['/app/format.js'])]]),
    async (f) => files[f],
    '/app',
  );
  assert.ok(r.inertRouteModules.has('/app/page.js'), 'the page must be inert');
});
