/**
 * Verifies the always-on example gallery the full-stack scaffold ships (#824 /
 * #821 / #817): idiomatic example routes under app/examples/ with their logic
 * in modules/, linked from the home page, backed by a todos table, each page
 * carrying a webjs-scaffold-placeholder marker so `webjs check` fails until an
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

const EXAMPLES = [
  'todo', 'tic-tac-toe', 'components', 'routing', 'server-actions',
  'async-render', 'directives', 'route-handler',
];
// Examples whose logic lives in a modules/<name> folder (routing and
// route-handler are app-only: a pages-only route and a route.ts handler).
const MODULE_EXAMPLES = ['todo', 'tic-tac-toe', 'components', 'server-actions', 'async-render', 'directives'];

async function tempCwd() {
  return mkdtemp(join(tmpdir(), 'webjs-scaffold-gallery-'));
}
async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

test('full-stack scaffold ships the example gallery (routes + modules)', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const appDir = join(cwd, 'demo');

    for (const name of EXAMPLES) {
      assert.ok(
        await exists(join(appDir, 'app', 'examples', name, 'page.ts')),
        `app/examples/${name}/page.ts should exist`,
      );
    }
    // Dynamic route param example.
    assert.ok(await exists(join(appDir, 'app', 'examples', 'routing', '[id]', 'page.ts')));
    // Route-handler example ships a server-only route.ts endpoint.
    assert.ok(await exists(join(appDir, 'app', 'examples', 'route-handler', 'data', 'route.ts')));
    // Feature logic lives in modules/, not app/.
    for (const name of MODULE_EXAMPLES) {
      assert.ok(await exists(join(appDir, 'modules', name)), `modules/${name} should exist`);
    }
    assert.ok(await exists(join(appDir, 'modules', 'todo', 'queries', 'list-todos.server.ts')));
    assert.ok(await exists(join(appDir, 'modules', 'todo', 'components', 'todo-app.ts')));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('full-stack home page links the gallery and keeps its placeholder marker', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const appDir = join(cwd, 'demo');
    const home = await readFile(join(appDir, 'app', 'page.ts'), 'utf8');

    assert.match(home, /webjs-scaffold-placeholder/, 'home keeps its placeholder marker');
    for (const name of EXAMPLES) {
      assert.match(home, new RegExp(`/examples/${name}`), `home links /examples/${name}`);
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('every gallery example page carries a webjs-scaffold-placeholder marker', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const appDir = join(cwd, 'demo');
    for (const name of EXAMPLES) {
      const src = await readFile(join(appDir, 'app', 'examples', name, 'page.ts'), 'utf8');
      assert.match(
        src,
        /webjs-scaffold-placeholder/,
        `app/examples/${name}/page.ts must carry a placeholder marker so the agent prunes or keeps it`,
      );
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('full-stack schema adds a todos table backing the gallery', async () => {
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

test('gallery todo query uses rc.3 object-form orderBy (regression guard)', async () => {
  const cwd = await tempCwd();
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack' });
    const q = await readFile(join(cwd, 'demo', 'modules', 'todo', 'queries', 'list-todos.server.ts'), 'utf8');
    assert.match(q, /orderBy:\s*\{\s*createdAt:\s*'desc'\s*\}/, 'uses object-form orderBy');
    // The array form `orderBy: [desc(col)]` mis-compiles in rc.3; match only real
    // code (an `orderBy: [`), not the cautionary comment that names the bad form.
    assert.doesNotMatch(q, /orderBy:\s*\[/, 'must not use array-form orderBy which mis-compiles in rc.3');
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
      assert.equal(
        existsSync(join(appDir, 'app', 'examples')),
        false,
        `${template} must not ship app/examples`,
      );
      assert.equal(
        existsSync(join(appDir, 'modules', 'todo')),
        false,
        `${template} must not ship the todo module`,
      );
      const schema = await readFile(join(appDir, 'db', 'schema.server.ts'), 'utf8');
      assert.doesNotMatch(schema, /table\('todos'/, `${template} schema must not add the gallery todos table`);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }
});
