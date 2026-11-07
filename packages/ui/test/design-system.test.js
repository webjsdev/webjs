/**
 * Themes, fonts, icon libraries and presets (#1666, step 8).
 *
 * The configurator at /ui/create prints `npx @webjsdev/ui init --preset
 * <code>`, so the code, the tokens it installs, and the items it pulls are a
 * contract between the site and the CLI. These tests pin that contract
 * against the packaged registry, with no network: `init` and `add` resolve
 * the default registry from disk.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { analyzeElision } from '../../server/src/component-elision.js';
import { init } from '../src/commands/init.js';
import { registryItemSchema } from '../src/registry/schema.js';
import { loadRegistryItem, loadRegistryIndex } from '../src/registry/local.js';
import { withIconLibrary } from '../src/registry/icons.js';
import { THEME_MARKER, THEME_END_MARKER, ensureTheme } from '../src/utils/theme.js';
import { THEMES, buildThemeVars } from '../packages/registry/themes/themes.js';
import { FONT_DEFINITIONS, googleFontsUrl } from '../packages/registry/themes/fonts.js';
import {
  DEFAULT_PRESET_CONFIG,
  ICON_LIBRARIES,
  PRESET_STYLES,
  buildPresetItem,
  decodePreset,
  encodePreset,
  isPresetCode,
  resolvePresetConfig,
} from '../packages/registry/themes/preset.js';

const REGISTRY = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'registry');

/** Run init quietly, returning what it printed. */
async function runInit(args) {
  const lines = [];
  const log = console.log;
  const err = console.error;
  console.log = (...a) => lines.push(a.join(' '));
  console.error = (...a) => lines.push(a.join(' '));
  try {
    await init.parseAsync(['--yes', ...args], { from: 'user' });
  } finally {
    console.log = log;
    console.error = err;
  }
  return lines.join('\n');
}

function tmp() {
  const d = mkdtempSync(join(tmpdir(), 'webjsui-ds-'));
  writeFileSync(join(d, 'package.json'), JSON.stringify({ dependencies: {} }));
  return d;
}

const ACCENTS = ['amber', 'blue', 'cyan', 'emerald', 'fuchsia', 'green', 'indigo', 'lime', 'orange', 'pink', 'purple', 'red', 'rose', 'sky', 'teal', 'violet', 'yellow'];
const BASES = ['neutral', 'stone', 'zinc', 'mauve', 'olive', 'mist', 'taupe'];

// ---------------------------------------------------------------------------
// Registry items
// ---------------------------------------------------------------------------

test('all 24 of shadcn\'s themes are registry:theme items that compose and validate', () => {
  assert.equal(THEMES.length, 24);
  for (const name of [...BASES, ...ACCENTS]) {
    const item = loadRegistryItem(`theme-${name}`);
    assert.ok(item, `theme-${name} resolves`);
    assert.equal(item.type, 'registry:theme');
    const parsed = registryItemSchema.safeParse(item);
    assert.ok(parsed.success, `theme-${name} validates: ${parsed.error && parsed.error.message}`);
  }
  // An accent theme is shadcn's partial layer: cssVars, no file.
  const blue = loadRegistryItem('theme-blue');
  assert.equal(blue.files, undefined);
  assert.equal(blue.cssVars.light.primary, 'oklch(0.488 0.243 264.376)');
  assert.equal(blue.cssVars.dark.primary, 'oklch(0.424 0.199 265.638)');
  const index = loadRegistryIndex().filter((it) => it.type === 'registry:theme');
  assert.equal(index.length, 24, 'the index lists every theme once');
});

