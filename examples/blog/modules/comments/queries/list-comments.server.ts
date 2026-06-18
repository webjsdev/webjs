'use server';

import { db } from '#db/connection.server.ts';
import { formatComment } from '#modules/comments/utils/format.ts';
import type { CommentFormatted } from '#modules/comments/types.ts';

export async function listComments(input: { postId: number }): Promise<CommentFormatted[]> {
  const rows = await db.query.comments.findMany({
    where: { postId: input.postId },
    orderBy: { createdAt: 'asc' },
    with: { author: { columns: { name: true, email: true } } },
  });
  return rows.map(formatComment);
}
