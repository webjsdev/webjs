/**
 * A small HTML to markdown pass over SERVER-RENDERED output (#1666).
 *
 * The /ui docs pages are built from `html` templates full of holes
 * (`${await componentPreview(...)}`, install tabs, API tables), so their
 * markdown cannot be read off the page SOURCE the way lib/docs-llms.server.ts
 * reads the framework docs. Instead the page module is rendered and its HTML
 * converted here, which keeps one copy of every page: the markdown is what a
 * reader sees, minus the chrome.
 *
 * The input is markup this site renders, so the tokenizer handles exactly
 * what our templates emit (balanced tags, quoted attributes, void elements,
 * comments, raw-text elements) rather than the whole HTML parsing algorithm.
 * It is import-free and has no filesystem access.
 *
 * What it keeps: headings, paragraphs, lists, tables, blockquotes, links,
 * inline code and emphasis, and every code figure as a fenced block (the
 * `figure[data-rehype-pretty-code-figure]` lib/ui/docs/code.ts renders, a
 * bare `pre`, and the `<code-block>` element). What it drops: script, style,
 * svg, form controls, navigation, screen-reader-only text, and anything
 * hidden. A component preview keeps its source and drops the rendered demo.
 */

export interface Element {
  tag: string;
  attrs: Record<string, string>;
  children: Node[];
  parent: Element | null;
}
export type Node = Element | string;

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title']);

/** Parse rendered HTML into a tree. Unmatched end tags are ignored. */
export function parseHtml(html: string): Element {
  const root: Element = { tag: '#root', attrs: {}, children: [], parent: null };
  let cur = root;
  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt < 0) {
      cur.children.push(html.slice(i));
      break;
    }
    if (lt > i) cur.children.push(html.slice(i, lt));
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end < 0 ? n : end + 3;
      continue;
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      const end = html.indexOf('>', lt);
      i = end < 0 ? n : end + 1;
      continue;
    }
    if (html[lt + 1] === '/') {
      const end = html.indexOf('>', lt);
      const name = html.slice(lt + 2, end < 0 ? n : end).trim().toLowerCase();
      i = end < 0 ? n : end + 1;
      // Pop to the matching open element; an end tag with no match is dropped.
      for (let e: Element | null = cur; e && e !== root; e = e.parent) {
        if (e.tag === name) {
          cur = e.parent ?? root;
          break;
        }
      }
      continue;
    }
    const m = /^<([a-zA-Z][\w:-]*)/.exec(html.slice(lt, lt + 64));
    if (!m) {
      cur.children.push('<');
      i = lt + 1;
      continue;
    }
    const tag = m[1].toLowerCase();
    // Read attributes up to the closing `>`, honouring quotes.
    let j = lt + m[0].length;
    const attrs: Record<string, string> = {};
    let selfClosing = false;
    while (j < n) {
      while (j < n && /\s/.test(html[j])) j++;
      if (html[j] === '>') {
        j++;
        break;
      }
      if (html[j] === '/' && html[j + 1] === '>') {
        selfClosing = true;
        j += 2;
        break;
      }
      const nm = /^[^\s=>/]+/.exec(html.slice(j, j + 256));
      if (!nm) {
        j++;
        continue;
      }
      const name = nm[0].toLowerCase();
      j += nm[0].length;
      while (j < n && /\s/.test(html[j])) j++;
      let value = '';
      if (html[j] === '=') {
        j++;
        while (j < n && /\s/.test(html[j])) j++;
        const q = html[j];
        if (q === '"' || q === "'") {
          const end = html.indexOf(q, j + 1);
          value = html.slice(j + 1, end < 0 ? n : end);
          j = end < 0 ? n : end + 1;
        } else {
          const uq = /^[^\s>]*/.exec(html.slice(j))![0];
          value = uq;
          j += uq.length;
        }
      }
      attrs[name] = decodeEntities(value);
    }
    const el: Element = { tag, attrs, children: [], parent: cur };
    cur.children.push(el);
    i = j;
    if (RAW_TEXT.has(tag)) {
      const close = html.toLowerCase().indexOf(`</${tag}`, i);
      const end = close < 0 ? n : close;
      el.children.push(html.slice(i, end));
      const gt = html.indexOf('>', end);
      i = close < 0 ? n : gt < 0 ? n : gt + 1;
      continue;
    }
    if (!VOID.has(tag) && !selfClosing) cur = el;
  }
  return root;
}

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '...',
  mdash: '--', ndash: '-', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', middot: '·', times: '×', copy: '©',
};

/** Decode the entities our renderer and authors emit. Applied to text once, at emit time. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[body] ?? m;
  });
}

/** Every element below `el` (depth first) that matches `pred`. */
export function findAll(el: Element, pred: (e: Element) => boolean, out: Element[] = []): Element[] {
  for (const c of el.children) {
    if (typeof c === 'string') continue;
    if (pred(c)) out.push(c);
    findAll(c, pred, out);
  }
  return out;
}

