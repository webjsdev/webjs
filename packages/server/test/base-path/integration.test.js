/**
 * Integration tests for sub-path deployment (issue #256), exercised through
 * `createRequestHandler` against minimal app fixtures with a
 * `webjs.basePath` in package.json. Web-standard Request/Response, no real
 * HTTP server.
 *
 * The headline behaviour ("module resolution does not 404 under a sub-path")
 * is proven at the HTTP layer, the strongest test: every framework-emitted
 * same-origin absolute URL in the served HTML (importmap targets, each
 * modulepreload href, each boot module specifier, the dev reload src) is
 * prefixed with the base path AND, when GET through the SAME handler,
 * resolves (status < 400). That is exactly the #158/#159-class guarantee
 * (every emitted URL resolves) under the prefix, which is what a real
 * browser would fetch when it hydrates a sub-path deploy.
 *
 * The byte-identical invariant (basePath unset => the served HTML is
 * exactly the root-relative output, no '//' or stray prefix) is the #1 risk
 * and is guarded differentially.
 *
 * NOTE on shared module state: the importmap base path is process-global
 * (set at each handler's boot via setBasePath, like setCoreInstall /
 * setVendorEntries). node:test runs a file's tests serially, and each test
 * here boots its handler and makes its requests before the next boots, so a
 * handler's requests always see its own base path.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_SRC = resolve(__dirname, '../../../core/src');
// A tmpdir app cannot resolve the bare `@webjsdev/core` specifier server-side
// (no node_modules), so the fixtures import core's per-file modules by file
// URL for SSR. The thing under test is the BROWSER importmap (whose bare
// `@webjsdev/core` targets the framework emits), which is base-path-prefixed
// regardless of how the fixture sources its server-side imports.
const HTML_URL = pathToFileURL(join(CORE_SRC, 'html.js')).toString();
const COMPONENT_URL = pathToFileURL(join(CORE_SRC, 'component.js')).toString();

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-basepath-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

/**
 * Write a fixture app with a layout, a page rendering a custom-element tag,
 * a registered component (so the boot script + a modulepreload are emitted),
 * and a package.json carrying the given `webjs.basePath`.
 */
function makeApp({ basePath } = {}) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  const webjs = basePath != null ? { basePath } : undefined;
  const files = {
    'package.json': JSON.stringify({ name: 'fixture', type: 'module', webjs }),
    'app/layout.js':
      `import { html } from ${JSON.stringify(HTML_URL)};\n` +
      `export default ({ children }) => html\`<main>\${children}</main>\`;\n`,
    'app/page.js':
      `import { html } from ${JSON.stringify(HTML_URL)};\n` +
      `import './widget.js';\n` +
      `export default () => html\`<x-widget></x-widget>\`;\n`,
    // A simple interactive component (an @click handler) so it is NOT elided
    // and ships a module the boot path imports + a modulepreload hint.
    'app/widget.js':
      `import { WebComponent } from ${JSON.stringify(COMPONENT_URL)};\n` +
      `import { html } from ${JSON.stringify(HTML_URL)};\n` +
      `export class XWidget extends WebComponent {\n` +
      `  render() { return html\`<button @click=\${() => {}}>hi</button>\`; }\n` +
      `}\n` +
      `XWidget.register('x-widget');\n`,
  };
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

/** Extract the importmap `imports` target URLs from served HTML. */
function importmapTargets(html) {
  const m = html.match(/<script type="importmap"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  const json = JSON.parse(m[1]);
  return Object.values(json.imports || {});
}

/** Extract every modulepreload href from served HTML. */
function modulepreloadHrefs(html) {
  return [...html.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1]);
}

/** Extract the boot script's `import "<url>";` module specifiers. */
function bootImportSpecifiers(html) {
  const m = html.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  return [...m[1].matchAll(/import\s+"([^"]+)";/g)].map((x) => x[1]);
}

/* ---------------- the key test: emit + resolve under /app ---------------- */

test('every framework-emitted same-origin URL is prefixed AND resolves under /app', async () => {
  const appDir = makeApp({ basePath: '/app' });
  const app = await createRequestHandler({ appDir, dev: false });
  await app.warmup();

  const res = await app.handle(new Request('http://x/app/'));
  assert.equal(res.status, 200, 'GET /app/ renders the page');
  const html = await res.text();

  const targets = importmapTargets(html);
  const preloads = modulepreloadHrefs(html);
  const bootImports = bootImportSpecifiers(html);

  assert.ok(targets.length, 'importmap has targets');
  assert.ok(preloads.length, 'page emits at least one modulepreload');
  assert.ok(bootImports.length, 'boot script imports at least one module');

  // Collect every SAME-ORIGIN absolute URL the HTML emits (a cross-origin
  // https:// CDN vendor target is absolute and is NOT prefixed; there are
  // none in this fixture, but guard the set anyway).
  const sameOrigin = [...targets, ...preloads, ...bootImports].filter(
    (u) => u.startsWith('/'),
  );
  assert.ok(sameOrigin.length, 'there are same-origin emitted URLs');

  for (const u of sameOrigin) {
    assert.ok(
      u.startsWith('/app/'),
      `emitted same-origin URL must be prefixed with /app/: ${u}`,
    );
    // None is a bare /__webjs/ or a bare root path (the broken pre-fix shape).
    assert.ok(
      !u.startsWith('/__webjs/'),
      `emitted URL must not be a bare /__webjs/ path: ${u}`,
    );
  }

  // The #158/#159-class guarantee under the prefix: GET every emitted
  // same-origin URL through the SAME handler and assert it resolves. This is
  // what proves a sub-path deploy hydrates (the browser fetches these exact
  // URLs). An importmap PREFIX entry (a target ending in `/`, e.g.
  // `@webjsdev/core/` -> `/app/__webjs/core/src/`) is a directory mapping the
  // browser only resolves when concatenating a subpath, not a fetchable URL,
  // so it is excluded from the GET check.
  for (const u of new Set(sameOrigin.filter((u) => !u.endsWith('/')))) {
    const r = await app.handle(new Request('http://x' + u));
    assert.ok(r.status < 400, `emitted URL ${u} must resolve, got ${r.status}`);
  }
});

