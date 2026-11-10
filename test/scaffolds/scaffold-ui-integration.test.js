/**
 * Verifies that the full-stack scaffold pre-initialises the Webjs UI kit
 * correctly: components.json + lib/utils/cn.ts + styles/globals.css are written
 * so the app is ready for `webjs ui add`, but no component kit is pre-copied
 * (components are added on demand). The API template deliberately ships none of
 * that.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { scaffoldApp } from '../../packages/cli/lib/create.js';
import { DEFAULT_ALIASES, DEFAULT_TAILWIND_CSS, init } from '../../packages/ui/src/commands/init.js';
import { add } from '../../packages/ui/src/commands/add.js';
import { analyzeRouteModules } from '../../packages/server/src/route-report.js';

async function tempCwd() {
  return mkdtemp(join(tmpdir(), 'webjs-scaffold-ui-'));
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

test('full-stack scaffold pre-initialises the Webjs UI kit', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const appDir = join(cwd, 'demo');

    // Bootstrap for `webjs ui add`: the config + cn() helper + theme ship, so an
    // app can add components on demand. No component ships until it is added.
    assert.ok(await exists(join(appDir, 'components.json')), 'components.json should exist');
    assert.ok(await exists(join(appDir, 'lib', 'utils', 'cn.ts')), 'lib/utils/cn.ts should exist');
    assert.ok(await exists(join(appDir, 'styles', 'globals.css')), 'styles/globals.css should exist');
    assert.equal(existsSync(join(appDir, 'app', 'globals.css')), false, 'globals.css must not be in routing-only app/');
    // The kit's Button, which the theme toggle uses, and nothing else.
    assert.deepEqual(readdirSync(join(appDir, 'components', 'ui')), ['button.ts'], 'components/ui holds only the kit Button');
    assert.deepEqual(readdirSync(join(appDir, 'modules')), [], 'modules/ ships empty (no demo modules)');

    // The scaffold and `webjsui init` must emit the SAME components.json, so
    // that initialising a bare app and scaffolding a new one land on one
    // layout. Asserted against the ui package's own constants rather than a
    // copied literal, because these two generators silently disagreed on the
    // `utils` alias until #1129 while a comment on each claimed they matched.
    const cfg = JSON.parse(await readFile(join(appDir, 'components.json'), 'utf8'));
    assert.equal(cfg.tailwind.css, DEFAULT_TAILWIND_CSS);
    assert.equal(cfg.tailwind.baseColor, 'neutral');
    assert.deepEqual(cfg.aliases, DEFAULT_ALIASES);

    const layout = await readFile(join(appDir, 'app', 'layout.ts'), 'utf8');

    // CSS delivery (#947): the layout links a STATIC compiled stylesheet (works
    // with JS off), not the browser runtime. The Tailwind @theme maps live in
    // public/input.css; the token VALUES live in styles/globals.css, in the
    // theme block a preset replaces (see the preset test below).
    // The href goes through asset() (#1194), so the compiled stylesheet carries
    // a content hash in production and is served immutable: a deploy that
    // changes the CSS changes the url, and no browser or CDN can serve the old
    // bytes at the stable path. Still a plain static stylesheet, JS-off safe.
    assert.match(layout, /<link rel="stylesheet" href=\$\{asset\('\/tailwind\.css'\)\}>/,
      'layout links the static compiled stylesheet through asset()');
    assert.match(layout, /import \{[^}]*\basset\b[^}]*\} from '@webjsdev\/core'/,
      'and imports asset from core');
    assert.doesNotMatch(layout, /tailwind-browser\.js|type="text\/tailwindcss"/,
      'layout no longer ships the Tailwind browser runtime');
    const inputCss = await readFile(join(appDir, 'public', 'input.css'), 'utf8');
    assert.match(inputCss, /@import "tailwindcss"/, 'input.css imports Tailwind');
    // The ui theme is IMPORTED from the stylesheet components.json names, so
    // the tokens `webjs ui add` merges there for a block reach the compiled CSS.
    assert.match(inputCss, /@import "\.\.\/styles\/globals\.css"/, 'input.css imports the ui theme components.json names');
    const globalsCss = await readFile(join(appDir, 'styles', 'globals.css'), 'utf8');
    assert.match(globalsCss, /color-primary/, 'which carries the @theme color maps');
    assert.doesNotMatch(inputCss, /@webjsdev\/ui theme/, 'and is not copied a second time into input.css');
    // Every fluid --text-<name> size carries its --text-<name>--line-height
    // companion. Tailwind v4's text-<name> utility emits
    // `line-height: var(--tw-leading, var(--text-<name>--line-height))`, so a
    // size without one resolves to an invalid value and the heading falls back
    // to the body's 1.6 line height, opening huge gaps between lines (#1541).
    const sizes = [...inputCss.matchAll(/^\s*--text-([a-z0-9-]+?):\s*clamp\(/gm)].map((m) => m[1]);
    assert.deepEqual(sizes, ['display', 'h1', 'h2', 'lede'], 'the scaffold defines the fluid type scale');
    for (const name of sizes) {
      assert.match(inputCss, new RegExp(`--text-${name}--line-height:\\s*[0-9.]+;`),
        `--text-${name} carries its line-height companion`);
    }
    // The values are plain CSS in the compiled stylesheet, so the light theme
    // paints with JS off; the dark one is the .dark class, the kit's (and a
    // preset's) switch, which the layout's inline script sets before paint.
    assert.match(globalsCss, /:root \{[\s\S]*?--primary: oklch\([^)]*\);/, 'the palette VALUES are plain CSS in the theme');
    assert.match(layout, /classList\.toggle\('dark'/, 'and the layout keeps .dark in step with the choice');
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('api scaffold deliberately ships no ui-* components', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'api' });
    const appDir = join(cwd, 'demo');

    // API has no UI: none of these should exist
    assert.equal(existsSync(join(appDir, 'components', 'ui')), false);
    assert.equal(existsSync(join(appDir, 'components.json')), false);
    assert.equal(existsSync(join(appDir, 'app', 'globals.css')), false);
    assert.equal(existsSync(join(appDir, 'styles', 'globals.css')), false);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('api scaffold route imports resolve to real modules/ files', async () => {
  // The route imports modules via the #modules alias (#555/#556), which
  // eliminates the relative `../`-depth off-by-one this test originally
  // guarded: `#modules/<feature>/...` is depth-independent.
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'api' });
    const appDir = join(cwd, 'demo');

    const route = await readFile(join(appDir, 'app', 'api', 'users', 'route.ts'), 'utf8');
    // Must NOT contain any relative `../` path to modules (the alias replaces it).
    assert.doesNotMatch(
      route,
      /from '(\.\.\/)+modules\//,
      'route.ts should reach modules/ via the #modules alias, not a relative ../ path',
    );
    // Must use the #modules alias.
    assert.match(route, /from '#modules\/users\/queries\/list-users\.server\.ts'/);
    assert.match(route, /from '#modules\/users\/actions\/create-user\.server\.ts'/);

    // The imported module files must actually exist on disk.
    assert.ok(
      await exists(join(appDir, 'modules', 'users', 'queries', 'list-users.server.ts')),
      'modules/users/queries/list-users.server.ts should exist',
    );
    assert.ok(
      await exists(join(appDir, 'modules', 'users', 'actions', 'create-user.server.ts')),
      'modules/users/actions/create-user.server.ts should exist',
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('lib/utils/cn.ts ships the pure cn() helper; onBeforeCache is in lib/utils/dom.ts (#819)', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const utils = await readFile(join(cwd, 'demo', 'lib', 'utils', 'cn.ts'), 'utf8');
    assert.match(utils, /export function cn/);
    assert.match(utils, /ClassValue/);
    // #819: the HTMLElement-era Base + defineElement were removed (the ui
    // components extend WebComponent now), so cn.ts stays pure and importing it
    // does not pin a page. onBeforeCache moved to its own client module.
    assert.ok(!/export\s+(?:class|const)\s+Base\b/.test(utils), 'Base removed from cn.ts');
    assert.ok(!/export\s+function\s+defineElement\b/.test(utils), 'defineElement removed from cn.ts');
    const dom = await readFile(join(cwd, 'demo', 'lib', 'utils', 'dom.ts'), 'utf8');
    assert.match(dom, /export function onBeforeCache\b/, 'onBeforeCache is shipped in lib/utils/dom.ts');
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('a page using only the kit class helpers loads no JavaScript and draws no hint (#1320)', async () => {
  // Tier-1 class helpers are pure functions returning class strings. A page
  // never ships (#1686), and the helpers register no element, so a page that
  // uses only them loads nothing in the browser, and nothing in it looks meant
  // for the browser. Asserted on the route REPORT rather than on byte size:
  // size moves with every unrelated kit change.
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const appDir = join(cwd, 'demo');

    // Local-first registry resolution, so no network. `--no-deps` skips the npm
    // install the app does not need to be analysed.
    await add.parseAsync(
      ['button', 'card', 'input', 'native-select', '--cwd', appDir, '--overwrite', '--yes', '--no-deps'],
      { from: 'user' },
    );

    await mkdir(join(appDir, 'app', 'kit'), { recursive: true });
    await writeFile(join(appDir, 'app', 'kit', 'page.ts'), [
      `import { html } from '@webjsdev/core';`,
      `import { buttonClass } from '#components/ui/button.ts';`,
      `import { cardClass } from '#components/ui/card.ts';`,
      `import { inputClass } from '#components/ui/input.ts';`,
      `import { nativeSelectClass, nativeSelectWrapperClass } from '#components/ui/native-select.ts';`,
      ``,
      `export default function Kit() {`,
      `  return html\`<div class=\${cardClass()}>`,
      `    <input class=\${inputClass()} name="q">`,
      `    <div class=\${nativeSelectWrapperClass()}>`,
      `      <select class=\${nativeSelectClass()} name="plan"><option value="a">A</option></select>`,
      `    </div>`,
      `    <button class=\${buttonClass()}>Go</button>`,
      `  </div>\`;`,
      `}`,
    ].join('\n'));
    const report = await analyzeRouteModules(appDir);
    assert.ok(report.analysed, `the route analysis ran (skipped: ${report.skipped})`);

    const kit = report.routeModules.find((r) => r.file === join('app', 'kit', 'page.ts'));
    assert.ok(kit, 'the kit page has a row');
    // It imports only Tier-1 helpers, which register no element, so there is
    // nothing for it to carry into the browser and nothing to hint about.
    assert.deepEqual(kit.emits, [], 'the kit page loads no JavaScript');
    assert.deepEqual(kit.hints, [], 'and holds nothing that looks meant for the browser');

  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

/** Every .ts file under a directory, recursively. */
function tsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tsFiles(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []);
}

