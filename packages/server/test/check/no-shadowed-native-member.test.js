import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { checkConventions, RULES } from '../../src/check.js';

/**
 * Tests for `no-shadowed-native-member`: a WebComponent method named after a
 * native DOM mutation method WebJs instruments for the light-DOM slot API (#1021)
 * is shadowed at runtime and silently never runs, while TypeScript stays green.
 * Found dogfooding the stream demo (a button handler named `append()`).
 */
const RULE = 'no-shadowed-native-member';

async function makeApp(files) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-shadow-native-'));
  for (const [rel, contents] of Object.entries(files)) {
    const abs = join(dir, rel);
    await mkdir(abs.slice(0, abs.lastIndexOf('/')), { recursive: true });
    await writeFile(abs, contents);
  }
  return dir;
}
const hits = (v) => v.filter((x) => x.rule === RULE);

test('the rule is registered', () => {
  assert.ok(RULES.some((r) => r.name === RULE), 'RULES lists no-shadowed-native-member');
});

test('flags a component method named after a native slot-instrumented method', async () => {
  const dir = await makeApp({
    'components/stream.ts': `import { WebComponent, html, renderStream } from '@webjsdev/core';
class Stream extends WebComponent {
  append() { renderStream('<webjs-stream action="append" target="l"></webjs-stream>'); }
  prepend() { renderStream('x'); }
  render() { return html\`<button @click=\${() => this.append()}>Add</button>\`; }
}
Stream.register('x-stream');`,
  });
  const v = hits(await checkConventions(dir));
  const names = v.map((x) => x.message.match(/`(\w+)`/)[1]).sort();
  assert.deepEqual(names, ['append', 'prepend'], 'flags both append and prepend');
  assert.match(v[0].fix, /Rename/);
});

test('does NOT flag a renamed handler or the lifecycle hooks (counterfactual)', async () => {
  const dir = await makeApp({
    'components/stream.ts': `import { WebComponent, html, renderStream } from '@webjsdev/core';
class Stream extends WebComponent {
  appendRow() { renderStream('x'); }
  prependRow() { renderStream('x'); }
  connectedCallback() { super.connectedCallback(); }
  render() { return html\`<button @click=\${() => this.appendRow()}>Add</button>\`; }
}
Stream.register('x-stream');`,
  });
  const v = hits(await checkConventions(dir));
  assert.equal(v.length, 0, 'appendRow/prependRow/connectedCallback/render are fine');
});

test('flags the Node-mutation members too (removeChild / insertBefore)', async () => {
  const dir = await makeApp({
    'components/x.ts': `import { WebComponent, html } from '@webjsdev/core';
class X extends WebComponent {
  removeChild() {}
  render() { return html\`<div></div>\`; }
}
X.register('x-x');`,
  });
  const v = hits(await checkConventions(dir));
  assert.equal(v.length, 1);
  assert.match(v[0].message, /removeChild/);
});

test('flags the factory form and the class-field function form', async () => {
  // The factory base (`extends WebComponent({...})`) is the shape every real
  // gallery component uses, and a class-field arrow is clobbered by the
  // connect-time interception install just like a method.
  const dir = await makeApp({
    'components/x.ts': `import { WebComponent, html, prop } from '@webjsdev/core';
class X extends WebComponent({ items: prop(Array) }) {
  remove = (id: number) => { this.items = this.items.filter((t) => t.id !== id); };
  render() { return html\`<div></div>\`; }
}
X.register('x-x');`,
  });
  const v = hits(await checkConventions(dir));
  assert.equal(v.length, 1, 'the class-field arrow on a factory-based class flags');
  assert.match(v[0].message, /`remove`/);
});

test('does NOT flag static members, nested object properties, or shadow components', async () => {
  const dir = await makeApp({
    // static: lives on the constructor, never shadowed.
    'components/a.ts': `import { WebComponent, html } from '@webjsdev/core';
class A extends WebComponent {
  static remove(id: string) { return id; }
  render() { return html\`<div></div>\`; }
}
A.register('x-a');`,
    // nested: an object-literal shorthand and a named function expression inside
    // a method body are another object's properties, not class members.
    'components/b.ts': `import { WebComponent, html } from '@webjsdev/core';
class B extends WebComponent {
  handlers() { return { remove(id: string) { return id; }, append() {} }; }
  wire() { this.addEventListener('x', function remove() {}); }
  render() { return html\`<div></div>\`; }
}
B.register('x-b');`,
    // shadow DOM: the slot interception installs only on light-DOM hosts.
    'components/c.ts': `import { WebComponent, html } from '@webjsdev/core';
class C extends WebComponent {
  static shadow = true;
  append() {}
  render() { return html\`<div></div>\`; }
}
C.register('x-c');`,
  });
  const v = hits(await checkConventions(dir));
  assert.equal(v.length, 0, `no false positives, got: ${v.map((x) => x.file).join(', ')}`);
});

test('does NOT flag a plain helper class sharing a file with a clean component', async () => {
  // Mixed file: the scan must stay scoped to WebComponent class bodies, so a
  // non-component helper class may use the native names freely.
  const dir = await makeApp({
    'components/mixed.ts': `import { WebComponent, html } from '@webjsdev/core';
class Registry {
  append(item: string) { return item; }
  remove(item: string) { return item; }
}
class Mixed extends WebComponent {
  render() { return html\`<div>\${new Registry().append('x')}</div>\`; }
}
Mixed.register('x-mixed');`,
  });
  const v = hits(await checkConventions(dir));
  assert.equal(v.length, 0, 'the helper class next to a component does not flag');
});
