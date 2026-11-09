/**
 * The /ui section for AI agents (#1666): the page list, each page as
 * markdown, and the llms.txt sections built from them (server-only).
 *
 * WebJs UI is meant to teach an agent how to build a WebJs app, so every /ui
 * page has to be reachable from /llms.txt and readable as text. This mirrors
 * shadcn's apps/v4 model: public/llms.txt indexes every docs page with its
 * description, and app/(app)/llm/[[...slug]] (lib/llm.ts) serves each page as
 * markdown with the ComponentPreview demos' source inlined as code.
 *
 * Two rules keep it from drifting, and both are why nothing here is a list
 * of pages:
 *
 * - The page list is DERIVED from the data the pages render from: the nav
 *   (modules/ui/docs/nav.ts), the component records, DOC_PAGES, the registry
 *   blocks, and the route table's static /ui pages. A page added to any of
 *   them is in /llms.txt and the sitemap the moment it exists.
 * - The markdown is the RENDERED page. The page module the router would run is
 *   called with the params the router would pass, rendered with custom
 *   elements left unexpanded, and converted by lib/html-to-markdown.ts. So the
 *   markdown says what the page says, demos' source included, with no second
 *   copy of any page to keep in step.
 *
 * Rendering is not free (the whole corpus is 2.8MB and several seconds), and
 * crawlers fetch these files, so every result is cached in process and keyed
 * to the SOURCE: a fingerprint of the files the pages are built from (see
 * `sourceFingerprint`). A deploy is a new process and starts empty, and a dev
 * edit changes the fingerprint, so a cached page is never older than its
 * source. The responses carry an ETag and answer a matching If-None-Match
 * with a 304.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildRouteTable, matchPage, staticPageRoutes } from '@webjsdev/server';
// The bare specifier on purpose, not '@webjsdev/core/server': on Node it is the
// same core instance the server renders pages with, so the form-action
// resolver the server installs is the one this render consults. Through the
// subpath, a page binding a server action (the Forms guide) threw as unbound.
import { renderToString } from '@webjsdev/core';
import { COMPONENTS, NAV, HEADER_NAV, docPageExists } from '#modules/ui/docs/nav.ts';
import { DOC_PAGES } from '#modules/ui/docs/pages/index.ts';
import { listBlocks, blockDisplay } from '#modules/ui/queries/blocks.server.ts';
import { BLOCK_CATEGORIES } from '#lib/ui/blocks-shell.ts';
import { renderDemo } from '#modules/ui/queries/render-demo.server.ts';
import { parseHtml, toMarkdown, find, findAll, textOf, fence, type Element } from '#lib/html-to-markdown.ts';
import { uiMarkdownHref } from '#lib/ui/llm-path.ts';
import { GALLERY_URL, GH_URL } from '#lib/links.ts';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** One /ui page as the index lists it. */
export interface UiPage {
  /** The page's path, e.g. "/ui/docs/components/button". */
  path: string;
  title: string;
  description: string;
  /** The llms.txt subsection it is listed under. */
  group: string;
}

type RouteTable = Awaited<ReturnType<typeof buildRouteTable>>;

interface PageModule {
  default: (ctx: Record<string, unknown>) => unknown;
  metadata?: { title?: unknown; description?: unknown };
  generateMetadata?: (ctx: Record<string, unknown>) => unknown;
}

const routeTable = (): Promise<RouteTable> => buildRouteTable(APP_ROOT);

/**
 * What the /ui pages are built from: this app's source (its package.json
 * included, for the redirects), the kit's registry, and the gallery's demo
 * index. A root that is not there (a standalone deploy) is skipped.
 */
const SOURCE_ROOTS = [
  'app', 'modules', 'lib', 'components', 'package.json',
  '../packages/ui/packages/registry', '../gallery/modules/gallery',
].map((p) => join(APP_ROOT, p));

/**
 * How long one fingerprint is trusted. Taking one is a stat of every source
 * file (about 1600, roughly 15ms), so a burst of crawler requests shares one
 * walk while a dev edit is still seen within a second.
 */
const FINGERPRINT_TTL_MS = 1000;

