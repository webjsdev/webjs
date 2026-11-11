// Unit tests for `webjs generate`: the name inflector, the Rails field
// grammar, the schema edits and the overwrite guard. The generated app as a
// whole is tested in test/scaffolds/generate-scaffold.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resourceNames, pluralize } from '../../packages/cli/lib/generate/names.js';
import { parseField, parseFields, columnFor } from '../../packages/cli/lib/generate/fields.js';
import { addImports, registerTable, addOneRelations, insertBlock, dialectOf } from '../../packages/cli/lib/generate/schema-edit.js';
import { parseGenerateArgs, applyPlan, migrationStamp, waitForNextMigrationSecond } from '../../packages/cli/lib/generate/index.js';
import { removeTable } from '../../packages/cli/lib/generate/destroy.js';
import { planMigration } from '../../packages/cli/lib/generate/migration.js';
import { planController } from '../../packages/cli/lib/generate/controller.js';
import { modelSummary } from '../../packages/cli/lib/generate/scaffold.js';

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
  assert.equal(registerTable('const x = 1;\n', 'posts'), null, 'no call: the caller prints the edit instead');
});

test('removeTable undoes the generator\'s schema edits', () => {
  let src = addImports(SCHEMA, 'drizzle-orm/sqlite-core', ['integer']);
  src = insertBlock(src, "export const posts = sqliteTable('posts', {\n  id: integer(),\n});\nexport type Post = typeof posts.$inferSelect;\n");
  src = /** @type {string} */ (registerTable(src, 'posts'));
  src = /** @type {string} */ (addOneRelations(src, 'posts', [{ relation: 'author', target: 'users', column: 'authorId' }]));
  const out = /** @type {string} */ (removeTable(src, 'posts', 'Post'));
  assert.doesNotMatch(out, /^export const posts/m);
  assert.doesNotMatch(out, /export type Post\b/);
  assert.match(out, /^export const relations = defineRelations\(\{ users \}, \(r\) => \(\{\n\}\)\);/m);
  assert.equal(removeTable(SCHEMA, 'posts', 'Post'), null);
});

const ctxWith = (schema) => ({
  appDir: '/app', schema, dialect: /** @type {'sqlite'} */ ('sqlite'), hasPages: true,
  ui: { button: true, input: true, label: true, textarea: false, kit: true }, skipTests: false,
});
const POSTS = `import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const posts = sqliteTable('posts', {
  id: integer().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  views: integer(),
});
`;

test('migration AddXToTable adds the columns to that table and names the migration as Rails does', () => {
  const plan = planMigration(ctxWith(POSTS), { name: 'AddPublishedAtToPosts', fields: ['published_at:datetime', 'flag:boolean'] }, () => { throw new Error('not a create'); });
  assert.equal(plan.migrationName, 'add_published_at_to_posts');
  assert.match(plan.edits[0].content, / {2}views: integer\(\),\n {2}publishedAt: integer\(\{ mode: 'timestamp_ms' \}\),\n {2}flag: integer\(\{ mode: 'boolean' \}\)\.notNull\(\)\.default\(false\),\n\}\);/);
  assert.throws(() => planMigration(ctxWith(POSTS), { name: 'AddTitleToPosts', fields: ['title'] }, () => ({})), /already has title/);
  assert.throws(() => planMigration(ctxWith(POSTS), { name: 'AddXToComments', fields: ['x'] }, () => ({})), /no comments table/);
});

test('migration RemoveXFromTable drops the column lines, CreateTable is the model generator, anything else refuses', () => {
  const plan = planMigration(ctxWith(POSTS), { name: 'RemoveViewsFromPosts', fields: ['views'] }, () => ({}));
  assert.doesNotMatch(plan.edits[0].content, /views/);
  assert.equal(plan.migrationName, 'remove_views_from_posts');
  let delegated;
  planMigration(ctxWith(POSTS), { name: 'CreateTags', fields: ['name:string!'] }, (_c, o) => { delegated = o; return {}; });
  assert.deepEqual(delegated, { name: 'tags', fields: ['name:string!'], kind: 'model' });
  assert.throws(() => planMigration(ctxWith(POSTS), { name: 'RenamePosts', fields: [] }, () => ({})), /AddXToTable, RemoveXFromTable or CreateTable/);
});

test('controller writes one page per action, index at the segment root, and a render test', () => {
  const plan = planController(ctxWith(''), { name: 'Pages', actions: ['index', 'about_us'] });
  assert.deepEqual(plan.files.map((f) => f.path), ['app/pages/page.ts', 'app/pages/about-us/page.ts', 'test/pages/pages.test.ts']);
  assert.match(plan.files[1].content, /export default function PagesAboutUsPage\(\)/);
  assert.match(plan.files[2].content, /for \(const path of \['\/pages', '\/pages\/about-us'\]\)/);
  assert.throws(() => planController({ ...ctxWith(''), hasPages: false }, { name: 'pages', actions: [] }), /no root layout/);
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
  assert.deepEqual(parseGenerateArgs(['scaffold', 'post', 'title:string!', '-f', '--plural', 'postz']), {
    generator: 'scaffold', name: 'post', fields: ['title:string!'], force: true, pretend: false, skipTests: false, skipMigration: false, plural: 'postz',
  });
  assert.equal(parseGenerateArgs(['auth']).generator, 'authentication');
  assert.throws(() => parseGenerateArgs(['scaffold', 'post', '--bogus']), /Unknown option --bogus/);
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
