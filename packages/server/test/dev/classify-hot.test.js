/**
 * Which dev edits hot-swap a component instead of reloading (#1689):
 * `hotSignature` reads what a swap cannot apply from a component's source, and
 * `findHotBoundaries` walks an edit up the shipped importer graph to the
 * component modules a tab re-imports. Every refusal is paired with the same
 * case minus its condition, which must hot-swap (the counterfactual).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hotSignature, findHotBoundaries, primeHotBaselines } from '../../src/dev-hot-classify.js';

const COMPONENT = (body = '', extra = '') => `
import { WebComponent, html } from '@webjsdev/core';
${extra}
class Counter extends WebComponent({ count: Number }) {
  constructor() { super(); this.count = 0; }
  ${body}
  render() { return html\`<button @click=\${() => { this.count++; }}>\${this.count}</button>\`; }
}
Counter.register('my-counter');
`;

/**
 * A small app: page -> counter -> util, page -> other -> util, an action the
 * counter imports, a side-effect helper, and a page-only helper.
 * @param {Record<string, string>} edited the NEW source of edited files
 */
function ctx(edited = {}) {
  const graph = {
    '/app/page.ts': ['/c/counter.ts', '/c/other.ts', '/lib/page-only.ts'],
    '/c/counter.ts': ['/lib/util.ts', '/a/save.server.ts', '/lib/effect.ts'],
    '/c/other.ts': ['/lib/util.ts'],
  };
  /** @type {Map<string, string[]>} */
  const importers = new Map();
  for (const [from, tos] of Object.entries(graph)) for (const to of tos) importers.set(to, [...(importers.get(to) || []), from]);
  const baseline = { '/c/counter.ts': hotSignature(COMPONENT()), '/c/other.ts': hotSignature(COMPONENT().replace(/Counter/g, 'Other')) };
  const current = { ...baseline };
  for (const [f, src] of Object.entries(edited)) current[f] = hotSignature(src);
  return {
    shipped: new Set(['/app/page.ts', ...Object.keys(graph).flatMap((f) => graph[f]), ...Object.keys(graph)]),
    componentFiles: new Set(['/c/counter.ts', '/c/other.ts']),
    routeFiles: new Set(['/app/page.ts']),
    importersOf: (f) => importers.get(f) || [],
    signatureOf: (f) => current[f] || null,
    baselineOf: (f) => baseline[f],
    sideEffectOf: (f) => f === '/lib/effect.ts',
  };
}

test('a component edit is its own boundary', async () => {
  const src = COMPONENT().replace('this.count++', 'this.count += 2');
  assert.deepEqual(await findHotBoundaries(['/c/counter.ts'], ctx({ '/c/counter.ts': src })), { ok: true, boundaries: ['/c/counter.ts'] });
});

test('a util imported only by components lists every importing component', async () => {
  assert.deepEqual(await findHotBoundaries(['/lib/util.ts'], ctx()), { ok: true, boundaries: ['/c/counter.ts', '/c/other.ts'] });
});

test('a util a shipping page imports has no boundary', async () => {
  assert.deepEqual(await findHotBoundaries(['/lib/page-only.ts'], ctx()), { ok: false, why: 'no-hot-boundary', by: '/app/page.ts' });
});

test('a module nothing shipped imports has no boundary', async () => {
  const c = ctx();
  c.shipped.add('/lib/orphan.ts');
  assert.deepEqual(await findHotBoundaries(['/lib/orphan.ts'], c), { ok: false, why: 'no-hot-boundary', by: '/lib/orphan.ts' });
});

test('a component with no shipped importer (an import-only page) is still a boundary', async () => {
  const c = ctx();
  c.importersOf = () => [];
  assert.deepEqual(await findHotBoundaries(['/c/counter.ts'], c), { ok: true, boundaries: ['/c/counter.ts'] });
});

test('a module-scope side effect on the walk reloads, and none hot-swaps (counterfactual)', async () => {
  assert.deepEqual(await findHotBoundaries(['/lib/effect.ts'], ctx()), { ok: false, why: 'side-effect-module', by: '/lib/effect.ts' });
  const c = ctx();
  c.sideEffectOf = () => false;
  assert.equal((await findHotBoundaries(['/lib/effect.ts'], c)).ok, true);
});

test('a use-server action a component imports hot-swaps', async () => {
  assert.deepEqual(await findHotBoundaries(['/a/save.server.ts'], ctx()), { ok: true, boundaries: ['/c/counter.ts'] });
});

