#!/usr/bin/env node
/**
 * One-shot script that walks main's history and emits a per-package
 * per-version changelog file:
 *
 *   changelog/<pkg>/<version>.md
 *
 * where <pkg> is one of `core`, `server`, `cli`, `intellisense`, `ui`,
 * `vscode`, or `nvim`. The last two are the editor packages: tracked
 * for the /changelog feed but flagged `npm: false` in their frontmatter
 * so the publish-* scripts skip the registry (they ship via vsce/ovsx
 * and the webjs.nvim git subtree).
 *
 * For each version of each package, the file lists every
 * conventional-commit (`feat:` / `fix:` / `breaking:` / `perf:`) that
 * touched the package's `packages/<pkg>/` tree between the prior
 * version bump and this one. Commits that touch multiple packages
 * appear under each.
 *
 * Idempotent: re-running produces the same files. Files that already
 * exist are left alone, so hand-curation survives subsequent runs.
 *
 *   node scripts/backfill-changelog.js
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'changelog');

// Only the framework packages get changelog entries. The unscoped
// wrappers `create-webjs` and `webjsdev` exist as version-lockstep
// mirrors of `@webjsdev/cli`, so their per-release notes would be
// "bump to match cli@X.Y.Z" every single time, which is noise on
// the rendered /changelog page. The release workflow auto-bumps and
// auto-publishes them without writing changelog files.
// The npm-published framework packages PLUS the two editor packages that
// ship through other channels (the VS Code extension via vsce/ovsx, the
// Neovim plugin via the webjsdev/webjs.nvim git subtree). The editor
// packages are tracked here for the unified /changelog feed but are NOT
// npm-published: they carry `npm: false` in their frontmatter so the
// release workflow's publish-* scripts skip them (see DISPLAY_NAME /
// NON_NPM below and scripts/publish-npm.js).
const PACKAGES = ['core', 'server', 'cli', 'intellisense', 'ui', 'mcp', 'vscode', 'nvim'];

// Some packages publish under an unscoped npm name; for those the
// frontmatter's `package` field is the bare name. (None of the
// `@webjsdev/<pkg>` framework packages are unscoped; this set is
// reserved for any future framework-side unscoped npm package.)
const UNSCOPED = new Set();

// Packages that are NOT on npm. Their changelog entries carry `npm: false`
// so the release workflow's publish scripts skip the registry publish
// (they ship via vsce/ovsx and the nvim git subtree instead). The display
// name is what renders in the changelog frontmatter `package:` field, since
// the `@webjsdev/<dir>` convention does not match their real identity (the
// extension id is `webjsdev.webjs`; the plugin is `webjs.nvim`).
const NON_NPM = new Set(['vscode', 'nvim']);
const DISPLAY_NAME = {
  vscode: 'webjs (VS Code extension)',
  nvim: 'webjs.nvim',
};

/** @param {string} pkg short dir name */
function npmName(pkg) {
  if (DISPLAY_NAME[pkg]) return DISPLAY_NAME[pkg];
  return UNSCOPED.has(pkg) ? pkg : `@webjsdev/${pkg}`;
}

// Some packages live in a grouped subfolder (#402). The PACKAGES keys stay
// the bare names (used for the npm name + the changelog/<pkg>/ dir); map a
// key to its on-disk directory here when it is not packages/<pkg>.
const PACKAGE_DIRS = {
  'intellisense': 'packages/editors/intellisense',
  vscode: 'packages/editors/vscode',
  nvim: 'packages/editors/nvim',
};
/** @param {string} pkg short dir name -> its repo-relative package dir */
function pkgDir(pkg) {
  return PACKAGE_DIRS[pkg] || `packages/${pkg}`;
}

