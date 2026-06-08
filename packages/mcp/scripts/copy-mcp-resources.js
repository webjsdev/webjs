/**
 * Bundle the framework docs into `@webjsdev/mcp` so `npx @webjsdev/mcp` is
 * self-contained (#376, #415). The MCP knowledge layer serves the `agent-docs/*.md`
 * corpus + the root `AGENTS.md` as resources, but those live at the MONOREPO
 * ROOT, outside this package, so npm's `files` cannot reach them. This script
 * copies them into `packages/mcp/resources/` (which IS in `files`) at `prepack`,
 * just before the tarball is built. `postpack` (clean-mcp-resources.js) removes
 * the working-tree copy right after, so the bundle is transient: present in the
 * tarball, absent in dev (where `resolveDocsLocation` falls back to the live
 * repo-root docs, so source stays single).
 *
 * The reusable `bundleDocs(...)` is exported + unit-tested; the script body just
 * runs it against the real repo paths. Mirrors `next-devtools-mcp`'s
 * `copy-resources`. Dependency-free.
 *
 * @module copy-mcp-resources
 */

import { cpSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Copy `srcDocs` (a dir of `*.md`) + `srcAgents` (a single file) into
 * `<destRoot>/agent-docs/` + `<destRoot>/AGENTS.md`. Cleans `destRoot` first so
 * a removed/renamed doc never lingers in the bundle. PURE side effect on the
 * given paths, so it is testable against temp dirs without touching the package.
 *
 * @param {{ srcDocs: string, srcAgents: string, destRoot: string }} paths
 * @returns {void}
 */
export function bundleDocs({ srcDocs, srcAgents, destRoot }) {
  const destDocs = join(destRoot, 'agent-docs');
  rmSync(destRoot, { recursive: true, force: true });
  mkdirSync(destDocs, { recursive: true });
  cpSync(srcDocs, destDocs, { recursive: true });
  copyFileSync(srcAgents, join(destRoot, 'AGENTS.md'));
}

/** Run against the real repo paths when invoked as the prepack script. */
function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgRoot = resolve(here, '..'); // packages/mcp/scripts -> packages/mcp
  const repoRoot = resolve(here, '..', '..', '..'); // -> monorepo root
  bundleDocs({
    srcDocs: join(repoRoot, 'agent-docs'),
    srcAgents: join(repoRoot, 'AGENTS.md'),
    destRoot: join(pkgRoot, 'resources'),
  });
  // Diagnostics to stderr so they never pollute a tool parsing `npm pack --json` stdout.
  console.error('[webjs] bundled MCP docs into resources/ (agent-docs + AGENTS.md)');
}

// Only run the side effect when invoked directly (not when imported by a test).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