test('the route resolves WITH the prefix and 404s WITHOUT it', async () => {
  const appDir = makeApp({ basePath: '/app' });
  const app = await createRequestHandler({ appDir, dev: false });
  await app.warmup();

  // With the prefix: 200, the page rendered.
  const withPrefix = await app.handle(new Request('http://x/app/'));
  assert.equal(withPrefix.status, 200);
  assert.ok((await withPrefix.text()).includes('x-widget'), 'page rendered under /app/');

  // Without the prefix: not this app under basePath, so 404.
  const noPrefix = await app.handle(new Request('http://x/'));
  assert.equal(noPrefix.status, 404, 'root path is not this app under basePath');
});

test('the core runtime serves at /app/__webjs/core/* and 404s without the prefix', async () => {
  const appDir = makeApp({ basePath: '/app' });
  const app = await createRequestHandler({ appDir, dev: false });
  await app.warmup();

  const prefixed = await app.handle(new Request('http://x/app/__webjs/core/index.js'));
  assert.equal(prefixed.status, 200, 'core runtime serves under the prefix');
  assert.ok(prefixed.headers.get('content-type').includes('javascript'));

  const bare = await app.handle(new Request('http://x/__webjs/core/index.js'));
  assert.equal(bare.status, 404, 'core runtime is not served at the bare path under basePath');
});

test('a nested basePath /foo/bar works end to end', async () => {
  const appDir = makeApp({ basePath: '/foo/bar' });
  const app = await createRequestHandler({ appDir, dev: false });
  await app.warmup();

  const res = await app.handle(new Request('http://x/foo/bar/'));
  assert.equal(res.status, 200);
  const html = await res.text();
  for (const u of importmapTargets(html).filter((u) => u.startsWith('/'))) {
    assert.ok(u.startsWith('/foo/bar/'), `importmap target prefixed: ${u}`);
    if (u.endsWith('/')) continue; // a directory-prefix mapping, not fetchable
    const r = await app.handle(new Request('http://x' + u));
    assert.ok(r.status < 400, `nested-prefix URL ${u} resolves, got ${r.status}`);
  }
});

/* ---------------- the critical invariant: byte-identical default ---------------- */

test('basePath unset is byte-identical to no feature (no // or stray prefix)', async () => {
  // Two apps with IDENTICAL source, one without webjs.basePath, one with an
  // explicit empty string. Both must serve byte-identical HTML and the
  // root-relative URLs, proving the empty default is a pure no-op.
  const appA = makeApp({});               // no webjs.basePath key at all
  const handlerA = await createRequestHandler({ appDir: appA, dev: false });
  await handlerA.warmup();
  const htmlA = await (await handlerA.handle(new Request('http://x/'))).text();

  const appB = makeApp({ basePath: '' }); // explicit empty string
  const handlerB = await createRequestHandler({ appDir: appB, dev: false });
  await handlerB.warmup();
  const htmlB = await (await handlerB.handle(new Request('http://x/'))).text();

  // Every emitted same-origin URL is exactly root-relative (starts with a
  // single '/__webjs/' or '/app...'-free path), never doubled or prefixed.
  const urls = [
    ...importmapTargets(htmlA),
    ...modulepreloadHrefs(htmlA),
    ...bootImportSpecifiers(htmlA),
  ].filter((u) => u.startsWith('/'));
  assert.ok(urls.length, 'there are emitted same-origin URLs');
  for (const u of urls) {
    assert.ok(!u.startsWith('//'), `no protocol-relative URL: ${u}`);
    // The framework's own runtime is at the bare /__webjs/ root, unprefixed.
    if (u.includes('__webjs')) {
      assert.ok(u.startsWith('/__webjs/'), `core/runtime URL is root-relative: ${u}`);
    }
  }

  // The two HTML bodies (no-key vs empty-string) are identical modulo nothing:
  // the build id + CSRF cookie ride headers, not the body, so the bodies match.
  assert.equal(
    htmlB.replace(/app-[^/"]+/g, 'APP'),
    htmlA.replace(/app-[^/"]+/g, 'APP'),
    'empty basePath and no basePath produce identical HTML',
  );
});
