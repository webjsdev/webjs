/**
 * The /ui docs (#1666): the shadcn-shaped docs layout, the component pages,
 * and the two 'use server' queries behind them.
 *
 * renderDemo and componentSource are callable over RPC by anyone, so the
 * name each one takes is a public input. Both must refuse a path and an
 * unknown name before touching the filesystem (D14).
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { renderDemo } from '#modules/ui/queries/render-demo.server.ts';
import { componentSource } from '#modules/ui/queries/component-source.server.ts';
import { COMPONENTS, NAV, neighbours } from '#modules/ui/docs/nav.ts';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
let handle: (path: string) => Promise<Response>;

before(async () => {
  const app = await createRequestHandler({ appDir: WEBSITE_ROOT, dev: false });
  await app.warmup?.();
  handle = async (path) => app.handle(new Request('http://localhost' + path));
});

test('renderDemo refuses a path or an unknown name, and renders a known demo', async () => {
  for (const bad of ['../queries/registry.server', '../../app/layout', 'button-demo/../x', 'BUTTON-DEMO', 'nope-not-a-demo', '']) {
    assert.equal(await renderDemo(bad), null, `${JSON.stringify(bad)} is refused`);
  }
  const demo = await renderDemo('button-demo');
  assert.ok(demo, 'a known demo renders');
  assert.match(demo!.html, /data-slot="button"/, 'the preview is the rendered demo');
  assert.match(demo!.source, /from '#components\/ui\/button\.ts'/, 'the source shows the app path, not the site mirror');
  assert.doesNotMatch(demo!.source, /#modules\/ui\/components\//);
});

test('componentSource refuses a path, and serves a component baked for an app', async () => {
  for (const bad of ['../registry', 'button/../../x', 'Button', '']) {
    assert.equal(await componentSource(bad), null, `${JSON.stringify(bad)} is refused`);
  }
  const files = await componentSource('button');
  assert.ok(files?.length, 'button has a source file');
  // A comment may still name the base form; no CLASS STRING may.
  assert.doesNotMatch(files![0].content, /'[^'\n]*\bcn-button[\w-]*[^'\n]*'/, 'baked: no base-form cn-* name survives in a class string');
  assert.match(files![0].content, /'[^'\n]*\binline-flex\b[^'\n]*'/, 'and the style\'s classes are inlined');
});

test('every component in the nav has a page, and an unknown one is a 404', async () => {
  const failed: string[] = [];
  for (const c of COMPONENTS) {
    const res = await handle(`/ui/docs/components/${c.slug}`);
    if (res.status !== 200) failed.push(`${c.slug} (${res.status})`);
  }
  assert.deepEqual(failed, []);
  assert.equal((await handle('/ui/docs/components/not-a-component')).status, 404);
});

test('a component page has the shadcn shape: title, preview, installation, table of contents', async () => {
  const res = await handle('/ui/docs/components/button');
  const page = await res.text();
  assert.match(page, /<h1[^>]*>Button<\/h1>/);
  assert.match(page, /data-slot="component-preview"/, 'the lead demo');
  assert.match(page, /<h2 id="installation">/, 'the Installation section');
  assert.match(page, /pnpm dlx @webjsdev\/ui add button/, 'the add command');
  assert.match(page, /aria-label="On this page"[\s\S]*href="#usage"/, 'the table of contents lists the sections');
  assert.match(page, /<a href="\/ui\/docs\/components\/button"[^>]*data-active="true"[^>]*aria-current="page"/, 'the sidebar marks the page');
  const { previous, next } = neighbours('/ui/docs/components/button');
  assert.ok(previous && next);
  assert.ok(page.includes(`href="${previous!.href}"`) && page.includes(`href="${next!.href}"`), 'previous and next link the neighbours');
});

test('the nav keeps shadcn\'s section order and leaves out what cannot exist', () => {
  assert.deepEqual(NAV.map((g) => g.title).slice(0, 3), ['Components', 'AI Elements', 'Get Started']);
  const hrefs = NAV.flatMap((g) => g.items.map((i) => i.href));
  for (const gone of ['/ui/docs/legacy', '/ui/docs/registry/open-in-v0', '/ui/docs/react-19']) {
    assert.ok(!hrefs.includes(gone), `${gone} is in the "Cannot exist" table`);
  }
  assert.equal(COMPONENTS.length, 67, 'all of shadcn\'s component pages');
});

test('the components index lists every component page, in title order as shadcn\'s does', async () => {
  // shadcn's components folder takes fumadocs' default order, by title, so
  // Alert comes before Alert Dialog and Button before Button Group. The
  // sidebar and the index read the same list.
  const items = NAV.find((g) => g.title === 'Components')!.items;
  const titles = items.map((i) => i.title);
  assert.deepEqual(titles, [...titles].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
  assert.ok(titles.indexOf('Alert') < titles.indexOf('Alert Dialog'));
  const res = await handle('/ui/docs/components');
  assert.equal(res.status, 200, 'the page the sidebar\'s Components link opens');
  const page = await res.text();
  assert.match(page, /<h1[^>]*>Components<\/h1>/);
  for (const i of items) assert.ok(page.includes(`href="${i.href}"`), `links ${i.title}`);
});