async function collectStats(path: string, out: string[]): Promise<void> {
  const st = await stat(path).catch(() => null);
  if (!st) return;
  if (!st.isDirectory()) {
    out.push(`${relative(APP_ROOT, path)}:${st.mtimeMs}:${st.size}`);
    return;
  }
  const entries = await readdir(path, { withFileTypes: true }).catch(() => []);
  await Promise.all(entries
    .filter((e) => e.name !== 'node_modules' && !e.name.startsWith('.'))
    .map((e) => collectStats(join(path, e.name), out)));
}

let fingerprintMemo: { at: number; value: Promise<string> } | null = null;

/**
 * A hash of the path, mtime and size of every file under SOURCE_ROOTS. It
 * changes when a source file is edited, added or removed, which is what
 * invalidates the caches below. The framework exposes no public build epoch
 * a route handler can read, so the source itself is the key.
 */
export function sourceFingerprint(): Promise<string> {
  const now = Date.now();
  if (!fingerprintMemo || now - fingerprintMemo.at > FINGERPRINT_TTL_MS) {
    const value = (async () => {
      const stats: string[] = [];
      await Promise.all(SOURCE_ROOTS.map((r) => collectStats(r, stats)));
      return createHash('sha1').update(stats.sort().join('\n')).digest('hex');
    })();
    fingerprintMemo = { at: now, value };
  }
  return fingerprintMemo.value;
}

/** A rendered text body with its ETag, computed once per cache entry. */
export interface CachedText {
  body: string;
  etag: string;
}

const withEtag = (body: string): CachedText => ({
  body,
  etag: `W/"${createHash('sha1').update(body).digest('base64url').slice(0, 22)}"`,
});

/** Bounded, so a crawler walking every page cannot grow it without limit. */
const MAX_ENTRIES = 512;
const memo = new Map<string, { fp: string; value: Promise<unknown> }>();

/**
 * `build()`'s result for `key`, built at most once per source fingerprint.
 * Concurrent callers share one build. A build that fails or yields null (a
 * page that does not exist) is not kept, so a 404 is never cached.
 */
async function cached<T>(key: string, build: () => Promise<T>): Promise<T> {
  const fp = await sourceFingerprint();
  const hit = memo.get(key);
  if (hit && hit.fp === fp) return hit.value as Promise<T>;
  const value = build();
  memo.delete(key);
  memo.set(key, { fp, value });
  while (memo.size > MAX_ENTRIES) memo.delete(memo.keys().next().value as string);
  const drop = () => {
    if (memo.get(key)?.value === value) memo.delete(key);
  };
  value.then((v) => { if (v == null) drop(); }, drop);
  return value;
}

let renders = 0;

/** How many pages this process has rendered for markdown, for the cache test. */
export function llmRenderCount(): number {
  return renders;
}

let redirectsMemo: { fp: string; value: Promise<URLPattern[]> } | null = null;

/**
 * The `webjs.redirects` sources in package.json. The router answers a path
 * one matches with a redirect before any page runs, so such a path is not a
 * page of its own and is never listed.
 */
async function configRedirects(): Promise<URLPattern[]> {
  const fp = await sourceFingerprint();
  if (redirectsMemo?.fp !== fp) {
    const value = readFile(join(APP_ROOT, 'package.json'), 'utf8').then((raw) => {
      const rules: { source?: unknown }[] = JSON.parse(raw)?.webjs?.redirects ?? [];
      return rules
        .filter((r) => typeof r.source === 'string')
        .map((r) => {
          try {
            return new URLPattern({ pathname: r.source as string });
          } catch {
            return null;
          }
        })
        .filter((r): r is URLPattern => r !== null);
    }).catch(() => []);
    redirectsMemo = { fp, value };
  }
  return redirectsMemo.value;
}

/** "Button | WebJs UI" and "WebJs UI | Foo" to "Button" and "Foo". */
function cleanTitle(title: unknown): string {
  const t = typeof title === 'string' ? title : '';
  return t.replace(/\s*\|\s*WebJs UI\s*$/i, '').replace(/^WebJs UI\s*\|\s*/i, '').trim();
}

/** Load the page module the router serves `path` with, and the params it passes. */
async function pageFor(path: string, table: RouteTable, origin: string) {
  if (!uiMarkdownHref(path)) return null;
  const hit = matchPage(table, path);
  if (!hit) return null;
  const mod = (await import(pathToFileURL(hit.route.file).href)) as PageModule;
  const ctx = { params: hit.params, searchParams: {}, url: origin + path, actionData: undefined };
  return { mod, ctx, dynamic: ((hit.route as { paramNames?: string[] }).paramNames ?? []).length > 0 };
}

