/**
 * Bundle the framework docs into `@webjsdev/cli` so `npx @webjsdev/cli mcp` is
 * self-contained (#376). The MCP knowledge layer serves the `agent-docs/*.md`
 * corpus + the root `AGENTS.md` as resources, but those live at the MONOREPO
 * ROOT, outside this package, so npm's `files` cannot reach them. This script
 * copies them into `packages/cli/resources/` (which IS in `files`) at `prepack`,
 * just before the tarball is built.
 *
 * The copies are gitignored, NOT committed: source stays single (the repo-root
 * docs), and `lib/mcp-docs.js` resolves the bundled copies in a published
 * install but falls back to the repo-root docs in dev/tests, so this script
 * only needs to run at publish time.
 *
 * Mirrors `next-devtools-mcp`'s `copy-resources` step. Dependency-free.
 */

import { cpSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cliRoot = resolve(here, '..'); // packages/cli/scripts -> packages/cli
const repoRoot = resolve(here, '..', '..', '..'); // -> monorepo root

const srcDocs = join(repoRoot, 'agent-docs');
const srcAgents = join(repoRoot, 'AGENTS.md');
const destRoot = join(cliRoot, 'resources');
const destDocs = join(destRoot, 'agent-docs');

// Clean + recreate so a removed/renamed doc never lingers in the bundle.
rmSync(destRoot, { recursive: true, force: true });
mkdirSync(destDocs, { recursive: true });

cpSync(srcDocs, destDocs, { recursive: true });
copyFileSync(srcAgents, join(destRoot, 'AGENTS.md'));

// Diagnostics go to stderr so they never pollute a tool parsing `npm pack --json` stdout.
console.error(`[webjs] bundled MCP docs into ${join('resources')} (agent-docs + AGENTS.md)`);
