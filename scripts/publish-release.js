#!/usr/bin/env node
/**
 * Publish ONE changelog file as a GitHub Release via the gh CLI.
 *
 *   node scripts/publish-release.js changelog/core/0.6.0.md
 *
 * Idempotent: skips when a release with the computed tag already
 * exists. Re-runs (e.g. workflow retries, force-pushes to main)
 * are safe.
 *
 * Tag convention: `<short_pkg>@<version>`, e.g. `core@0.6.0`. Matches
 * the npm dist-tag flavour. Title: `@webjskit/<short_pkg> <version>`.
 * Body: the markdown body of the file (frontmatter stripped).
 *
 * The script shells out to `gh`. The workflow injects GH_TOKEN via
 * the auto-provisioned GITHUB_TOKEN; locally, `gh auth login` works
 * the same way.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/publish-release.js <changelog/<pkg>/<version>.md>');
  process.exit(2);
}
if (!existsSync(file)) {
  console.error(`[publish-release] file not found: ${file}`);
  process.exit(2);
}

// Parse frontmatter + body. The schema is the same one
// scripts/backfill-changelog.js emits.
const raw = readFileSync(resolve(file), 'utf8');
const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
if (!m) {
  console.error(`[publish-release] ${file}: no frontmatter block`);
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
// Strip the leading h1 (e.g. `# @webjskit/core 0.6.0`) if present.
// The release page already shows the title (from --title), so the h1
// in the body was a duplicate header on every release page. Older
// changelog files include this line; the current backfill generator
// no longer emits it.
const body = m[2].replace(/^#\s+[^\n]*\n+/, '').trim();

const pkg = (fm.package || '').replace(/^@webjskit\//, '');
const version = fm.version;
if (!pkg || !version) {
  console.error(`[publish-release] ${file}: missing package or version in frontmatter`);
  process.exit(2);
}

const tag = `${pkg}@${version}`;
const title = `@webjskit/${pkg} ${version}`;

function gh(args, opts = {}) {
  return spawnSync('gh', args, {
    encoding: 'utf8',
    stdio: opts.stdio || ['ignore', 'pipe', 'pipe'],
    ...opts,
  });
}

// Idempotency check: if a release with this tag already exists, skip,
// unless --update is passed (in which case we overwrite its notes via
// `gh release edit`). --update is for back-out scenarios like the
// duplicate-header fix; default behaviour stays no-op so workflow
// retries don't churn.
const wantUpdate = process.argv.includes('--update');
const exists = gh(['release', 'view', tag, '--json', 'tagName']);
if (exists.status === 0) {
  if (!wantUpdate) {
    console.log(`[publish-release] skip ${tag}: release already exists (pass --update to overwrite notes)`);
    process.exit(0);
  }
  const edit = spawnSync(
    'gh',
    ['release', 'edit', tag, '--title', title, '--notes-file', '-'],
    { input: body, encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'] },
  );
  if (edit.status !== 0) {
    console.error(`[publish-release] gh release edit failed for ${tag}`);
    process.exit(edit.status || 1);
  }
  console.log(`[publish-release] updated release ${tag} (${basename(file)})`);
  process.exit(0);
}

// Create the release. Body is piped via stdin so we don't need a
// temp file and we don't run into shell-quoting issues with
// multi-line markdown.
//
// Optional --target <sha>: anchors the release tag to a specific
// commit (e.g. the version-bump commit recovered from git history).
// Without it, gh tags HEAD-of-default-branch, which puts every tag
// at the same commit and makes GitHub's web UI fall back to
// alphabetical sort when releases are otherwise indistinguishable.
const targetIdx = process.argv.indexOf('--target');
const target = targetIdx > 0 ? process.argv[targetIdx + 1] : null;
const args = ['release', 'create', tag, '--title', title, '--notes-file', '-'];
if (target) args.push('--target', target);
const create = spawnSync(
  'gh',
  args,
  { input: body, encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'] },
);
if (create.status !== 0) {
  console.error(`[publish-release] gh release create failed for ${tag}`);
  process.exit(create.status || 1);
}
console.log(`[publish-release] created release ${tag} (${basename(file)})`);
