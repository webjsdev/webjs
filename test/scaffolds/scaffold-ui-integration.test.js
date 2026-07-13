/**
 * Verifies that the full-stack and saas scaffolds pre-initialise the Webjs UI
 * kit correctly: components.json + lib/utils/cn.ts + styles/globals.css are
 * written, the standard component sources land in components/ui/, generated
 * pages call the Tier-1 class helpers on raw native elements (not stale
 * `<ui-X>` tags for Tier-1 components), and the API template deliberately
 * ships none of that.
 *
 * The "no stale Tier-1 tags" assertion catches a real regression class -
 * before the Tier-1/Tier-2 split, scaffolded pages used `<ui-button>`,
 * `<ui-card>`, etc. as custom elements. After the split, those Tier-1
 * components are class helpers (`buttonClass()`, `cardClass()`); a tag
 * like `<ui-button>` would render as un-upgraded HTML.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { scaffoldApp } from '../../packages/cli/lib/create.js';

// Tier 1: class helpers. Pages MUST call e.g. `buttonClass()` and apply
// to a native <button>, never use `<ui-button>` (which doesn't exist).
const TIER1_TAGS = [
  'ui-button', 'ui-card', 'ui-card-header', 'ui-card-title', 'ui-card-description',
  'ui-card-content', 'ui-card-footer', 'ui-card-action',
  'ui-input', 'ui-textarea', 'ui-label',
  'ui-alert', 'ui-alert-title', 'ui-alert-description',
  'ui-badge', 'ui-separator', 'ui-skeleton', 'ui-aspect-ratio', 'ui-kbd',
  'ui-checkbox', 'ui-radio-group', 'ui-switch', 'ui-native-select',
  'ui-avatar', 'ui-table', 'ui-toggle', 'ui-breadcrumb', 'ui-pagination',
  // Migrated to Tier 1 (native <progress value max>) in feat/ui-progress-tier1.
  'ui-progress',
];

const TIER1_HELPERS_BUTTON = ['buttonClass'];
const TIER1_HELPERS_CARD = [
  'cardClass', 'cardHeaderClass', 'cardTitleClass',
  'cardDescriptionClass', 'cardContentClass',
];
const TIER1_HELPERS_INPUT = ['inputClass'];
const TIER1_HELPERS_LABEL = ['labelClass'];

async function tempCwd() {
  return mkdtemp(join(tmpdir(), 'webjs-scaffold-ui-'));
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

/** Assert a file uses class helpers and contains no stale Tier-1 ui-* tags. */
function assertTier1HygieneOnFile(content, filePath) {
  for (const tag of TIER1_TAGS) {
    assert.doesNotMatch(
      content,
      new RegExp(`<${tag}\\b`),
      `${filePath}: stale Tier-1 tag <${tag}>: Tier-1 components are class helpers, not custom elements`,
    );
  }
}

