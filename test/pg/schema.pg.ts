/**
 * The unified schema body (users + posts with a relation), written against the
 * Postgres column helpers (#563). Deliberately the SAME shape the blog's
 * SQLite schema uses (db/schema.server.ts), to prove one schema/queries port
 * to Postgres with only the columns module swapped.
 */
import { defineRelations } from 'drizzle-orm';
import type { RelationsBuilder, ExtractTablesFromSchema } from 'drizzle-orm';
import { table, pk, text, integer, createdAt, index } from './columns.pg.ts';

export const users = table('users', {
  id: pk(),
  email: text().notNull().unique(),
  name: text(),
  createdAt: createdAt(),
});
const usersRelations = (r: R) => ({
  users: { posts: r.many.posts({ from: r.users.id, to: r.posts.authorId }) },
});

export const posts = table('posts', {
  id: pk(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  authorId: integer().notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
}, (t) => [index(t.authorId), index(t.createdAt)]);
const postsRelations = (r: R) => ({
  posts: { author: r.one.users({ from: r.posts.authorId, to: r.users.id }) },
});

const schema = { users, posts };
type R = RelationsBuilder<ExtractTablesFromSchema<typeof schema>>;

export const relations = defineRelations(schema, (r) => ({
  ...usersRelations(r),
  ...postsRelations(r),
}));

export type User = typeof users.$inferSelect;
export type Post = typeof posts.$inferSelect;
