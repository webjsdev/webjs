/**
 * shadcn's themes on the /ui pages, and the preset endpoints (#1666).
 *
 * A docs preview wears a theme by class (`theme-blue`), as shadcn's does, so
 * the class has to reach the page AND the stylesheet the page links has to
 * define it. The rules are generated from the kit's theme data
 * (scripts/build-ui-themes.mjs, run by copy-registry.mjs, which `npm test`
 * runs first), imported by public/ui-input.css, and compiled into ui.css.
 *
 * /ui/init and /ui/init/md are what the configurator's preset code resolves
 * through, so they are asserted against the real request pipeline.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { THEMES_CSS, themeRule, themeStylesheet } from '../../scripts/build-ui-themes.mjs';
import { encodePreset } from '../../../packages/ui/packages/registry/themes/preset.js';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

let handle: (path: string) => Promise<Response>;

before(async () => {
  const app = await createRequestHandler({ appDir: WEBSITE_ROOT, dev: false });
  await app.warmup?.();
  handle = async (path) => app.handle(new Request('http://localhost' + path));
});

// shadcn's `.theme-blue` (apps/v4/app/legacy-themes.css): the blue primary,
// light and dark, in the site's light-dark() form.
const BLUE_PRIMARY = '--primary: light-dark(oklch(0.488 0.243 264.376), oklch(0.424 0.199 265.638));';

test('every one of shadcn\'s 24 themes is a .theme-<name> class in light-dark() form', () => {
  const css = themeStylesheet();
  const names = [...css.matchAll(/^\.ui-site \.theme-([a-z]+) \{$/gm)].map((m) => m[1]);
  assert.equal(names.length, 24);
  assert.ok(themeRule('blue').includes(BLUE_PRIMARY), 'theme-blue sets the blue primary');
  // A base colour is a whole palette with its own chart ramp.
  assert.match(themeRule('stone'), /--chart-1: oklch\(0\.869 0\.005 56\.366\);/);
  assert.match(themeRule('neutral'), /--radius: 0\.625rem;/);
  // A value the same in both modes is written once, plain.
  assert.match(themeRule('blue'), /--primary-foreground: oklch\(0\.97 0\.014 254\.604\);/);
});

test('the /ui stylesheet imports the generated theme classes, and the generator has run', () => {
  const input = readFileSync(resolve(WEBSITE_ROOT, 'public/ui-input.css'), 'utf8');
  assert.match(input, /@import "\.\.\/node_modules\/\.cache\/ui-styles\/themes\.css";/);
  assert.ok(!/\.ui-site \.theme-neutral \{/.test(input), 'no hand-written copy beside the generated one');
  assert.equal(readFileSync(THEMES_CSS, 'utf8'), themeStylesheet(), 'copy-registry wrote the current rules');
});

test('a page using theme-blue renders the class inside .ui-site and links the stylesheet defining it', async () => {
  const res = await handle('/ui/docs/components/bubble');
  assert.equal(res.status, 200);
  const html = await res.text();
  const site = html.indexOf('ui-site');
  assert.ok(site >= 0, 'the page renders inside .ui-site');
  const blue = html.search(/class="[^"]*\btheme-blue\b/);
  assert.ok(blue > site, 'the bubble preview wears theme-blue inside .ui-site');
  assert.match(html, /<link[^>]+href="\/public\/ui\.css[^"]*"/, 'the page links ui.css, which compiles the theme classes');
});

test('/ui/init returns the registry payload for a preset', async () => {
  const code = encodePreset({ style: 'nova', baseColor: 'neutral', theme: 'blue', iconLibrary: 'tabler', font: 'figtree' });
  const res = await handle(`/ui/init?preset=${code}`);
  assert.equal(res.status, 200);
  const item = await res.json();
  assert.equal(item.type, 'registry:base');
  assert.equal(item.meta.preset, code);
  assert.equal(item.cssVars.light.primary, 'oklch(0.488 0.243 264.376)');
  assert.equal(item.cssVars.theme['font-sans'], "'Figtree', sans-serif");
  assert.ok(item.registryDependencies.includes('lib-icons-tabler'));
  // A field given beside the code overrides it.
  const over = await (await handle(`/ui/init?preset=${code}&theme=rose`)).json();
  assert.equal(over.meta.config.theme, 'rose');
  // Not a code, or not a choice the kit offers.
  assert.equal((await handle('/ui/init?preset=nope!')).status, 400);
  assert.equal((await handle('/ui/init?baseColor=gray&theme=gray')).status, 400);
});

test('/ui/init/md returns the markdown instructions for a preset', async () => {
  const code = encodePreset({ style: 'vega', baseColor: 'stone', theme: 'stone', font: 'lora' });
  const res = await handle(`/ui/init/md?preset=${code}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/markdown/);
  const md = await res.text();
  assert.ok(md.includes(`npx @webjsdev/ui init --preset ${code}`), 'leads with the one command');
  assert.match(md, /"style": "vega"/);
  assert.match(md, /--font-serif: 'Lora', serif;/);
  assert.match(md, /fonts\.googleapis\.com\/css2\?family=Lora/);
  assert.match(md, /\bbutton\b/, 'lists the components');
});
