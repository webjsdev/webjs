#!/usr/bin/env node
/**
 * Copy the @webjsdev/ui registry component sources into this website's
 * components/ui/ so the docs pages can import them and render live previews.
 *
 * We rewrite the relative path to `lib/utils.ts` from `../lib/utils.ts` (the
 * registry's local layout) to `../../lib/utils.ts` (the website's layout -
 * `components/ui/<name>.ts` is one level deeper than `lib/utils.ts`).
 *
 * Run via `npm run preview:build` / automatically before `dev` and `start`.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBSITE_ROOT = resolve(__dirname, '..');
const REGISTRY_ROOT = resolve(__dirname, '..', '..', 'registry');

const COMPONENTS_SRC = join(REGISTRY_ROOT, 'components');
const LIB_SRC = join(REGISTRY_ROOT, 'lib', 'utils.ts');
// onBeforeCache lives in its own client-only module since the #819 split.
const LIB_DOM_SRC = join(REGISTRY_ROOT, 'lib', 'dom.ts');

const COMPONENTS_DST = join(WEBSITE_ROOT, 'components', 'ui');
const LIB_DST = join(WEBSITE_ROOT, 'lib', 'utils.ts');
const LIB_DOM_DST = join(WEBSITE_ROOT, 'lib', 'dom.ts');

if (!existsSync(COMPONENTS_SRC)) {
  console.error(`[ui-website] registry components not found at ${COMPONENTS_SRC}`);
  process.exit(1);
}

mkdirSync(COMPONENTS_DST, { recursive: true });
mkdirSync(dirname(LIB_DST), { recursive: true });

// 1. Clean the destination so removed-from-registry components don't linger as
//    orphans (they'd still be importable from website code and confuse SSR /
//    the dev server's module graph). We only remove .ts files we'd manage.
for (const name of readdirSync(COMPONENTS_DST)) {
  if (name.endsWith('.ts')) rmSync(join(COMPONENTS_DST, name));
}

// 2. Copy lib/utils.ts (pure cn helpers) and lib/dom.ts (onBeforeCache) verbatim.
copyFileSync(LIB_SRC, LIB_DST);
copyFileSync(LIB_DOM_SRC, LIB_DOM_DST);

// 3. Copy each component, rewriting the `../lib/utils.ts` and `../lib/dom.ts`
//    import paths so they point at the website's `lib/` (two levels up from
//    `components/ui/<name>.ts`). Missing the dom.ts rewrite 500s SSR (#819).
let copied = 0;
for (const name of readdirSync(COMPONENTS_SRC)) {
  if (!name.endsWith('.ts')) continue;
  const raw = readFileSync(join(COMPONENTS_SRC, name), 'utf8');
  const rewritten = raw
    .replaceAll("'../lib/utils.ts'", "'../../lib/utils.ts'")
    .replaceAll('"../lib/utils.ts"', '"../../lib/utils.ts"')
    .replaceAll("'../lib/dom.ts'", "'../../lib/dom.ts'")
    .replaceAll('"../lib/dom.ts"', '"../../lib/dom.ts"');
  writeFileSync(join(COMPONENTS_DST, name), rewritten);
  copied++;
}

console.log(`[ui-website] copied ${copied} components + lib/utils.ts + lib/dom.ts from registry`);