export function find(el: Element, pred: (e: Element) => boolean): Element | null {
  for (const c of el.children) {
    if (typeof c === 'string') continue;
    if (pred(c)) return c;
    const hit = find(c, pred);
    if (hit) return hit;
  }
  return null;
}

/** The decoded text content of a node, whitespace kept. */
export function textOf(node: Node): string {
  if (typeof node === 'string') return decodeEntities(node);
  if (node.tag === 'script' || node.tag === 'style') return '';
  return node.children.map(textOf).join('');
}

const classes = (e: Element) => (e.attrs.class ?? '').split(/\s+/);

/** Elements whose whole subtree is not prose a reader of the markdown needs. */
function skipped(e: Element): boolean {
  if (SKIP.has(e.tag)) return true;
  if ('hidden' in e.attrs || e.attrs['aria-hidden'] === 'true') return true;
  if (e.attrs.role === 'tablist' || e.attrs.role === 'radiogroup') return true;
  if (e.attrs['data-slot'] === 'preview') return true;
  const cls = classes(e);
  return cls.includes('sr-only');
}

const SKIP = new Set([
  'script', 'style', 'noscript', 'template', 'svg', 'math', 'button', 'input', 'select', 'textarea',
  'nav', 'header', 'footer', 'aside', 'dialog', 'canvas', 'video', 'audio', 'link', 'meta', 'title', 'head',
  'ui-tabs-list',
]);

const BLOCK = new Set([
  'p', 'div', 'section', 'article', 'main', 'figure', 'figcaption', 'pre', 'ul', 'ol', 'li', 'table',
  'blockquote', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'dl', 'dt', 'dd', 'details', 'summary',
  'code-block', 'iframe', 'form', 'fieldset',
]);

export interface MarkdownOptions {
  /** Absolute origin that root-relative links are resolved against. */
  origin?: string;
  /**
   * A per-element override. Return a markdown string to replace the element
   * (an empty string drops it), or undefined to convert it normally.
   */
  override?: (e: Element) => string | undefined;
}

