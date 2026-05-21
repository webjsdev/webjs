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

// Make sure the .npmrc routes @webjsdev to GitHub Packages. The
// workflow's setup-node step targets registry.npmjs.org by default
// for the unscoped lookup, so we install our own scope override.
const npmrcPath = `${homedir()}/.npmrc`;
const existing = existsSync(npmrcPath) ? readFileSync(npmrcPath, 'utf8') : '';
const scopeLine = '@webjsdev:registry=https://npm.pkg.github.com';
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