// Prior on-disk locations of a package, before a move. `git log` does not
// follow a directory across a rename, so to attribute a commit that landed
// while the package lived at its old path (the #402/#404 reorg moved the
// editor packages from packages/<x> into packages/editors/<x>), we pass
// BOTH the current and the historical dir as pathspecs. Without this, a
// package's pre-move version bumps and feature commits are invisible to the
// changelog (vscode's 0.1.0/0.2.0 and the nvim epic work all predate #404).
// NOTE: `intellisense` deliberately has NO old-dirs entry. It was renamed
// from `@webjsdev/ts-plugin` (#416), whose full version history stays frozen
// under `changelog/ts-plugin/`. Pointing intellisense at the old ts-plugin
// dirs would regenerate that entire history a SECOND time under
// `changelog/intellisense/`. intellisense starts fresh at the rename (0.5.0),
// hand-authored; future bumps are tracked from `packages/editors/intellisense`.
const PACKAGE_OLD_DIRS = {
  vscode: ['packages/vscode'],
  nvim: ['packages/nvim'],
};
/** All historical repo-relative dirs for a package (current first). */
function pkgDirs(pkg) {
  return [pkgDir(pkg), ...(PACKAGE_OLD_DIRS[pkg] || [])];
}

function git(args, opts = {}) {
  const r = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...opts,
  });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

/**
 * For one package, list every (version, commit, date) triple where
 * its package.json version field changed, in chronological order.
 * If the working tree has a STAGED version bump for the package
 * that isn't yet committed, append it as a virtual entry with
 * sha="HEAD" and today's date so the pre-commit hook can generate
 * the changelog file in the same commit as the bump.
 */
function versionTimeline(pkg) {
  // Format the log output as: <sha>\t<iso-date>\n<diff lines starting with +/->
  // Then filter to commits where a `+  "version":` line shows up.
  const raw = git([
    'log', '--reverse', '--diff-filter=M', '--pretty=format:===%h\t%aI',
    '-p', '--', ...pkgDirs(pkg).map((d) => `${d}/package.json`),
  ]);

  const out = [];
  let cur = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith('===')) {
      cur = { sha: '', date: '' };
      const [sha, date] = line.slice(3).split('\t');
      cur.sha = sha;
      // Store the FULL ISO timestamp (not just YYYY-MM-DD) so the
      // renderer can sort by commit time, not just calendar day.
      // This is the difference between "the order they shipped" and
      // "the day they shipped, then arbitrary tiebreak".
      cur.date = date;
      continue;
    }
    if (!cur) continue;
    const m = line.match(/^\+\s*"version":\s*"([^"]+)"/);
    if (m) {
      out.push({ sha: cur.sha, date: cur.date, version: m[1] });
      cur = null; // one version per commit; ignore further +/- lines
    }
  }

  // Detect a staged version bump that hasn't been committed yet.
  // `git diff --cached` shows the staged changes; we look for a
  // `+  "version":` line in this package's package.json.
  const staged = spawnSync(
    'git',
    ['diff', '--cached', '--unified=0', '--', `${pkgDir(pkg)}/package.json`],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
  ).stdout || '';
  const stagedMatch = staged.match(/^\+\s*"version":\s*"([^"]+)"/m);
  if (stagedMatch) {
    const stagedVersion = stagedMatch[1];
    // Skip if the last committed version is already this one (no
    // actual bump in the staged diff, just whitespace).
    const lastCommittedVersion = out.length ? out[out.length - 1].version : null;
    if (stagedVersion !== lastCommittedVersion) {
      out.push({
        sha: 'HEAD',
        // Full ISO timestamp (not just YYYY-MM-DD) so the renderer
        // can sort by commit time, matching how committed entries
        // are recorded above.
        date: new Date().toISOString(),
        version: stagedVersion,
        staged: true,
      });
    }
  }
  return out;
}

const PREFIX_RE = /^(feat|fix|breaking|perf)(?:\(([^)]+)\))?(!)?:\s*(.*)$/i;

