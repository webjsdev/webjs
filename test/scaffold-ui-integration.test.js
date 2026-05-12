/**
 * Verifies that the full-stack and saas scaffolds pre-initialise
 * @webjskit/ui out of the box: components.json + lib/utils.ts +
 * app/globals.css are written, the standard component kit lands in
 * components/ui/, the layout pre-imports them, and the API template
 * deliberately ships none of that (no UI in an API-only project).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { scaffoldApp } from '../packages/cli/lib/create.js';

async function tempCwd() {
  return mkdtemp(join(tmpdir(), 'webjs-scaffold-ui-'));
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

test('full-stack scaffold pre-initialises @webjskit/ui', async () => {
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

    // Layout pre-imports ui-* so registrations happen at SSR + hydration
    const layout = await readFile(join(appDir, 'app', 'layout.ts'), 'utf8');
    assert.match(layout, /import '\.\.\/components\/ui\/button\.ts'/);
    assert.match(layout, /import '\.\.\/components\/ui\/card\.ts'/);

    // Homepage uses ui-* tags
    const page = await readFile(join(appDir, 'app', 'page.ts'), 'utf8');
    assert.match(page, /<ui-button/);
    assert.match(page, /<ui-card/);
    assert.match(page, /<ui-badge/);

    // Theme CSS is inlined into the layout (shadcn tokens)
    assert.match(layout, /color-primary/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('saas scaffold adds form/dialog components on top of the standard kit', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'saas' });
    const appDir = join(cwd, 'demo');

    // Standard kit (inherited from full-stack path)
    for (const name of ['button', 'card', 'alert', 'badge', 'separator', 'label', 'input']) {
      assert.ok(await exists(join(appDir, 'components', 'ui', `${name}.ts`)));
    }

    // Saas extras (form + field are deferred to v2 — see packages/ui/AGENTS.md)
    for (const name of ['dialog', 'switch', 'checkbox']) {
      assert.ok(
        await exists(join(appDir, 'components', 'ui', `${name}.ts`)),
        `saas should include components/ui/${name}.ts`,
      );
    }

    // Login / signup / dashboard use ui-* tags
    const login = await readFile(join(appDir, 'app', 'login', 'page.ts'), 'utf8');
    assert.match(login, /<ui-card/);
    assert.match(login, /<ui-input/);
    assert.match(login, /<ui-label/);
    assert.match(login, /<ui-button/);

    const signup = await readFile(join(appDir, 'app', 'signup', 'page.ts'), 'utf8');
    assert.match(signup, /<ui-card/);
    assert.match(signup, /<ui-input/);

    const dash = await readFile(join(appDir, 'app', 'dashboard', 'page.ts'), 'utf8');
    assert.match(dash, /<ui-card/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('api scaffold deliberately ships no ui-* components', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'api' });
    const appDir = join(cwd, 'demo');

    // API has no UI — none of these should exist
    assert.equal(existsSync(join(appDir, 'components', 'ui')), false);
    assert.equal(existsSync(join(appDir, 'components.json')), false);
    assert.equal(existsSync(join(appDir, 'app', 'globals.css')), false);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('lib/utils.ts ships the cn() helper verbatim', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const utils = await readFile(join(cwd, 'demo', 'lib', 'utils.ts'), 'utf8');
    assert.match(utils, /export function cn/);
    assert.match(utils, /ClassValue/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
