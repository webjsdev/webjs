/**
 * /founder-resources renders its link, and nothing on the site points at it.
 *
 * The page is unlisted by design: it is reached by someone who was handed the
 * URL. That is a property no other test would notice breaking, because every
 * other guard here pins what the chrome and the sitemap DO list. So the
 * absence is asserted directly, against rendered output for the surfaces a
 * crawler reads and against source for everything else.
 *
 * The other half is that the link is FOLLOWED and the page is indexable. A
 * rel=nofollow or a noindex added by habit would leave the page looking fine
 * while defeating the reason it exists.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { html } from '@webjsdev/core';
import { renderToString } from '@webjsdev/core/server';
import ResourcesPage, * as ResourcesModule from '#app/founder-resources/page.ts';
import RootLayout from '#app/layout.ts';
import Sitemap from '#app/sitemap.ts';
import { GET as llmsTxt } from '#app/llms.txt/route.ts';
import { layoutProps } from '#test/helpers/layout-props.ts';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LINK = 'https://www.investorlist.com';

/** The opening tag of the anchor pointing at `href`, attributes included. */
function anchorTag(out: string, href: string): string {
  const tag = out.match(new RegExp(`<a\\b[^>]*href="${href.replaceAll('.', '\\.')}"[^>]*>`));
  assert.ok(tag, `no anchor to ${href}`);
  return tag[0];
}

test('/founder-resources renders a followed link with its description', async () => {
  const out = await renderToString(ResourcesPage());
  const tag = anchorTag(out, LINK);
  assert.ok(!/\brel=/.test(tag), `the link must carry no rel at all, saw ${tag}`);
  assert.ok(!/nofollow|sponsored|ugc/i.test(out), 'nothing on the page opts a link out of being followed');
  assert.ok(out.includes('>Investorlist.com</a>'), 'the anchor text names the site');
  assert.ok(
    out.includes('Downloadable, curated lists of active startup investors, angels, VCs, and family offices.'),
    'the description sits beside the link',
  );
});

test('/founder-resources stays indexable', () => {
  // A `robots` key is the only way a page opts out of indexing here, so its
  // absence from the page metadata is the whole assertion.
  assert.ok(!('robots' in ResourcesModule.metadata), 'no robots metadata on the page');
  assert.ok(!/noindex/i.test(JSON.stringify(ResourcesModule.metadata)));
});

test('the sitemap does not list /founder-resources', async () => {
  const out = await Sitemap();
  assert.ok(out.includes('<loc>https://webjs.dev/brand</loc>'), 'sanity: the sitemap rendered its static routes');
  assert.ok(!out.includes('/founder-resources'), '/founder-resources is unlisted');
});

test('/llms.txt does not list /founder-resources', async () => {
  const out = await (await llmsTxt()).text();
  assert.ok(out.includes('/what-is-webjs'), 'sanity: llms.txt rendered its overview');
  assert.ok(!out.includes('/founder-resources'), '/founder-resources is unlisted');
});

test('neither the header nor the footer links /founder-resources', async () => {
  const out = await renderToString(RootLayout(layoutProps(html`<main>x</main>`)));
  assert.ok(out.includes('href="/blog"'), 'sanity: the chrome rendered');
  assert.ok(!out.includes('/founder-resources'), 'no chrome link to the page');
});

test('no other source file references /founder-resources', () => {
  // The rendered checks above cover the surfaces that exist today. This one
  // covers a link added tomorrow on any page, fragment or component.
  const self = resolve(WEBSITE_ROOT, 'app', 'founder-resources');
  const hits: string[] = [];
  for (const dir of ['app', 'lib', 'components', 'modules']) {
    for (const entry of readdirSync(resolve(WEBSITE_ROOT, dir), { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.(ts|js|json|txt|md)$/.test(entry.name)) continue;
      const file = resolve(entry.parentPath, entry.name);
      if (file.startsWith(self)) continue;
      // The trailing class keeps a longer path with the same prefix, if one is
      // ever added, from reading as a reference to this page.
      if (/\/founder-resources(?![\w/-])/.test(readFileSync(file, 'utf8'))) hits.push(relative(WEBSITE_ROOT, file));
    }
  }
  assert.deepEqual(hits, [], 'only app/founder-resources itself may name the path');
});
