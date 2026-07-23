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
  const names = v.map((x) => x.message.match(/`(\w+)\(\)`/)[1]).sort();
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
