/**
 * Three /ui pages ported from shadcn/ui (#1666): /ui/colors (the Tailwind
 * palette in every format), /ui/sera (the Sera style showcase) and
 * /ui/rss.xml (the WebJs UI changelog feed).
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { getColors, getColorFormat } from '#modules/ui/colors/colors.ts';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
let handle: (path: string) => Promise<Response>;

before(async () => {
  const app = await createRequestHandler({ appDir: WEBSITE_ROOT, dev: false });
  await app.warmup?.();
  handle = async (path) => app.handle(new Request('http://localhost' + path));
});

test('getColors gives every palette in every format, with a readable text colour', () => {
  const palettes = getColors();
  assert.equal(palettes.length, 26);
  assert.ok(palettes.every((p) => p.colors.length === 11), 'eleven shades per palette');
  const red500 = palettes.find((p) => p.name === 'red')!.colors.find((c) => c.scale === 500)!;
  assert.equal(red500.className, 'red-500');
  assert.equal(red500.hex, '#ef4444');
  assert.match(red500.rgb, /^\d+ \d+ \d+$/, 'rgb is space separated');
  assert.match(red500.hsl, /^[\d.]+ [\d.]+% [\d.]+%$/, 'hsl is space separated');
  assert.match(red500.oklch, /^oklch\([\d.]+ [\d.]+ [\d.]+\)$/);
  assert.equal(red500.var, '--color-red-500');
  const neutral = palettes.find((p) => p.name === 'neutral')!.colors;
  assert.equal(neutral[0].foreground, '#000', 'black on the lightest shade');
  assert.equal(neutral[10].foreground, '#fff', 'white on the darkest shade');
  assert.deepEqual(Object.keys(getColorFormat(red500)), ['className', 'hex', 'rgb', 'hsl', 'oklch', 'var']);
});

test('/ui/colors renders every swatch as markup, with its values to copy', async () => {
  const res = await handle('/ui/colors');
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /<h1[^>]*>Tailwind Colors in Every Format<\/h1>/);
  assert.equal(body.match(/data-swatch/g)?.length, 286, 'all 286 shades');
  assert.match(body, /<h2 class="capitalize">rose<\/h2>/);
  assert.match(body, /data-classname="red-500"[^>]*data-hex="#ef4444"/);
  assert.match(body, /<color-swatches[\s>]/, 'the copy element wraps the palettes');
  assert.equal(body.match(/<select[^>]*data-color-format/g)?.length, 26, 'one format menu per palette');
  assert.match(body, /<option value="hsl"[^>]*selected/, 'hsl is the default format');
  assert.equal(body.match(/<template data-select-trigger>/g)?.length, 26, 'each trigger reads "Format: <format>"');
  assert.match(body, /<span class="font-medium">hex<\/span><span class="font-mono text-xs text-muted-foreground">#fafafa<\/span>/, 'a menu item shows the format beside its value');
  assert.match(body, /href="#colors"/, 'Browse Colors jumps to the palettes');
});

test('/ui/sera renders the six preview screens in the sera style and the taupe theme', async () => {
  const res = await handle('/ui/sera');
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /<h1[^>]*>Introducing Sera<\/h1>/);
  assert.match(body, /class="style-sera /, 'the page renders in the sera style');
  assert.match(body, /\/public\/ui-styles\/sera\.css/, 'and links its stylesheet');
  assert.match(body, /\/public\/sera-fonts\.css/, 'and its own fonts, Playfair Display among them');
  assert.equal(body.match(/class="preview theme-taupe /g)?.length, 6, 'six preview screens');
  for (const heading of ['Audience Analytics', 'Article Directory', 'EDIT ARTICLE', 'Media Library']) {
    assert.ok(body.includes(heading), `${heading} is on the page`);
  }
  assert.match(body, /href="\/ui\/create\?preset=b4xFeBLg4O"/, 'the Create link carries the Sera preset');
  assert.match(body, /\/public\/images\/sera-01-light\.png/, 'the small-screen screenshots');
});

/** A tiny well-formedness check: every element closes, in order, outside CDATA. */
function wellFormed(xml: string): boolean {
  const stack: string[] = [];
  const body = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '').replace(/<\?xml[^>]*\?>/, '');
  for (const m of body.matchAll(/<(\/?)([a-zA-Z][\w:.-]*)[^>]*?(\/?)>/g)) {
    const [, close, name, self] = m;
    if (self) continue;
    if (close) {
      if (stack.pop() !== name) return false;
    } else {
      stack.push(name);
    }
  }
  return stack.length === 0;
}

test('/ui/rss.xml is an RSS feed with one entry per WebJs UI release', async () => {
  const res = await handle('/ui/rss.xml');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /^application\/rss\+xml/);
  const xml = await res.text();
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(wellFormed(xml), 'the feed is well formed');
  assert.match(xml, /<rss version="2\.0"/);
  assert.match(xml, /<title>WebJs UI Changelog<\/title>/);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  const releases = readdirSync(resolve(WEBSITE_ROOT, '..', 'changelog', 'ui')).filter((f) => f.endsWith('.md')).length;
  assert.ok(items.length > 0, 'the feed has entries');
  assert.equal(items.length, releases, 'one entry per changelog/ui release');
  for (const item of items) {
    assert.match(item, /<title><!\[CDATA\[@webjsdev\/ui \d+\.\d+\.\d+\]\]><\/title>/);
    assert.match(item, /<link>https?:\/\/[^<]+\/ui\/docs\/changelog(#v[\d-]+)?<\/link>/);
    const date = /<pubDate>([^<]+)<\/pubDate>/.exec(item)?.[1] ?? '';
    assert.ok(!Number.isNaN(Date.parse(date)), `a valid pubDate, got ${date}`);
  }
  assert.match(items[0], /#v\d+-\d+-\d+<\/link>/, 'the newest entry links to its heading');
});