test('the font items carry shadcn\'s font field and survive schema validation', () => {
  assert.equal(FONT_DEFINITIONS.length, 26);
  for (const f of FONT_DEFINITIONS) {
    for (const name of [`font-${f.name}`, `font-heading-${f.name}`]) {
      const item = loadRegistryItem(name);
      assert.ok(item, `${name} resolves`);
      const parsed = registryItemSchema.parse(item);
      assert.equal(parsed.type, 'registry:font');
      assert.equal(parsed.font.family, f.family, `${name} keeps its font field through parse`);
    }
  }
  const heading = loadRegistryItem('font-heading-lora');
  assert.equal(heading.font.variable, '--font-heading');
  assert.deepEqual(heading.cssVars.theme, { 'font-heading': "'Lora', serif" });
  assert.equal(googleFontsUrl(FONT_DEFINITIONS.find((f) => f.name === 'dm-sans')), 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@100..1000&display=swap');
});

test('the five icon libraries are registry items exporting the same function names', () => {
  const names = (src) => [...src.matchAll(/^export function (\w+)\(/gm)].map((m) => m[1]);
  const lucide = names(readFileSync(join(REGISTRY, 'lib', 'icons.ts'), 'utf8'));
  assert.ok(lucide.length >= 150, `lucide has ${lucide.length} icons`);
  assert.ok(lucide.includes('ChevronDownIcon'));
  for (const lib of ICON_LIBRARIES) {
    const item = loadRegistryItem(lib.item);
    assert.ok(item, `${lib.item} resolves`);
    assert.ok(registryItemSchema.safeParse(item).success, `${lib.item} validates`);
    assert.equal(item.files[0].target, 'lib/icons.ts', `${lib.item} lands at the one icons path`);
    assert.deepEqual(names(item.files[0].content), lucide, `${lib.item} exports lucide's names, in order`);
  }
});

test('no icon library pins a page that imports it to the browser', async () => {
  // A glyph class can spell a browser global (`lucide-app-window`). The elision
  // analyser reads a string literal as data, not a reference, so an icon file
  // stays pure markup and a page importing it stays inert. Drive the real
  // analyser rather than grepping for the word, so the test tracks its rule.
  // The analyser only scans files under the app, so mount each library there.
  const page = '/app/page.js';
  for (const lib of ICON_LIBRARIES) {
    const file = `/app/${lib.path}`;
    const files = {
      [page]: `import { html } from '@webjsdev/core';\nimport { AppWindowIcon } from '${file}';\nexport default () => html\`<p>\${AppWindowIcon()}</p>\`;`,
      [file]: readFileSync(join(REGISTRY, lib.path), 'utf8'),
    };
    const graph = new Map([[page, new Set([file])]]);
    const r = await analyzeElision([], [page], graph, async (f) => files[f], '/app');
    assert.ok(r.inertRouteModules.has(page), `${lib.path} pins its importer: ${r.shippedRouteModules?.get?.(page)?.reason ?? ''}`);
  }
  // The class string carries the word literally, so the runtime class is the glyph's own.
  assert.match(readFileSync(join(REGISTRY, 'lib', 'icons.ts'), 'utf8'), /'lucide lucide-app-window'/);
});

test('the preset module does no work at module scope (the configurator runs it in the browser)', () => {
  const src = readFileSync(join(REGISTRY, 'themes', 'preset.js'), 'utf8');
  for (const line of src.split('\n')) {
    if (/^export const|^const/.test(line)) assert.doesNotMatch(line, /=\s*[\w.]+\(|\.map\(|Object\.fromEntries/, `a module-scope call: ${line}`);
  }
});

// ---------------------------------------------------------------------------
// The preset code
// ---------------------------------------------------------------------------

test('a preset code round-trips every field', () => {
  const config = {
    style: 'lyra', baseColor: 'zinc', theme: 'blue', chartColor: 'emerald', iconLibrary: 'tabler',
    font: 'jetbrains-mono', fontHeading: 'playfair-display', radius: 'large', menuAccent: 'bold', menuColor: 'inverted',
  };
  const code = encodePreset(config);
  assert.ok(isPresetCode(code));
  assert.deepEqual(decodePreset(code), config);
  for (const style of PRESET_STYLES) assert.equal(decodePreset(encodePreset({ style })).style, style);
  assert.deepEqual(decodePreset('b0'), DEFAULT_PRESET_CONFIG);
});

test('a code shadcn printed decodes to the config shadcn encoded (wire compatible)', () => {
  // `b4rvdY0k5R` is what shadcn's encodePreset gives the config above (taken
  // from shadcn's own preset.test.ts config, encoded with its encoder).
  assert.equal(encodePreset({
    style: 'lyra', baseColor: 'zinc', theme: 'blue', chartColor: 'emerald', iconLibrary: 'tabler',
    font: 'jetbrains-mono', fontHeading: 'playfair-display', radius: 'large', menuAccent: 'bold', menuColor: 'inverted',
  }), 'b4rvdY0k5R');
  // A code from shadcn's site.
  assert.deepEqual(decodePreset('b4xFeBLg4O'), {
    menuColor: 'default', menuAccent: 'subtle', radius: 'default', font: 'noto-sans', iconLibrary: 'lucide',
    theme: 'taupe', baseColor: 'taupe', style: 'sera', chartColor: 'taupe', fontHeading: 'playfair-display',
  });
  // A v1 code has no chart colour and inherits its heading font.
  assert.equal(decodePreset('a0').fontHeading, 'inherit');
  assert.equal(decodePreset('a0').chartColor, undefined);
  assert.equal(decodePreset('c123'), null);
  assert.equal(decodePreset('b!'), null);
});

test('resolvePresetConfig rejects what the kit does not ship, as shadcn does', () => {
  assert.match(resolvePresetConfig({ baseColor: 'gray', theme: 'gray' }).error, /base color "gray"/);
  assert.match(resolvePresetConfig({ baseColor: 'zinc', theme: 'stone' }).error, /not available for base color/);
  const ok = resolvePresetConfig({ style: 'nova', baseColor: 'stone', theme: 'rose', font: 'inter', fontHeading: 'inter' });
  assert.equal(ok.config.chartColor, 'rose', 'the chart follows the theme');
  assert.equal(ok.config.fontHeading, 'inherit', 'a heading font equal to the body font is inherited');
});

test('the theme builder matches shadcn\'s theme-blue (neutral base, blue accent)', () => {
  const { light, dark } = buildThemeVars({ baseColor: 'neutral', theme: 'blue' });
  // apps/v4/app/legacy-themes.css `.theme-blue`.
  assert.equal(light.primary, 'oklch(0.488 0.243 264.376)');
  assert.equal(light.secondary, 'oklch(0.967 0.001 286.375)');
  assert.equal(light.muted, 'oklch(0.97 0 0)');
  assert.equal(light['chart-1'], 'oklch(0.809 0.105 251.813)');
  assert.equal(light['sidebar-primary'], 'oklch(0.546 0.245 262.881)');
  assert.equal(light.radius, '0.625rem');
  assert.equal(dark.primary, 'oklch(0.424 0.199 265.638)');
  assert.equal(dark['sidebar-primary'], 'oklch(0.623 0.214 259.815)');
  const bold = buildThemeVars({ baseColor: 'neutral', theme: 'blue', menuAccent: 'bold', radius: 'none' });
  assert.equal(bold.light.accent, bold.light.primary);
  assert.equal(bold.light.radius, '0');
});

test('buildPresetItem is a valid registry:base item naming what the preset installs', () => {
  const { config } = resolvePresetConfig({ style: 'nova', baseColor: 'zinc', theme: 'violet', iconLibrary: 'phosphor', font: 'geist', fontHeading: 'lora' });
  const item = buildPresetItem(config);
  assert.ok(registryItemSchema.safeParse(item).success);
  assert.equal(item.type, 'registry:base');
  assert.equal(item.meta.preset, encodePreset(config));
  assert.deepEqual(item.registryDependencies, ['lib-utils', 'lib-dom', 'lib-icons-phosphor', 'font-geist', 'font-heading-lora']);
  assert.equal(item.cssVars.light.primary, THEMES.find((t) => t.name === 'violet').cssVars.light.primary);
  assert.deepEqual(item.cssVars.theme, { 'font-sans': "'Geist', sans-serif", 'font-heading': "'Lora', serif" });
});

// ---------------------------------------------------------------------------
// init --preset / --style / --icons
// ---------------------------------------------------------------------------

test('init --preset writes the theme block between its START and END markers', async () => {
  const d = tmp();
  try {
    const code = encodePreset({ style: 'vega', baseColor: 'neutral', theme: 'blue', iconLibrary: 'tabler', font: 'figtree' });
    const out = await runInit(['--cwd', d, '--preset', code]);
    const cfg = JSON.parse(readFileSync(join(d, 'components.json'), 'utf8'));
    assert.equal(cfg.style, 'vega');
    assert.equal(cfg.tailwind.baseColor, 'neutral');
    assert.equal(cfg.iconLibrary, 'tabler');
    const css = readFileSync(join(d, 'styles', 'globals.css'), 'utf8');
    assert.equal(css.split(THEME_MARKER).length, 2, 'one START marker');
    assert.equal(css.split(THEME_END_MARKER).length, 2, 'one END marker');
    assert.ok(css.indexOf(THEME_MARKER) < css.indexOf(THEME_END_MARKER));
    assert.match(css, /--primary: oklch\(0\.488 0\.243 264\.376\);/, 'blue primary in :root');
    assert.match(css, /--primary: oklch\(0\.424 0\.199 265\.638\);/, 'blue primary in .dark');
    assert.match(css, /--font-sans: 'Figtree', sans-serif;/, 'the body font token');
    assert.match(css, /--font-heading: var\(--font-sans\);/, 'the heading font inherits');
    assert.match(out, /fonts\.googleapis\.com\/css2\?family=Figtree/, 'init names where to load the face');
    // The chosen icon library lands beside cn().
    const icons = readFileSync(join(d, 'lib', 'utils', 'icons.ts'), 'utf8');
    assert.equal(icons, readFileSync(join(REGISTRY, 'lib', 'icons-tabler.ts'), 'utf8'));
  } finally {
    rmSync(d, { recursive: true });
  }
});

test('a second init --preset replaces the block in place and keeps the app\'s own CSS', async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, 'styles'), { recursive: true });
    writeFileSync(join(d, 'styles', 'globals.css'), '@import "tailwindcss";\n');
    await runInit(['--cwd', d, '--preset', encodePreset({ baseColor: 'neutral', theme: 'blue' })]);
    // The app adds its own rules after the block.
    writeFileSync(join(d, 'styles', 'globals.css'), readFileSync(join(d, 'styles', 'globals.css'), 'utf8') + '\n.app-rule { color: red; }\n');
    const out = await runInit(['--cwd', d, '--preset', encodePreset({ baseColor: 'neutral', theme: 'rose' })]);
    const css = readFileSync(join(d, 'styles', 'globals.css'), 'utf8');
    assert.match(out, /Replaced the theme/);
    assert.equal(css.split(THEME_MARKER).length, 2, 'still one block');
    assert.ok(css.startsWith('@import "tailwindcss";\n'), 'what precedes the block is kept');
    assert.match(css, /\.app-rule \{ color: red; \}/, 'what follows the block is kept');
    assert.ok(css.indexOf('.app-rule') > css.indexOf(THEME_END_MARKER));
    const rose = THEMES.find((t) => t.name === 'rose').cssVars.light.primary;
    assert.ok(css.includes(`--primary: ${rose};`), 'the new theme is in');
    assert.ok(!css.includes('--primary: oklch(0.488 0.243 264.376);'), 'the old theme is out');
  } finally {
    rmSync(d, { recursive: true });
  }
});

