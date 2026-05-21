#!/usr/bin/env node
/**
 * Publish ONE package version to GitHub Packages, driven by a changelog file.
 *
 *   node scripts/publish-github-packages.js changelog/core/0.7.1.md
 *
 * Sibling to scripts/publish-npm.js. Same idempotency shape: parse
 * frontmatter, derive package + version, check whether that version
 * is already on the registry, skip if yes, publish if no.
 *
 * Registry: https://npm.pkg.github.com. GitHub Packages enforces
 * that the package scope match the GitHub org/user that owns the
 * repo (webjsdev/webjs in our case, so @webjsdev/* lines up).
 *
 * Auth: relies on NODE_AUTH_TOKEN, which the workflow sets to
 * secrets.GITHUB_TOKEN. The workflow also needs `permissions:
 * packages: write` for the token to be allowed to publish.
 *
 * Locally, set NODE_AUTH_TOKEN to a personal access token with the
 * `write:packages` scope (gh auth refresh -s write:packages, then
 * gh auth token), or write your own ~/.npmrc.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const REGISTRY = 'https://npm.pkg.github.com';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/publish-github-packages.js <changelog/<pkg>/<version>.md>');
  process.exit(2);
}
if (!existsSync(file)) {
  console.error(`[publish-github-packages] file not found: ${file}`);
  process.exit(2);
}

const raw = readFileSync(resolve(file), 'utf8');
const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
if (!m) {
  console.error(`[publish-github-packages] ${file}: no frontmatter block`);
  process.exit(2);
}
const fm = {};
for (const line of m[1].split('\n')) {
  const idx = line.indexOf(':');
  if (idx < 0) continue;
  const k = line.slice(0, idx).trim();
  let v = line.slice(idx + 1).trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  fm[k] = v;
}

// Historical changelog files (the @webjskit era) record `package:
// "@webjskit/<short>"` in their frontmatter; we cannot publish those
// names to GitHub Packages because the @webjskit scope does not
// match the webjsdev GitHub org. Skip them with an explicit log so
// a bootstrap pass over the full changelog/ tree is safe to run.
const pkgName = fm.package;
const version = fm.version;
if (!pkgName || !version) {
  console.error(`[publish-github-packages] ${file}: missing package or version in frontmatter`);
  process.exit(2);
}
if (!pkgName.startsWith('@webjsdev/')) {
  console.log(`[publish-github-packages] skip ${pkgName}@${version}: scope is not @webjsdev (legacy entry)`);
  process.exit(0);
}

// `npm publish --workspace=<name>` always publishes whatever
// version is in that workspace's package.json HEAD, not the
// version named in the changelog file. So if we're asked to
// publish a historical version that does not match the current
// workspace, skip; we cannot recreate historical workspace state
// from the current source tree. The bootstrap pass over the whole
// changelog tree relies on this skip to publish only the 5 current
// versions (one per package).
const shortPkg = pkgName.replace(/^@webjsdev\//, '');
const workspacePkgJson = resolve(REPO_ROOT, 'packages', shortPkg, 'package.json');
if (!existsSync(workspacePkgJson)) {
  console.error(`[publish-github-packages] cannot find ${workspacePkgJson} for ${pkgName}`);
  process.exit(2);
}
const workspaceVersion = JSON.parse(readFileSync(workspacePkgJson, 'utf8')).version;
if (workspaceVersion !== version) {
  console.log(`[publish-github-packages] skip ${pkgName}@${version}: workspace HEAD is ${workspaceVersion}; cannot recreate historical version from current source`);
  process.exit(0);
}

// Configure npm to route @webjsdev to GitHub Packages. The
// workflow's setup-node step sets NPM_CONFIG_USERCONFIG to a temp
// .npmrc with the npmjs.org auth; we write our scope+auth lines to
// the SAME file so `npm publish` picks them up. Falling back to
// ~/.npmrc lets the script also work locally when run by hand.
const npmrcPath = process.env.NPM_CONFIG_USERCONFIG || `${homedir()}/.npmrc`;
const existing = existsSync(npmrcPath) ? readFileSync(npmrcPath, 'utf8') : '';
const scopeLine = '@webjsdev:registry=https://npm.pkg.github.com/';
const authLine = '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}';
const lines = existing.split('\n').filter(Boolean);
if (!lines.includes(scopeLine)) lines.push(scopeLine);
if (!lines.some((l) => l.startsWith('//npm.pkg.github.com/:_authToken='))) lines.push(authLine);
writeFileSync(npmrcPath, lines.join('\n') + '\n');

// Idempotency: already published to GitHub Packages?
const view = spawnSync(
  'npm', ['view', `${pkgName}@${version}`, 'version', `--registry=${REGISTRY}`],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
);
if (view.status === 0 && view.stdout.trim() === version) {
  console.log(`[publish-github-packages] skip ${pkgName}@${version}: already on GitHub Packages`);
  process.exit(0);
}

// Publish. `--registry` forces the target; the per-package
// publishConfig stays on npmjs.org as the canonical registry.
const pub = spawnSync(
  'npm',
  ['publish', `--workspace=${pkgName}`, `--registry=${REGISTRY}`, '--access=public', '--ignore-scripts=false'],
  { stdio: 'inherit' },
);
if (pub.status !== 0) {
  console.error(`[publish-github-packages] npm publish failed for ${pkgName}@${version}`);
  process.exit(pub.status || 1);
}
console.log(`[publish-github-packages] published ${pkgName}@${version} to GitHub Packages (${basename(file)})`);
