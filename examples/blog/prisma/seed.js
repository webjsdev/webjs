/**
 * Deterministic, idempotent seed for the blog example.
 *
 * Gives a freshly migrated database a demo author and a few posts so the
 * home page has content to list. Used by CI (the e2e suite asserts the
 * home page shows at least one post link) and handy for local dev after
 * `npm run db:migrate`. Re-running is safe: every row is upserted.
 *
 * Run: `npx prisma db seed` (wired via the `prisma.seed` key in
 * package.json), or `node prisma/seed.js` directly.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
  const author = await prisma.user.upsert({
    where: { email: 'demo@webjs.dev' },
    update: {},
    // Placeholder hash: this seed author exists to own demo posts, not to
    // log in. The auth e2e flows create their own users via signup.
    create: { email: 'demo@webjs.dev', name: 'Demo Author', passwordHash: 'seed-placeholder-not-a-valid-hash' },
  });

  for (const post of POSTS) {
    await prisma.post.upsert({
      where: { slug: post.slug },
      update: {},
      create: { ...post, authorId: author.id },
    });
  }
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
