/**
 * `public/` is served at the URL root, as in Next.js: `public/logo.png` is
 * `/logo.png`, the `/public/` prefix is gone, a public file beats a DYNAMIC
 * route, a public file at the url of a static page / route.ts / metadata route
 * is a boot error (no-public-route-conflict), traversal is refused, asset()
 * fingerprints root paths, and trailing-slash canonicalization leaves a public
 * file alone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import { createRequestHandler } from '../../src/dev.js';
import { buildPublicIndex, publicFilePath } from '../../src/public-files.js';
import { checkConventions } from '../../src/check.js';

const quiet = { info() {}, warn() {}, error() {}, debug() {} };

function app(files, pkg = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-public-root-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'p', type: 'module', ...pkg }));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return dir;
}

for (const dev of [true, false]) {
  test(`public/ files serve at the root, never under /public/ (dev=${dev})`, async () => {
    const dir = app({
      'app/page.js': `export default () => 'home';\n`,
      'public/logo.svg': '<svg/>',
      'public/images/a.txt': 'nested',
      'public/LICENSE': 'MIT',
      'secret.txt': 'nope',
    });
    try {
      const h = await createRequestHandler({ appDir: dir, dev, logger: quiet });
      const logo = await h.handle(new Request('http://x/logo.svg'));
      assert.equal(logo.status, 200);
      assert.match(logo.headers.get('content-type') || '', /svg/);
      assert.equal(await (await h.handle(new Request('http://x/images/a.txt'))).text(), 'nested');
      assert.equal(await (await h.handle(new Request('http://x/LICENSE'))).text(), 'MIT');
      const old = await h.handle(new Request('http://x/public/logo.svg'));
      assert.equal(old.status, 404, 'the /public/ prefix is gone');
      await old.text();
      const esc = await h.handle(new Request('http://x/..%2Fsecret.txt'));
      assert.notEqual(await esc.text(), 'nope', 'traversal out of public/ is refused');
      const home = await h.handle(new Request('http://x/'));
      assert.equal(home.status, 200, 'pages still render');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

test('a public file beats a dynamic route at the same url (Next order)', async () => {
  const dir = app({
    'app/[slug]/page.js': `export default ({ params }) => 'page ' + params.slug;\n`,
    'public/about.txt': 'static',
  });
  try {
    const h = await createRequestHandler({ appDir: dir, dev: false, logger: quiet });
    assert.equal(await (await h.handle(new Request('http://x/about.txt'))).text(), 'static');
    assert.match(await (await h.handle(new Request('http://x/other'))).text(), /page other/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a public file at a static page / route / metadata url is a boot error and a check violation', async () => {
  const dir = app({
    'app/about/page.js': `export default () => 'about';\n`,
    'app/api/x/route.js': `export const GET = () => new Response('r');\n`,
    'app/robots.js': `export default () => 'User-agent: *';\n`,
    'public/about': 'shadow',
    'public/api/x': 'shadow',
    'public/robots.txt': 'shadow',
  });
  try {
    await assert.rejects(
      () => createRequestHandler({ appDir: dir, dev: false, logger: quiet }),
      (e) => /no-public-route-conflict/.test(e.message) && /public\/about/.test(e.message),
    );
    const v = (await checkConventions(dir)).filter((x) => x.rule === 'no-public-route-conflict').map((x) => x.file).sort();
    assert.deepEqual(v, ['public/about', 'public/api/x', 'public/robots.txt']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('asset() fingerprints a root public path and the hashed url serves immutable', async () => {
  const dir = app({
    'public/app.css': 'body{color:red}',
    'app/layout.js': `import { html, asset } from '@webjsdev/core';\nexport default ({ children }) => html\`<link rel="stylesheet" href=\${asset('/app.css')}>\${children}\`;\n`,
    'app/page.js': `export default () => 'p';\n`,
  });
  mkdirSync(join(dir, 'node_modules', '@webjsdev'), { recursive: true });
  try {
    const { symlinkSync } = await import('node:fs');
    symlinkSync(join(process.cwd(), 'packages', 'core'), join(dir, 'node_modules', '@webjsdev', 'core'));
    const h = await createRequestHandler({ appDir: dir, dev: false, logger: quiet });
    const html = await (await h.handle(new Request('http://x/'))).text();
    const m = /href="(\/app\.css\?v=[0-9a-f]+)"/.exec(html);
    assert.ok(m, html.slice(0, 400));
    const css = await h.handle(new Request(`http://x${m[1]}`));
    assert.match(css.headers.get('cache-control') || '', /immutable/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('trailingSlash: always leaves a public file (even extensionless) alone', async () => {
  const dir = app({ 'app/page.js': `export default () => 'p';\n`, 'public/LICENSE': 'MIT' }, { webjs: { trailingSlash: 'always' } });
  try {
    const h = await createRequestHandler({ appDir: dir, dev: false, logger: quiet });
    const r = await h.handle(new Request('http://x/LICENSE'));
    assert.equal(r.status, 200);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('buildPublicIndex / publicFilePath', () => {
  const dir = app({ 'public/a.txt': 'a', 'public/d/b.txt': 'b' });
  try {
    assert.deepEqual([...buildPublicIndex(dir)].sort(), ['/a.txt', '/d/b.txt']);
    assert.equal(publicFilePath(dir, '/'), null);
    assert.equal(publicFilePath(dir, '/d/'), null);
    assert.equal(publicFilePath(dir, '/../x'), null);
    assert.ok(publicFilePath(dir, '/a.txt').endsWith(join('public', 'a.txt')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
