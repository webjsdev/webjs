/**
 * `webjs generate` in freshly scaffolded apps: each generator's output must
 * pass `webjs check`, `webjs typecheck` and its own generated tests, and every
 * generated page must render. The generators emit strings, so an escaping or
 * typing mistake only shows in a generated app, which is why this drives a
 * real one rather than inspecting the emitted text.
 *
 * Counterfactual: break any emitter (drop the `values` the uniqueness check
 * reads, or a closing backtick in a page) and the typecheck or test step
 * here goes red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, symlinkSync, existsSync, readFileSync, readdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scaffoldApp } from '../../packages/cli/lib/create.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = join(ROOT, 'packages', 'cli', 'bin', 'webjs.js');

const env = { ...process.env };
delete env.DATABASE_URL;
delete env.WEBJS_TEST_DB;
// node --test inside node --test reports to this process instead of setting
// its own exit code unless the inherited context is dropped.
delete env.NODE_TEST_CONTEXT;

/** @param {{ template?: string, db?: string }} opts */
async function makeApp(opts) {
  const cwd = mkdtempSync(join(tmpdir(), 'webjs-generate-'));
  const log = console.log;
  console.log = () => {};
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack', install: false, ...opts });
  } finally {
    console.log = log;
  }
  const app = join(cwd, 'demo');
  symlinkSync(join(ROOT, 'node_modules'), join(app, 'node_modules'));
  const cli = (/** @type {string[]} */ ...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: app, env, encoding: 'utf8' });
  return { cwd, app, cli };
}

/** @param {import('node:child_process').SpawnSyncReturns<string>} r */
const out = (r) => r.stdout + r.stderr;

/**
 * Assert a generated test ran. `node --test` names each passing test;
 * `bun test`, which `webjs test` runs when this file runs under the Bun matrix,
 * names the files it ran instead.
 * @param {import('node:child_process').SpawnSyncReturns<string>} r
 * @param {RegExp} name
 * @param {string} file
 */
const ran = (r, name, file) => assert.match(out(r), process.versions.bun ? new RegExp(file.replace(/[./]/g, '\\$&') + ':') : name);

