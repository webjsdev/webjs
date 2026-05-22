import { html } from '@webjsdev/core';
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * /blog
 *
 * Reads every `blog/<slug>.md` at the repo root at SSR time, parses
 * frontmatter, and renders an index card per post sorted by date DESC.
 * Each card links to /blog/<slug> for the full post. The same renderer
 * shape as /changelog: zero markdown library, hand-rolled frontmatter
 * parse, server-rendered HTML for SEO.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const BLOG_DIR = resolve(REPO_ROOT, 'blog');

export const metadata = {
  title: 'Blog · webjs',
  description: 'Long-form notes from building webjs: the design decisions, the trade-offs, the things that did not work, and what the framework looks like in production.',
};

type Post = {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags: string[];
  author: string;
};

function parseFrontmatter(raw: string): { fm: Record<string, string>; body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  const fm: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    fm[k] = v;
  }
  return { fm, body: m[2] };
}

async function loadPosts(): Promise<Post[]> {
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

export default async function Blog() {
  const posts = await loadPosts();
  return html`
    <main class="max-w-[840px] mx-auto px-6 py-12">
      <header class="mb-10">
        <p class="font-mono text-[11px] uppercase tracking-[0.15em] text-accent font-semibold mb-2">Blog</p>
        <h1 class="font-serif text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-tight text-fg mb-3">Notes from building webjs</h1>
        <p class="text-fg-muted text-[15px] leading-relaxed max-w-[640px]">
          Long-form posts on the design decisions, the trade-offs, the things that did not work, and what the framework looks like in production. Written as the project evolves, not after the fact.
        </p>
      </header>

      ${posts.length === 0
        ? html`<p class="text-fg-subtle italic">No posts yet.</p>`
        : posts.map((p) => html`
            <article class="border border-border rounded-xl bg-bg-elev p-5 sm:p-6 mb-5 shadow-sm transition-colors hover:border-border-strong">
              <a href=${'/blog/' + p.slug} class="block no-underline text-fg">
                <header class="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
                  <time class="font-mono text-[11.5px] text-fg-subtle tracking-tight">${p.date.slice(0, 10)}</time>
                  ${p.tags.length > 0
                    ? p.tags.map((t) => html`<span class="bg-fg-subtle/10 text-fg-subtle font-mono text-[10.5px] uppercase tracking-[0.1em] px-2 py-0.5 rounded">${t}</span>`)
                    : ''}
                </header>
                <h2 class="font-serif text-[clamp(20px,3vw,26px)] leading-[1.15] tracking-tight text-fg m-0 mb-2">${p.title}</h2>
                <p class="text-fg-muted text-[14.5px] leading-relaxed m-0">${p.description}</p>
              </a>
            </article>
          `)}
    </main>
  `;
}
