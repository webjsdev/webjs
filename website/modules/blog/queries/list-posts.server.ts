'use server';

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '../../../lib/frontmatter.ts';
import type { Post } from '../types.ts';

// website/modules/blog/queries/list-posts.server.ts is 4 levels deep
// from the repo root (website/modules/blog/queries/...).
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');
const BLOG_DIR = resolve(REPO_ROOT, 'blog');

/**
 * Read every `blog/<slug>.md` at the repo root, parse frontmatter,
 * sort by date DESC. Returns the metadata, not the body, so the index
 * page can render compact cards without loading every post's full text.
 *
 * Each file's frontmatter requires `title` and `date`; other fields are
 * optional. Files without those fields are dropped silently (lets you
 * keep a draft `.md` in the directory without breaking the index).
 */
export async function listPosts(): Promise<Post[]> {
  let files: string[];
  try { files = await readdir(BLOG_DIR); } catch { return []; }
  const posts: Post[] = [];
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    const raw = await readFile(join(BLOG_DIR, f), 'utf8');
    const { fm } = parseFrontmatter(raw);
    if (!fm.title || !fm.date) continue;
    posts.push({
      slug: f.replace(/\.md$/, ''),
      title: fm.title,
      date: fm.date,
      description: fm.description || '',
      tags: (fm.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      author: fm.author || 'Vivek',
    });
  }
  posts.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return posts;
}