test('scaffold, references and resource generate an app that checks, typechecks and passes its tests', { timeout: 300_000 }, async () => {
  const { cwd, app, cli } = await makeApp({});
  try {
    const post = cli('g', 'scaffold', 'post', 'title:string!', 'body:text', 'views:integer', 'published:boolean', 'publishedAt:datetime', 'slug:string:uniq', 'meta:json');
    assert.equal(post.status, 0, out(post));
    for (const f of ['app/posts/page.ts', 'app/posts/new/page.ts', 'app/posts/[id]/page.ts', 'app/posts/[id]/edit/page.ts',
      'modules/posts/actions/create-post.server.ts', 'modules/posts/queries/list-posts.server.ts', 'test/posts/posts.test.ts', 'components/ui/textarea.ts']) {
      assert.ok(existsSync(join(app, f)), f);
    }
    assert.match(out(post), /migration {2}webjs db generate --name=create_posts/);

    const comment = cli('g', 'scaffold', 'comment', 'body:text!', 'post:references');
    assert.equal(comment.status, 0, out(comment));
    const product = cli('g', 'resource', 'product', 'name:string!', 'price:float', 'sku:string:uniq');
    assert.equal(product.status, 0, out(product));
    assert.ok(existsSync(join(app, 'app/api/products/[id]/route.ts')));
    assert.ok(!existsSync(join(app, 'app/products')), 'resource writes no pages');

    const schema = readFileSync(join(app, 'db', 'schema.server.ts'), 'utf8');
    assert.match(schema, /^export const relations = defineRelations\(\{ users, posts, comments, products \}, \(r\) => \(\{\n {2}comments: \{ post: r\.one\.posts\(/m);

    const check = cli('check');
    assert.equal(check.status, 0, out(check));
    const tc = cli('typecheck');
    assert.equal(tc.status, 0, out(tc));
    const tests = cli('test', '--server');
    assert.equal(tests.status, 0, out(tests));
    ran(tests, /create, show, edit and delete a post through its forms/, 'test/posts/posts.test.ts');
    ran(tests, /create, read, update and delete a product over JSON/, 'test/products/products.test.ts');

    // Every generated page that takes no parameter renders (status --boot runs
    // no before-steps, so the dev database is migrated first).
    const migrate = cli('db', 'migrate');
    assert.equal(migrate.status, 0, out(migrate));
    const status = cli('status', '--boot', '/posts', '/posts/new', '/comments', '/comments/new');
    assert.equal(status.status, 0, out(status));

    // Re-running over an edited file refuses, names it, and writes nothing.
    appendFileSync(join(app, 'app/posts/page.ts'), '// mine\n');
    const again = cli('g', 'scaffold', 'post', 'title:string!');
    assert.equal(again.status, 1);
    assert.match(out(again), /app\/posts\/page\.ts/);
    assert.match(readFileSync(join(app, 'app/posts/page.ts'), 'utf8'), /\/\/ mine\n$/);

    // destroy removes what resource wrote, and the app still typechecks.
    const destroyed = cli('d', 'resource', 'product');
    assert.equal(destroyed.status, 0, out(destroyed));
    assert.ok(!existsSync(join(app, 'app/api/products')));
    assert.doesNotMatch(readFileSync(join(app, 'db', 'schema.server.ts'), 'utf8'), /products/);
    const tc2 = cli('typecheck');
    assert.equal(tc2.status, 0, out(tc2));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('scaffold in the api template writes JSON route handlers and they pass their test', { timeout: 300_000 }, async () => {
  const { cwd, app, cli } = await makeApp({ template: 'api' });
  try {
    const r = cli('g', 'scaffold', 'widget', 'name:string!', 'qty:integer');
    assert.equal(r.status, 0, out(r));
    assert.ok(existsSync(join(app, 'app/api/widgets/route.ts')));
    assert.ok(!existsSync(join(app, 'app/widgets')), 'no pages without a root layout');
    const tc = cli('typecheck');
    assert.equal(tc.status, 0, out(tc));
    const tests = cli('test', '--server');
    assert.equal(tests.status, 0, out(tests));
    ran(tests, /create, read, update and delete a widget over JSON/, 'test/widgets/widgets.test.ts');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('scaffold on Postgres writes pg columns that check and typecheck', { timeout: 300_000 }, async () => {
  const { cwd, app, cli } = await makeApp({ db: 'postgres' });
  try {
    const r = cli('g', 'scaffold', 'post', 'title:string!', 'published:boolean', 'publishedAt:datetime', 'meta:json', 'author:references', '--plural', 'posts');
    // author:references needs an authors table, which this app does not have.
    assert.equal(r.status, 1);
    assert.match(out(r), /needs a authors table/);
    const ok = cli('g', 'scaffold', 'post', 'title:string!', 'published:boolean', 'publishedAt:datetime', 'meta:json', 'user:references');
    assert.equal(ok.status, 0, out(ok));
    const schema = readFileSync(join(app, 'db', 'schema.server.ts'), 'utf8');
    assert.match(schema, /pgTable\('posts', \{\n {2}id: serial\(\)\.primaryKey\(\),/);
    assert.match(schema, /published: boolean\(\)\.notNull\(\)\.default\(false\)/);
    assert.match(schema, /meta: jsonb\(\)\.\$type<unknown>\(\)/);
    assert.ok(existsSync(join(app, 'db', 'migrations')), 'drizzle-kit generate needs no database');
    const check = cli('check');
    assert.equal(check.status, 0, out(check));
    // The repo installs no pg driver, so only the scaffold's own connection
    // module may fail to resolve it; every generated file must be clean.
    const tc = cli('typecheck');
    const errors = out(tc).split('\n').filter((l) => /error TS/.test(l) && !l.startsWith('db/connection.server.ts'));
    assert.deepEqual(errors, []);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('authentication adds a password hash to users, and its pages, middleware and test work', { timeout: 300_000 }, async () => {
  const { cwd, app, cli } = await makeApp({});
  try {
    const r = cli('g', 'authentication');
    assert.equal(r.status, 0, out(r));
    for (const f of ['modules/auth/auth.server.ts', 'modules/auth/password.server.ts', 'app/api/auth/[...path]/route.ts',
      'app/login/page.ts', 'app/signup/page.ts', 'app/dashboard/middleware.ts', 'test/auth/auth.test.ts']) {
      assert.ok(existsSync(join(app, f)), f);
    }
    assert.match(readFileSync(join(app, 'db', 'schema.server.ts'), 'utf8'), /^ {2}passwordHash: text\(\),$/m);
    assert.match(out(r), /--name=add_password_hash_to_users/);

    // Running it again changes nothing: every file is identical, the column is there.
    const again = cli('g', 'authentication');
    assert.equal(again.status, 0, out(again));
    assert.match(out(again), /identical {2}app\/login\/page\.ts/);
    assert.match(out(again), /users already has passwordHash/);

    // A resource that belongs to a user.
    const notes = cli('g', 'scaffold', 'note', 'body:text!', 'user:references');
    assert.equal(notes.status, 0, out(notes));

    const check = cli('check');
    assert.equal(check.status, 0, out(check));
    const tc = cli('typecheck');
    assert.equal(tc.status, 0, out(tc));
    const tests = cli('test', '--server');
    assert.equal(tests.status, 0, out(tests));
    ran(tests, /sign up, see the dashboard, log out, then log in again/, 'test/auth/auth.test.ts');

    const migrate = cli('db', 'migrate');
    assert.equal(migrate.status, 0, out(migrate));
    const status = cli('status', '--boot', '/login', '/signup');
    assert.equal(status.status, 0, out(status));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('migration edits a table with Rails-named migrations, and controller pages render', { timeout: 300_000 }, async () => {
  const { cwd, app, cli } = await makeApp({});
  try {
    assert.equal(cli('g', 'scaffold', 'post', 'title:string!').status, 0);
    const add = cli('g', 'migration', 'AddPublishedAtToPosts', 'published_at:datetime', 'views:integer');
    assert.equal(add.status, 0, out(add));
    const remove = cli('g', 'migration', 'RemoveViewsFromPosts', 'views');
    assert.equal(remove.status, 0, out(remove));
    const migrations = readdirSync(join(app, 'db', 'migrations')).join(' ');
    assert.match(migrations, /_create_posts/);
    assert.match(migrations, /_add_published_at_to_posts/);
    assert.match(migrations, /_remove_views_from_posts/);
    const schema = readFileSync(join(app, 'db', 'schema.server.ts'), 'utf8');
    assert.match(schema, /publishedAt: integer\(\{ mode: 'timestamp_ms' \}\),/);
    assert.doesNotMatch(schema, /views:/);

    const pages = cli('g', 'controller', 'pages', 'home', 'about');
    assert.equal(pages.status, 0, out(pages));
    const tc = cli('typecheck');
    assert.equal(tc.status, 0, out(tc));
    const tests = cli('test', '--server');
    assert.equal(tests.status, 0, out(tests));
    ran(tests, /\/pages\/about renders/, 'test/pages/pages.test.ts');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('authentication creates the users table when the app has none', { timeout: 300_000 }, async () => {
  const { cwd, app, cli } = await makeApp({});
  try {
    // The app after its example module is deleted: no users table, no page using it.
    rmSync(join(app, 'modules', 'users'), { recursive: true, force: true });
    rmSync(join(app, 'test', 'users'), { recursive: true, force: true });
    writeFileSync(join(app, 'app', 'page.ts'), "import { html } from '@webjsdev/core';\n\nexport default function Home() {\n  return html`<h1>Home</h1>`;\n}\n");
    writeFileSync(join(app, 'db', 'schema.server.ts'), "import { defineRelations } from 'drizzle-orm';\n\nexport const relations = defineRelations({}, () => ({}));\n");
    const r = cli('g', 'authentication');
    assert.equal(r.status, 0, out(r));
    const schema = readFileSync(join(app, 'db', 'schema.server.ts'), 'utf8');
    assert.match(schema, /^export const users = sqliteTable\('users', \{$/m);
    assert.match(schema, /defineRelations\(\{ users \}/);
    assert.match(out(r), /--name=create_users/);
    const tc = cli('typecheck');
    assert.equal(tc.status, 0, out(tc));
    const tests = cli('test', '--server');
    assert.equal(tests.status, 0, out(tests));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
