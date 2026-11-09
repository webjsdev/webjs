/**
 * React-isms in templates fail loudly with the WebJs fix:
 *   - a function in an `on*` attribute (`onClick=${fn}`) throws on render;
 *   - `className=` / `htmlFor=` / a capitalised tag throw at template compile;
 *   - in dev, an `@event` or native `.prop` binding in a page or layout
 *     template (which never hydrates) is a render error, while the same
 *     binding inside a component's render() is fine.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { html } from '../../packages/core/src/html.js';
import { renderToString } from '../../packages/core/src/render-server.js';
import { findJsxIsm } from '../../packages/core/src/jsx-guard.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../../packages/core/index.js')).toString();

let ssrPage;
let tmp;
before(async () => {
  ({ ssrPage } = await import('../../packages/server/src/ssr.js'));
  tmp = mkdtempSync(join(tmpdir(), 'webjs-page-binding-'));
});
after(() => rmSync(tmp, { recursive: true, force: true }));

test('a function in an on* attribute throws, naming @event', async () => {
  for (const tpl of [
    html`<button onClick=${() => 1}>x</button>`,
    html`<button onclick="${() => 1}">x</button>`,
  ]) {
    await assert.rejects(() => renderToString(tpl), /onclick|onClick.*@click/i);
  }
  // A string handler is the author's own HTML, not a React-ism.
  assert.match(await renderToString(html`<button onclick=${'go()'}>x</button>`), /onclick="go\(\)"/);
});

test('findJsxIsm: className, htmlFor and capitalised tags; prose is ignored', () => {
  assert.deepEqual(findJsxIsm(['<div className="a">x</div>']), { kind: 'attr', name: 'className' });
  assert.deepEqual(findJsxIsm(['<label htmlFor=', '>x</label>']), { kind: 'attr', name: 'htmlFor' });
  assert.deepEqual(findJsxIsm(['<p>', '</p><Link href="/a">a</Link>']), { kind: 'tag', name: 'Link' });
  for (const ok of [
    ['<p>use &lt;Link&gt; and className= in React</p>'],
    ['<!-- <Link className="x"> -->'],
    ['<script>if (a <Link) x.className = 1;</script>'],
    ['<BR><DIV class="x"></DIV>'],
    ['<svg viewBox="0 0 1 1"><linearGradient></linearGradient></svg>'],
    ['<div title="className=x">', '</div>'],
  ]) assert.equal(findJsxIsm(ok), null, ok[0]);
});

test('className= throws at SSR template compile with the class= fix', async () => {
  await assert.rejects(() => renderToString(html`<div className="card">x</div>`), /Write `class=`/);
  await assert.rejects(() => renderToString(html`<Link href="/a">a</Link>`), /<Link>.*JSX component/);
});

function pageApp(pageSrc) {
  const appDir = mkdtempSync(join(tmp, 'app-'));
  const file = join(appDir, 'app', 'page.js');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, pageSrc);
  return { appDir, route: { file, layouts: [], errors: [], metadataFiles: [] } };
}

test('dev: @click in a page template is a render error; prod drops it', async () => {
  const { appDir, route } = pageApp(
    `import { html } from ${JSON.stringify(CORE)};\n` +
    `export default () => html\`<button @click=\${() => 1}>x</button>\`;\n`);
  const errors = [];
  const dev = await ssrPage(route, {}, new URL('http://x/'), { dev: true, appDir, onDevError: (e) => errors.push(e) });
  assert.equal(dev.status, 500);
  assert.ok(errors.some((e) => /@click.*page or layout.*WebComponent/s.test(String(e.message))), 'dev names the fix');
  const prod = await ssrPage(route, {}, new URL('http://x/'), { dev: false, appDir });
  assert.equal(prod.status, 200);
});

test('dev: a native .value binding in a page is an error; a custom element .prop is fine', async () => {
  const bad = pageApp(
    `import { html } from ${JSON.stringify(CORE)};\n` +
    `export default () => html\`<input .value=\${'x'}>\`;\n`);
  assert.equal((await ssrPage(bad.route, {}, new URL('http://x/'), { dev: true, appDir: bad.appDir, onDevError() {} })).status, 500);
  const ok = pageApp(
    `import { html } from ${JSON.stringify(CORE)};\n` +
    `export default () => html\`<my-thing .items=\${[1]}></my-thing>\`;\n`);
  assert.equal((await ssrPage(ok.route, {}, new URL('http://x/'), { dev: true, appDir: ok.appDir })).status, 200);
});

test('dev: @click inside a component render() renders fine', async () => {
  const appDir = mkdtempSync(join(tmp, 'app-'));
  mkdirSync(join(appDir, 'app'), { recursive: true });
  mkdirSync(join(appDir, 'components'), { recursive: true });
  writeFileSync(join(appDir, 'components', 'clicker.js'),
    `import { WebComponent, html } from ${JSON.stringify(CORE)};\n` +
    `class Clicker extends WebComponent({}) { render() { return html\`<button @click=\${() => 1}>go</button>\`; } }\n` +
    `Clicker.register('page-binding-clicker');\n`);
  const file = join(appDir, 'app', 'page.js');
  writeFileSync(file,
    `import { html } from ${JSON.stringify(CORE)};\n` +
    `import '../components/clicker.js';\n` +
    `export default () => html\`<page-binding-clicker></page-binding-clicker>\`;\n`);
  const r = await ssrPage({ file, layouts: [], errors: [], metadataFiles: [] }, {}, new URL('http://x/'), { dev: true, appDir });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /<button[^>]*>go<\/button>/);
});