test('a #private member reloads, and none hot-swaps (counterfactual)', async () => {
  const priv = COMPONENT('#seen = 0;\n  bump() { this.#seen++; }');
  const plain = COMPONENT('bump() { this.seen++; }');
  const base = ctx({ '/c/counter.ts': priv });
  assert.deepEqual(await findHotBoundaries(['/c/counter.ts'], base), { ok: false, why: 'private-members', by: '/c/counter.ts' });
  assert.equal((await findHotBoundaries(['/c/counter.ts'], ctx({ '/c/counter.ts': plain }))).ok, true);
});

test('a changed constructor reloads, an unchanged one hot-swaps (counterfactual)', async () => {
  const src = COMPONENT().replace('this.count = 0;', 'this.count = 10;');
  assert.deepEqual(await findHotBoundaries(['/c/counter.ts'], ctx({ '/c/counter.ts': src })), { ok: false, why: 'constructor-changed', by: '/c/counter.ts' });
  const reindented = COMPONENT().replace('constructor() { super(); this.count = 0; }', 'constructor() {\n    super();\n    this.count = 0;\n  }');
  assert.equal((await findHotBoundaries(['/c/counter.ts'], ctx({ '/c/counter.ts': reindented }))).ok, true, 'whitespace is not a change');
});

test('a changed instance field initializer reloads', async () => {
  const c = ctx({ '/c/counter.ts': COMPONENT('step = 2;') });
  c.baselineOf = () => hotSignature(COMPONENT('step = 1;'));
  assert.deepEqual(await findHotBoundaries(['/c/counter.ts'], c), { ok: false, why: 'instance-fields-changed', by: '/c/counter.ts' });
  c.baselineOf = () => hotSignature(COMPONENT('step = 2;'));
  assert.equal((await findHotBoundaries(['/c/counter.ts'], c)).ok, true);
});

test('a changed static shadow reloads', async () => {
  const c = ctx({ '/c/counter.ts': COMPONENT('static shadow = true;') });
  assert.deepEqual(await findHotBoundaries(['/c/counter.ts'], c), { ok: false, why: 'static-shadow-changed', by: '/c/counter.ts' });
  c.baselineOf = () => hotSignature(COMPONENT('static shadow = true;'));
  assert.equal((await findHotBoundaries(['/c/counter.ts'], c)).ok, true);
});

// Review of #1689: Prettier wraps a long initializer onto the next line, and a
// multi-line ternary spans several. Cutting the initializer at its first
// newline read `label =` both times, so a changed value hot-swapped and the
// live elements kept the old one.
test('a changed initializer that continues on the next line reloads', async () => {
  const cases = [
    ["label =\n    'Save';", "label =\n    'Submit';"],
    ['mode = this.count\n    ? 1\n    : 2;', 'mode = this.count\n    ? 1\n    : 3;'],
    ['items = [\n    1,\n  ]\n  .map((n) => n * 2);', 'items = [\n    1,\n  ]\n  .map((n) => n * 3);'],
  ];
  for (const [before, after] of cases) {
    const c = ctx({ '/c/counter.ts': COMPONENT(after) });
    c.baselineOf = () => hotSignature(COMPONENT(before));
    assert.deepEqual(await findHotBoundaries(['/c/counter.ts'], c), { ok: false, why: 'instance-fields-changed', by: '/c/counter.ts' }, after);
    c.baselineOf = () => hotSignature(COMPONENT(after));
    assert.equal((await findHotBoundaries(['/c/counter.ts'], c)).ok, true, `unchanged: ${after}`);
  }
  const shadow = ctx({ '/c/counter.ts': COMPONENT('static shadow =\n    true;') });
  shadow.baselineOf = () => hotSignature(COMPONENT('static shadow =\n    false;'));
  assert.deepEqual(await findHotBoundaries(['/c/counter.ts'], shadow), { ok: false, why: 'static-shadow-changed', by: '/c/counter.ts' });
});

test('a field with no semicolon still ends at its line, so the next member is its own', () => {
  const sig = hotSignature(COMPONENT("label = 'Save'\n  step = 1\n  shown = true"));
  assert.equal(sig.classes[0].fields, "label = 'Save'\nstep = 1\nshown = true");
});

