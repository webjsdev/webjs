/**
 * The typeset builder (#1666): /ui/typeset, its preview frame under
 * /ui/preview/typeset/<item>, and /ui/typeset.css. The state is the query
 * string, so most of what the builder does is checkable in the server's HTML.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { DEFAULTS, PARAM_KEYS, CONTENT_OPTIONS, paramValues, parseParams, shuffleParams } from '#modules/ui/typeset/params.ts';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
let handle: (path: string) => Promise<Response>;

before(async () => {
  const app = await createRequestHandler({ appDir: WEBSITE_ROOT, dev: false });
  await app.warmup?.();
  handle = async (path) => app.handle(new Request('http://localhost' + path));
});

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function page(path: string) {
  const res = await handle(path);
  assert.equal(res.status, 200, `${path} renders`);
  return res.text();
}


test('/ui/typeset renders the three panels, in shadcn\'s order', async () => {
  const html = await page('/ui/typeset');
  assert.match(html, /<typeset-customizer[^>]*data-slot="designer"/, 'the designer, wrapped by its element');
  assert.match(html, /<form method="get" action="\/ui\/typeset"/, 'the customizer is a GET form');
  for (const name of ['measure', 'heading', 'body', 'mono', 'scale', 'leading', 'flow']) {
    assert.match(html, new RegExp(`<input type="radio" name="${name}"`), `the ${name} picker carries its param`);
  }
  assert.match(html, /<iframe src="\/ui\/preview\/typeset\/docs"/, 'the preview frame, at the defaults');
  assert.match(html, /data-slot="typeset-docs"/, 'the docs panel');
  assert.match(html, /<ui-tabs-trigger value="docs"[\s\S]*?>Docs</);
  assert.match(html, /<ui-tabs-trigger value="prompt"[\s\S]*?>Prompt</);
  assert.match(html, /\/public\/typeset-fonts\.css/, 'the typeset faces are linked');
  // shadcn's DOM order: docs, preview, customizer (md:flex-row-reverse shows it the other way).
  const at = (re: RegExp) => html.search(re);
  assert.ok(at(/data-slot="typeset-docs"/) < at(/data-slot="typeset-preview"/));
  assert.ok(at(/data-slot="typeset-preview"/) < at(/<form method="get"/));
  // The defaults are checked.
  assert.match(html, /name="body" value="geist" checked/);
  assert.match(html, /name="heading" value="inherit" checked/);
  assert.match(html, /name="scale" value="15" checked/);
});

test('invalid params fall back to the defaults', async () => {
  const html = await page('/ui/typeset?body=comic-sans&scale=99&measure=&leading=2&item=nope&flow=1.25em');
  assert.match(html, /name="body" value="geist" checked/);
  assert.match(html, /name="scale" value="15" checked/);
  assert.match(html, /name="measure" value="80" checked/);
  assert.match(html, /name="leading" value="1.75" checked/);
  assert.match(html, /<iframe src="\/ui\/preview\/typeset\/docs"/, 'an unknown item is the default specimen');
  assert.deepEqual(parseParams(new URLSearchParams('body=comic-sans&scale=99&item=nope')), DEFAULTS);
});

test('a non-default param reaches the preview src, the links and the docs code', async () => {
  const html = await page('/ui/typeset?body=lora&heading=montserrat&scale=18&item=chat');
  const src = decode(html.match(/<iframe src="([^"]*)"/)?.[1] ?? '');
  const url = new URL(src, 'http://x');
  assert.equal(url.pathname, '/ui/preview/typeset/chat');
  assert.equal(url.searchParams.get('body'), 'lora');
  assert.equal(url.searchParams.get('heading'), 'montserrat');
  assert.equal(url.searchParams.get('scale'), '18');
  assert.equal(url.searchParams.get('mono'), null, 'a default is left out, as nuqs does');
  assert.match(html, /name="body" value="lora" checked/);
  assert.match(html, /data-current>Lora</, 'the trigger names the font');
  // The docs: the preset, the wrapper and the font loading name the choice.
  assert.match(html, /\.typeset-chat \{/);
  assert.match(html, /--typeset-font-body: var\(--font-lora\);/);
  assert.match(html, /--typeset-font-heading: var\(--font-montserrat\);/);
  assert.match(html, /--typeset-size: 18px;/);
  assert.match(html, /class=&quot;typeset typeset-chat max-w-\[37em\]&quot;|class="typeset typeset-chat max-w-\[37em\]"/);
  assert.match(decode(html), /family=Lora:wght@400\.\.700/, 'the Google Fonts link loads it');
  assert.match(decode(html), /src: url\('\/public\/fonts\/lora\.woff2'\)/, 'and the self-hosted rules declare it');
  // The specimen switch and Open in New Tab carry the params.
  assert.match(decode(html), /href="\/ui\/typeset\?body=lora&heading=montserrat&scale=18"[^>]*data-item="docs"/);
  // shadcn's serializer keeps a non-default item in the query too.
  assert.match(decode(html), /href="\/ui\/preview\/typeset\/chat\?body=lora&heading=montserrat&scale=18&item=chat"[^>]*data-open-preview/);
  assert.match(html, /data-item="chat"[^>]*data-active="true"/);
});

test('the docs are true for a WebJs app', async () => {
  const html = decode(await page('/ui/typeset'));
  assert.match(html, /public\/typeset\.css/, 'typeset.css goes in public/');
  assert.match(html, /\/\* public\/input\.css \*\//, 'imported from the Tailwind input');
  assert.doesNotMatch(html, /next\/font|className=/, 'nothing of Next.js or JSX survives');
  assert.match(html, /Install shadcn\/typeset in this WebJs app\./, 'the prompt');
  assert.match(html, /Download http:\/\/localhost\/ui\/typeset\.css/, 'the prompt names this site\'s stylesheet');
});

test('/ui/preview/typeset/<item> renders every specimen with its variables', async () => {
  for (const { value } of CONTENT_OPTIONS) {
    const html = await page(`/ui/preview/typeset/${value}`);
    assert.match(html, /class="typeset w-full/, `${value}: the typeset container`);
    assert.match(html, /--preview-size: 15px; --preview-leading: 1\.75; --preview-flow: 1\.25em; --preview-measure: 37em; --preview-font: 'Geist', sans-serif/, `${value}: the defaults`);
    assert.doesNotMatch(html, /<header/, `${value}: no chrome`);
  }
  const html = await page('/ui/preview/typeset/article?body=merriweather&measure=60&leading=1.9&flow=2em');
  assert.match(html, /A Morning at the Letterpress Museum/);
  assert.match(html, /--preview-measure: 28em/);
  assert.match(html, /--preview-leading: 1\.9/);
  assert.match(html, /--preview-flow: 2em/);
  assert.match(html, /--preview-font: 'Merriweather', serif/);
  assert.match(html, /--preview-font-heading: 'Merriweather', serif/, 'the heading inherits the body');
  assert.match(await page('/ui/preview/typeset/chat'), /My Next\.js dev server takes forever/, 'the chat question bubble');
  assert.equal((await handle('/ui/preview/typeset/not-a-fixture')).status, 404);
});

test('/ui/typeset.css serves shadcn\'s stylesheet', async () => {
  const res = await handle('/ui/typeset.css');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /^text\/css/);
  const css = await res.text();
  assert.ok(css.startsWith('/*\n * shadcn/typeset\n'), 'under shadcn\'s own header');
  assert.match(css, /\.typeset \{\s*--typeset-font-body: inherit;/);
  const local = await readFile(resolve(WEBSITE_ROOT, 'public/ui-typeset.css'), 'utf8');
  assert.ok(local.endsWith(css.slice(css.indexOf('*/') + 3)), 'the same rules the /ui docs compile in');
});