function splitPr(subject) {
  const m = subject.match(/^(.*?)\s*\(#(\d+)\)\s*$/);
  if (!m) return { subject: subject.trim(), pr: null };
  return { subject: m[1].trim(), pr: m[2] };
}

function classify(rawSubject) {
  const { subject, pr } = splitPr(rawSubject);
  const m = subject.match(PREFIX_RE);
  if (!m) return null;
  const [, kind, scope, breakingMarker, rest] = m;
  return {
    type: breakingMarker ? 'breaking' : kind.toLowerCase(),
    scope: scope || null,
    title: rest.trim(),
    pr: pr || null,
  };
}

/** Conventional-commit log entries that touched `packages/<pkg>/` between two SHAs (exclusive..inclusive). */
function commitsInRange(pkg, fromSha, toSha) {
  const range = fromSha ? `${fromSha}..${toSha}` : toSha;
  const FIELD = '';
  const RECORD = '';
  const fmt = `%h${FIELD}%aI${FIELD}%s${FIELD}%b${RECORD}`;
  const raw = git([
    'log', '--reverse', `--pretty=format:${fmt}`, range, '--',
    ...pkgDirs(pkg).map((d) => `${d}/`),
  ]);
  const out = [];
  for (const rec of raw.split(RECORD)) {
    if (!rec.trim()) continue;
    const [sha, iso, subject, body = ''] = rec.split(FIELD);
    if (!subject) continue;
    const c = classify(subject);
    if (!c) continue;
    out.push({
      sha: sha.trim(),
      date: iso.slice(0, 10),
      type: c.type,
      title: c.title,
      pr: c.pr,
      scope: c.scope,
      body: body.trim(),
    });
  }
  return out;
}

const TYPE_ORDER = { breaking: 0, feat: 1, perf: 2, fix: 3 };
const TYPE_LABEL = { breaking: 'Breaking', feat: 'Features', perf: 'Performance', fix: 'Fixes' };

function renderEntry(pkg, version, date, commits) {
  const grouped = new Map();
  for (const c of commits) {
    if (!grouped.has(c.type)) grouped.set(c.type, []);
    grouped.get(c.type).push(c);
  }
  const order = [...grouped.keys()].sort((a, b) => TYPE_ORDER[a] - TYPE_ORDER[b]);

  // No h1 in the body. The website's /changelog page emits its own
  // card header (package badge + version + date), and GitHub Releases
  // uses the release title for the heading on each entry. An h1 here
  // duplicates one or the other on every surface.
  const fm = [
    '---',
    `package: "${npmName(pkg)}"`,
    `version: ${version}`,
    `date: ${date}`,
    `commit_count: ${commits.length}`,
    // Non-npm packages (the editor extensions) carry this flag so the
    // release workflow's publish-* scripts skip the registry publish.
    ...(NON_NPM.has(pkg) ? ['npm: false'] : []),
    '---',
    '',
  ].join('\n');

  if (!commits.length) {
    return fm + '_No user-facing changes shipped with this version (release-only bump)._\n';
  }

  const sections = [];
  for (const t of order) {
    sections.push(`## ${TYPE_LABEL[t]}\n`);
    for (const c of grouped.get(t)) {
      const prRef = c.pr ? ` ([#${c.pr}](https://github.com/webjsdev/webjs/pull/${c.pr}))` : '';
      const sha = `[\`${c.sha}\`](https://github.com/webjsdev/webjs/commit/${c.sha})`;
      sections.push(`- **${c.title}**${prRef} ${sha}`);
      if (c.body) {
        const summary = c.body.split('\n').slice(0, 4).map((l) => `  ${l}`).join('\n').trimEnd();
        if (summary) sections.push(summary);
      }
    }
    sections.push('');
  }
  return fm + sections.join('\n');
}

let total = 0;
let skippedEmpty = 0;
for (const pkg of PACKAGES) {
  const versions = versionTimeline(pkg);
  if (!versions.length) {
    console.log(`[backfill-changelog] ${npmName(pkg)}: no version bumps in history; skipping`);
    continue;
  }
  const dir = resolve(OUT, pkg);
  mkdirSync(dir, { recursive: true });
  let prevSha = null;
  for (const v of versions) {
    const file = resolve(dir, `${v.version}.md`);
    if (existsSync(file)) { prevSha = v.sha; continue; }
    const commits = commitsInRange(pkg, prevSha, v.sha);
    // Skip release-only bumps. A version that shipped no
    // feat / fix / breaking / perf commits has nothing to say to a
    // reader of the changelog. Tracking it here would emit a
    // single-line "no user-facing changes" placeholder for every
    // dependency bump, which is just noise.
    if (commits.length === 0) {
      skippedEmpty++;
      prevSha = v.sha;
      continue;
    }
    writeFileSync(file, renderEntry(pkg, v.version, v.date, commits));
    total++;
    prevSha = v.sha;
  }
  console.log(`[backfill-changelog] ${npmName(pkg)}: ${versions.length} versions`);
}
console.log(`[backfill-changelog] new files: ${total}, skipped (empty): ${skippedEmpty}`);
