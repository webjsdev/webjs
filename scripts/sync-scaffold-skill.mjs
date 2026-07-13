#!/usr/bin/env node
// Sync the canonical agent skill into the scaffold template.
//
// The WebJs agent skill lives ONCE, canonically, at the repo root
// `.agents/skills/webjs/` (SKILL.md + references/). The framework's own
// AGENTS.md and the @webjsdev/mcp knowledge layer read it there. The scaffold
// ships a copy so `webjs create` can drop it into every generated app, and
// `packages/cli/lib/create.js` copies that committed template copy.
//
// This script regenerates the template copy from the canonical one. Run it
// after editing the canonical skill. The drift guard
// (test/scaffolds/skill-sync.test.js) fails CI if the two ever diverge, so the
// template copy is a GENERATED artifact: never hand-edit it, edit the canonical
// `.agents/skills/webjs/` and re-run this.
import { rm, cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(repoRoot, '.agents', 'skills', 'webjs');
const dest = join(repoRoot, 'packages', 'cli', 'templates', '.agents', 'skills', 'webjs');

await rm(dest, { recursive: true, force: true });
await mkdir(dirname(dest), { recursive: true });
await cp(src, dest, { recursive: true });
console.log(`synced ${src} -> ${dest}`);
