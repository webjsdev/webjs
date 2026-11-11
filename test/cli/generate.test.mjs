// Unit tests for `webjs generate`: the name inflector, the Rails field
// grammar, the schema edits and the overwrite guard. The generated app as a
// whole is tested in test/scaffolds/generate.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resourceNames, pluralize } from '../../packages/cli/lib/generate/names.js';
import { parseField, parseFields, columnFor } from '../../packages/cli/lib/generate/fields.js';
import { addImports, registerTable, addOneRelations, insertBlock, dialectOf } from '../../packages/cli/lib/generate/schema-edit.js';
import { parseGenerateArgs, applyPlan, migrationStamp, waitForNextMigrationSecond } from '../../packages/cli/lib/generate/index.js';
import { modelSummary, planModel } from '../../packages/cli/lib/generate/model.js';
import { planAuthentication } from '../../packages/cli/lib/generate/authentication.js';
import { MIDDLEWARE } from '../../packages/cli/lib/generate/authentication-pages.js';

test('pluralize follows the common English rules and the irregulars', () => {
  assert.equal(pluralize('post'), 'posts');
  assert.equal(pluralize('category'), 'categories');
  assert.equal(pluralize('box'), 'boxes');
  assert.equal(pluralize('status'), 'statuses');
  assert.equal(pluralize('day'), 'days');
  assert.equal(pluralize('person'), 'people');
  assert.equal(pluralize('hero'), 'heroes');
  assert.equal(pluralize('photo'), 'photos');
});

test('resourceNames accepts every spelling Rails does, singular or plural', () => {
  for (const raw of ['BlogPost', 'blog_post', 'blog-post', 'blogPost', 'blog_posts']) {
    const n = resourceNames(raw);
    assert.equal(n.singular, 'blogPost', raw);
    assert.equal(n.plural, 'blogPosts', raw);
    assert.equal(n.Singular, 'BlogPost', raw);
    assert.equal(n.kebabPlural, 'blog-posts', raw);
    assert.equal(n.table, 'blog_posts', raw);
  }
  assert.equal(resourceNames('categories').singular, 'category');
  assert.equal(resourceNames('people').singular, 'person');
  assert.equal(resourceNames('status').plural, 'statuses');
  assert.equal(resourceNames('cactus', { plural: 'cacti' }).plural, 'cacti');
});

test('resourceNames refuses a name that is not an identifier, since it is written into code', () => {
  for (const bad of ['', '1post', 'po st', "post'", 'post`', 'post${x}', 'post/x']) {
    assert.throws(() => resourceNames(bad), /not a valid resource name/, bad);
  }
  assert.throws(() => resourceNames('news'), /same singular and plural/);
});

test('parseField reads the Rails grammar: type, !, :uniq and :index', () => {
  assert.deepEqual(parseField('title'), { name: 'title', label: 'Title', kind: 'string', notNull: false, unique: false, index: false });
  const t = parseField('title:string!');
  assert.equal(t.notNull, true);
  assert.equal(parseField('email!:string').notNull, true);
  const s = parseField('slug:string:uniq');
  assert.equal(s.unique, true);
  assert.equal(parseField('slug:uniq').kind, 'string');
  assert.equal(parseField('slug:uniq').unique, true);
  assert.equal(parseField('rank:integer:index').index, true);
  assert.equal(parseField('published_at:datetime').name, 'publishedAt');
  assert.equal(parseField('published_at:datetime').label, 'Published at');
  assert.equal(parseField('price:decimal').kind, 'float');
});

test('a references field becomes a foreign key and a relation', () => {
  const f = parseField('author:references!');
  assert.equal(f.name, 'authorId');
  assert.equal(f.notNull, true);
  assert.deepEqual(f.references, { table: 'authors', relation: 'author' });
  assert.equal(f.index, true, 'a foreign key is indexed, as in Rails');
  assert.equal(parseField('blog_post:belongs_to').references?.table, 'blogPosts');
});

