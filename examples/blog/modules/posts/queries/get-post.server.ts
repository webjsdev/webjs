'use server';

import { db } from '#/db/connection.server.ts';
import { formatPost } from '#/modules/posts/utils/slugify.ts';
import type { PostFormatted } from '#/modules/posts/types.ts';

export async function getPost(input: { slug: string }): Promise<PostFormatted | null> {
  const row = await db.query.posts.findFirst({
    where: { slug: input.slug },
    with: { author: { columns: { name: true, email: true } } },
  });
  return row ? formatPost(row) : null;
}