/** A notFound() / redirect() / forbidden() throw, which the router turns into a status. */
const isControlFlow = (e: unknown) => !!(e && typeof e === 'object' && '__webjs' in e);

/** The /ui path a redirect() throw sends the reader to, or null. */
function redirectTarget(e: unknown): string | null {
  const url = e && typeof e === 'object' && 'url' in e ? (e as { url: unknown }).url : null;
  if (typeof url !== 'string') return null;
  const path = new URL(url, 'http://x').pathname;
  return uiMarkdownHref(path) ? path : null;
}

async function metaOf(mod: PageModule, ctx: Record<string, unknown>): Promise<{ title: string; description: string }> {
  let m: { title?: unknown; description?: unknown } | undefined;
  try {
    m = (mod.generateMetadata ? await mod.generateMetadata(ctx) : mod.metadata) as typeof m;
  } catch (e) {
    if (!isControlFlow(e)) throw e;
  }
  return { title: cleanTitle(m?.title), description: typeof m?.description === 'string' ? m.description : '' };
}

/**
 * Render one page to its HTML tree, or null when the page would 404. A page
 * that redirects to another /ui page (/ui/charts opens on /ui/charts/area) is
 * followed, and `path` is where it landed.
 */
async function renderPage(path: string, table: RouteTable, origin: string, hops = 0): Promise<{ path: string; tree: Element; meta: { title: string; description: string } } | null> {
  const page = await pageFor(path, table, origin);
  if (!page) return null;
  let value: unknown;
  try {
    value = await page.mod.default(page.ctx);
  } catch (e) {
    const to = redirectTarget(e);
    if (to && to !== path && hops < 3) return renderPage(to, table, origin, hops + 1);
    if (isControlFlow(e)) return null;
    throw e;
  }
  renders++;
  const html = await renderToString(value, { ssr: false });
  return { path, tree: parseHtml(html), meta: await metaOf(page.mod, page.ctx) };
}

/** The docs shell's slots (lib/ui/docs/page.ts), or the page's main element. */
function regions(tree: Element) {
  const main = find(tree, (e) => e.tag === 'main') ?? tree;
  const docs = main.attrs['data-slot'] === 'docs';
  const h1 = docs ? find(main, (e) => e.tag === 'h1') : null;
  const desc = docs ? find(main, (e) => e.attrs['data-slot'] === 'docs-description') : null;
  const body = docs ? find(main, (e) => e.attrs['data-slot'] === 'docs-body') : null;
  return {
    title: h1 ? textOf(h1).replace(/\s+/g, ' ').trim() : '',
    description: desc ? textOf(desc).replace(/\s+/g, ' ').trim() : '',
    body: body ?? main,
  };
}

/**
 * The one category page a block's full source belongs to in the corpus: its
 * first listed category, preferring one the blocks nav links. The featured
 * page and the hidden categories repeat blocks a listed category already has.
 */
function blockHome(categories: string[]): string {
  const cat = BLOCK_CATEGORIES.find((c) => !c.hidden && categories.includes(c.slug))
    ?? BLOCK_CATEGORIES.find((c) => categories.includes(c.slug));
  return cat ? `/ui/blocks/${cat.slug}` : '/ui/blocks';
}

/**
 * A block as markdown: what it is, the add command, and every file it
 * installs. With `compactOn` set (the corpus), a block shown on a page other
 * than its home page is a pointer there instead, so its files appear once.
 */
async function blockMarkdown(name: string, origin: string, compactOn?: string): Promise<string> {
  const block = await blockDisplay(name);
  if (!block) return '';
  const home = blockHome(block.categories);
  if (compactOn && compactOn !== home) {
    return [
      `## ${block.title || block.name}`,
      block.description,
      `Install it with \`npx @webjsdev/ui add ${block.name}\`. Its files are listed under ${home}.`,
    ].filter(Boolean).join('\n\n');
  }
  const fileFence = (target: string, source: string) => {
    const ticks = source.includes('```') ? '````' : '```';
    const lang = target.split('.').pop() ?? '';
    return `${ticks}${lang} title="${target}"\n${source.trimEnd()}\n${ticks}`;
  };
  return [
    `## ${block.title || block.name}`,
    block.description,
    'Install it with the CLI, which copies these files into your app:',
    '```bash\nnpx @webjsdev/ui add ' + block.name + '\n```',
    `Preview: ${origin}/ui/view/${block.name}`,
    ...block.files.map((f) => fileFence(f.target, f.source)),
  ].filter(Boolean).join('\n\n');
}