test('a brace names the referenced table, as in assignee:references{users}', () => {
  const f = parseField('assignee:references{users}');
  assert.equal(f.name, 'assigneeId');
  assert.equal(f.label, 'Assignee');
  assert.deepEqual(f.references, { table: 'users', relation: 'assignee' });
  assert.equal(f.notNull, false);
  assert.equal(parseField('assignee:references{users}!').notNull, true, '! after the brace');
  assert.equal(parseField('assignee!:references{users}').notNull, true, '! after the name');
  assert.equal(parseField('owner:belongs_to{blog_posts}').references?.table, 'blogPosts');
  assert.equal(columnFor(parseField('assignee:references{users}'), 'sqlite').code, 'integer().references(() => users.id)');
  assert.throws(() => parseField('title:string{users}'), /only a references field takes a \{table\}/);
  assert.throws(() => parseField('owner:references{}'), /is not a table name/);
  assert.throws(() => parseField("owner:references{us'ers}"), /is not a table name/);
  assert.throws(() => parseFields(['assignee:references{users}', 'assignee:references']), /given twice/);
});

test('parseField refuses what it cannot write correctly', () => {
  assert.throws(() => parseField('title:strng'), /unknown type "strng"/);
  assert.throws(() => parseField('password:digest'), /webjs generate authentication/);
  assert.throws(() => parseField('id:integer'), /added to every generated table/);
  assert.throws(() => parseField('title:string:primary'), /unknown modifier/);
  assert.throws(() => parseField("ti'tle"), /not a valid field name/);
  assert.throws(() => parseFields(['title', 'title:text']), /given twice/);
});

test('columnFor writes plain Drizzle per dialect, as the scaffold schema does', () => {
  assert.equal(columnFor(parseField('title:string!:uniq'), 'sqlite').code, 'text().notNull().unique()');
  assert.equal(columnFor(parseField('on:boolean'), 'sqlite').code, "integer({ mode: 'boolean' }).notNull().default(false)");
  assert.equal(columnFor(parseField('on:boolean'), 'postgres').code, 'boolean().notNull().default(false)');
  assert.equal(columnFor(parseField('at:datetime'), 'sqlite').code, "integer({ mode: 'timestamp_ms' })");
  assert.equal(columnFor(parseField('at:datetime'), 'postgres').code, 'timestamp({ withTimezone: true })');
  assert.equal(columnFor(parseField('meta:json'), 'postgres').code, 'jsonb().$type<unknown>()');
  assert.equal(columnFor(parseField('user:references'), 'sqlite').code, 'integer().references(() => users.id)');
  assert.deepEqual(columnFor(parseField('price:float'), 'postgres').imports, ['doublePrecision']);
});

const SCHEMA = `import { defineRelations } from 'drizzle-orm';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer().primaryKey({ autoIncrement: true }),
});

// A relation belongs HERE:
//   export const relations = defineRelations({ users, posts }, (r) => ({
export const relations = defineRelations({ users }, () => ({}));
`;

test('dialectOf reads drizzle.config.ts', () => {
  assert.equal(dialectOf("dialect: 'postgresql',"), 'postgres');
  assert.equal(dialectOf("dialect: 'sqlite',"), 'sqlite');
  assert.equal(dialectOf(''), 'sqlite');
});

