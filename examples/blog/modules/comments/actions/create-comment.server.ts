'use server';

import { db } from '#db/connection.server.ts';
import { comments } from '#db/schema.server.ts';
import { currentUser } from '#modules/auth/queries/current-user.server.ts';
import { publish } from '#modules/comments/utils/bus.ts';
import { formatComment } from '#modules/comments/utils/format.ts';
import type { ActionResult } from '#modules/auth/types.ts';
import type { CommentFormatted } from '#modules/comments/types.ts';

/**
 * Add a comment to a post. Requires auth. Publishes to the comments bus
 * so live subscribers (WebSocket clients) pick it up instantly.
 */
export async function createComment(
  input: { postId: number; body: string } | { postId: unknown; body: unknown },
): Promise<ActionResult<CommentFormatted>> {
  const me = await currentUser();
  if (!me) return { success: false, error: 'Not signed in', status: 401 };
  const postId = Number((input as any)?.postId);
  const body = typeof (input as any)?.body === 'string' ? (input as any).body.trim() : '';
  if (!Number.isFinite(postId)) return { success: false, error: 'postId required', status: 400 };
  if (!body) return { success: false, error: 'body is required', status: 400 };
  if (body.length > 2000) return { success: false, error: 'body too long', status: 400 };

  const post = await db.query.posts.findFirst({ where: { id: postId }, columns: { id: true } });
  if (!post) return { success: false, error: 'Post not found', status: 404 };

  const [row] = await db.insert(comments).values({ postId, authorId: me.id, body }).returning();
  // returning() gives columns only; splice the author we already hold.
  const formatted = formatComment({ ...row, author: { name: me.name, email: me.email } });
  publish(postId, formatted);
  return { success: true, data: formatted };
}
