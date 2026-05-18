/**
 * Verifies that the full-stack and saas scaffolds pre-initialise the Webjs UI
 * kit correctly: components.json + lib/utils.ts + app/globals.css are
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

import { scaffoldApp } from '../packages/cli/lib/create.js';

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

    // Bootstrap files
    assert.ok(await exists(join(appDir, 'components.json')), 'components.json should exist');
    assert.ok(await exists(join(appDir, 'lib', 'utils.ts')), 'lib/utils.ts should exist');
    assert.ok(await exists(join(appDir, 'app', 'globals.css')), 'app/globals.css should exist');

    // components.json shape matches what webjsui init writes for webjs
    const cfg = JSON.parse(await readFile(join(appDir, 'components.json'), 'utf8'));
    assert.equal(cfg.tailwind.css, 'app/globals.css');
    assert.equal(cfg.tailwind.baseColor, 'neutral');
    assert.equal(cfg.aliases.ui, 'components/ui');
    assert.equal(cfg.aliases.utils, 'lib/utils');

    // Standard component kit
    for (const name of ['button', 'card', 'alert', 'badge', 'separator', 'label', 'input']) {
      assert.ok(
        await exists(join(appDir, 'components', 'ui', `${name}.ts`)),
        `components/ui/${name}.ts should exist`,
      );
    }

    // Relative import to cn() helper is rewritten for components/ui/ depth
    const button = await readFile(join(appDir, 'components', 'ui', 'button.ts'), 'utf8');
    assert.match(button, /from '\.\.\/\.\.\/lib\/utils\.ts'/);
    assert.doesNotMatch(button, /from '\.\.\/lib\/utils\.ts'/);

    // Tier-1 button source exports the buttonClass function (no custom element).
    assert.match(button, /export\s+function\s+buttonClass\b/);
    assert.doesNotMatch(button, /customElements\.define|defineElement\(['"]ui-button['"]/);

    // Layout no longer pre-imports Tier-1 sources by side effect (they
    // don't register custom elements; the imports were dead code).
    const layout = await readFile(join(appDir, 'app', 'layout.ts'), 'utf8');
    assert.doesNotMatch(
      layout,
      /import\s+['"]\.\.\/components\/ui\/button\.ts['"]/,
      'Tier-1 side-effect imports should be removed from layout',
    );

    // Homepage calls Tier-1 class helpers on native elements
    const page = await readFile(join(appDir, 'app', 'page.ts'), 'utf8');
    for (const fn of [...TIER1_HELPERS_BUTTON, 'badgeClass', 'cardClass', 'cardHeaderClass', 'cardTitleClass', 'alertClass']) {
      assert.match(page, new RegExp(`\\b${fn}\\b`), `homepage should call ${fn}()`);
    }
    // …and contains no Tier-1 custom element tags
    assertTier1HygieneOnFile(page, 'app/page.ts');

    // Theme CSS is inlined into the layout (shadcn tokens)
    assert.match(layout, /color-primary/);
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

    // Dashboard: uses card + button + badge (no inputs)
    const dash = await readFile(join(appDir, 'app', 'dashboard', 'page.ts'), 'utf8');
    for (const fn of [...TIER1_HELPERS_CARD, ...TIER1_HELPERS_BUTTON, 'badgeClass']) {
      assert.match(dash, new RegExp(`\\b${fn}\\b`), `dashboard.ts should call ${fn}()`);
    }
    assertTier1HygieneOnFile(dash, 'app/dashboard/page.ts');

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
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('api scaffold route imports resolve to real modules/ files', async () => {
  // Regression for an off-by-one in the relative `../` depth: route.ts
  // lives at app/api/<feature>/route.ts (3 levels deep), so reaching
  // modules/<feature>/... needs three `..` segments, not four.
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'api' });
    const appDir = join(cwd, 'demo');

    const route = await readFile(join(appDir, 'app', 'api', 'users', 'route.ts'), 'utf8');
    // Must NOT contain the 4-dot path (the old bug).
    assert.doesNotMatch(
      route,
      /from '\.\.\/\.\.\/\.\.\/\.\.\/modules\//,
      'route.ts should not use four ../ segments to reach modules/',
    );
    // Must use the correct 3-dot path.
    assert.match(route, /from '\.\.\/\.\.\/\.\.\/modules\/users\/queries\/list-users\.server\.ts'/);
    assert.match(route, /from '\.\.\/\.\.\/\.\.\/modules\/users\/actions\/create-user\.server\.ts'/);

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

test('lib/utils.ts ships the cn() helper + Base + defineElement', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const utils = await readFile(join(cwd, 'demo', 'lib', 'utils.ts'), 'utf8');
    assert.match(utils, /export function cn/);
    assert.match(utils, /ClassValue/);
    // Tier-2 custom elements (when added via `webjs ui add dialog`) import
    // Base + defineElement from here: verify both exports are present.
    // Base is exported as a const (class expression assigned to a const)
    // so it works in non-browser test environments where HTMLElement is
    // undefined; accept either `class Base` or `const Base`.
    assert.match(utils, /export\s+(?:class|const)\s+Base\b/);
    assert.match(utils, /export\s+function\s+defineElement\b/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
