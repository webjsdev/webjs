import { html, unsafeHTML } from '@webjskit/core';
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * /changelog
 *
 * Reads every `changelog/<pkg>/<version>.md` file at SSR time, parses
 * the frontmatter + body, sorts by date descending, and renders one
 * card per release. No markdown library: the entries are produced by
 * `scripts/backfill-changelog.js` and follow a known shape (h1, h2
 * section headings, top-level bulleted lists of changes), so we
 * render the subset of markdown that shape uses.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
// website/app/changelog/page.ts is 3 levels deep from repo root.
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const CHANGELOG_DIR = resolve(REPO_ROOT, 'changelog');

export const metadata = {
  title: 'Changelog · webjs',
  description: 'Per-package, per-version release notes for the webjs framework: @webjskit/core, server, cli, ts-plugin, ui.',
};

type Entry = {
  package: string;          // "@webjskit/core"
  shortPkg: string;         // "core"
  version: string;          // "0.6.0"
  date: string;             // "2026-05-21"
  commitCount: number;
  body: string;             // raw markdown body (after frontmatter)
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

async function loadEntries(): Promise<Entry[]> {
  const entries: Entry[] = [];
  let pkgs: string[];
  try { pkgs = await readdir(CHANGELOG_DIR, { withFileTypes: true }).then((es) => es.filter((e) => e.isDirectory()).map((e) => e.name)); }
  catch { return []; }
  for (const pkg of pkgs) {
    const dir = join(CHANGELOG_DIR, pkg);
    let files: string[];
    try { files = await readdir(dir); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      const raw = await readFile(join(dir, f), 'utf8');
      const { fm, body } = parseFrontmatter(raw);
      if (!fm.version || !fm.date) continue;
      entries.push({
        package: fm.package || `@webjskit/${pkg}`,
        shortPkg: pkg,
        version: fm.version,
        date: fm.date,
        commitCount: Number(fm.commit_count || 0),
        body: body.trim(),
      });
    }
  }
  // Sort: most recent first; tie-break by package name.
  entries.sort((a, b) => (b.date.localeCompare(a.date)) || a.shortPkg.localeCompare(b.shortPkg));
  return entries;
}

/** Tiny inline-markdown renderer: links, bold, italic, inline code. */
function inline(s: string): string {
  let out = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) =>
    `<a href="${u}" class="text-accent no-underline hover:underline" rel="noopener noreferrer">${t}</a>`);
  // `code`
  out = out.replace(/`([^`]+)`/g, '<code class="font-mono text-[12.5px] bg-bg-subtle text-fg px-1 py-0.5 rounded">$1</code>');
  // **bold** (non-greedy single-line match: must allow asterisks
  // inside the span so titles like "**data-webjs-prop-* side-channel**"
  // still parse. The previous [^*]+ rejected the embedded asterisk
  // and silently left the literal ** in the rendered output.)
  out = out.replace(/\*\*([^\n]+?)\*\*/g, '<strong class="font-semibold text-fg">$1</strong>');
  // _italic_ and *italic* (the backfill generator does not emit these,
  // but hand-curated entries can; the previous renderer left the
  // underscores in the rendered HTML).
  out = out.replace(/(^|[^\w])_([^_\s][^_]*[^_\s]|[^_\s])_(?=$|[^\w])/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^*\w])\*([^*\s][^*]*[^*\s]|[^*\s])\*(?=$|[^*\w])/g, '$1<em>$2</em>');
  return out;
}

/** Render the body of one entry: h1 / h2 / bulleted lists / paragraphs. */
function renderBody(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;
  let curItem: string[] = [];

  function flushItem() {
    if (curItem.length) {
      out.push(`<li class="text-fg-muted text-[14px] leading-relaxed">${inline(curItem.join(' '))}</li>`);
      curItem = [];
    }
  }
  function endList() {
    flushItem();
    if (inList) { out.push('</ul>'); inList = false; }
  }
  function startList() {
    if (!inList) { out.push('<ul class="list-disc pl-5 space-y-2 my-3">'); inList = true; }
  }

  for (const raw of lines) {
    const line = raw;
    if (/^# /.test(line)) {
      endList();
      out.push(`<h3 class="font-mono text-[16px] font-semibold tracking-tight text-fg mt-0 mb-3">${inline(line.slice(2).trim())}</h3>`);
    } else if (/^## /.test(line)) {
      endList();
      out.push(`<h4 class="font-mono text-[11px] uppercase tracking-[0.15em] font-semibold text-fg-subtle mt-4 mb-1.5">${inline(line.slice(3).trim())}</h4>`);
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
      out.push(`<p class="text-fg-muted text-[14px] leading-relaxed my-3">${inline(line.trim())}</p>`);
    }
  }
  endList();
  return out.join('\n');
}

const PKG_COLOR: Record<string, string> = {
  core:        'bg-accent/15 text-accent',
  server:      'bg-blue-500/15 text-blue-500',
  cli:         'bg-emerald-500/15 text-emerald-500',
  'ts-plugin': 'bg-purple-500/15 text-purple-500',
  ui:          'bg-orange-500/15 text-orange-500',
};

function pkgBadge(pkg: string) {
  const cls = PKG_COLOR[pkg] || 'bg-fg-subtle/15 text-fg-subtle';
  return html`<span class="${cls} font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] px-2 py-0.5 rounded">${pkg}</span>`;
}

export default async function Changelog() {
  const entries = await loadEntries();
  return html`
    <main class="max-w-[840px] mx-auto px-6 py-12">
      <header class="mb-10">
        <p class="font-mono text-[11px] uppercase tracking-[0.15em] text-accent font-semibold mb-2">Changelog</p>
        <h1 class="font-serif text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-tight text-fg mb-3">What shipped</h1>
        <p class="text-fg-muted text-[15px] leading-relaxed max-w-[640px]">
          Per-package, per-version release notes for <code class="font-mono text-[13px] bg-bg-subtle px-1 py-0.5 rounded">@webjskit/core</code>,
          <code class="font-mono text-[13px] bg-bg-subtle px-1 py-0.5 rounded">/server</code>,
          <code class="font-mono text-[13px] bg-bg-subtle px-1 py-0.5 rounded">/cli</code>,
          <code class="font-mono text-[13px] bg-bg-subtle px-1 py-0.5 rounded">/ts-plugin</code>, and
          <code class="font-mono text-[13px] bg-bg-subtle px-1 py-0.5 rounded">/ui</code>.
          Each version-bump produces one entry, automatically.
        </p>
      </header>

      ${entries.length === 0
        ? html`<p class="text-fg-subtle italic">No entries yet.</p>`
        : entries.map((e) => html`
            <article class="border border-border rounded-xl bg-bg-elev p-5 sm:p-6 mb-5 shadow-sm">
              <header class="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
                ${pkgBadge(e.shortPkg)}
                <h2 class="font-mono text-[18px] font-semibold text-fg tracking-tight m-0">v${e.version}</h2>
                <time class="font-mono text-[11.5px] text-fg-subtle tracking-tight">${e.date}</time>
                <span class="text-[11.5px] text-fg-subtle">${e.commitCount} change${e.commitCount === 1 ? '' : 's'}</span>
              </header>
              <div>${unsafeHTML(renderBody(e.body))}</div>
            </article>
          `)}
    </main>
  `;
}
