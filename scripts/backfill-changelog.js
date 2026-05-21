#!/usr/bin/env node
/**
 * One-shot script that walks main's history and emits a per-package
 * per-version changelog file:
 *
 *   changelog/<pkg>/<version>.md
 *
 * where <pkg> is one of `core`, `server`, `cli`, `ts-plugin`, `ui`.
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

const PACKAGES = ['core', 'server', 'cli', 'ts-plugin', 'ui'];

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
 */
function versionTimeline(pkg) {
  // Format the log output as: <sha>\t<iso-date>\n<diff lines starting with +/->
  // Then filter to commits where a `+  "version":` line shows up.
  const raw = git([
    'log', '--reverse', '--diff-filter=M', '--pretty=format:===%h\t%aI',
    '-p', '--', `packages/${pkg}/package.json`,
  ]);

  const out = [];
  let cur = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith('===')) {
      cur = { sha: '', date: '' };
      const [sha, date] = line.slice(3).split('\t');
      cur.sha = sha;
      cur.date = date.slice(0, 10);
      continue;
    }
    if (!cur) continue;
    const m = line.match(/^\+\s*"version":\s*"([^"]+)"/);
    if (m) {
      out.push({ sha: cur.sha, date: cur.date, version: m[1] });
      cur = null; // one version per commit; ignore further +/- lines
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
    'log', '--reverse', `--pretty=format:${fmt}`, range, '--', `packages/${pkg}/`,
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

  const fm = [
    '---',
    `package: "@webjskit/${pkg}"`,
    `version: ${version}`,
    `date: ${date}`,
    `commit_count: ${commits.length}`,
    '---',
    '',
    `# @webjskit/${pkg} ${version}`,
    '',
  ].join('\n');

  if (!commits.length) {
    return fm + '_No user-facing changes shipped with this version (release-only bump)._\n';
  }

  const sections = [];
  for (const t of order) {
    sections.push(`## ${TYPE_LABEL[t]}\n`);
    for (const c of grouped.get(t)) {
      const prRef = c.pr ? ` ([#${c.pr}](https://github.com/vivek7405/webjs/pull/${c.pr}))` : '';
      const sha = `[\`${c.sha}\`](https://github.com/vivek7405/webjs/commit/${c.sha})`;
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
    console.log(`[backfill-changelog] @webjskit/${pkg}: no version bumps in history; skipping`);
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
  console.log(`[backfill-changelog] @webjskit/${pkg}: ${versions.length} versions`);
}
console.log(`[backfill-changelog] new files: ${total}, skipped (empty): ${skippedEmpty}`);