test('a theme block without an END marker is left alone and reported', async () => {
  const d = tmp();
  try {
    mkdirSync(join(d, 'styles'), { recursive: true });
    const legacy = `${THEME_MARKER}\n:root { --primary: #000; }\n.mine { color: blue; }\n`;
    writeFileSync(join(d, 'styles', 'globals.css'), legacy);
    const out = await runInit(['--cwd', d, '--preset', encodePreset({ theme: 'blue' })]);
    assert.equal(readFileSync(join(d, 'styles', 'globals.css'), 'utf8'), legacy, 'not one byte changed');
    assert.match(out, /predates the end marker/);
    const r = await ensureTheme(d, 'neutral', 'styles/globals.css', undefined, { replace: true });
    assert.equal(r.status, 'legacy');
  } finally {
    rmSync(d, { recursive: true });
  }
});

test('init with no preset and no --overwrite leaves an existing block alone', async () => {
  const d = tmp();
  try {
    await runInit(['--cwd', d]);
    const first = readFileSync(join(d, 'styles', 'globals.css'), 'utf8');
    assert.ok(first.includes(THEME_END_MARKER), 'a fresh block carries the END marker');
    await runInit(['--cwd', d, '--base-color', 'zinc']);
    assert.equal(readFileSync(join(d, 'styles', 'globals.css'), 'utf8'), first);
    assert.equal(existsSync(join(d, 'lib', 'utils', 'icons.ts')), false, 'no icon library unless one is named');
  } finally {
    rmSync(d, { recursive: true });
  }
});

