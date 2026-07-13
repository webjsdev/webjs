#!/usr/bin/env node
// Bundle the canonical agent skill into the CLI package for publishing.
//
// The WebJs agent skill lives ONCE, canonically, at the repo root
// `.agents/skills/webjs/` (SKILL.md + references/). The framework's own
// AGENTS.md and the @webjsdev/mcp knowledge layer read it there. The scaffold
// (`webjs create`) also ships it into every generated app, but npm's `files`
// cannot reach a repo-root path from inside `packages/cli`, so this script
// copies the canonical skill into `packages/cli/templates/.agents/skills/webjs/`
// at `prepack` (wired into packages/cli's prepack), just before the tarball is
// built. `postpack` runs it with `--clean` to remove the transient copy, so the
// bundle is present in the tarball but ABSENT in the working tree: the source
// stays single (no committed duplicate), and `create.js` falls back to the
// repo-root canonical when the bundle is absent (monorepo dev).
import { rm, cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(repoRoot, '.agents', 'skills', 'webjs');
const dest = join(repoRoot, 'packages', 'cli', 'templates', '.agents', 'skills', 'webjs');

if (process.argv.includes('--clean')) {
  await rm(dest, { recursive: true, force: true });
  console.error('[webjs] cleaned the transient scaffold-skill bundle');
} else {
  if (!existsSync(src)) throw new Error(`canonical skill not found at ${src}`);
  await rm(dest, { recursive: true, force: true });
  await mkdir(dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true });
  console.error(`[webjs] bundled the scaffold skill into ${dest}`);
}
