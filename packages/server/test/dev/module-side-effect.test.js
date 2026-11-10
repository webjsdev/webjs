/**
 * `hasModuleScopeSideEffect` (#1689): whether a module runs code when it loads.
 * The dev hot swap refuses to pass an edit through a module that does
 * (`side-effect-module` in `dev-hot-classify.js`), since re-evaluating it at a
 * new version would repeat the effect in the open tab. The helper was lifted
 * from the component elision analyser when #1686 removed elision, so the
 * declaration-shape tables from that analyser's tests (#1567) come with it:
 * every declaration shape is paired with real top-level calls that must still
 * count, because the cheap way to pass the first half is to stop seeing calls.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hasModuleScopeSideEffect } from '../../src/module-side-effect.js';
import { stripTypeScript } from '../../src/ts-strip.js';

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

test('a pure-data constructor is inert, any other constructor is a side effect (#623)', () => {
  assert.equal(hasModuleScopeSideEffect('export const S = new Set([1, 2]);\nexport const R = new RegExp("x");'), false);
  assert.equal(hasModuleScopeSideEffect('export const ws = new WebSocket("wss://x");'), true);
});

test('a component registration and the WebComponent factory are not side effects', () => {
  const src = "import { WebComponent } from '@webjsdev/core';\nclass A extends WebComponent({ n: Number }) { render() { go(); } }\nA.register('a-b');";
  assert.equal(hasModuleScopeSideEffect(src), false);
  assert.equal(hasModuleScopeSideEffect('export const B = WebComponent({});'), true, 'outside `extends` the factory call counts');
});

test('top-level await and a dynamic import are side effects', () => {
  assert.equal(hasModuleScopeSideEffect('const x = await load();'), true);
  assert.equal(hasModuleScopeSideEffect("import('./x.js');"), true);
});

test('a typed data literal reads as inert once its types are erased (#1423)', async () => {
  const ts = 'export const POINTS: readonly (readonly [number, number, number])[] = [[1, 2, 3]];';
  assert.equal(hasModuleScopeSideEffect(await stripTypeScript(ts)), false);
});
