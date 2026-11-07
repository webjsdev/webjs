/**
 * /ui/create, the design-system configurator, and its preview frame (#1666).
 *
 * The state is the query string, so the server renders every picker, the
 * preset code, the init command and the preview frame right for it on the
 * first paint, with JavaScript off. These assert that against the real
 * request pipeline, and that the frame wears exactly the tokens
 * `webjsui init --preset` installs.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { encodePreset } from '../../../packages/ui/packages/registry/themes/preset.js';
import { buildThemeVars } from '../../../packages/ui/packages/registry/themes/themes.js';
import { FIELDS, normalizeConfig } from '#modules/ui/create/params.ts';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

let handle: (path: string) => Promise<Response>;

before(async () => {
  const app = await createRequestHandler({ appDir: WEBSITE_ROOT, dev: false });
  await app.warmup?.();
  handle = async (path) => app.handle(new Request('http://localhost' + path));
});

async function page(path: string): Promise<string> {
  const res = await handle(path);
  assert.equal(res.status, 200, `${path} renders`);
  return res.text();
}

/** The checked radio's value for a field, read from the served markup. */
function checked(html: string, field: string): string | undefined {
  const re = new RegExp(`<input type="radio" name="${field}" value="([^"]+)"\\s+checked`, 'g');
  return re.exec(html)?.[1];
}

test('/ui/create renders the configurator as a GET form with every picker', async () => {
  const html = await page('/ui/create');
  assert.match(html, /<create-customizer[^>]*data-slot="designer"/);
  assert.match(html, /<form method="get" action="\/ui\/create"/);
  for (const field of FIELDS) assert.match(html, new RegExp(`data-picker="${field}"`), `the ${field} picker`);
  const code = encodePreset(normalizeConfig({}));
  assert.match(html, new RegExp(`data-preset-code>${code}<`), 'the default preset code');
  assert.match(html, new RegExp(`data-init-command>npx @webjsdev/ui init --preset ${code}<`), 'the init command');
  assert.match(html, new RegExp(`<iframe src="/ui/preview/preview\\?preset=${code}"`), 'the preview frame');
  assert.equal(checked(html, 'style'), 'nova', 'shadcn\'s default style');
});

test('a choice in the query string reaches every panel', async () => {
  const html = await page('/ui/create?style=lyra&baseColor=zinc&theme=blue&font=lora&iconLibrary=tabler');
  const config = normalizeConfig({ style: 'lyra', baseColor: 'zinc', theme: 'blue', font: 'lora', iconLibrary: 'tabler' });
  const code = encodePreset(config);
  assert.equal(checked(html, 'style'), 'lyra');
  assert.equal(checked(html, 'theme'), 'blue');
  assert.equal(checked(html, 'iconLibrary'), 'tabler');
  assert.match(html, new RegExp(`data-preset-code>${code}<`));
  // A theme zinc cannot wear (another base color) is hidden and off.
  assert.match(html, /data-option="stone" hidden="">\s*<input type="radio" name="theme" value="stone"\s+disabled/);
  // The code alone gives the same page.
  const again = await page(`/ui/create?preset=${code}`);
  assert.equal(checked(again, 'theme'), 'blue');
  assert.equal(checked(again, 'font'), 'lora');
});

test('a theme the base color cannot wear follows the base color', async () => {
  const html = await page('/ui/create?baseColor=stone&theme=zinc');
  assert.equal(checked(html, 'theme'), 'stone');
});

test('/ui/preview/<name> wears the design system init --preset installs', async () => {
  const config = normalizeConfig({ style: 'lyra', baseColor: 'neutral', theme: 'blue', radius: 'large', font: 'figtree' });
  const res = await handle(`/ui/preview/preview?preset=${encodePreset(config)}`);
  assert.equal(res.status, 200);
  const html = await res.text();
  const wrapper = html.match(/<div data-slot="design-system"[^>]*>/)?.[0] ?? '';
  assert.ok(wrapper, 'the design-system wrapper');
  assert.match(wrapper, /class="style-lyra /, 'the chosen style');
  const { light, dark } = buildThemeVars(config);
  assert.ok(wrapper.includes(`--primary: light-dark(${light.primary}, ${dark.primary})`), 'the theme\'s primary, light and dark');
  assert.ok(wrapper.includes('--radius: 0.875rem'), 'the radius');
  assert.ok(wrapper.includes(`--font-sans: 'Figtree', sans-serif`), 'the body font');
  assert.match(html, /<link rel="stylesheet" href="\/public\/ui-styles\/lyra\.css[^"]*" data-style-sheet="lyra">/, 'the style\'s stylesheet');
  assert.equal((await handle('/ui/preview/not-a-preview')).status, 404);
});

test('the /ui header lists Create and carries shadcn\'s New button', async () => {
  const html = await page('/ui');
  assert.match(html, /<a class="[^"]*" href="\/ui\/create"[^>]*>Create<\/a>/, 'Create in the main nav');
  assert.match(html, /<a href="\/ui\/create" data-new-project[^>]*>[\s\S]*?New<\/a>/, 'the New button');
});