test('--style and --icons write components.json and the chosen icon file', async () => {
  const d = tmp();
  try {
    await runInit(['--cwd', d, '--style', 'nova', '--icons', 'phosphor']);
    let cfg = JSON.parse(readFileSync(join(d, 'components.json'), 'utf8'));
    assert.equal(cfg.style, 'nova');
    assert.equal(cfg.iconLibrary, 'phosphor');
    const target = join(d, 'lib', 'utils', 'icons.ts');
    assert.equal(readFileSync(target, 'utf8'), readFileSync(join(REGISTRY, 'lib', 'icons-phosphor.ts'), 'utf8'));
    // Switching libraries replaces a file that is still as shipped...
    await runInit(['--cwd', d, '--icons', 'remixicon']);
    cfg = JSON.parse(readFileSync(join(d, 'components.json'), 'utf8'));
    assert.equal(cfg.iconLibrary, 'remixicon');
    assert.equal(cfg.style, 'nova', 'a re-run keeps the style it was not asked to change');
    assert.equal(readFileSync(target, 'utf8'), readFileSync(join(REGISTRY, 'lib', 'icons-remixicon.ts'), 'utf8'));
    // ...but keeps one the app edited, unless --overwrite.
    writeFileSync(target, readFileSync(target, 'utf8') + '\nexport const mine = 1;\n');
    const out = await runInit(['--cwd', d, '--icons', 'lucide']);
    assert.match(out, /has been edited/);
    assert.match(readFileSync(target, 'utf8'), /export const mine = 1;/);
    await runInit(['--cwd', d, '--icons', 'lucide', '--overwrite']);
    assert.equal(readFileSync(target, 'utf8'), readFileSync(join(REGISTRY, 'lib', 'icons.ts'), 'utf8'));
  } finally {
    rmSync(d, { recursive: true });
  }
});

test('add swaps lib-icons for the library components.json names', async () => {
  const tree = [{ name: 'lib-utils' }, { name: 'lib-icons', files: [] }, { name: 'login-01' }];
  const swapped = await withIconLibrary(tree, 'hugeicons');
  assert.deepEqual(swapped.map((i) => i.name), ['lib-utils', 'lib-icons-hugeicons', 'login-01']);
  assert.equal(await withIconLibrary(tree, 'lucide'), tree, 'Lucide is the item itself');
  assert.equal(await withIconLibrary(tree, undefined), tree);
});
