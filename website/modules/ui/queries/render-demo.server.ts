'use server';

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderToString } from '@webjsdev/core/server';

/**
 * Render one /ui docs demo and read its source, for a component preview
 * (#1666, D14).
 *
 * A demo is one module under modules/ui/examples/<name>.ts that
 * default-exports a function returning an `html` template. The page shows
 * the rendered markup as the preview and this same file as the Code tab, so
 * the two cannot drift. The page imports only this action, which keeps the
 * demos' Tier-1 helper modules out of the browser.
 *
 * Three details, each one load-bearing:
 * - `renderToString(tpl, { ssr: false })` leaves custom elements
 *   unexpanded. The page's own render expands them when it walks this string,
 *   so expanding here too would render every element twice.
 * - The name is checked against the files that exist before anything is
 *   imported. A 'use server' function is callable over RPC by anyone, so an
 *   unchecked name would be a path traversal.
 * - The website keeps `"seed": false`, or this result (a large HTML string)
 *   would be serialized into the page a second time.
 */

const EXAMPLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'examples');
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

let known: Promise<Set<string>> | null = null;
async function demoNames(): Promise<Set<string>> {
  known ??= readdir(EXAMPLES).then((files) => new Set(files.filter((f) => f.endsWith('.ts')).map((f) => f.slice(0, -3))));
  return known;
}

/**
 * The source as a reader copies it into an app: the site's mirror paths
 * rewritten to where `webjs ui add` puts the files.
 */
function forApp(source: string): string {
  return source
    .replaceAll("'#modules/ui/components/", "'#components/ui/")
    .trimEnd();
}

export interface RenderedDemo {
  html: string;
  source: string;
}

/**
 * `opts.lang` is a language for a demo that has several (the RTL sidebar's
 * `?lang=` on /ui/view): a two-letter code, passed to the demo as `{ lang }`,
 * which picks it from the languages it knows. Anything else is dropped.
 */
export async function renderDemo(name: string, opts: { lang?: string } = {}): Promise<RenderedDemo | null> {
  if (typeof name !== 'string' || !NAME.test(name) || !(await demoNames()).has(name)) return null;
  const lang = typeof opts?.lang === 'string' && /^[a-z]{2}$/.test(opts.lang) ? opts.lang : undefined;
  const file = join(EXAMPLES, `${name}.ts`);
  const mod = await import(`../examples/${name}.ts`);
  const [html, source] = await Promise.all([
    renderToString(await mod.default(lang ? { lang } : undefined), { ssr: false }),
    readFile(file, 'utf8'),
  ]);
  return { html, source: forApp(source) };
}
