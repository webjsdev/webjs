/**
 * Verifies the always-on gallery the full-stack scaffold ships (#824 / #821 /
 * #817), organized by KIND so features and whole apps are not mixed:
 *   - app/features/<name>  single-feature demos (one WebJs concept each),
 *   - app/examples/<name>  whole example apps that compose several features.
 * Each has its logic in modules/<name> and is linked from the home page. The
 * placeholder-marker gate was retired: `npm run gallery:clear` sheds the gallery
 * in one step instead.
 *
 * Also guards the scoping decision: api has no UI, so the gallery ships in the
 * one UI template (full-stack). Auth is one of the gallery cards.
 *
 * The todo query assertion is a regression guard for the rc.3 relational-query
 * orderBy bug (`[desc(col)]` compiles to `no such column: d0.0`); the query must
 * use the object form `{ createdAt: 'desc' }`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { scaffoldApp } from '../../packages/cli/lib/create.js';

// Single-feature demos under app/features/<name>.
const FEATURES = [
  'routing', 'boundaries', 'auth', 'components', 'server-actions', 'optimistic-ui',
  'async-render', 'streaming', 'stream', 'suspense', 'directives', 'route-handler', 'forms',
  'metadata', 'caching', 'env', 'client-router', 'view-transitions', 'frames',
  'service-worker', 'websockets', 'broadcast', 'rate-limit', 'file-storage', 'sessions',
];
// Whole example apps under app/examples/<name>.
const EXAMPLE_APPS = ['todo'];
// Demos whose logic lives in a modules/<name> folder, spot-checked here. The
// app-only demos (routing / metadata / env / boundaries / view-transitions,
// which have no modules/ dir) are excluded.
const MODULE_ROUTES = ['auth', 'components', 'server-actions', 'optimistic-ui', 'async-render', 'streaming', 'stream', 'suspense', 'directives', 'frames', 'todo', 'websockets', 'broadcast', 'rate-limit', 'file-storage', 'sessions'];

async function tempCwd() {
  return mkdtemp(join(tmpdir(), 'webjs-scaffold-gallery-'));
}
async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

test('full-stack scaffold ships feature demos and one example app', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const appDir = join(cwd, 'demo');

    for (const name of FEATURES) {
      assert.ok(await exists(join(appDir, 'app', 'features', name, 'page.ts')), `app/features/${name}/page.ts`);
    }
    // Shared layouts give every feature demo AND every example app a
    // back-to-gallery link so no card is a dead end (each links the home at /).
    for (const seg of ['features', 'examples']) {
      const layout = await readFile(join(appDir, 'app', seg, 'layout.ts'), 'utf8');
      assert.match(layout, /href="\/"/, `${seg} layout links back to the gallery home`);
      assert.match(layout, /Gallery/, `${seg} layout renders a Gallery link`);
    }
    for (const name of EXAMPLE_APPS) {
      assert.ok(await exists(join(appDir, 'app', 'examples', name, 'page.ts')), `app/examples/${name}/page.ts`);
    }
    // Boundaries demo: a forbidden()/unauthorized() thrower next to its nearest boundary file.
    assert.ok(await exists(join(appDir, 'app', 'features', 'boundaries', 'gated', 'page.ts')));
    assert.ok(await exists(join(appDir, 'app', 'features', 'boundaries', 'gated', 'forbidden.ts')));
    assert.ok(await exists(join(appDir, 'app', 'features', 'boundaries', 'private', 'page.ts')));
    assert.ok(await exists(join(appDir, 'app', 'features', 'boundaries', 'private', 'unauthorized.ts')));
    // Dynamic route param example + the route.ts handler.
    assert.ok(await exists(join(appDir, 'app', 'features', 'routing', '[id]', 'page.ts')));
    assert.ok(await exists(join(appDir, 'app', 'features', 'route-handler', 'data', 'route.ts')));
    // Client-router soft-nav target subpage.
    assert.ok(await exists(join(appDir, 'app', 'features', 'client-router', 'second', 'page.ts')));
    // View-transitions soft-nav target subpage (the cross-fade + permanent-element demo).
    assert.ok(await exists(join(appDir, 'app', 'features', 'view-transitions', 'second', 'page.ts')));
    // Infra features ship their server endpoints alongside the page.
    assert.ok(await exists(join(appDir, 'app', 'features', 'websockets', 'echo', 'route.ts')));
    assert.ok(await exists(join(appDir, 'app', 'features', 'broadcast', 'feed', 'route.ts')));
    assert.ok(await exists(join(appDir, 'app', 'features', 'rate-limit', 'ping', 'route.ts')));
    assert.ok(await exists(join(appDir, 'app', 'features', 'rate-limit', 'ping', 'middleware.ts')));
    assert.ok(await exists(join(appDir, 'app', 'features', 'file-storage', 'file', '[key]', 'route.ts')));
    // Root-only boundaries + metadata image routes (the convention-file demos).
    for (const f of ['global-error.ts', 'global-not-found.ts', 'icon.ts', 'apple-icon.ts', 'opengraph-image.ts', 'twitter-image.ts']) {
      assert.ok(await exists(join(appDir, 'app', f)), `app/${f}`);
    }
    // Feature/app logic lives in modules/, not app/.
    for (const name of MODULE_ROUTES) {
      assert.ok(await exists(join(appDir, 'modules', name)), `modules/${name}`);
    }
    // tic-tac-toe was dropped.
    assert.equal(existsSync(join(appDir, 'app', 'examples', 'tic-tac-toe')), false);
    assert.equal(existsSync(join(appDir, 'modules', 'tic-tac-toe')), false);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('full-stack home page links every feature and the example app', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const home = await readFile(join(cwd, 'demo', 'app', 'page.ts'), 'utf8');

    assert.doesNotMatch(home, /webjs-scaffold-placeholder/, 'the placeholder gate was retired');
    for (const name of FEATURES) {
      assert.match(home, new RegExp(`/features/${name}`), `home links /features/${name}`);
    }
    for (const name of EXAMPLE_APPS) {
      assert.match(home, new RegExp(`/examples/${name}`), `home links /examples/${name}`);
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('no gallery route page carries a scaffold-placeholder marker (gate retired)', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const appDir = join(cwd, 'demo');
    for (const name of FEATURES) {
      const src = await readFile(join(appDir, 'app', 'features', name, 'page.ts'), 'utf8');
      assert.doesNotMatch(src, /webjs-scaffold-placeholder/, `app/features/${name} has no marker`);
    }
    for (const name of EXAMPLE_APPS) {
      const src = await readFile(join(appDir, 'app', 'examples', name, 'page.ts'), 'utf8');
      assert.doesNotMatch(src, /webjs-scaffold-placeholder/, `app/examples/${name} has no marker`);
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('full-stack schema adds a todos table backing the todo example', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const schema = await readFile(join(cwd, 'demo', 'db', 'schema.server.ts'), 'utf8');
    assert.match(schema, /export const todos = table\('todos'/, 'todos table present');
    assert.match(schema, /defineRelations\(\{ users, todos \}/, 'todos wired into relations');
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('todo query uses rc.3 object-form orderBy (regression guard)', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const q = await readFile(join(cwd, 'demo', 'modules', 'todo', 'queries', 'list-todos.server.ts'), 'utf8');
    assert.match(q, /orderBy:\s*\{\s*createdAt:\s*'desc'\s*\}/, 'uses object-form orderBy');
    // Match only real code (an `orderBy: [`), not the cautionary comment.
    assert.doesNotMatch(q, /orderBy:\s*\[/, 'must not use array-form orderBy which mis-compiles in rc.3');
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('feature pages have no stale /examples/ links after the features refactor', async () => {
  // Regression guard: moving the demos from app/examples/ to app/features/ must
  // update the in-page hrefs too, not just the marker text. The ONLY valid
  // /examples/* link anywhere is the todo app (app/examples/todo).
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const featuresDir = join(cwd, 'demo', 'app', 'features');
    const pages = [
      ...FEATURES.map((n) => join(featuresDir, n, 'page.ts')),
      join(featuresDir, 'routing', '[id]', 'page.ts'),
      join(featuresDir, 'route-handler', 'data', 'route.ts'),
    ];
    for (const p of pages) {
      const src = await readFile(p, 'utf8');
      for (const m of src.matchAll(/\/examples\/[a-z-]+/g)) {
        assert.equal(m[0], '/examples/todo', `${p}: stale link ${m[0]} (todo is the only /examples/ route)`);
      }
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('the api template ships the backend-features showcase, not the UI gallery', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'api' });
    const appDir = join(cwd, 'demo');
    // No UI gallery (the api template has no pages/components).
    assert.equal(existsSync(join(appDir, 'app', 'features')), false, 'api must not ship the UI app/features');
    assert.equal(existsSync(join(appDir, 'app', 'examples')), false, 'api must not ship app/examples');
    assert.equal(existsSync(join(appDir, 'modules', 'todo')), false, 'api must not ship the todo module');
    // The BACKEND-features showcase (endpoints under app/api/features/).
    for (const name of ['validate', 'rate-limit', 'stream', 'files', 'ws']) {
      assert.ok(await exists(join(appDir, 'app', 'api', 'features', name, 'route.ts')), `api backend demo ${name}`);
    }
    assert.ok(await exists(join(appDir, 'app', 'api', 'features', 'rate-limit', 'middleware.ts')), 'rate-limit middleware');
    assert.ok(await exists(join(appDir, 'app', 'api', 'features', 'files', '[key]', 'route.ts')), 'file serve route');
    assert.ok(await exists(join(appDir, 'modules', 'widgets', 'actions', 'create-widget.server.ts')), 'widgets action');
    assert.ok(await exists(join(appDir, 'env.ts')), 'env-validation demo at the app root');
    // The root index lists the showcase.
    const rootRoute = await readFile(join(appDir, 'app', 'route.ts'), 'utf8');
    assert.match(rootRoute, /features:/, 'root index lists the features');
    assert.match(rootRoute, /api\/features\/validate/, 'root index links the validate endpoint');
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('the full-stack auth card wires a real, protected auth baseline', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const appDir = join(cwd, 'demo');
    // The auth card ships login, signup, and a protected dashboard subtree.
    assert.ok(await exists(join(appDir, 'app', 'features', 'auth', 'login', 'page.ts')), 'auth login page');
    assert.ok(await exists(join(appDir, 'app', 'features', 'auth', 'signup', 'page.ts')), 'auth signup page');
    assert.ok(await exists(join(appDir, 'app', 'features', 'auth', 'dashboard', 'page.ts')), 'protected dashboard page');
    assert.ok(await exists(join(appDir, 'app', 'features', 'auth', 'dashboard', 'middleware.ts')), 'the dashboard gate');
    // The createAuth handler stays at the app root (createAuth hardcodes /api/auth/*).
    assert.ok(await exists(join(appDir, 'app', 'api', 'auth', '[...path]', 'route.ts')), 'auth api handler at root');
    // The auth server modules: createAuth config, hashing, signup, current-user.
    assert.ok(await exists(join(appDir, 'modules', 'auth', 'auth.server.ts')), 'createAuth config module');
    assert.ok(await exists(join(appDir, 'modules', 'auth', 'password.server.ts')), 'password hashing module');
    // The users table carries the auth passwordHash column.
    const schema = await readFile(join(appDir, 'db', 'schema.server.ts'), 'utf8');
    assert.match(schema, /table\('users'/, 'the users table');
    assert.match(schema, /passwordHash/, 'users table carries the auth column');
    // The real auth-flow test ships with the card.
    assert.ok(await exists(join(appDir, 'test', 'auth', 'auth.test.ts')), 'the auth flow test ships');
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
