/**
 * Deterministic, idempotent seed for the blog example.
 *
 * Gives a freshly migrated database a demo author and a few posts so the
 * home page has content to list. Used by CI (the e2e suite asserts the home
 * page shows at least one post link) and handy for local dev after
 * `npm run db:migrate`. Re-running is safe: every row is insert-or-skip via
 * ON CONFLICT (works on SQLite and Postgres alike).
 *
 * Run: `npm run db:seed` (which runs `webjs db seed`, executing this file).
 */
import { db } from './connection.server.ts';
import { users, posts } from './schema.server.ts';

const POSTS = [
  {
    slug: 'hello-webjs',
    title: 'Hello, webjs',
    body: 'The first post on a zero-build, web-components-first framework. Server-rendered, progressively enhanced, authored in plain JavaScript with JSDoc.',
  },
  {
    slug: 'zero-build-steps',
    title: 'Zero build steps',
    body: 'webjs serves your source files as native ES modules. No bundler, no output directory. Production performance comes from HTTP/2 multiplex and SSR-time modulepreload hints.',
  },
  {
    slug: 'web-components-first',
    title: 'Web components first',
    body: 'A lit-aligned component runtime so the ecosystem knowledge transfers, with SSR and progressive enhancement by default.',
  },
];

async function main() {
  // Placeholder hash: this seed author exists to own demo posts, not to
  // log in. The auth e2e flows create their own users via signup.
  await db.insert(users).values({
    email: 'demo@webjs.dev',
    name: 'Demo Author',
    passwordHash: 'seed-placeholder-not-a-valid-hash',
  }).onConflictDoNothing({ target: users.email });

  const author = await db.query.users.findFirst({ where: { email: 'demo@webjs.dev' } });
  if (!author) throw new Error('[seed] author row missing after upsert');

  for (const post of POSTS) {
    await db.insert(posts).values({ ...post, authorId: author.id })
      .onConflictDoNothing({ target: posts.slug });
  }
}

main()
  .then(() => console.log('[seed] done'))
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  });