test('a non-class export reloads, a class export hot-swaps (counterfactual)', async () => {
  const withConst = COMPONENT('', 'export const LIMIT = 3;');
  assert.deepEqual(await findHotBoundaries(['/c/counter.ts'], ctx({ '/c/counter.ts': withConst })), { ok: false, why: 'non-component-exports', by: '/c/counter.ts' });
  const exported = COMPONENT() + '\nexport { Counter };\nexport default Counter;\n';
  assert.equal((await findHotBoundaries(['/c/counter.ts'], ctx({ '/c/counter.ts': exported }))).ok, true);
});

test('a renamed or added class reloads', async () => {
  const renamed = COMPONENT().replace(/Counter/g, 'Clicker');
  assert.deepEqual(await findHotBoundaries(['/c/counter.ts'], ctx({ '/c/counter.ts': renamed })), { ok: false, why: 'class-set-changed', by: '/c/counter.ts' });
});

test('a component with no recorded baseline reloads', async () => {
  const c = ctx();
  c.baselineOf = () => undefined;
  assert.deepEqual(await findHotBoundaries(['/c/counter.ts'], c), { ok: false, why: 'no-hot-baseline', by: '/c/counter.ts' });
});

test('rel shapes the reported path', async () => {
  const c = ctx();
  c.rel = (f) => f.slice(1);
  assert.equal((await findHotBoundaries(['/lib/page-only.ts'], c)).by, 'app/page.ts');
});

test('hotSignature reads constructor, fields, shadow and private members off the class body', () => {
  const sig = hotSignature(`
class A extends WebComponent({ n: Number }) {
  static shadow = true;
  static styles = css\`
    :host { display: block }
  \`;
  label = 'x';
  onClick = () => {
    this.n++;
  };
  constructor() {
    super();
    this.n = 1;
  }
  render() { return html\`<p>\${'#notPrivate'}</p>\`; }
}
class B extends A { constructor() { super(); } }
`);
  assert.deepEqual(sig.classes.map((c) => c.name), ['A', 'B']);
  const [a, b] = sig.classes;
  assert.equal(a.ctor, 'constructor() { super(); this.n = 1; }');
  assert.equal(a.fields, "label = 'x'\nonClick = () => { this.n++; }");
  assert.equal(a.shadow, 'true');
  assert.equal(a.priv, false, 'a # inside a string is not a private member');
  assert.equal(b.ctor, 'constructor() { super(); }');
  assert.equal(sig.componentOnlyExports, true, 'no exports at all is component-only');
});

// Review of #1689: the baselines used to be read inside the analysis that gates
// the first request, which waited on a read and a strip per shipped component.
// They are now started in the background and awaited only by a later edit.
test('primeHotBaselines returns at once, and the boundary walk awaits a pending baseline', async () => {
  const baselines = new Map();
  let release;
  const gate = new Promise((r) => { release = r; });
  const reads = [];
  primeHotBaselines(['/c/counter.ts', '/c/other.ts'], baselines, async (f) => {
    reads.push(f);
    await gate;
    return hotSignature(f === '/c/counter.ts' ? COMPONENT() : COMPONENT().replace(/Counter/g, 'Other'));
  });
  assert.deepEqual(reads, ['/c/counter.ts', '/c/other.ts'], 'every read starts at once');
  assert.ok(baselines.get('/c/counter.ts') instanceof Promise, 'the entry holds the pending read');
  const c = ctx({ '/c/counter.ts': COMPONENT().replace('this.count = 0;', 'this.count = 10;') });
  c.baselineOf = (f) => baselines.get(f);
  const verdict = findHotBoundaries(['/c/counter.ts'], c);
  release();
  assert.deepEqual(await verdict, { ok: false, why: 'constructor-changed', by: '/c/counter.ts' }, 'compared against the baseline once it lands');
  assert.equal(baselines.get('/c/counter.ts').classes[0].name, 'Counter', 'and the settled read replaces the promise');
});

test('a baseline read that lands after a newer signature does not overwrite it', async () => {
  const baselines = new Map();
  let release;
  const gate = new Promise((r) => { release = r; });
  primeHotBaselines(['/c/counter.ts'], baselines, async () => { await gate; return hotSignature(COMPONENT()); });
  const newer = hotSignature(COMPONENT('step = 2;'));
  baselines.set('/c/counter.ts', newer);
  release();
  await gate;
  await new Promise((r) => setImmediate(r));
  assert.equal(baselines.get('/c/counter.ts'), newer);
  primeHotBaselines(['/c/counter.ts'], baselines, () => { throw new Error('a recorded file is not read again'); });
});