/**
 * One /ui page as markdown (/ui/llm/<path>), cached per source fingerprint:
 * the title, the description, the page's own URL, then the body. A component
 * preview becomes its demo's source, the install tabs the npm command and the
 * source to copy by hand, a block viewer the block's add command and files.
 */
export function renderUiMarkdown(path: string, origin: string): Promise<CachedText | null> {
  return cached(`page:${origin}:${path}`, async () => {
    const body = await buildUiMarkdown(path, origin, await routeTable());
    return body == null ? null : withEtag(body);
  });
}

async function buildUiMarkdown(path: string, origin: string, table: RouteTable, opts: { compactBlocks?: boolean } = {}): Promise<string | null> {
  const rendered = await renderPage(path, table, origin);
  if (!rendered) return null;
  const { tree, meta } = rendered;
  const r = regions(tree);

  // A block viewer's markup is a toolbar, radio groups and a file tree, so it
  // is replaced by the block's data rather than converted.
  const viewers = findAll(r.body, (e) => e.tag === 'block-viewer' && !!e.attrs.id);
  const blocks = new Map<string, string>();
  for (const v of viewers) blocks.set(v.attrs.id, await blockMarkdown(v.attrs.id, origin, opts.compactBlocks ? rendered.path : undefined));

  // A preview with `hideCode` shows no source, but shadcn's llm route inlines
  // every ComponentPreview's source, so it is read from the demo itself.
  const hidden = findAll(r.body, (e) => e.attrs['data-slot'] === 'component-preview' && !!e.attrs['data-demo']
    && !find(e, (c) => 'data-rehype-pretty-code-figure' in c.attrs));
  const demoSources = new Map<string, string>();
  for (const p of hidden) {
    const demo = await renderDemo(p.attrs['data-demo']);
    if (demo) demoSources.set(p.attrs['data-demo'], fence(demo.source, 'ts'));
  }

  const body = path === '/ui'
    ? homeMarkdown(origin)
    : toMarkdown(r.body, {
      origin,
      override: (e) => {
        if (e.tag === 'block-viewer') return blocks.get(e.attrs.id) ?? '';
        const demo = e.attrs['data-demo'];
        if (demo && demoSources.has(demo) && e.attrs['data-slot'] === 'component-preview') return demoSources.get(demo);
        // A section page's header (lib/ui/ui-page-header.ts) repeats what the
        // title and description below already say: the release badge, the
        // h1, the paragraph after it, and in-page jump buttons.
        if (e.attrs['data-slot'] === 'badge' && e.tag === 'a') return '';
        if (e.tag === 'a' && e.attrs['data-slot'] === 'button' && (e.attrs.href ?? '#').startsWith('#')) return '';
        if (e.tag === 'h1') return '';
        if (e.tag === 'p' && previousElement(e)?.tag === 'h1') return '';
        return undefined;
      },
    });
  const title = r.title || meta.title || path;
  const description = r.description || meta.description;
  return [`# ${title}`, description, `Source: ${origin}${rendered.path}`, body].filter(Boolean).join('\n\n') + '\n';
}

function previousElement(e: Element): Element | null {
  const siblings = e.parent?.children ?? [];
  for (let i = siblings.indexOf(e) - 1; i >= 0; i--) {
    const s = siblings[i];
    if (typeof s !== 'string') return s;
  }
  return null;
}

/**
 * The /ui home page is a hero over a showcase of rendered components, which
 * carries nothing an agent can use as text, so its markdown is the hero and
 * the section pages the header links to.
 */
function homeMarkdown(origin: string): string {
  return [
    'The home page shows the components in use. Read the sections it links to:',
    HEADER_NAV.filter((n) => n.href !== '/ui').map((n) => `- [${n.title}](${origin}${uiMarkdownHref(n.href)})`).join('\n'),
    `Every page is indexed in ${origin}/ui/llms.txt.`,
  ].join('\n\n');
}

