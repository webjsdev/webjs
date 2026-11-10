import { html } from '@webjsdev/core';

export const metadata = { title: 'Database (Drizzle) | WebJs' };

export default function Database() {
  return html`
    <h1>Database (Drizzle)</h1>
    <p>WebJs uses <strong>Drizzle</strong> as the default ORM. It fits the buildless thesis: there is <strong>no codegen and no engine binary</strong> (what you write is what runs), it runs on Node and Bun, and the types are inferred straight from your schema. SQLite is the default; Postgres is a flag away. The scaffold wires it all up under a <code>db/</code> folder.</p>

    <h2>What the scaffold gives you</h2>
    <code-block>db/
  schema.server.ts       your models + relations, plain Drizzle
  connection.server.ts   opens the driver, exports \`db\`
  seed.server.ts         optional seed (run via \`webjs db seed\`)
  migrations/            generated SQL (committed)
drizzle.config.ts        drizzle-kit config (root)</code-block>
    <p>The schema is plain Drizzle, written as Drizzle's own docs write it, so nothing WebJs-specific stands between you and the builders. The schema's column builders (<code>drizzle-orm/sqlite-core</code> or <code>drizzle-orm/pg-core</code>) and <code>db/connection.server.ts</code> are the dialect-specific parts; your queries and actions are identical whether you run SQLite or Postgres.</p>

    <h2>The schema</h2>
    <p>Write models with Drizzle's builders directly:</p>
    <code-block>// db/schema.server.ts (SQLite)
import { defineRelations } from 'drizzle-orm';
import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer().primaryKey({ autoIncrement: true }),
  email: text().notNull().unique(),
  name: text(),
  createdAt: integer({ mode: 'timestamp_ms' }).notNull().defaultNow(),
});

export const posts = sqliteTable('posts', {
  id: integer().primaryKey({ autoIncrement: true }),
  slug: text().notNull().unique(),
  title: text().notNull(),
  body: text().notNull(),
  authorId: integer().notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer({ mode: 'timestamp_ms' }).notNull().defaultNow(),
}, (t) => [index('posts_author_id_idx').on(t.authorId)]);

export const relations = defineRelations({ users, posts }, (r) => ({
  users: { posts: r.many.posts({ from: r.users.id, to: r.posts.authorId }) },
  posts: { author: r.one.users({ from: r.posts.authorId, to: r.users.id }) },
}));

export type Post = typeof posts.$inferSelect;</code-block>
    <p>A column's SQL name is its key unless you give one (<code>integer('created_at', { mode: 'timestamp_ms' })</code>). <code>integer({ mode: 'timestamp_ms' })</code> reads and writes a JavaScript <code>Date</code>; plain <code>integer()</code> is a number. A JSON column is <code>text({ mode: 'json' }).$type&lt;T&gt;()</code> on SQLite and <code>jsonb().$type&lt;T&gt;()</code> on Postgres. A UUID key is <code>text().primaryKey().$defaultFn(() =&gt; crypto.randomUUID())</code> on SQLite and <code>uuid().primaryKey().defaultRandom()</code> on Postgres.</p>

    <h2>Migrations</h2>
    <p>Drizzle has no client to generate. <code>generate</code> turns your schema into SQL; <code>migrate</code> applies it.</p>
    <code-block>npm run db:generate     # webjs db generate -> drizzle-kit generate (schema to SQL)
npm run db:migrate      # webjs db migrate  -> drizzle-kit migrate (apply)</code-block>
    <p>Both <code>webjs dev</code> and <code>webjs start</code> run <code>webjs db migrate</code> before serving (the <code>webjs.dev.before</code> / <code>webjs.start.before</code> steps, idempotent), so after you <code>db:generate</code> a migration it is applied on the next boot with no manual <code>db:migrate</code>, and a deploy applies pending migrations before serving. <code>generate</code> stays a deliberate, manual step (it authors migration files from a schema diff), never auto-run on boot.</p>

    <h2>The connection</h2>
    <code-block>// db/connection.server.ts (SQLite, runtime-neutral)
import * as schema from './schema.server.ts';

const url = process.env.DATABASE_URL?.replace(/^file:/, '') ?? 'db/dev.db';

// node:sqlite and bun:sqlite default busy_timeout to 0, so a contended write
// throws "database is locked". Set a 5s wait (+ WAL) so it waits instead.
function tune&lt;T extends { exec(sql: string): unknown }&gt;(client: T): T {
  client.exec('PRAGMA busy_timeout = 5000');
  client.exec('PRAGMA journal_mode = WAL');
  return client;
}

// Cache the DRIVER handle, never the Drizzle instance (see below).
const g = globalThis as unknown as { __webjs_db_clients?: Map&lt;string, unknown&gt; };
const clients = (g.__webjs_db_clients ??= new Map());
function cached&lt;T&gt;(open: () =&gt; T): T {
  if (!clients.has(url)) clients.set(url, open());
  return clients.get(url) as T;
}

async function connect() {
  if ((globalThis as { Bun?: unknown }).Bun) {
    const { Database } = await import('bun:sqlite');
    const { drizzle } = await import('drizzle-orm/bun-sqlite');
    return drizzle({ client: cached(() =&gt; tune(new Database(url))), relations: schema.relations });
  }
  const { DatabaseSync } = await import('node:sqlite');
  const { drizzle } = await import('drizzle-orm/node-sqlite');
  return drizzle({ client: cached(() =&gt; tune(new DatabaseSync(url))), relations: schema.relations });
}

export const db = await connect();</code-block>
    <p>The <code>globalThis</code> cache reuses one open connection per database url across dev-server reloads. It holds the driver handle only: the Drizzle instance is rebuilt each time the module is evaluated, because it captures <code>schema.relations</code>. Caching the instance instead kept the relations from the first load, so a table added while <code>npm run dev</code> ran stayed <code>undefined</code> on <code>db.query</code> until a restart. This is the only file that opens the driver, and it is server-only (<code>.server.ts</code>), so it never reaches the browser.</p>

    <h2>Queries and mutations</h2>
    <p>Reads use the relational query builder with object filters; writes use the builder with <code>.returning()</code> (both SQLite and Postgres support it).</p>
    <code-block>// modules/posts/queries/list-posts.server.ts
'use server';
import { db } from '#db/connection.server.ts';

export async function listPosts() {
  return db.query.posts.findMany({
    orderBy: { createdAt: 'desc' },
    with: { author: { columns: { name: true } } },
  });
}</code-block>
    <code-block>// modules/posts/actions/create-post.server.ts
'use server';
import { db } from '#db/connection.server.ts';
import { posts } from '#db/schema.server.ts';

export async function createPost(input: { slug: string; title: string; body: string; authorId: number }) {
  const [row] = await db.insert(posts).values(input).returning();
  return { success: true as const, data: row };
}</code-block>
    <p>Import the query or action from a page or component as a normal import; WebJs rewrites it into a typed RPC stub on the client.</p>
    <code-block>// app/page.ts
import { listPosts } from '#modules/posts/queries/list-posts.server.ts';

export default async function Home() {
  const posts = await listPosts();
  return html\`&lt;ul&gt;\${posts.map(p =&gt; html\`&lt;li&gt;\${p.title}&lt;/li&gt;\`)}&lt;/ul&gt;\`;
}</code-block>

    <p><strong>Why the <code>.server.ts</code> boundary?</strong> Page modules (and layouts, loading, error, not-found, plus all components) load in the browser so transitively imported components register. A top-level import of <code>db/connection.server.ts</code> would pull the DB driver (<code>pg</code>, or the built-in <code>node:sqlite</code>, which need Node APIs) into the browser graph and crash. The <code>.server.{js,ts}</code> extension lets the framework rewrite the import into an RPC stub; the driver and your DB code never reach the client. The rule across the framework: server-only code goes in <code>.server.{js,ts}</code> files, <code>route.ts</code> handlers, or <code>middleware.ts</code>. Never in pages, layouts, or components.</p>

    <h2>Type safety</h2>
    <p>Types are inferred from the schema, never hand-written. <code>typeof posts.$inferSelect</code> is the row type; a <code>.ts</code> server action's return type flows through the RPC boundary to the client, and webjs's rich-type serializer keeps a <code>Date</code> a <code>Date</code> on both sides.</p>

    <h2>Switching to Postgres</h2>
    <p>Scaffold with the dialect you want:</p>
    <code-block>webjs create my-app --db postgres</code-block>
    <p>That writes the Postgres variants of <code>db/schema.server.ts</code> (<code>pgTable</code> from <code>drizzle-orm/pg-core</code>) and <code>db/connection.server.ts</code> (and the <code>pg</code> driver). The deploy files follow the dialect too: <code>compose.yaml</code> runs a <code>postgres:17-alpine</code> <code>db</code> service the app waits on (healthy before the boot-time migrate), and the generated CI workflow starts a Postgres service container, so <code>docker compose up</code> and the first CI run both work with no edits. Your <code>schema.server.ts</code>, queries, and actions are unchanged. To move an existing app, swap those two files for the Postgres variants and point <code>DATABASE_URL</code> at your Postgres instance. Migrations are generated per dialect, and runtime behaviour differs (case-sensitivity, constraints), so run your tests against the production engine before relying on a dev-SQLite / prod-Postgres setup. The generated <code>DATABASE_URL</code> names a lowercased, separator-folded form of the app name, so <code>MyApp</code> gets <code>myapp</code>, which is the same name Postgres folds an unquoted <code>CREATE DATABASE MyApp</code> to.</p>

    <h2>CLI</h2>
    <code-block>webjs db generate    # schema -> SQL migration (drizzle-kit generate)
webjs db migrate     # apply pending migrations (drizzle-kit migrate)
webjs db push        # push the schema straight to the dev DB (drizzle-kit push)
webjs db studio      # visual DB browser (drizzle-kit studio)
webjs db seed        # run db/seed.server.ts
webjs db &lt;verb&gt;      # any verb webjs.db maps in package.json (see below)</code-block>

    <h2 id="bring-your-own-orm">Bring your own ORM</h2>
    <p>Drizzle is the <em>default</em>, not lock-in. The runtime never imports it, <code>db/connection.server.ts</code> is your own file, and the <code>webjs db</code> verbs are adapter-driven. A <code>db</code> block in the <code>package.json</code> <code>webjs</code> config maps each verb to the shell command <code>webjs db &lt;verb&gt;</code> runs instead of the drizzle-kit default, with <code>node_modules/.bin</code> on the PATH and any extra arguments appended, so a Prisma app looks like this.</p>
    <code-block>"webjs": &#123;
  "db": &#123;
    "generate": "prisma migrate dev --create-only",
    "migrate":  "prisma migrate deploy",
    "push":     "prisma db push",
    "studio":   "prisma studio",
    "reset":    "prisma migrate reset --force"
  &#125;
&#125;</code-block>
    <p>Any key is a verb, so <code>reset</code> above adds a <code>webjs db reset</code> command. A verb the block does not name keeps its default (drizzle-kit for the four kit verbs, <code>db/seed.server.ts</code> for <code>seed</code>), so an app with no block behaves exactly as before and the scaffold emits none. The point is that <code>webjs db migrate</code> stays one spelling whatever sits behind it, so the scaffolded <code>dev.before</code> and <code>start.before</code> steps, the Dockerfile, CI, and the deployment guide all keep working after a swap. Write the bare binary (<code>prisma migrate deploy</code>) rather than <code>npx prisma ...</code>, since a pure Bun image ships no <code>npx</code>. The rest of the swap is your own files: replace <code>db/connection.server.ts</code> with the new client, delete <code>drizzle.config.ts</code> and <code>db/columns.server.ts</code>, and keep the server-only imports behind <code>.server.ts</code> exactly as with Drizzle.</p>
  `;
}