test('full-stack scaffold pre-initialises the Webjs UI kit', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const appDir = join(cwd, 'demo');

    // Bootstrap for `webjs ui add`: the config + cn() helper + theme ship, but
    // NOT the pre-copied component kit (a full-stack app adds components on
    // demand with `webjs ui add <name>`; only saas pre-copies its auth kit).
    assert.ok(await exists(join(appDir, 'components.json')), 'components.json should exist');
    assert.ok(await exists(join(appDir, 'lib', 'utils', 'cn.ts')), 'lib/utils/cn.ts should exist');
    assert.ok(await exists(join(appDir, 'styles', 'globals.css')), 'styles/globals.css should exist');
    assert.equal(existsSync(join(appDir, 'app', 'globals.css')), false, 'globals.css must not be in routing-only app/');
    assert.ok(!(await exists(join(appDir, 'components', 'ui'))), 'full-stack pre-copies no ui-* kit');
    assert.ok(!(await exists(join(appDir, 'lib', 'utils', 'ui.ts'))), 'the ui.ts class-bundle helper is removed');

    // components.json shape matches what webjsui init writes for webjs
    const cfg = JSON.parse(await readFile(join(appDir, 'components.json'), 'utf8'));
    assert.equal(cfg.tailwind.css, 'styles/globals.css');
    assert.equal(cfg.tailwind.baseColor, 'neutral');
    assert.equal(cfg.aliases.ui, 'components/ui');
    assert.equal(cfg.aliases.utils, 'lib/utils/cn');

    // The minimal home is a plain welcome page, using no ui-* helpers.
    const layout = await readFile(join(appDir, 'app', 'layout.ts'), 'utf8');
    const page = await readFile(join(appDir, 'app', 'page.ts'), 'utf8');
    assert.match(page, /Welcome to/, 'home is the minimal welcome page');
    assert.doesNotMatch(page, /buttonClass|cardClass|rubric/, 'home uses no ui-* class helpers');

    // CSS delivery (#947): the layout links a STATIC compiled stylesheet (works
    // with JS off), not the browser runtime. The Tailwind @theme maps live in
    // public/input.css; the token VALUES stay inline in the layout (plain CSS).
    assert.match(layout, /<link rel="stylesheet" href="\/public\/tailwind\.css">/,
      'layout links the static compiled stylesheet');
    assert.doesNotMatch(layout, /tailwind-browser\.js|type="text\/tailwindcss"/,
      'layout no longer ships the Tailwind browser runtime');
    const inputCss = await readFile(join(appDir, 'public', 'input.css'), 'utf8');
    assert.match(inputCss, /@import "tailwindcss"/, 'input.css imports Tailwind');
    assert.match(inputCss, /color-primary/, 'input.css carries the @theme color maps');
    assert.match(layout, /--primary:\s*#[0-9a-f]{6}/i, 'the palette VALUES stay inline (JS-off safe)');
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('saas scaffold uses Tier-1 helpers on native elements', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'saas' });
    const appDir = join(cwd, 'demo');

    // Standard kit (inherited from full-stack path)
    for (const name of ['button', 'card', 'alert', 'badge', 'separator', 'label', 'input']) {
      assert.ok(await exists(join(appDir, 'components', 'ui', `${name}.ts`)));
    }

    // Saas extras: only Tier-2 (dialog) + form-control class helpers
    // (switch, checkbox). form + field are v2-deferred (see ui AGENTS.md).
    for (const name of ['dialog', 'switch', 'checkbox']) {
      assert.ok(
        await exists(join(appDir, 'components', 'ui', `${name}.ts`)),
        `saas should include components/ui/${name}.ts`,
      );
    }

    // Login page: imports + uses Tier-1 helpers, no stale Tier-1 tags
    const login = await readFile(join(appDir, 'app', 'login', 'page.ts'), 'utf8');
    for (const fn of [...TIER1_HELPERS_CARD, ...TIER1_HELPERS_BUTTON, ...TIER1_HELPERS_INPUT, ...TIER1_HELPERS_LABEL]) {
      assert.match(login, new RegExp(`\\b${fn}\\b`), `login.ts should call ${fn}()`);
    }
    assertTier1HygieneOnFile(login, 'app/login/page.ts');

    // Signup page: same shape
    const signup = await readFile(join(appDir, 'app', 'signup', 'page.ts'), 'utf8');
    for (const fn of [...TIER1_HELPERS_CARD, ...TIER1_HELPERS_BUTTON, ...TIER1_HELPERS_INPUT, ...TIER1_HELPERS_LABEL]) {
      assert.match(signup, new RegExp(`\\b${fn}\\b`), `signup.ts should call ${fn}()`);
    }
    assertTier1HygieneOnFile(signup, 'app/signup/page.ts');

    // Dashboard page: header-only card + badge (no inputs). buttonClass moved to
    // the dashboard layout with the logout control (#904), so it is asserted there.
    const dash = await readFile(join(appDir, 'app', 'dashboard', 'page.ts'), 'utf8');
    for (const fn of ['cardClass', 'cardHeaderClass', 'cardTitleClass', 'cardDescriptionClass', 'badgeClass']) {
      assert.match(dash, new RegExp(`\\b${fn}\\b`), `dashboard.ts should call ${fn}()`);
    }
    assertTier1HygieneOnFile(dash, 'app/dashboard/page.ts');

    // Dashboard layout: the logout control demonstrates buttonClass (#904).
    const dashLayout = await readFile(join(appDir, 'app', 'dashboard', 'layout.ts'), 'utf8');
    for (const fn of TIER1_HELPERS_BUTTON) {
      assert.match(dashLayout, new RegExp(`\\b${fn}\\b`), `dashboard/layout.ts should call ${fn}()`);
    }
    assertTier1HygieneOnFile(dashLayout, 'app/dashboard/layout.ts');

    // Settings: uses card subparts only
    const settings = await readFile(join(appDir, 'app', 'dashboard', 'settings', 'page.ts'), 'utf8');
    for (const fn of TIER1_HELPERS_CARD) {
      assert.match(settings, new RegExp(`\\b${fn}\\b`), `settings.ts should call ${fn}()`);
    }
    assertTier1HygieneOnFile(settings, 'app/dashboard/settings/page.ts');
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
