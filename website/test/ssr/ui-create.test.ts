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
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { encodePreset, isPresetCode } from '../../../packages/ui/packages/registry/themes/preset.js';
import { buildThemeVars } from '../../../packages/ui/packages/registry/themes/themes.js';
import { FIELDS, SHUFFLE_PRESETS, DEFAULT_CONFIG, normalizeConfig, parsePresetInput, shuffleConfig } from '#modules/ui/create/params.ts';
import { MENU_TARGETS, designSystemData } from '#modules/ui/create/design-system.ts';
import { newProjectCommand } from '#modules/ui/create/project.ts';

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
  assert.match(html, new RegExp(`--preset <span data-preset-code>${code}</span>`), 'the default preset code, as the flag Copy Preset copies');
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
  assert.match(wrapper, /class="[^"]*\bstyle-lyra /, 'the chosen style');
  const { light, dark } = buildThemeVars(config);
  assert.ok(wrapper.includes(`--primary: light-dark(${light.primary}, ${dark.primary})`), 'the theme\'s primary, light and dark');
  assert.ok(wrapper.includes('--radius: 0.875rem'), 'the radius');
  assert.ok(wrapper.includes(`--font-sans: 'Figtree', sans-serif`), 'the body font');
  assert.match(wrapper, /data-style="lyra" data-radius="large" data-font="figtree" data-font-heading="inherit" data-style-title="Lyra" data-font-title="Figtree"/, 'the choice as data, for preview content that shows it');
  assert.match(html, /<link rel="stylesheet" href="\/public\/ui-styles\/lyra\.css[^"]*" data-style-sheet="lyra">/, 'the style\'s stylesheet');
  assert.equal((await handle('/ui/preview/not-a-preview')).status, 404);
});

test('the /ui header lists Create and carries shadcn\'s New button', async () => {
  const html = await page('/ui');
  assert.match(html, /<a class="[^"]*" href="\/ui\/create"[^>]*>Create<\/a>/, 'Create in the main nav');
  assert.match(html, /<a href="\/ui\/create" data-new-project[^>]*>[\s\S]*?New<\/a>/, 'the New button');
});

// ---------------------------------------------------------------------------
// The rest of shadcn's configurator: menu color, the main menu and locks, the
// dialogs, the item explorer.
// ---------------------------------------------------------------------------

test('the menu color rides the frame wrapper: inverted by CSS, translucent by the menu script', async () => {
  const config = normalizeConfig({ menuColor: 'inverted-translucent', menuAccent: 'bold' });
  assert.equal(config.menuAccent, 'subtle', 'a translucent menu takes the subtle accent, as shadcn sets it');
  const html = await page(`/ui/preview/preview?preset=${encodePreset(config)}`);
  assert.match(html, /<div data-slot="design-system"[^>]*data-menu-color="inverted-translucent"/);
  assert.match(html, /\[data-slot="design-system"\]\[data-menu-color\^="inverted"\] :is\([^)]*\[data-slot="dropdown-menu-content"\][^)]*\) \{ color-scheme: dark; \}/, 'the inverted rule');
  assert.match(html, /<script src="\/public\/ui-menu-color\.js[^"]*" defer><\/script>/, 'the translucent script');
});

test('the menu script and the CSS name the same menu surfaces', () => {
  const script = readFileSync(resolve(WEBSITE_ROOT, 'public/ui-menu-color.js'), 'utf8');
  assert.ok(script.includes(`var TARGETS = '${MENU_TARGETS}';`));
});

test('the customizer carries shadcn\'s main menu, a lock per picker, and Get Code', async () => {
  const html = await page('/ui/create');
  assert.match(html, /<div popover id="create-menu" role="menu"/);
  for (const action of ['navigate', 'theme', 'undo', 'redo']) {
    assert.match(html, new RegExp(`<button type="button" role="menuitem" disabled data-action="${action}"`), `${action} waits for the element`);
  }
  assert.match(html, /<a role="menuitem" href="\/ui\/create\?preset=[^"]+" data-action="shuffle"/, 'Shuffle is a link with JS off');
  assert.match(html, /<a role="menuitem" href="\/ui\/create" data-action="reset"/, 'Reset is a link with JS off');
  for (const field of FIELDS) assert.match(html, new RegExp(`data-lock="${field}"`), `a lock for ${field}`);
  assert.match(html, /<button type="button" commandfor="create-project" command="show-modal" data-action="get-code"/);
});

test('Shuffle draws from shadcn\'s curated presets, keeping locked fields', () => {
  const config = normalizeConfig({ style: 'lyra', baseColor: 'stone', theme: 'rose', font: 'lora' });
  for (let i = 0; i < 20; i++) {
    let n = i;
    const next = shuffleConfig(config, ['style', 'font'], () => ((n = (n * 7 + 3) % 25) / 25));
    assert.equal(next.style, 'lyra', 'a locked style holds');
    assert.equal(next.font, 'lora', 'a locked font holds');
    assert.notEqual(encodePreset(next), encodePreset(config));
  }
  for (const code of SHUFFLE_PRESETS) assert.ok(isPresetCode(code), `${code} is a preset code`);
});

