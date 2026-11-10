/**
 * `core-imports-exist`: a named import from `@webjsdev/core` of a name the
 * installed core does not export is a load-time crash, so it is flagged with
 * the WebJs fix. The rule reads the real export surface, so these tests run
 * against the workspace's own core.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

import { checkConventions, RULES } from '../../src/check.js';
import { coreSurface } from '../../src/core-exports.js';

async function appWith(files) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-core-imports-'));
  for (const [rel, body] of Object.entries(files)) {
    await mkdir(dirname(join(dir, rel)), { recursive: true });
    await writeFile(join(dir, rel), body);
  }
  return dir;
}

async function hits(files) {
  const dir = await appWith(files);
  try {
    return (await checkConventions(dir)).filter((v) => v.rule === 'core-imports-exist');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('the rule is registered', () => {
  assert.ok(RULES.some((r) => r.name === 'core-imports-exist'));
});

test('the export surface is read from the real core package (anti-vacuum)', () => {
  const s = coreSurface();
  const root = s.subpaths.get('@webjsdev/core');
  assert.ok(root.runtime.has('WebComponent') && root.runtime.has('html') && root.runtime.has('renderToString'));
  assert.ok(root.types.has('TemplateResult') || root.types.has('PropertyDeclaration'));
  assert.ok(s.subpaths.has('@webjsdev/core/directives') && s.subpaths.has('@webjsdev/core/task'));
});

test('LitElement is flagged with the WebComponent fix', async () => {
  const v = await hits({ 'components/a.ts': "import { LitElement, html } from '@webjsdev/core';\n" });
  assert.equal(v.length, 1);
  assert.match(v[0].message, /`LitElement` \(line 1\) is not exported/);
  assert.match(v[0].fix, /WebComponent/);
});

test('a decorator function import is flagged with the decorator fix', async () => {
  const v = await hits({ 'components/a.ts': "import { WebComponent } from '@webjsdev/core';\nimport { customElement, property } from '@webjsdev/core';\n" });
  assert.deepEqual(v.map((x) => x.message.match(/`(\w+)`/)[1]).sort(), ['customElement', 'property']);
  assert.match(v.find((x) => x.message.includes('customElement')).fix, /\.register\(/);
  assert.match(v.find((x) => x.message.includes('`property`')).fix, /static properties/);
});

test('a type imported as a value gets the import type fix', async () => {
  const v = await hits({ 'components/a.ts': "import { WebComponent, PropertyDeclaration } from '@webjsdev/core';\n" });
  assert.equal(v.length, 1);
  assert.match(v[0].message, /only as a type/);
  assert.match(v[0].fix, /import type \{ PropertyDeclaration \}/);
});

test('import type, a type-qualified name, and real exports pass', async () => {
  const v = await hits({
    'components/a.ts':
      "import type { PropertyDeclaration, LitElement } from '@webjsdev/core';\n" +
      "import { WebComponent, html, type TemplateResult, css as styles } from '@webjsdev/core';\n" +
      "import { repeat, unsafeHTML } from '@webjsdev/core/directives';\n" +
      "import { Task } from '@webjsdev/core/task';\n" +
      "import { renderToString } from '@webjsdev/core/server';\n" +
      "import * as core from '@webjsdev/core';\n" +
      "export { html as h } from '@webjsdev/core';\n",
  });
  assert.deepEqual(v, []);
});

test('a name exported by another subpath is pointed there', async () => {
  const v = await hits({ 'components/a.ts': "import { Task } from '@webjsdev/core/directives';\n" });
  assert.equal(v.length, 1);
  assert.match(v[0].fix, /@webjsdev\/core\/task|@webjsdev\/core`/);
});

test('an unknown subpath and a default import are flagged', async () => {
  const v = await hits({
    'components/a.ts': "import { x } from '@webjsdev/core/decorators.js';\nimport core from '@webjsdev/core';\n",
  });
  assert.equal(v.length, 2);
  assert.ok(v.some((x) => /not a subpath/.test(x.message)));
  assert.ok(v.some((x) => /default import/.test(x.message)));
});

test('an import inside a template, string, or comment is not read', async () => {
  const v = await hits({
    'app/page.ts':
      "import { html } from '@webjsdev/core';\n" +
      "// import { LitElement } from '@webjsdev/core';\n" +
      "const s = \"import { LitElement } from '@webjsdev/core'\";\n" +
      "export default () => html`<pre>import { LitElement } from '@webjsdev/core';</pre>${s}`;\n",
  });
  assert.deepEqual(v, []);
});