/**
 * renderPage for the index. A page that throws while rendering is still a
 * page (its own route answers the error), so the index lists it from its
 * metadata rather than failing every llms.txt and the sitemap with it.
 */
async function renderForIndex(path: string, table: RouteTable, origin: string) {
  try {
    return await renderPage(path, table, origin);
  } catch {
    return 'error' as const;
  }
}

/** Title and description for a page, from its metadata, else its rendered docs shell. */
async function describe(path: string, table: RouteTable, origin: string): Promise<{ title: string; description: string }> {
  const page = await pageFor(path, table, origin);
  if (!page) return { title: '', description: '' };
  const meta = await metaOf(page.mod, page.ctx);
  if (meta.title && meta.description) return meta;
  const rendered = await renderForIndex(path, table, origin);
  const r = rendered && rendered !== 'error' ? regions(rendered.tree) : null;
  return { title: meta.title || r?.title || '', description: meta.description || r?.description || '' };
}

/**
 * A docs page module, or null when it does not load. The page itself would
 * answer 500 then, so it is left out of the index rather than failing it.
 */
async function loadDocPage(key: string) {
  try {
    return await DOC_PAGES[key]();
  } catch {
    return null;
  }
}

/**
 * Every /ui page, in the order an agent should read them: the section pages,
 * the docs nav groups in sidebar order, every component, then the blocks.
 * Cached per source fingerprint, since the section pages are rendered to
 * find their titles and links.
 */
export function listUiPages(origin: string): Promise<UiPage[]> {
  return cached(`pages:${origin}`, () => buildUiPageList(origin));
}

async function buildUiPageList(origin: string): Promise<UiPage[]> {
  const table = await routeTable();
  const redirects = await configRedirects();
  const out: UiPage[] = [];
  const seen = new Set<string>();
  const add = (p: UiPage) => {
    if (seen.has(p.path) || !uiMarkdownHref(p.path)) return;
    seen.add(p.path);
    if (redirects.some((r) => r.test({ pathname: p.path }))) return;
    out.push(p);
  };

  // The section pages: the header nav, then any other static /ui page the
  // router serves (a page that lands before it is linked is still listed). A
  // section's dynamic pages (/ui/charts/<type>) are the ones it links to, so
  // they are read off its rendered links rather than out of a list.
  const statics = staticPageRoutes(table as Parameters<typeof staticPageRoutes>[0]).filter((p) => uiMarkdownHref(p));
  for (const path of [...HEADER_NAV.map((n) => n.href), ...statics]) {
    if (path.startsWith('/ui/docs') || seen.has(path)) continue;
    const rendered = await renderForIndex(path, table, origin);
    if (!rendered) continue;
    const nav = HEADER_NAV.find((n) => n.href === path);
    if (rendered === 'error') {
      const d = await describe(path, table, origin);
      add({ path, title: d.title || nav?.title || path, description: d.description, group: 'Sections' });
      continue;
    }
    const r = regions(rendered.tree);
    add({
      path: rendered.path,
      title: path === '/ui' ? 'WebJs UI' : rendered.meta.title || r.title || nav?.title || path,
      description: rendered.meta.description || r.description,
      group: 'Sections',
    });
    // The block categories are enumerated below, from the registry.
    if (path === '/ui' || path === '/ui/blocks') continue;
    for (const a of findAll(rendered.tree, (e) => e.tag === 'a' && !!e.attrs.href)) {
      const href = new URL(a.attrs.href, 'http://x').pathname.replace(/\/+$/, '');
      if (!href.startsWith(path + '/') || seen.has(href)) continue;
      if (!(await pageFor(href, table, origin))?.dynamic) continue;
      const linked = await renderForIndex(href, table, origin);
      if (!linked || linked === 'error' || linked.path !== href) continue;
      const lr = regions(linked.tree);
      add({ path: href, title: linked.meta.title || lr.title || href, description: linked.meta.description || lr.description, group: nav?.title ?? 'Sections' });
    }
  }

  // The docs, in the sidebar's order. The nav lists shadcn's whole tree, so a
  // page that is not built yet (docPageExists) is skipped rather than linked.
  for (const group of NAV) {
    if (group.title === 'Components') continue;
    for (const item of group.items) {
      if (!docPageExists(item.href)) continue;
      const key = item.href.slice('/ui/docs/'.length);
      if (key in DOC_PAGES) {
        const mod = await loadDocPage(key);
        if (mod) add({ path: item.href, title: mod.title || item.title, description: mod.description ?? '', group: group.title });
        continue;
      }
      const d = await describe(item.href, table, origin);
      add({ path: item.href, title: d.title || item.title, description: d.description, group: group.title });
    }
  }
  // A docs page with a module or a route but no nav entry is still a page.
  for (const key of Object.keys(DOC_PAGES)) {
    const mod = await loadDocPage(key);
    if (mod) add({ path: `/ui/docs/${key}`, title: mod.title, description: mod.description ?? '', group: 'Docs' });
  }
  for (const path of statics.filter((p) => p.startsWith('/ui/docs') && !p.startsWith('/ui/docs/components'))) {
    if (seen.has(path)) continue;
    const d = await describe(path, table, origin);
    add({ path, title: d.title || path, description: d.description, group: 'Docs' });
  }

  const index = await describe('/ui/docs/components', table, origin);
  add({ path: '/ui/docs/components', title: index.title || 'Components', description: index.description, group: 'Components' });
  for (const c of COMPONENTS) {
    add({ path: `/ui/docs/components/${c.slug}`, title: c.title, description: c.description, group: 'Components' });
  }

  // Every block category that has a block has a page, hidden ones included.
  const blocks = await listBlocks();
  for (const cat of BLOCK_CATEGORIES) {
    const inCat = blocks.filter((b) => b.categories.includes(cat.slug));
    if (!inCat.length) continue;
    add({
      path: `/ui/blocks/${cat.slug}`,
      title: `${cat.name} Blocks`,
      description: `Every ${cat.name.toLowerCase()} block, each with its add command and full source: ${inCat.map((b) => b.name).join(', ')}.`,
      group: 'Blocks',
    });
  }
  return out;
}