test('webjs ui add --overwrite in a fresh app keeps the shell working', async () => {
  // A fresh app's `add dialog` pulls the kit's card, input, button and badge
  // into components/ui/, overwriting the Button the theme toggle uses. The
  // shell imports only the kit's public helper (buttonClass), so it keeps
  // resolving; nothing else in the shell imports from components/ui/.
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const appDir = join(cwd, 'demo');
    const shell = [...tsFiles(join(appDir, 'app')), ...tsFiles(join(appDir, 'components'))];
    await add.parseAsync(['dialog', 'card', 'input', 'button', 'badge', '--cwd', appDir, '--overwrite', '--yes', '--no-deps'], { from: 'user' });
    assert.ok(existsSync(join(appDir, 'components', 'ui', 'card.ts')), 'the kit card landed where add writes');
    for (const file of shell) {
      const src = await readFile(file, 'utf8');
      for (const m of src.matchAll(/from '#components\/ui\/([\w-]+)\.ts'/g)) {
        assert.equal(m[1], 'button', `${file} imports only the kit Button from components/ui/`);
        assert.match(await readFile(join(appDir, 'components', 'ui', 'button.ts'), 'utf8'), /export function buttonClass\(/, 'which still exports buttonClass after the overwrite');
      }
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('the theme lives where init writes it, so a preset repaints a fresh app', async () => {
  // The gallery's tokens used to sit on :root in app/layout.ts, after the
  // stylesheet in the cascade, so `init --preset` rewrote styles/globals.css
  // and changed nothing on screen.
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const appDir = join(cwd, 'demo');
    const layout = await readFile(join(appDir, 'app', 'layout.ts'), 'utf8');
    assert.doesNotMatch(layout, /--(?:background|foreground|primary|card|border|font-sans)\s*:/, 'the layout defines no theme token');
    const inputCss = await readFile(join(appDir, 'public', 'input.css'), 'utf8');
    assert.doesNotMatch(inputCss, /--font-sans\s*:/, 'input.css leaves the body font to the theme');
    const theme = await readFile(join(appDir, 'styles', 'globals.css'), 'utf8');
    const block = theme.slice(theme.indexOf('/* @webjsdev/ui theme */'), theme.indexOf('/* @webjsdev/ui theme end */'));
    assert.match(block, /:root \{[\s\S]*?--primary: oklch\(0% 0 0\);/, 'the webjs.dev/ui palette is inside the theme block');
    assert.match(block, /\.dark \{[\s\S]*?--primary: oklch\(0\.922 0 0\);/, 'with its dark half on .dark');
    assert.match(block, /@theme inline \{[\s\S]*?--font-sans: 'Geist'/, 'and its font where a preset writes one');
    assert.match(theme.slice(theme.indexOf('/* @webjsdev/ui theme end */')), /--border-strong/, 'the app\'s extra tokens follow the block');

    // lyra, zinc, blue, Lora, large radius, from /ui/create.
    await init.parseAsync(['--cwd', appDir, '--preset', 'b1ZhhFKyG', '--css', 'styles/globals.css', '--yes'], { from: 'user' });
    const after = await readFile(join(appDir, 'styles', 'globals.css'), 'utf8');
    assert.doesNotMatch(after, /--primary: oklch\(0% 0 0\);/, 'the scaffold palette is replaced');
    assert.match(after, /--primary: oklch\(0\.488 0\.243 264\.376\)/, 'by the preset\'s');
    assert.match(after, /--font-sans: 'Lora', serif;/, 'and its body font is the page\'s default family');
    assert.match(after, /--border-strong/, 'the app\'s own tokens are kept');
    assert.equal(await readFile(join(appDir, 'app', 'layout.ts'), 'utf8'), layout, 'nothing in the layout overrides it');
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
