'use server';

import { eq } from 'drizzle-orm';
import { db } from '#/db/connection.server.ts';
import { posts } from '#/db/schema.server.ts';
import { currentUser } from '#/modules/auth/queries/current-user.server.ts';
import { listPosts } from '#/modules/posts/queries/list-posts.server.ts';
import type { ActionResult } from '#/modules/auth/types.ts';

export async function deletePost(
  input: { slug: string },
): Promise<ActionResult<{ slug: string }>> {
  const me = await currentUser();
  if (!me) return { success: false, error: 'Not signed in', status: 401 };
  const post = await db.query.posts.findFirst({
    where: { slug: input.slug },
    columns: { id: true, authorId: true },
  });
  if (!post) return { success: false, error: 'Not found', status: 404 };
  if (post.authorId !== me.id) return { success: false, error: 'Forbidden', status: 403 };
  await db.delete(posts).where(eq(posts.id, post.id));
  await listPosts.invalidate();
  return { success: true, data: { slug: input.slug } };
}
