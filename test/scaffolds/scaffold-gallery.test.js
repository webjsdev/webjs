/**
 * Verifies the always-on gallery the full-stack scaffold ships (#824 / #821 /
 * #817), organized by KIND so features and whole apps are not mixed:
 *   - app/features/<name>  single-feature demos (one webjs concept each),
 *   - app/examples/<name>  whole example apps that compose several features.
 * Each has its logic in modules/<name>, is linked from the home page, and
 * carries a webjs-scaffold-placeholder marker so `webjs check` fails until an
 * agent keeps-and-adapts or prunes it.
 *
 * Also guards the scoping decision: api has no UI and saas overwrites the schema
 * with its own focused auth example, so the gallery ships in FULL-STACK ONLY.
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
  'routing', 'components', 'server-actions', 'optimistic-ui',
  'async-render', 'directives', 'route-handler', 'forms',
];
// Whole example apps under app/examples/<name>.
const EXAMPLE_APPS = ['todo'];
// Routes whose logic lives in a modules/<name> folder (routing and
// route-handler are app-only: a pages-only route and a route.ts handler).
const MODULE_ROUTES = ['components', 'server-actions', 'optimistic-ui', 'async-render', 'directives', 'todo'];

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
    for (const name of EXAMPLE_APPS) {
      assert.ok(await exists(join(appDir, 'app', 'examples', name, 'page.ts')), `app/examples/${name}/page.ts`);
    }
    // Dynamic route param example + the route.ts handler.
    assert.ok(await exists(join(appDir, 'app', 'features', 'routing', '[id]', 'page.ts')));
    assert.ok(await exists(join(appDir, 'app', 'features', 'route-handler', 'data', 'route.ts')));
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

test('full-stack home page links every feature and the example app, keeps its marker', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const home = await readFile(join(cwd, 'demo', 'app', 'page.ts'), 'utf8');

    assert.match(home, /webjs-scaffold-placeholder/, 'home keeps its placeholder marker');
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

test('every gallery route page carries a webjs-scaffold-placeholder marker', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const appDir = join(cwd, 'demo');
    for (const name of FEATURES) {
      const src = await readFile(join(appDir, 'app', 'features', name, 'page.ts'), 'utf8');
      assert.match(src, /webjs-scaffold-placeholder/, `app/features/${name} marker`);
    }
    for (const name of EXAMPLE_APPS) {
      const src = await readFile(join(appDir, 'app', 'examples', name, 'page.ts'), 'utf8');
      assert.match(src, /webjs-scaffold-placeholder/, `app/examples/${name} marker`);
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

test('api and saas do NOT ship the gallery (full-stack only)', async () => {
  for (const template of ['api', 'saas']) {
    const cwd = await tempCwd();
    try {
      await scaffoldApp('demo', cwd, { template });
      const appDir = join(cwd, 'demo');
      assert.equal(existsSync(join(appDir, 'app', 'features')), false, `${template} must not ship app/features`);
      assert.equal(existsSync(join(appDir, 'app', 'examples')), false, `${template} must not ship app/examples`);
      assert.equal(existsSync(join(appDir, 'modules', 'todo')), false, `${template} must not ship the todo module`);
      const schema = await readFile(join(appDir, 'db', 'schema.server.ts'), 'utf8');
      assert.doesNotMatch(schema, /table\('todos'/, `${template} schema must not add the gallery todos table`);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }
});
