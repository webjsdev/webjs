#!/usr/bin/env node
/**
 * Copy the @webjskit/ui registry component sources into this website's
 * components/ui/ so the docs pages can import them and render live previews.
 *
 * We rewrite the relative path to `lib/utils.ts` from `../lib/utils.ts` (the
 * registry's local layout) to `../../lib/utils.ts` (the website's layout —
 * `components/ui/<name>.ts` is one level deeper than `lib/utils.ts`).
 *
 * Run via `npm run preview:build` / automatically before `dev` and `start`.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBSITE_ROOT = resolve(__dirname, '..');
const REGISTRY_ROOT = resolve(__dirname, '..', '..', 'registry');

const COMPONENTS_SRC = join(REGISTRY_ROOT, 'components');
const LIB_SRC = join(REGISTRY_ROOT, 'lib', 'utils.ts');

const COMPONENTS_DST = join(WEBSITE_ROOT, 'components', 'ui');
const LIB_DST = join(WEBSITE_ROOT, 'lib', 'utils.ts');

if (!existsSync(COMPONENTS_SRC)) {
  console.error(`[ui-website] registry components not found at ${COMPONENTS_SRC}`);
  process.exit(1);
}

mkdirSync(COMPONENTS_DST, { recursive: true });
mkdirSync(dirname(LIB_DST), { recursive: true });

// 1. Copy lib/utils.ts verbatim.
copyFileSync(LIB_SRC, LIB_DST);

// 2. Copy each component, rewriting the `../lib/utils.ts` import path so it
//    points to the website's `lib/utils.ts` (two levels up from
//    `components/ui/<name>.ts`).
let copied = 0;
for (const name of readdirSync(COMPONENTS_SRC)) {
  if (!name.endsWith('.ts')) continue;
  const raw = readFileSync(join(COMPONENTS_SRC, name), 'utf8');
  const rewritten = raw
    .replaceAll("'../lib/utils.ts'", "'../../lib/utils.ts'")
    .replaceAll('"../lib/utils.ts"', '"../../lib/utils.ts"')
    // `@webjskit/core/directives` isn't a declared subpath export in the
    // published `@webjskit/core` package — `unsafeHTML` is re-exported from
    // the main entry. Rewrite so the website resolves correctly against the
    // installed package.
    .replaceAll("from '@webjskit/core/directives'", "from '@webjskit/core'")
    .replaceAll('from "@webjskit/core/directives"', 'from "@webjskit/core"');
  writeFileSync(join(COMPONENTS_DST, name), rewritten);
  copied++;
}

console.log(`[ui-website] copied ${copied} components + lib/utils.ts from registry`);
