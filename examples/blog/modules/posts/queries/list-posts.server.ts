'use server';

import { cache } from '@webjsdev/server';
import { db } from '../../../db/connection.server.ts';
import { formatPost } from '../utils/slugify.ts';
import type { PostFormatted } from '../types.ts';

/** List the most recent posts, newest first, with author info denormalised. */
export const listPosts = cache(
  async (): Promise<PostFormatted[]> => {
    const rows = await db.query.posts.findMany({
      orderBy: { createdAt: 'desc' },
      with: { author: { columns: { name: true, email: true } } },
    });
    return rows.map(formatPost);
  },
  { key: 'posts', ttl: 60 }
);