test('Shuffle links a random valid typeset, keeping the specimen', async () => {
  const html = decode(await page('/ui/typeset?item=notes'));
  const hrefs = [...html.matchAll(/<a href="([^"]*)" data-action="shuffle"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 1, 'a Shuffle link (the footer, and the menu)');
  for (const href of hrefs) {
    const url = new URL(href, 'http://x');
    assert.equal(url.pathname, '/ui/typeset');
    for (const key of url.searchParams.keys()) assert.ok((PARAM_KEYS as string[]).includes(key), `${key} is a param`);
    for (const key of PARAM_KEYS) {
      const value = url.searchParams.get(key);
      if (value !== null) assert.ok(paramValues(key).includes(value), `${key}=${value} is valid`);
    }
    assert.equal(parseParams(url.searchParams).item, 'notes', 'the specimen stays');
  }
  // The shuffle itself: mono from the mono faces, body never mono, locks hold.
  for (let i = 0; i < 50; i++) {
    const next = shuffleParams({ ...DEFAULTS, body: 'lora' }, ['body']);
    assert.equal(next.body, 'lora', 'a locked param keeps its value');
    assert.ok(['jetbrains-mono', 'geist-mono'].includes(next.mono));
    assert.notEqual(next.heading, 'geist-mono');
  }
});

test('the /ui header links Typeset', async () => {
  const html = await page('/ui');
  assert.match(html, /<a [^>]*href="\/ui\/typeset"[^>]*>Typeset<\/a>/);
  const typeset = await page('/ui/typeset');
  assert.match(typeset, /<a [^>]*href="\/ui\/typeset" aria-current="page"[^>]*>Typeset<\/a>/, 'and marks it on the page');
});
