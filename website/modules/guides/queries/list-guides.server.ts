'use server';

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '#lib/frontmatter.ts';
import type { Guide } from '#modules/guides/types.ts';

// website/modules/guides/queries/list-guides.server.ts is 4 levels deep
// from the repo root (website/modules/guides/queries/...).
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');
const GUIDES_DIR = resolve(REPO_ROOT, 'guides');

/**
 * Read every `guides/<slug>.md` at the repo root, parse frontmatter, and
 * return the metadata (not the body) for the `/guides` index cards.
 * Sorted newest first so a freshly published guide leads the hub.
 *
 * Mirrors the compare module (list-comparisons). Each file requires
 * `title`, `tagline`, and `keyword`; files missing those are dropped
 * silently (lets a draft sit in the directory).
 *
 * Declared as a GET server action (#488): a public, cacheable read of
 * repo content identical for every visitor, so `public: true` is safe.
 * The `guides` tag lets a future write path evict it.
 */
export const method = 'GET';
export const cache = { maxAge: 300, public: true };
export const tags = () => ['guides'];
export async function listGuides(): Promise<Guide[]> {
  let files: string[];
  try { files = await readdir(GUIDES_DIR); } catch { return []; }
  const guides: Guide[] = [];
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    const raw = await readFile(join(GUIDES_DIR, f), 'utf8');
    const { fm } = parseFrontmatter(raw);
    if (!fm.title || !fm.tagline || !fm.keyword) continue;
    guides.push({
      slug: f.replace(/\.md$/, ''),
      title: fm.title,
      date: fm.date || '',
      description: fm.description || '',
      tagline: fm.tagline,
      keyword: fm.keyword,
      tags: (fm.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      author: fm.author || 'Vivek',
    });
  }
  guides.sort((a, b) => Date.parse(b.date || '0') - Date.parse(a.date || '0'));
  return guides;
}
