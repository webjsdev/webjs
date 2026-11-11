/**
 * `webjs generate` in freshly scaffolded apps: the model and authentication
 * generators' output must pass `webjs check`, `webjs typecheck` and the app's
 * tests, its migrations must apply, and every generated page must render. The
 * generators emit strings, so an escaping or typing mistake only shows in a
 * generated app, which is why this drives a real one rather than inspecting
 * the emitted text.
 *
 * Counterfactual: break any emitter (a column the schema edit writes wrong, or
 * a closing backtick in an auth page) and the typecheck or test step here
 * goes red.
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

test('model and references generate tables that check, typecheck and migrate', { timeout: 300_000 }, async () => {
  const { cwd, app, cli } = await makeApp({});
  try {
    const post = cli('g', 'model', 'post', 'title:string!', 'body:text', 'views:integer', 'published:boolean', 'publishedAt:datetime', 'slug:string:uniq', 'meta:json');
    assert.equal(post.status, 0, out(post));
    assert.match(out(post), /migration {2}webjs db generate --name=create_posts/);
    assert.match(out(post), /row type Post:/, 'prints the model summary');
    assert.ok(!existsSync(join(app, 'modules/posts')), 'a model writes no module folder');

    const comment = cli('g', 'model', 'comment', 'body:text!', 'post:references!');
    assert.equal(comment.status, 0, out(comment));
    const tag = cli('g', 'model', 'tag', 'name:string!:uniq', 'rank:integer:index');
    assert.equal(tag.status, 0, out(tag));

    const schema = readFileSync(join(app, 'db', 'schema.server.ts'), 'utf8');
    assert.match(schema, /^export type Post = typeof posts\.\$inferSelect;$/m);
    assert.match(schema, /^export const relations = defineRelations\(\{ users, posts, comments, tags \}, \(r\) => \(\{\n {2}comments: \{ post: r\.one\.posts\(/m);
    const migrations = readdirSync(join(app, 'db', 'migrations')).join(' ');
    for (const name of ['create_posts', 'create_comments', 'create_tags']) assert.match(migrations, new RegExp(`_${name}`));

    // The same table again is left alone, with a note.
    const again = cli('g', 'model', 'post', 'title:string!');
    assert.equal(again.status, 0, out(again));
    assert.match(out(again), /already defines posts/);

    const check = cli('check');
    assert.equal(check.status, 0, out(check));
    const tc = cli('typecheck');
    assert.equal(tc.status, 0, out(tc));
    // The app's own tests run on a test database the migrations build.
    const tests = cli('test', '--server');
    assert.equal(tests.status, 0, out(tests));
    const migrate = cli('db', 'migrate');
    assert.equal(migrate.status, 0, out(migrate));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('model on Postgres writes pg columns that check and typecheck', { timeout: 300_000 }, async () => {
  const { cwd, app, cli } = await makeApp({ db: 'postgres' });
  try {
    const r = cli('g', 'model', 'post', 'title:string!', 'published:boolean', 'publishedAt:datetime', 'meta:json', 'author:references', '--plural', 'posts');
    // author:references needs an authors table, which this app does not have.
    assert.equal(r.status, 1);
    assert.match(out(r), /needs a authors table/);
    const ok = cli('g', 'model', 'post', 'title:string!', 'published:boolean', 'publishedAt:datetime', 'meta:json', 'user:references');
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

    // Re-running over an edited file refuses, names it, and writes nothing.
    appendFileSync(join(app, 'app/login/page.ts'), '// mine\n');
    const edited = cli('g', 'authentication');
    assert.equal(edited.status, 1);
    assert.match(out(edited), /app\/login\/page\.ts/);
    assert.match(readFileSync(join(app, 'app/login/page.ts'), 'utf8'), /\/\/ mine\n$/);

    // A table that belongs to a user.
    const notes = cli('g', 'model', 'note', 'body:text!', 'user:references');
    assert.equal(notes.status, 0, out(notes));
    assert.match(out(notes), /relations: note\.user -> users/);

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
