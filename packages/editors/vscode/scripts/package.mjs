/**
 * Package (or publish) the webjs VSCode extension from a standalone staging
 * dir (#382).
 *
 * Why staging: vsce's npm path runs `npm list --production` to decide which
 * dependency dirs to include. Run from a workspace member, that command
 * resolves the whole monorepo (the repo root + every sibling package), so the
 * vsix balloons to ~86 MB of unrelated dev deps. Copying the publishable files
 * into a standalone dir OUTSIDE the workspace makes `npm list` return exactly
 * two dirs: the extension and the one self-contained vendored tsserver plugin.
 *
 * Flow:
 *   1. `scripts/build.mjs` esbuilds the plugin into
 *      `node_modules/@webjsdev/intellisense/` (a real, dependency-free dir).
 *   2. Copy the extension's publishable tree into a temp dir, including that
 *      vendored plugin, with a package.json whose only dependency is the
 *      plugin and with NO `workspaces` field.
 *   3. Run `vsce <package|publish>` there; copy the resulting `.vsix` back.
 *
 * Usage: node scripts/package.mjs <package|publish:vsce>  [extra vsce args...]
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXT = resolve(HERE, '..');
const mode = process.argv[2] || 'package';
const extraArgs = process.argv.slice(3);

// 1. Build the vendored, self-contained tsserver plugin.
execFileSync('node', [resolve(HERE, 'build.mjs')], { stdio: 'inherit' });

const VENDORED = resolve(EXT, 'node_modules/@webjsdev/intellisense');
if (!existsSync(join(VENDORED, 'index.cjs'))) {
  console.error('[package] build did not produce the vendored plugin; aborting.');
  process.exit(1);
}

// 2. Stage the publishable files into a standalone dir outside the workspace.
const stage = mkdtempSync(join(tmpdir(), 'webjs-vscode-'));
const COPY = ['README.md', 'LICENSE', 'icon.png', '.vscodeignore', 'src', 'syntaxes', 'snippets'];
for (const item of COPY) {
  const from = resolve(EXT, item);
  if (existsSync(from)) cpSync(from, join(stage, item), { recursive: true });
}
cpSync(VENDORED, join(stage, 'node_modules/@webjsdev/intellisense'), { recursive: true });

// A standalone manifest: same contributes, but no `workspaces`, no
// devDependencies, and the plugin as the sole production dependency so
// `npm list --production` (run by vsce) returns just the vendored dir.
const manifest = JSON.parse(readFileSync(resolve(EXT, 'package.json'), 'utf8'));
delete manifest.devDependencies;
delete manifest.scripts;
manifest.dependencies = { '@webjsdev/intellisense': '*' };
writeFileSync(join(stage, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');

// 3. Run vsce in the staging dir.
const vsceArgs =
  mode === 'package'
    ? ['--yes', '@vscode/vsce', 'package', '--out', join(stage, 'webjs.vsix'), ...extraArgs]
    : ['--yes', '@vscode/vsce', 'publish', ...extraArgs];

console.log(`[package] running vsce ${mode} in ${stage}`);
execFileSync('npx', vsceArgs, { cwd: stage, stdio: 'inherit' });

if (mode === 'package') {
  const out = resolve(EXT, 'webjs.vsix');
  copyFileSync(join(stage, 'webjs.vsix'), out);
  console.log(`[package] wrote ${out}`);
}

rmSync(stage, { recursive: true, force: true });
