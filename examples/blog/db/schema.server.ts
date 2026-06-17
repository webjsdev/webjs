/**
 * Database schema (Drizzle). Ported 1:1 from the previous prisma/schema.prisma.
 * Written against ./columns.server.ts so it is portable across SQLite and
 * Postgres; only that file differs per dialect.
 */
import { defineRelations } from 'drizzle-orm';
import type { RelationsBuilder, ExtractTablesFromSchema } from 'drizzle-orm';
import { table, pk, text, integer, timestamp, createdAt, index } from './columns.server.ts';

export const users = table('users', {
  id: pk(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  name: text(),
  createdAt: createdAt(),
});
const usersRelations = (r: R) => ({
  users: {
    posts: r.many.posts({ from: r.users.id, to: r.posts.authorId }),
    comments: r.many.comments({ from: r.users.id, to: r.comments.authorId }),
    sessions: r.many.sessions({ from: r.users.id, to: r.sessions.userId }),
  },
});

export const sessions = table('sessions', {
  token: text().primaryKey(),
  userId: integer().notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp().notNull(),
  createdAt: createdAt(),
}, (t) => [index(t.userId)]);
const sessionsRelations = (r: R) => ({
  sessions: { user: r.one.users({ from: r.sessions.userId, to: r.users.id }) },
});

export const posts = table('posts', {
  id: pk(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  body: text().notNull(),
  authorId: integer().notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
}, (t) => [index(t.authorId), index(t.createdAt)]);
const postsRelations = (r: R) => ({
  posts: {
    author: r.one.users({ from: r.posts.authorId, to: r.users.id }),
    comments: r.many.comments({ from: r.posts.id, to: r.comments.postId }),
  },
});

export const comments = table('comments', {
  id: pk(),
  postId: integer().notNull().references(() => posts.id, { onDelete: 'cascade' }),
  authorId: integer().notNull().references(() => users.id, { onDelete: 'cascade' }),
  body: text().notNull(),
  createdAt: createdAt(),
}, (t) => [index(t.postId, t.createdAt)]);
const commentsRelations = (r: R) => ({
  comments: {
    post: r.one.posts({ from: r.comments.postId, to: r.posts.id }),
    author: r.one.users({ from: r.comments.authorId, to: r.users.id }),
  },
});

// Tables registered for the relation builder; R types each per-model `r`.
const schema = { users, sessions, posts, comments };
type R = RelationsBuilder<ExtractTablesFromSchema<typeof schema>>;

// Per-model relations spread into one defineRelations.
export const relations = defineRelations(schema, (r) => ({
  ...usersRelations(r),
  ...sessionsRelations(r),
  ...postsRelations(r),
  ...commentsRelations(r),
}));

// Derived types, never hand-written.
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;
