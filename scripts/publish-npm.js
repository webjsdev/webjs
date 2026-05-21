#!/usr/bin/env node
/**
 * Publish ONE package version to npm, driven by a changelog file.
 *
 *   node scripts/publish-npm.js changelog/core/0.6.0.md
 *
 * The companion to scripts/publish-release.js. Same idempotency
 * shape: parse the file's frontmatter, derive package + version,
 * check whether that version is already on the npm registry, skip
 * if yes, publish if no.
 *
 * Auth: relies on the standard `npm publish` token resolution
 * (NODE_AUTH_TOKEN env var via setup-node's .npmrc on CI, or
 * `npm login` locally). The script does not write any .npmrc.
 *
 * The workspace flag (`--workspace=@webjskit/<pkg>`) tells npm to
 * publish that specific package out of the monorepo. `--access public`
 * is a belt-and-braces alongside the per-package
 * `publishConfig: { access: "public" }`, in case a package forgot
 * to set it.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/publish-npm.js <changelog/<pkg>/<version>.md>');
  process.exit(2);
}
if (!existsSync(file)) {
  console.error(`[publish-npm] file not found: ${file}`);
  process.exit(2);
}

const raw = readFileSync(resolve(file), 'utf8');
const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
if (!m) {
  console.error(`[publish-npm] ${file}: no frontmatter block`);
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

const pkgName = fm.package; // "@webjskit/core"
const version = fm.version;
if (!pkgName || !version) {
  console.error(`[publish-npm] ${file}: missing package or version in frontmatter`);
  process.exit(2);
}

// Idempotency: is this version already on the registry?
// `npm view <pkg>@<version> version` prints the version on success,
// non-zero exit on 404. We swallow stderr to avoid noisy "E404" log.
const view = spawnSync(
  'npm', ['view', `${pkgName}@${version}`, 'version'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
);
if (view.status === 0 && view.stdout.trim() === version) {
  console.log(`[publish-npm] skip ${pkgName}@${version}: already on registry`);
  process.exit(0);
}

// Publish. --workspace targets the package within the monorepo, so we
// can run this from the repo root without cd'ing into packages/<pkg>/.
const pub = spawnSync(
  'npm',
  ['publish', `--workspace=${pkgName}`, '--access=public', '--ignore-scripts=false'],
  { stdio: 'inherit' },
);
if (pub.status !== 0) {
  console.error(`[publish-npm] npm publish failed for ${pkgName}@${version}`);
  process.exit(pub.status || 1);
}
console.log(`[publish-npm] published ${pkgName}@${version} (${basename(file)})`);
