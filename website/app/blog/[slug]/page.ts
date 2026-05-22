import { html, unsafeHTML, notFound } from '@webjsdev/core';
import { readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * /blog/[slug]
 *
 * Reads `blog/<slug>.md` at SSR time, parses frontmatter, renders body.
 * Returns 404 via `notFound()` if the slug does not exist.
 *
 * `generateMetadata` derives <head> from the post's frontmatter so each
 * post gets its own title / description / og:* tags for SEO. Each post
 * has a self-contained canonical URL at `/blog/<slug>`, matching what
 * search engines index.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');
const BLOG_DIR = resolve(REPO_ROOT, 'blog');

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

async function loadPost(slug: string) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  let raw: string;
  try { raw = await readFile(join(BLOG_DIR, slug + '.md'), 'utf8'); }
  catch { return null; }
  const { fm, body } = parseFrontmatter(raw);
  if (!fm.title || !fm.date) return null;
  return {
    slug,
    title: fm.title,
    date: fm.date,
    description: fm.description || '',
    tags: (fm.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    author: fm.author || 'Vivek',
    body: body.trim(),
  };
}

function inline(s: string): string {
  let out = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) =>
    `<a href="${u}" class="text-accent no-underline hover:underline" rel="noopener noreferrer">${t}</a>`);
  out = out.replace(/`([^`]+)`/g, '<code class="font-mono text-[0.9em] bg-bg-subtle text-fg px-1.5 py-0.5 rounded">$1</code>');
  out = out.replace(/\*\*([^\n]+?)\*\*/g, '<strong class="font-semibold text-fg">$1</strong>');
  out = out.replace(/(^|[^\w])_([^_\s][^_]*[^_\s]|[^_\s])_(?=$|[^\w])/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^*\w])\*([^*\s][^*]*[^*\s]|[^*\s])\*(?=$|[^*\w])/g, '$1<em>$2</em>');
  return out;
}

/** Render body: h1 / h2 / h3 / fenced code / bulleted lists / paragraphs. */
function renderBody(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;
  let curItem: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let codeLang = '';

  function flushItem() {
    if (curItem.length) {
      out.push(`<li class="text-fg-muted text-[17px] leading-[1.8] relative pl-6 my-3 before:content-['•'] before:absolute before:left-1 before:top-0 before:text-fg-subtle before:font-bold">${inline(curItem.join(' '))}</li>`);
      curItem = [];
    }
  }
  function endList() {
    flushItem();
    if (inList) { out.push('</ul>'); inList = false; }
  }
  function startList() {
    if (!inList) { out.push('<ul class="my-7 space-y-2 list-none ml-2">'); inList = true; }
  }

  for (const raw of lines) {
    if (inCode) {
      if (raw.trim().startsWith('```')) {
        const escaped = codeBuf.join('\n')
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        out.push(`<pre class="bg-bg-subtle border border-border rounded-lg my-8 overflow-x-auto"><code class="font-mono text-[13px] leading-[1.65] text-fg whitespace-pre block px-6 py-5"${codeLang ? ` data-lang="${codeLang}"` : ''}>${escaped}</code></pre>`);
        codeBuf = [];
        codeLang = '';
        inCode = false;
      } else {
        codeBuf.push(raw);
      }
      continue;
    }
    if (raw.trim().startsWith('```')) {
      endList();
      inCode = true;
      codeLang = raw.trim().slice(3).trim();
      continue;
    }
    const line = raw;
    if (/^# /.test(line)) {
      endList();
      out.push(`<h2 class="font-serif text-[clamp(26px,3.5vw,34px)] leading-[1.18] tracking-tight text-fg mt-20 mb-6">${inline(line.slice(2).trim())}</h2>`);
    } else if (/^## /.test(line)) {
      endList();
      out.push(`<h3 class="font-serif text-[clamp(21px,2.8vw,26px)] leading-[1.2] tracking-tight text-fg mt-14 mb-5">${inline(line.slice(3).trim())}</h3>`);
    } else if (/^### /.test(line)) {
      endList();
      out.push(`<h4 class="font-mono text-[12px] uppercase tracking-[0.18em] font-semibold text-fg-subtle mt-10 mb-4">${inline(line.slice(4).trim())}</h4>`);
    } else if (/^> /.test(line)) {
      endList();
      out.push(`<blockquote class="border-l-2 border-accent pl-5 my-8 italic text-fg-muted text-[17px] leading-[1.7]">${inline(line.slice(2).trim())}</blockquote>`);
    } else if (/^- /.test(line)) {
      flushItem();
      startList();
      curItem.push(line.slice(2).trim());
    } else if (inList && /^ {2,}\S/.test(line)) {
      curItem.push(line.trim());
    } else if (line.trim() === '') {
      flushItem();
    } else {
      endList();
      out.push(`<p class="text-fg-muted text-[17px] leading-[1.8] my-7">${inline(line.trim())}</p>`);
    }
  }
  endList();
  return out.join('\n');
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = await loadPost(params.slug);
  if (!post) return { title: 'Post not found · webjs' };
  return {
    title: `${post.title} · webjs blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      url: `https://webjs.dev/blog/${post.slug}`,
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await loadPost(params.slug);
  if (!post) notFound();

  return html`
    <main class="max-w-[760px] mx-auto px-6 py-16">
      <nav class="mb-12">
        <a href="/blog" class="font-mono text-[12px] text-fg-subtle no-underline hover:text-fg tracking-wide">← All posts</a>
      </nav>

      <header class="mb-16">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2 mb-6">
          <time class="font-mono text-[12.5px] text-fg-subtle tracking-tight">${post.date.slice(0, 10)}</time>
          <span class="text-fg-subtle/40 text-[12px]">·</span>
          <span class="font-mono text-[12.5px] text-fg-subtle">By ${post.author}</span>
          ${post.tags.length > 0 ? html`<span class="text-fg-subtle/40 text-[12px]">·</span>` : ''}
          ${post.tags.map((t) => html`<span class="bg-fg-subtle/10 text-fg-subtle font-mono text-[10.5px] uppercase tracking-[0.12em] px-2 py-0.5 rounded">${t}</span>`)}
        </div>
        <h1 class="font-serif text-[clamp(36px,6vw,56px)] leading-[1.05] tracking-tight text-fg m-0 mb-6">${post.title}</h1>
        <p class="text-fg-muted text-[19px] leading-[1.55] m-0 font-serif italic">${post.description}</p>
      </header>

      <article class="mt-4">${unsafeHTML(renderBody(post.body))}</article>

      <footer class="mt-28 pt-10 border-t border-border">
        <a href="/blog" class="font-mono text-[12px] text-fg-subtle no-underline hover:text-fg tracking-wide">← All posts</a>
      </footer>
    </main>
  `;
}
