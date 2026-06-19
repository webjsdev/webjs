import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { checkConventions, RULES } from '../../src/check.js';
import { parsePropEntries } from '../../src/js-scan.js';

async function makeTempApp() {
  return mkdtemp(join(tmpdir(), 'webjs-check-arrayprop-'));
}

async function writeComponent(appDir, rel, source) {
  const abs = join(appDir, rel);
  await mkdir(abs.slice(0, abs.lastIndexOf('/')), { recursive: true });
  await writeFile(abs, source);
}

const RULE = 'array-prop-uses-array-type';

test(`${RULE}: registered in RULES with a description`, () => {
  const r = RULES.find((r) => r.name === RULE);
  assert.ok(r, 'rule should be registered');
  assert.match(r.description, /Array/);
});

test(`${RULE}: flags prop<T[]>(Object)`, async () => {
  const appDir = await makeTempApp();
  try {
    await writeComponent(
      appDir,
      'components/comment-list.ts',
      `import { WebComponent, prop, html } from '@webjsdev/core';
class CommentList extends WebComponent({
  items: prop<Comment[]>(Object),
}) {
  render() { return html\`<ul></ul>\`; }
}
CommentList.register('comment-list');
`,
    );
    const violations = await checkConventions(appDir);
    const v = violations.find((v) => v.rule === RULE && v.file.includes('comment-list.ts'));
    assert.ok(v, 'expected prop<Comment[]>(Object) to be flagged');
    assert.match(v.message, /`items`/, 'message names the prop');
    assert.match(v.fix, /Array/, 'fix suggests Array');
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test(`${RULE}: flags prop<Array<T>>(Object) and readonly arrays`, async () => {
  const appDir = await makeTempApp();
  try {
    await writeComponent(
      appDir,
      'components/multi.ts',
      `import { WebComponent, prop, html } from '@webjsdev/core';
class Multi extends WebComponent({
  a: prop<Array<string>>(Object),
  b: prop<readonly Tag[]>(Object),
  c: prop<ReadonlyArray<number>>(Object),
}) {
  render() { return html\`<div></div>\`; }
}
Multi.register('multi-thing');
`,
    );
    const violations = await checkConventions(appDir);
    const flagged = violations.filter((v) => v.rule === RULE && v.file.includes('multi.ts'));
    assert.equal(flagged.length, 3, 'all three array forms flagged');
    assert.deepEqual(
      flagged.map((v) => v.message.match(/`(\w)`/)[1]).sort(),
      ['a', 'b', 'c'],
    );
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test(`${RULE}: passes for prop<T[]>(Array) (counterfactual)`, async () => {
  const appDir = await makeTempApp();
  try {
    await writeComponent(
      appDir,
      'components/good-list.ts',
      `import { WebComponent, prop, html } from '@webjsdev/core';
class GoodList extends WebComponent({
  items: prop<Comment[]>(Array),
}) {
  render() { return html\`<ul></ul>\`; }
}
GoodList.register('good-list');
`,
    );
    const violations = await checkConventions(appDir);
    assert.equal(
      violations.filter((v) => v.rule === RULE).length,
      0,
      'prop<Comment[]>(Array) must not be flagged',
    );
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test(`${RULE}: does not flag a non-array generic or a bare Object`, async () => {
  const appDir = await makeTempApp();
  try {
    await writeComponent(
      appDir,
      'components/scalar.ts',
      `import { WebComponent, prop, html } from '@webjsdev/core';
class Scalar extends WebComponent({
  student: prop<Student>(Object),
  bag: Object,
  count: Number,
}) {
  render() { return html\`<div></div>\`; }
}
Scalar.register('scalar-thing');
`,
    );
    const violations = await checkConventions(appDir);
    assert.equal(
      violations.filter((v) => v.rule === RULE).length,
      0,
      'object-shaped and bare props must not be flagged',
    );
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test(`${RULE}: ignores prop<T[]>(Object) shown inside an html template example`, async () => {
  const appDir = await makeTempApp();
  try {
    await writeComponent(
      appDir,
      'components/docs-page.ts',
      `import { WebComponent, prop, html } from '@webjsdev/core';
class DocsPage extends WebComponent({
  open: Boolean,
}) {
  render() {
    return html\`<pre>items: prop<Comment[]>(Object)</pre>\`;
  }
}
DocsPage.register('docs-page');
`,
    );
    const violations = await checkConventions(appDir);
    assert.equal(
      violations.filter((v) => v.rule === RULE).length,
      0,
      'a code example inside a template literal must not be flagged',
    );
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test(`${RULE}: preserves later props after a value with commas`, async () => {
  const appDir = await makeTempApp();
  try {
    await writeComponent(
      appDir,
      'components/mixed.ts',
      `import { WebComponent, prop, html } from '@webjsdev/core';
class Mixed extends WebComponent({
  label: prop<string | null>(String, { attribute: 'show-label' }),
  rows: prop<Row[]>(Object),
}) {
  render() { return html\`<div></div>\`; }
}
Mixed.register('mixed-thing');
`,
    );
    const violations = await checkConventions(appDir);
    const flagged = violations.filter((v) => v.rule === RULE && v.file.includes('mixed.ts'));
    assert.equal(flagged.length, 1, 'rows flagged even after an options-object value');
    assert.match(flagged[0].message, /`rows`/);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

// Unit coverage for the entry parser the rule depends on.
test('parsePropEntries: captures values across commas in nested brackets', () => {
  const entries = parsePropEntries(
    `label: prop<string | null>(String, { attribute: 'x' }), rows: prop<Row[]>(Object), n: Number`,
  );
  assert.deepEqual(entries.map((e) => e.key), ['label', 'rows', 'n']);
  assert.equal(entries[1].value, 'prop<Row[]>(Object)');
  assert.equal(entries[2].value, 'Number');
});