/** Convert a rendered subtree to markdown. */
export function toMarkdown(root: Element, opts: MarkdownOptions = {}): string {
  const out = blocks(root.children, opts);
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

const blockishMemo = new WeakMap<Element, boolean>();
function blockish(e: Element): boolean {
  const hit = blockishMemo.get(e);
  if (hit !== undefined) return hit;
  const v = BLOCK.has(e.tag) || e.attrs['data-slot'] === 'component-preview' || e.tag === 'block-viewer'
    || e.children.some((c) => typeof c !== 'string' && !skipped(c) && blockish(c));
  blockishMemo.set(e, v);
  return v;
}

function blocks(nodes: Node[], opts: MarkdownOptions): string[] {
  const out: string[] = [];
  let inline = '';
  const flush = () => {
    const t = inline.replace(/[ \t\n]+/g, ' ').trim();
    if (t) out.push(t);
    inline = '';
  };
  for (const node of nodes) {
    if (typeof node === 'string') {
      inline += decodeEntities(node);
      continue;
    }
    if (skipped(node)) continue;
    const custom = opts.override?.(node);
    if (custom !== undefined) {
      flush();
      if (custom.trim()) out.push(custom.trim());
      continue;
    }
    if (!blockish(node)) {
      inline += inlineOf(node, opts);
      continue;
    }
    flush();
    out.push(...block(node, opts));
  }
  flush();
  return out;
}

export function fence(code: string, info = ''): string {
  const body = code.replace(/^\n+/, '').replace(/\s+$/, '');
  const ticks = body.includes('```') ? '````' : '```';
  return `${ticks}${info}\n${body}\n${ticks}`;
}

/** A code figure: the selected tab (npm when the figure offers several), else its pre. */
function codeFigure(fig: Element): string {
  const caption = find(fig, (e) => e.tag === 'figcaption');
  const tabs = findAll(fig, (e) => e.tag === 'ui-tabs-content');
  const scope = tabs.find((t) => t.attrs.value === 'npm') ?? tabs[0] ?? fig;
  const pre = find(scope, (e) => e.tag === 'pre') ?? (scope.tag === 'pre' ? scope : null);
  if (!pre) return '';
  const code = find(pre, (e) => e.tag === 'code');
  const lang = pre.attrs['data-language'] ?? code?.attrs['data-language'] ?? '';
  const title = caption ? textOf(caption).trim() : '';
  return fence(textOf(pre), (lang || (title ? 'text' : '')) + (title ? ` title="${title}"` : ''));
}

function block(e: Element, opts: MarkdownOptions): string[] {
  const tag = e.tag;
  if (/^h[1-6]$/.test(tag)) {
    const t = inlineChildren(e, opts).trim();
    return t ? [`${'#'.repeat(Number(tag[1]))} ${t}`] : [];
  }
  if (e.attrs['data-slot'] === 'component-preview') {
    const fig = find(e, (c) => 'data-rehype-pretty-code-figure' in c.attrs);
    return fig ? [codeFigure(fig)] : [];
  }
  if ('data-rehype-pretty-code-figure' in e.attrs) {
    const f = codeFigure(e);
    return f ? [f] : [];
  }
  if (tag === 'pre') {
    const code = find(e, (c) => c.tag === 'code');
    return [fence(textOf(e), e.attrs['data-language'] ?? code?.attrs['data-language'] ?? '')];
  }
  if (tag === 'code-block') return [fence(textOf(e), e.attrs.lang ?? e.attrs.language ?? '')];
  if (tag === 'p') {
    const t = inlineChildren(e, opts).replace(/[ \t\n]+/g, ' ').trim();
    return t ? [t] : [];
  }
  if (tag === 'hr') return ['---'];
  if (tag === 'iframe') {
    const src = e.attrs.src;
    return src ? [`[${e.attrs.title || src}](${absolute(src, opts)})`] : [];
  }
  if (tag === 'ul' || tag === 'ol') return [list(e, opts)];
  if (tag === 'table') return [table(e, opts)];
  if (tag === 'blockquote') {
    return [blocks(e.children, opts).join('\n\n').split('\n').map((l) => `> ${l}`.trimEnd()).join('\n')];
  }
  if (tag === 'summary') {
    const t = inlineChildren(e, opts).replace(/\s+/g, ' ').trim();
    return t ? [`**${t}**`] : [];
  }
  // A container holding only links (an index grid) reads as a list, not as
  // links run together on one line.
  const kids = e.children.filter((c) => typeof c !== 'string' || c.trim());
  if (kids.length > 1 && kids.every((c) => typeof c !== 'string' && (c.tag === 'a' || skipped(c)))) {
    const items = kids.map((c) => inlineOf(c as Element, opts).replace(/\s+/g, ' ').trim()).filter(Boolean);
    return items.length ? [items.map((t) => `- ${t}`).join('\n')] : [];
  }
  return blocks(e.children, opts);
}

function list(e: Element, opts: MarkdownOptions): string {
  const ordered = e.tag === 'ol';
  const items = e.children.filter((c): c is Element => typeof c !== 'string' && c.tag === 'li' && !skipped(c));
  return items.map((li, i) => {
    const marker = ordered ? `${i + 1}. ` : '- ';
    const body = blocks(li.children, opts).join('\n\n');
    const pad = ' '.repeat(marker.length);
    return marker + body.split('\n').map((l, k) => (k === 0 || !l ? l : pad + l)).join('\n');
  }).join('\n');
}

function table(e: Element, opts: MarkdownOptions): string {
  const rows = findAll(e, (c) => c.tag === 'tr').map((tr) =>
    tr.children
      .filter((c): c is Element => typeof c !== 'string' && (c.tag === 'td' || c.tag === 'th'))
      .map((cell) => inlineChildren(cell, opts).replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|')),
  ).filter((r) => r.length);
  if (!rows.length) return '';
  const width = Math.max(...rows.map((r) => r.length));
  const line = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => r[i] ?? '').join(' | ')} |`;
  return [line(rows[0]), `| ${Array(width).fill('---').join(' | ')} |`, ...rows.slice(1).map(line)].join('\n');
}

function absolute(href: string, opts: MarkdownOptions): string {
  if (opts.origin && href.startsWith('/') && !href.startsWith('//')) return opts.origin + href;
  return href;
}

function inlineChildren(e: Element, opts: MarkdownOptions): string {
  let s = '';
  for (const c of e.children) {
    if (typeof c === 'string') s += decodeEntities(c);
    else if (!skipped(c)) s += inlineOf(c, opts);
  }
  return s;
}

function inlineOf(e: Element, opts: MarkdownOptions): string {
  const custom = opts.override?.(e);
  if (custom !== undefined) return custom;
  const tag = e.tag;
  if (tag === 'br') return '\n';
  if (tag === 'img') return e.attrs.alt ? `![${e.attrs.alt}](${absolute(e.attrs.src ?? '', opts)})` : '';
  if (tag === 'code' || tag === 'kbd') {
    const t = textOf(e).replace(/\s+/g, ' ');
    if (!t.trim()) return '';
    const ticks = t.includes('`') ? '``' : '`';
    return `${ticks}${t}${ticks}`;
  }
  const inner = inlineChildren(e, opts);
  if (tag === 'strong' || tag === 'b') return inner.trim() ? `**${inner.trim()}**` : '';
  if (tag === 'em' || tag === 'i') return inner.trim() ? `*${inner.trim()}*` : '';
  if (tag === 'a') {
    const href = e.attrs.href ?? '';
    const text = inner.replace(/\s+/g, ' ').trim();
    if (!text) return '';
    // An in-page anchor (a heading's own link, a "#blocks" jump) is just text.
    if (!href || href.startsWith('#')) return text;
    return `[${text}](${absolute(href, opts)})`;
  }
  return inner;
}