const md = (origin: string, path: string) => origin + uiMarkdownHref(path);
const entry = (origin: string, p: UiPage) => `- [${p.title}](${md(origin, p.path)})${p.description ? `: ${p.description}` : ''}`;

/**
 * The "WebJs UI" part of /llms.txt, and the body of /ui/llms.txt: every /ui
 * page with its description, linked to its markdown.
 */
export async function renderUiIndexSection(origin: string, pages?: UiPage[]): Promise<string[]> {
  const list = pages ?? (await listUiPages(origin));
  const groups = new Map<string, UiPage[]>();
  for (const p of list) groups.set(p.group, [...(groups.get(p.group) ?? []), p]);
  const lines = [
    '## WebJs UI',
    '',
    `WebJs UI is the component library for WebJs apps, and the /ui site is itself a WebJs app. Every page below links to its markdown, with each demo's source inlined, so reading them teaches the components and the WebJs idioms they are written in: light-DOM custom elements, Tailwind classes on native elements, server rendering and progressive enhancement. Add a component to an app with the command \`npx @webjsdev/ui add <name>\`. Every page in one file: ${origin}/ui/llms-full.txt`,
  ];
  for (const [group, items] of groups) {
    lines.push('', `### ${group}`, '', ...items.map((p) => entry(origin, p)));
  }
  return lines;
}

interface GalleryItem { href: string; title: string; blurb: string }

/** The gallery's demo index, read from the gallery app when it ships beside this one. */
async function galleryNav(): Promise<GalleryItem[]> {
  try {
    const url = pathToFileURL(join(APP_ROOT, '..', 'gallery', 'modules', 'gallery', 'nav.ts')).href;
    const mod = await import(url);
    const features: GalleryItem[] = mod.FEATURE_GROUPS.flatMap((g: { items: GalleryItem[] }) => g.items);
    return [...features, ...((mod.EXAMPLES as GalleryItem[] | undefined) ?? [])];
  } catch {
    // A standalone deploy without the monorepo: the gallery is still linked below.
    return [];
  }
}

/**
 * The "Examples" part of /llms.txt: real WebJs apps to read, with their live
 * URLs and their source, then the /ui blocks as installable reference views.
 */
