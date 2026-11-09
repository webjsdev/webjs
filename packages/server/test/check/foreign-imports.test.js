/**
 * Foreign-framework imports (next/*, react, lit and family) are refused with
 * the exact WebJs replacement: by `webjs check`, by the dev/prod analysis, by
 * the server import path (ERR_MODULE_NOT_FOUND rewritten; the Node resolve
 * guard for an installed package), and never sent to the vendor resolver.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { checkConventions } from '../../src/check.js';
import {
  foreignImport, foreignImportAllowed, explainImportError, foreignImportMessage, registerForeignImportGuard,
} from '../../src/foreign-imports.js';
import { createRequestHandler } from '../../src/dev.js';
import { reachedBareImports } from '../../src/vendor/scanner.js';
import { buildModuleGraph } from '../../src/module-graph.js';

const quiet = { info() {}, warn() {}, error() {}, debug() {} };

async function app(files) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-foreign-'));
  await writeFile(join(dir, 'package.json'), '{"name":"x","type":"module"}');
  for (const [rel, body] of Object.entries(files)) {
    await mkdir(dirname(join(dir, rel)), { recursive: true });
    await writeFile(join(dir, rel), body);
  }
  return dir;
}

test('the table maps each foreign package to a WebJs replacement', () => {
  assert.match(foreignImport('next/navigation').fix, /'@webjsdev\/core'/);
  assert.match(foreignImport('next/headers').fix, /'@webjsdev\/server'/);
  assert.match(foreignImport('next/server').fix, /MiddlewareRequest/);
  assert.match(foreignImport('next/cache').fix, /revalidatePath/);
  assert.match(foreignImport('next/link').fix, /<a href/);
  assert.match(foreignImport('next/image').fix, /<img/);
  assert.match(foreignImport('next').fix, /import type/);
  // next-auth names the auth fix, not the generic `next` one it would otherwise match.
  assert.match(foreignImport('next-auth').fix, /createAuth/);
  assert.match(foreignImport('next-auth/providers/credentials').fix, /Credentials\(\{ authorize \}\)/);
  assert.doesNotMatch(foreignImport('next-auth').fix, /import type/);
  assert.equal(foreignImport('react').framework, 'React');
  assert.equal(foreignImport('react-dom/client').framework, 'React');
  assert.match(foreignImport('lit').fix, /WebComponent/);
  assert.match(foreignImport('lit/directives/class-map.js').fix, /@webjsdev\/core\/directives/);
  assert.match(foreignImport('lit/decorators.js').fix, /static properties/);
  assert.match(foreignImport('@lit/context').fix, /@webjsdev\/core\/context/);
  assert.match(foreignImport('@lit/task').fix, /@webjsdev\/core\/task/);
  assert.equal(foreignImport('@lit-labs/ssr').framework, 'Lit');
  // Not foreign: look-alikes and WebJs's own packages.
  for (const s of ['literally', 'nextra', 'reactive', '@webjsdev/core', 'dayjs', './lit.ts']) {
    assert.equal(foreignImport(s), null, s);
  }
});

test('react is allowed only in a *.server.* module', () => {
  assert.equal(foreignImportAllowed('react', 'lib/email.server.ts'), true);
  assert.equal(foreignImportAllowed('react', 'components/x.ts'), false);
  assert.equal(foreignImportAllowed('lit', 'lib/x.server.ts'), false, 'lit is never allowed');
});

test('check: flags every import form and names the fix', async () => {
  const dir = await app({
    'app/page.ts': `import { redirect } from 'next/navigation';\nimport type { Metadata } from 'next';\nexport default () => redirect('/x');\n`,
    'components/c.ts': `import { LitElement, html } from 'lit';\nimport 'lit/decorators.js';\nexport { ContextProvider } from '@lit/context';\nconst m = () => import('react');\n`,
    'lib/email.server.ts': `import { renderToString } from 'react-dom/server';\nexport const x = renderToString;\n`,
    'lib/doc.ts': `const sample = "import { useState } from 'react'";\nconst t = \`import x from 'lit'\`;\n// import { redirect } from 'next/navigation'\nexport { sample, t };\n`,
  });
  try {
    const v = (await checkConventions(dir)).filter((x) => x.rule === 'no-foreign-framework-import');
    const got = v.map((x) => `${x.file}:${/'([^']+)'/.exec(x.message)[1]}`).sort();
    assert.deepEqual(got, [
      'app/page.ts:next',
      'app/page.ts:next/navigation',
      'components/c.ts:@lit/context',
      'components/c.ts:lit',
      'components/c.ts:lit/decorators.js',
      'components/c.ts:react',
    ]);
    assert.match(v.find((x) => x.message.includes("'lit'")).fix, /WebComponent/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('analysis: a foreign import is refused before render (dev 500 naming the fix)', async () => {
  const dir = await app({
    'app/page.ts': `import { html } from 'lit';\nexport default () => html\`<p>x</p>\`;\n`,
  });
  try {
    const h = await createRequestHandler({ appDir: dir, dev: true, logger: quiet });
    const r = await h.handle(new Request('http://x/'));
    assert.equal(r.status, 500);
    const body = await r.text();
    assert.match(body, /no-foreign-framework-import/);
    assert.match(body, /@webjsdev\/core/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('explainImportError rewrites a missing foreign package and leaves others alone', () => {
  const nf = Object.assign(new Error("Cannot find package 'next' imported from /app/app/page.ts"), { code: 'ERR_MODULE_NOT_FOUND' });
  const out = explainImportError(nf, 'app/page.ts');
  assert.notEqual(out, nf);
  assert.match(out.message, /app\/page\.ts imports 'next', a Next\.js package/);
  assert.equal(out.cause, nf);
  const dirForm = new Error("Cannot find package '/app/node_modules/react/' imported from /app/x.ts");
  assert.match(explainImportError(dirForm).message, /'react' is imported, a React package/);
  const other = new Error("Cannot find package 'dayjs' imported from /app/x.ts");
  assert.equal(explainImportError(other), other);
  assert.equal(foreignImportMessage('dayjs'), '');
});

test('the Node resolve guard refuses an INSTALLED foreign package from an app file', { skip: !!process.versions.bun }, async () => {
  const dir = await app({
    'node_modules/lit/package.json': '{"name":"lit","type":"module","exports":"./index.js"}',
    'node_modules/lit/index.js': 'export const html = () => "real lit";\n',
    'node_modules/dep/package.json': '{"name":"dep","type":"module","exports":"./index.js"}',
    'node_modules/dep/index.js': 'export { html } from "lit";\n',
    'app/uses-lit.js': `import { html } from 'lit';\nexport default html;\n`,
    'app/uses-dep.js': `import { html } from 'dep';\nexport default html;\n`,
  });
  try {
    registerForeignImportGuard(dir);
    await assert.rejects(
      () => import(pathToFileURL(join(dir, 'app/uses-lit.js')).href),
      (e) => e.code === 'ERR_WEBJS_FOREIGN_IMPORT' && /WebComponent/.test(e.message),
    );
    // A dependency that uses the package internally is untouched.
    const ok = await import(pathToFileURL(join(dir, 'app/uses-dep.js')).href);
    assert.equal(ok.default(), 'real lit');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('vendor scanner never sends a foreign package to jspm', async () => {
  const dir = await app({
    'components/c.ts': `import { LitElement } from 'lit';\nimport dayjs from 'dayjs';\nexport { LitElement, dayjs };\n`,
  });
  try {
    const graph = await buildModuleGraph(dir);
    const found = reachedBareImports(graph, [join(dir, 'components/c.ts')], dir);
    assert.ok(found.has('dayjs'));
    assert.ok(!found.has('lit'), 'lit is excluded');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