test('the Get Code dialog offers the real WebJs commands, one per package manager', async () => {
  const code = encodePreset(normalizeConfig({ theme: 'blue' }));
  const html = await page(`/ui/create?preset=${code}`);
  assert.match(html, /<dialog id="create-project"/);
  for (const tab of ['new', 'existing', 'theme']) assert.match(html, new RegExp(`data-tab="${tab}"`));
  assert.ok(html.includes(`npm create webjs@latest my-app &amp;&amp; cd my-app &amp;&amp; npx @webjsdev/ui init --preset ${code}`), 'npm, new project');
  assert.ok(html.includes(`bun create webjs my-app --runtime node &amp;&amp; cd my-app &amp;&amp; bunx @webjsdev/ui init --preset ${code}`), 'bun, new project');
  assert.ok(html.includes(`pnpm dlx @webjsdev/ui init --preset ${code}`), 'pnpm, existing project');
  assert.match(html, /data-theme-css>@theme inline \{/, 'the theme tokens');
  // The scaffold's own flags, and only those.
  assert.equal(newProjectCommand({ pm: 'npm', runtime: 'bun', db: 'postgres', name: 'shop' }, code), `npm create webjs@latest shop -- --runtime bun --db postgres && cd shop && npx @webjsdev/ui init --preset ${code}`);
  assert.equal(newProjectCommand({ pm: 'bun', runtime: 'node', db: 'sqlite', name: 'shop' }, code), `bun create webjs shop --runtime node && cd shop && bunx @webjsdev/ui init --preset ${code}`);
});

test('the welcome dialog is in the markup, closed', async () => {
  const html = await page('/ui/create');
  assert.match(html, /<dialog id="create-welcome"[^>]*>/);
  assert.doesNotMatch(html, /<dialog id="create-welcome"[^>]*\sopen[\s>=]/);
  assert.match(html, /Build your own WebJs UI/);
});

test('the item explorer lists component demos, and the frame renders one', async () => {
  const html = await page('/ui/create');
  assert.match(html, /<div popover id="create-explorer" data-explorer/);
  assert.match(html, /href="\/ui\/create\?preset=[^"]+&amp;item=button-demo"\s+data-item="button-demo"/, 'button-demo is listed');
  const frame = await page('/ui/preview/button-demo');
  assert.match(frame, /<div data-slot="design-system" data-item="button-demo"/);
  assert.match(frame, /data-slot="button"/, 'the demo renders');
  assert.equal((await handle('/ui/preview/no-such-demo')).status, 404);
});

test('the specimen label names the heading font only when it is a different face', () => {
  // shadcn's typography specimen labels an inheriting heading "Inherit"
  // until the heading is set to another font, unlike the font-heading title,
  // which names the inherited body font.
  const label = (fontHeading: string, font = 'inter') =>
    designSystemData(normalizeConfig({ ...DEFAULT_CONFIG, font, fontHeading })).fontHeadingLabel;
  assert.equal(label('inherit'), 'Inherit');
  assert.equal(label('inter'), 'Inherit', 'the body face chosen again is still no different face');
  assert.equal(label('lora'), 'Lora');
  assert.equal(designSystemData(normalizeConfig({ ...DEFAULT_CONFIG, fontHeading: 'inherit' })).fontHeadingTitle, 'Inter', 'while the title names the inherited font');
});

test('the footer is shadcn\'s: Copy Preset, Open Preset and Shuffle, then Get Code from md', async () => {
  const html = await page('/ui/create');
  // The last Get Code is the footer's; the first is the header's (from md).
  const footer = html.slice(html.indexOf('data-action="copy-preset"') - 400, html.lastIndexOf('data-action="get-code"') + 200);
  const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  assert.match(header, /md:\[body:has\(#create-project\)_&\]:flex[^>]*>[\s\S]*?commandfor="create-project" command="show-modal" data-action="get-code"/, 'the header\'s Get Code, shadcn\'s DesignerActions');
  const order = ['data-action="copy-preset"', 'data-action="open-preset"', 'data-action="shuffle"', 'data-action="get-code"'].map((a) => footer.indexOf(a));
  assert.ok(order.every((i) => i >= 0), 'all four controls');
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'in shadcn\'s order');
  assert.match(footer, /<span class="md:hidden">Open<\/span><span class="hidden md:inline">Open Preset<\/span>/, 'Open on a phone, Open Preset from md');
  assert.match(footer, /class="[^"]*-mt-3 hidden[^"]*md:flex[^"]*"[^>]*>\s*<button type="button" commandfor="create-project"/, 'Get Code only from md');
  assert.doesNotMatch(html, /data-init-command|Instructions<\/span>/, 'the old init command row is gone, as from shadcn\'s footer');
});

test('Open Preset is a GET form that takes either spelling of a code', async () => {
  const html = await page('/ui/create');
  assert.match(html, /<dialog id="create-open-preset"[\s\S]*?<form method="get" action="\/ui\/create"[\s\S]*?<input id="preset-code" name="preset"/, 'a dialog holding a GET form');
  assert.match(html, /commandfor="create-open-preset" command="show-modal" data-action="open-preset"/, 'opened by the footer with no script');
  assert.match(html, /data-action="open-preset"[^>]*>Open Preset\.\.\./, 'and from the menu');
  const code = encodePreset(normalizeConfig({ style: 'lyra', theme: 'blue', baseColor: 'zinc' }));
  assert.equal(parsePresetInput(code), code);
  assert.equal(parsePresetInput(` --preset ${code} `), code, 'the copied flag');
  assert.equal(parsePresetInput('open sesame'), null);
  assert.equal(parsePresetInput(''), null);
  // What the form submits with JavaScript off: the flag, spaces and all.
  for (const pasted of [code, `--preset ${code}`]) {
    const opened = await page(`/ui/create?preset=${encodeURIComponent(pasted)}`);
    assert.equal(checked(opened, 'style'), 'lyra', `${JSON.stringify(pasted)} opens the preset`);
  }
});