export async function renderExamplesSection(origin: string): Promise<string[]> {
  const tree = (p: string) => `${GH_URL}/tree/main/${p}`;
  const lines = [
    '## Examples',
    '',
    'Working WebJs apps with their source open. Read one before writing the same thing yourself.',
    '',
    `- [WebJs feature gallery](${GALLERY_URL}): one runnable, densely commented demo per framework feature, the same demos a new app is scaffolded with. Source: ${tree('gallery')}`,
  ];
  for (const f of await galleryNav()) {
    lines.push(`- [${f.title}](${GALLERY_URL}${f.href}): ${f.blurb} Source: ${tree(`gallery/app${f.href}`)}`);
  }
  lines.push(
    `- [Example blog](https://example-blog.webjs.dev): a full app with posts, auth, server actions, streaming and Drizzle on SQLite. Source: ${tree('examples/blog')}`,
    `- [The WebJs website](${origin}): this site, the docs and the /ui component library included, is a WebJs app. Source: ${tree('website')}, with the /ui pages under ${tree('website/app/ui')} and their demos under ${tree('website/modules/ui/examples')}`,
  );

  const blocks = await listBlocks();
  if (blocks.length) {
    lines.push('', '### Blocks', '', 'Whole views (dashboards, sidebars, login and signup pages), installed with `npx @webjsdev/ui add <name>` and then edited as your own code.', '');
    for (const b of blocks) {
      const href = md(origin, blockHome(b.categories));
      lines.push(`- [${b.title || b.name}](${href}): ${b.description || b.name} (\`npx @webjsdev/ui add ${b.name}\`)`);
    }
  }
  return lines;
}

/** Run `fn` over `items` with at most `limit` in flight, keeping order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Every /ui page's markdown, concatenated: the UI half of /llms-full.txt and
 * the whole of /ui/llms-full.txt. A page that fails to render is named rather
 * than dropping the corpus. Callers go through `uiCorpus` / `siteCorpus`,
 * which cache it.
 */
async function buildUiCorpus(origin: string): Promise<string> {
  const table = await routeTable();
  const pages = await listUiPages(origin);
  const parts = await mapLimit(pages, 6, async (p) => {
    try {
      return (await buildUiMarkdown(p.path, origin, table, { compactBlocks: true })) ?? '';
    } catch (e) {
      return `# ${p.title}\n\nSource: ${origin}${p.path}\n\n(This page could not be rendered as markdown: ${e instanceof Error ? e.message : String(e)})\n`;
    }
  });
  return parts.filter(Boolean).map((s) => s.trim()).join('\n\n---\n\n') + '\n';
}

/** The /ui corpus, built once per source version for both files that carry it. */
const uiCorpusBody = (origin: string) => cached(`ui-body:${origin}`, () => buildUiCorpus(origin));

/** /ui/llms-full.txt: every /ui page's markdown under one heading, cached. */
export function uiCorpus(origin: string): Promise<CachedText> {
  return cached(`ui-corpus:${origin}`, async () => withEtag(
    `# WebJs UI (full corpus)\n\nEvery page of ${origin}/ui as markdown, concatenated.\n\n---\n\n${await uiCorpusBody(origin)}`,
  ));
}

/** /llms-full.txt: the framework docs corpus, then the /ui corpus, cached. */
export function siteCorpus(origin: string, docs: () => Promise<string>): Promise<CachedText> {
  return cached(`site-corpus:${origin}`, async () => {
    const [d, ui] = await Promise.all([docs(), uiCorpusBody(origin)]);
    return withEtag(`${d}\n---\n\n# WebJs UI (every /ui page)\n\n${ui}`);
  });
}

/** The headers every cached text response carries. */
const CACHE_CONTROL = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

/**
 * A cached text body as a response: an ETag, a Cache-Control, and a 304 when
 * the request already holds this version. Kept out of the search index like
 * the docs variants, since each one copies a page that exists as HTML.
 */
export function cachedTextResponse(req: Request, text: CachedText, contentType = 'text/markdown; charset=utf-8'): Response {
  const headers = {
    'content-type': contentType,
    'cache-control': CACHE_CONTROL,
    etag: text.etag,
    'x-robots-tag': 'noindex',
  };
  const tags = (req.headers.get('if-none-match') ?? '').split(',').map((t) => t.trim().replace(/^W\//, ''));
  if (tags.includes('*') || tags.includes(text.etag.replace(/^W\//, ''))) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(text.body, { headers });
}

/** A markdown response that is not cached (a 404). */
export function markdownResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': status === 200 ? CACHE_CONTROL : 'no-store',
      'x-robots-tag': 'noindex',
    },
  });
}