test('the schema edits insert at the real anchors and never at an example in a comment', () => {
  let src = addImports(SCHEMA, 'drizzle-orm/sqlite-core', ['integer', 'real', 'index']);
  assert.match(src, /import \{ sqliteTable, integer, text, real, index \} from 'drizzle-orm\/sqlite-core';/);
  src = insertBlock(src, "export const posts = sqliteTable('posts', {\n  id: integer(),\n});\n");
  assert.ok(src.indexOf('export const posts') < src.indexOf('// A relation belongs HERE'), 'before the comment that describes the call');
  src = /** @type {string} */ (registerTable(src, 'posts'));
  assert.match(src, /^export const relations = defineRelations\(\{ users, posts \}/m);
  assert.match(src, /^\/\/ {3}export const relations = defineRelations\(\{ users, posts \}, \(r\)/m, 'the comment is untouched');
  src = /** @type {string} */ (addOneRelations(src, 'posts', [{ relation: 'author', target: 'users', column: 'authorId' }]));
  assert.match(src, /defineRelations\(\{ users, posts \}, \(r\) => \(\{\n {2}posts: \{ author: r\.one\.users\(\{ from: r\.posts\.authorId, to: r\.users\.id \}\) \},\n\}\)\);/);
  // A NOT NULL foreign key is a required relation: Drizzle 1.0 types it as the
  // row, not the row or null, only with optional: false.
  const required = /** @type {string} */ (addOneRelations(SCHEMA, 'posts', [
    { relation: 'author', target: 'users', column: 'authorId', notNull: true },
    { relation: 'editor', target: 'users', column: 'editorId' },
  ]));
  assert.match(required, /author: r\.one\.users\(\{ from: r\.posts\.authorId, to: r\.users\.id, optional: false \}\),/);
  assert.match(required, /editor: r\.one\.users\(\{ from: r\.posts\.editorId, to: r\.users\.id \}\),/);
  assert.equal(registerTable('const x = 1;\n', 'posts'), null, 'no call: the caller prints the edit instead');
});

const ctxWith = (schema) => ({
  appDir: '/app', schema, dialect: /** @type {'sqlite'} */ ('sqlite'),
  ui: { button: true, input: true, label: true }, skipTests: false,
});

test('model writes only the table, its row type and its relations, and names the migration create_<table>', () => {
  const plan = planModel(ctxWith(SCHEMA), { name: 'post', fields: ['title:string!', 'user:references'] });
  assert.deepEqual(plan.files, [], 'no module folder: the table belongs to whichever feature uses it');
  assert.equal(plan.migrationName, 'create_posts');
  const src = plan.edits[0].content;
  assert.match(src, /^export const posts = sqliteTable\('posts', \{$/m);
  assert.match(src, /^export type Post = typeof posts\.\$inferSelect;$/m);
  assert.match(src, /^export const relations = defineRelations\(\{ users, posts \}, \(r\) => \(\{\n {2}posts: \{ user: r\.one\.users\(/m);
  assert.throws(() => planModel(ctxWith(SCHEMA), { name: 'post', fields: ['tag:references'] }), /needs a tags table/);
  assert.match(planModel(ctxWith(SCHEMA), { name: 'post', fields: ['user:references!'] }).edits[0].content, /user: r\.one\.users\(\{ from: r\.posts\.userId, to: r\.users\.id, optional: false \}\)/);
  assert.match(planModel(ctxWith(SCHEMA), { name: 'task', fields: ['assignee:references{users}'] }).edits[0].content,
    /assigneeId: integer\(\)\.references\(\(\) => users\.id\),[\s\S]*assignee: r\.one\.users\(\{ from: r\.tasks\.assigneeId, to: r\.users\.id \}\)/);
  assert.throws(() => planModel(ctxWith(SCHEMA), { name: 'task', fields: ['assignee:references{people}'] }), /needs a people table/);
  // A --pretend chain previews a model whose referenced table is itself only
  // a preview, so the refusal becomes a note and the chain completes.
  const dry = planModel({ ...ctxWith(SCHEMA), pretend: true }, { name: 'booking', fields: ['room:references!'] });
  assert.match(dry.notes.join('\n'), /rooms is not in db\/schema\.server\.ts yet, so generate it before this model/);
  assert.match(dry.edits[0].content, /^export const bookings = sqliteTable/m);
  const again = planModel(ctxWith(src), { name: 'post', fields: ['title'] });
  assert.deepEqual(again.edits, [], 'a table already in the schema is left as it is');
  assert.match(again.notes[0], /already defines posts/);
});

test('a migration generated in the same second as the last one still sorts after it', () => {
  // The migrator applies folders in name order and the stamp has one-second
  // resolution, so without the wait add_x_to_posts sorted before create_posts.
  const dir = mkdtempSync(join(tmpdir(), 'webjs-gen-stamp-'));
  const planted = migrationStamp(new Date());
  mkdirSync(join(dir, 'db', 'migrations', `${planted}_create_posts`), { recursive: true });
  waitForNextMigrationSecond(dir);
  assert.ok(migrationStamp(new Date()) > planted, 'the next stamp is a later second');
  assert.equal(migrationStamp(new Date(Date.UTC(2026, 0, 2, 3, 4, 5))), '20260102030405');
  waitForNextMigrationSecond(join(dir, 'missing'));
});

test('the model summary prints the row type the agent would otherwise read back from the schema', () => {
  const lines = modelSummary(resourceNames('booking'), parseFields(['user:references!', 'title:string!', 'notes:text', 'paid:boolean', 'at:datetime', 'meta:json']));
  assert.equal(lines[0], "table bookings ('bookings'), row type Booking:");
  assert.equal(lines[1], '  { id: number; userId: number; title: string; notes: string | null; paid: boolean; at: Date | null; meta: unknown; createdAt: Date; updatedAt: Date }');
  assert.equal(lines[2], "import { bookings, type Booking } from '#db/schema.server.ts';");
  assert.match(lines[3], /^relations: booking\.user -> users \(db\.query\.bookings\.findMany\(\{ with: \{ user: true \} \}\)\)$/);
});

test('parseGenerateArgs reads the generator, the name, the fields and the Rails flags', () => {
  assert.deepEqual(parseGenerateArgs(['model', 'post', 'title:string!', '-f', '--plural', 'postz']), {
    generator: 'model', name: 'post', fields: ['title:string!'], force: true, pretend: false, skipTests: false, skipMigration: false, plural: 'postz',
  });
  assert.equal(parseGenerateArgs(['auth']).generator, 'authentication');
  assert.throws(() => parseGenerateArgs(['model', 'post', '--bogus']), /Unknown option --bogus/);
  assert.throws(() => parseGenerateArgs(['authentication', 'user']), /takes no name/);
});

test('applyPlan refuses to overwrite a differing file without --force, and writes nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-gen-'));
  mkdirSync(join(dir, 'app'));
  writeFileSync(join(dir, 'app', 'same.ts'), 'same\n');
  writeFileSync(join(dir, 'app', 'mine.ts'), 'edited by hand\n');
  const plan = {
    files: [
      { path: 'app/same.ts', content: 'same\n' },
      { path: 'app/mine.ts', content: 'generated\n' },
      { path: 'app/new.ts', content: 'new\n' },
    ],
    edits: [],
    notes: [],
  };
  const lines = [];
  const refused = applyPlan(dir, plan, { log: (l) => lines.push(l) });
  assert.deepEqual(refused.conflicts, ['app/mine.ts']);
  assert.equal(readFileSync(join(dir, 'app', 'mine.ts'), 'utf8'), 'edited by hand\n');
  assert.throws(() => readFileSync(join(dir, 'app', 'new.ts')), /ENOENT/, 'nothing is written on a conflict');

  const forced = applyPlan(dir, plan, { force: true, log: (l) => lines.push(l) });
  assert.deepEqual(forced.written, ['app/mine.ts', 'app/new.ts']);
  assert.equal(readFileSync(join(dir, 'app', 'mine.ts'), 'utf8'), 'generated\n');
  assert.ok(lines.some((l) => /identical {2}app\/same\.ts/.test(l)));
  assert.ok(lines.some((l) => /force {2}app\/mine\.ts/.test(l)));
});

test('authentication gates every route from app/middleware.ts, and keeps an app middleware it did not write', () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-gen-auth-'));
  mkdirSync(join(dir, 'app'));
  const ctx = { ...ctxWith(SCHEMA.replace('  id: integer().primaryKey({ autoIncrement: true }),', '$&\n  email: text().notNull().unique(),')), appDir: dir };
  const plan = planAuthentication(ctx);
  const paths = plan.files.map((f) => f.path);
  assert.ok(paths.includes('app/middleware.ts'), 'the gate is the root segment middleware');
  assert.ok(paths.includes('app/logout/page.ts'), 'log out has a page the generator owns');
  assert.ok(!paths.some((p) => p.startsWith('app/dashboard')), 'no dashboard: signing in lands on the home page');
  assert.match(MIDDLEWARE, /^const publicPaths = \['\/login', '\/signup', '\/api\/auth'\];$/m);
  assert.match(plan.files.find((f) => f.path === 'modules/auth/auth.server.ts')?.content ?? '', /^export const signedInPath = '\/';$/m);
  assert.match(plan.files.find((f) => f.path === 'test/auth/auth.test.ts')?.content ?? '', /match: '\/logOut"', index: 0/);

  // An identical gate (a second run) is not a conflict.
  writeFileSync(join(dir, 'app', 'middleware.ts'), MIDDLEWARE);
  assert.doesNotThrow(() => planAuthentication(ctx));
  // The app's own middleware is kept: the plan is refused with the way to merge.
  writeFileSync(join(dir, 'app', 'middleware.ts'), 'export default function middleware() {}\n');
  assert.throws(() => planAuthentication(ctx), /app\/middleware\.ts already exists[\s\S]*move your code into the generated app\/middleware\.ts[\s\S]*--force to replace it/);
  assert.doesNotThrow(() => planAuthentication({ ...ctx, force: true }), '--force replaces it');
  // A middleware.js is never replaced, since a middleware.ts beside it would make two.
  writeFileSync(join(dir, 'app', 'middleware.js'), 'export default function middleware() {}\n');
  assert.throws(() => planAuthentication({ ...ctx, force: true }), /app\/middleware\.js already exists/);
});
