'use server';

import { db } from '#db/connection.server.ts';
import { formatComment } from '#modules/comments/utils/format.ts';
import type { CommentFormatted } from '#modules/comments/types.ts';

// A GET server action (#488): the initial comment list for a post. The live
// thread updates over a WebSocket (see comments-thread.ts), so the cache is
// short; the per-post `comments:` tag (resolved from the `postId` arg) is what
// `createComment` evicts. Private cache is the safe default.
export const method = 'GET';
export const cache = 15;
export const tags = (input: { postId: number }) => ['comments', `comments:${input.postId}`];
export async function listComments(input: { postId: number }): Promise<CommentFormatted[]> {
  const rows = await db.query.comments.findMany({
    where: { postId: input.postId },
    orderBy: { createdAt: 'asc' },
    with: { author: { columns: { name: true, email: true } } },
  });
  return rows.map(formatComment);
}
