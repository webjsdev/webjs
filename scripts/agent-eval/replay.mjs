#!/usr/bin/env node
/**
 * First-draft replay: did the agent's FIRST draft pass, against THIS branch?
 *
 * An eval build iterates until its app passes, so a pass rate on the final app
 * says nothing about whether the code was right the first time. This rebuilds
 * each recorded build as it stood when the agent first verified its work (its
 * Write / Edit calls up to its first `webjs check`, typecheck or test run),
 * then runs this branch's `webjs check`, `webjs typecheck` and server tests on
 * that draft. No model is called, so every framework change can be measured
 * against the same corpus for free.
 *
 *   node scripts/agent-eval/replay.mjs --corpus corpus.json [--json] [--keep] [--jobs 3]
 *   node scripts/agent-eval/replay.mjs --transcript t.jsonl --app path/to/app
 *
 * A corpus is a JSON array of `{ name, transcript, app }`. `app` is the eval
 * app as the build left it: a git repo whose root commit is the untouched
 * scaffold, with `node_modules` linked to this repo (so `@webjsdev/*` is this
 * branch). Generated files the agent did not write (the UI kit `webjs ui add`
 * copies in) are taken from the finished app; a migration is regenerated
 * with `webjs db generate` when the agent ran it before verifying.
 *
 * Local only, like the rest of this folder: the corpus is transcripts on the
 * machine that ran the builds.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, symlinkSync, realpathSync, rmSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = join(REPO, 'packages/cli/bin/webjs.js');

/** Which verification a Bash command is, if any. */
export function verifyKind(cmd) {
  if (/webjs(\.js)?\s+check\b/.test(cmd) && !/--rules/.test(cmd)) return 'check';
  if (/webjs(\.js)?\s+typecheck\b|\btsc\b/.test(cmd)) return 'typecheck';
  if (/webjs(\.js)?\s+test\b|npm (run )?test\b|node --test|bun test/.test(cmd)) return 'test';
  return null;
}

/**
 * An absolute path an agent wrote, mapped to the app-relative path. Agents
 * sometimes worked in a git worktree inside the app (`.wt-build/`,
 * `.worktrees/<x>/`, `.claude/worktrees/<x>/`), which folds back onto the app.
 * @param {string} abs @param {string} appDir
 * @returns {string|null}
 */
export function appRelative(abs, appDir) {
  const root = appDir.replace(/[\\/]+$/, '') + '/';
  if (!abs.startsWith(root)) return null;
  let rel = abs.slice(root.length);
  rel = rel.replace(/^(?:\.wt-build|\.worktrees\/[^/]+|\.claude\/worktrees\/[^/]+|\.wt\/[^/]+)\//, '');
  if (rel.startsWith('node_modules/') || rel.startsWith('.git/')) return null;
  return rel;
}

/**
 * The agent's file operations and generator commands for its FIRST COMPLETE
 * DRAFT: everything up to the first verification run that comes after the
 * agent created its last new file. Cutting at the very first verification
 * would grade a half-written app when an agent checks early (a layout that
 * names a helper it has not written yet), which measures timing, not
 * correctness. Edits that land between files are corrections the agent made
 * before it considered the draft done, and they are kept.
 * @param {string} transcript
 * @param {string} appDir
 */
export function firstDraftOps(transcript, appDir) {
  /** @type {Array<{ type: 'write', path: string, content: string } | { type: 'edit', path: string, edits: Array<{ old: string, new: string, all: boolean }> } | { type: 'cmd', cmd: string }>} */
  const ops = [];

  for (const line of readFileSync(transcript, 'utf8').split('\n')) {
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.type !== 'assistant') continue;
    for (const c of e.message?.content || []) {
      if (c?.type !== 'tool_use') continue;
      const inp = c.input || {};
      if (c.name === 'Write') {
        const p = appRelative(inp.file_path || '', appDir);
        if (p) ops.push({ type: 'write', path: p, content: inp.content ?? '' });
      } else if (c.name === 'Edit' || c.name === 'MultiEdit') {
        const p = appRelative(inp.file_path || '', appDir);
        if (!p) continue;
        const edits = c.name === 'Edit'
          ? [{ old: inp.old_string, new: inp.new_string, all: !!inp.replace_all }]
          : (inp.edits || []).map((x) => ({ old: x.old_string, new: x.new_string, all: !!x.replace_all }));
        ops.push({ type: 'edit', path: p, edits });
      } else if (c.name === 'Bash') {
        const cmd = String(inp.command || '');
        const kind = verifyKind(cmd);
        if (kind) ops.push({ type: 'verify', kind, cmd });
        else if (/\bui\s+add\b|db[: ]generate/.test(cmd)) ops.push({ type: 'cmd', cmd });
      }
    }
  }
  // The last op that creates a file not written before.
  const seen = new Set();
  let lastNew = -1;
  ops.forEach((o, i) => { if (o.type === 'write' && !seen.has(o.path)) { seen.add(o.path); lastNew = i; } });
  const cut = ops.findIndex((o, i) => i > lastNew && o.type === 'verify');
  // Strict: after the agent's FIRST verification, an edit or a rewrite of a
  // file it already wrote is likely a correction prompted by that run's
  // output, so only first-time writes (and generator commands) are kept.
  const firstAny = ops.findIndex((o) => o.type === 'verify');
  const written = new Set();
  const kept = (cut === -1 ? ops : ops.slice(0, cut)).filter((o, i) => {
    if (o.type === 'write') { const isNew = !written.has(o.path); written.add(o.path); return firstAny === -1 || i < firstAny || isNew; }
    if (o.type === 'edit') return firstAny === -1 || i < firstAny;
    return true;
  });
  const firstVerify = cut === -1 ? null : { kind: ops[cut].kind, cmd: ops[cut].cmd };
  return { ops: kept.filter((o) => o.type !== 'verify'), firstVerify };
}

/** Every file under `dir`, relative to it. */
function listFiles(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) listFiles(abs, base, out);
    else out.push(relative(base, abs));
  }
  return out;
}

function run(args, cwd, timeout = 300_000) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd, encoding: 'utf8', timeout,
    env: { ...process.env, CI: '1', NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

/**
 * Rebuild one build's first draft and grade it.
 * @param {{ name: string, transcript: string, app: string }} build
 * @param {{ keep?: boolean }} [opts]
 */
export function replayBuild(build, opts = {}) {
  const appDir = resolve(build.app);
  const { ops, firstVerify } = firstDraftOps(build.transcript, appDir);
  const work = mkdtempSync(join(tmpdir(), `webjs-replay-${build.name}-`));
  const draft = join(work, 'app');
  const result = { name: build.name, firstVerify: firstVerify?.kind ?? null, writes: 0, edits: 0, editMisses: [], check: null, typecheck: null, test: null, dir: draft };
  try {
    execFileSync('git', ['clone', '-q', appDir, draft]);
    const root = execFileSync('git', ['-C', draft, 'rev-list', '--max-parents=0', 'HEAD'], { encoding: 'utf8' }).trim().split('\n')[0];
    execFileSync('git', ['-C', draft, 'checkout', '-q', root]);
    symlinkSync(realpathSync(join(appDir, 'node_modules')), join(draft, 'node_modules'));
    for (const f of ['.env', '.env.local']) if (existsSync(join(appDir, f))) cpSync(join(appDir, f), join(draft, f));

    const ranUiAdd = ops.some((o) => o.type === 'cmd' && /\bui\s+add\b/.test(o.cmd));
    const ranDbGenerate = ops.some((o) => o.type === 'cmd' && /db[: ]generate/.test(o.cmd));
    if (ranUiAdd) {
      // The kit files `webjs ui add` copied in, taken from the finished app.
      for (const rel of [...listFiles(join(appDir, 'components/ui')).map((f) => join('components/ui', f)), 'lib/utils/cn.ts', 'lib/utils/dom.ts', 'components.json']) {
        const from = join(appDir, rel);
        if (existsSync(from) && !existsSync(join(draft, rel))) { mkdirSync(dirname(join(draft, rel)), { recursive: true }); cpSync(from, join(draft, rel)); }
      }
    }
    for (const op of ops) {
      if (op.type === 'cmd') continue;
      const abs = join(draft, op.path);
      if (op.type === 'write') {
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, op.content);
        result.writes++;
        continue;
      }
      let src = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
      for (const ed of op.edits) {
        if (src === null || !src.includes(ed.old)) { result.editMisses.push(op.path); continue; }
        src = ed.all ? src.split(ed.old).join(ed.new) : src.replace(ed.old, () => ed.new);
      }
      if (src !== null) { writeFileSync(abs, src); result.edits++; }
    }
    if (ranDbGenerate) run(['db', 'generate'], draft, 120_000);
    // Grade only the tests the agent wrote: a scaffold's own example tests
    // exercise scaffold code from another framework version, not the draft.
    const agentWrote = new Set(ops.filter((o) => o.type === 'write').map((o) => o.path));
    for (const rel of listFiles(join(draft, 'test')).map((f) => join('test', f))) {
      if (/\.test\.(js|ts|mjs|mts)$/.test(rel) && !agentWrote.has(rel)) rmSync(join(draft, rel));
    }
    result.agentTests = [...agentWrote].filter((f) => /\.test\.(js|ts|mjs|mts)$/.test(f) && !f.includes('/browser/')).length;

    const check = run(['check', '--json'], draft);
    let violations = [];
    try { violations = JSON.parse(check.out.slice(check.out.indexOf('{'))).violations || []; } catch { /* non-JSON output */ }
    result.check = { ok: check.code === 0, rules: violations.map((v) => `${v.rule} ${v.file}`) };
    const tc = run(['typecheck'], draft);
    result.typecheck = { ok: tc.code === 0, errors: [...tc.out.matchAll(/^(.+?\(\d+,\d+\)): error (TS\d+): (.*)$/gm)].map((m) => `${m[1]} ${m[2]} ${m[3]}`) };
    const test = run(['test', '--server'], draft, 600_000);
    const fails = [...test.out.matchAll(/ℹ fail (\d+)/g)].map((m) => Number(m[1]));
    result.test = { ok: test.code === 0 && fails.every((n) => n === 0), fail: fails.reduce((a, b) => a + b, 0), tail: test.code === 0 ? '' : test.out.split('\n').filter((l) => /✖|Error|error/.test(l)).slice(0, 8).join('\n') };
  } catch (err) {
    result.error = String(err?.message || err).split('\n')[0];
  } finally {
    if (!opts.keep) rmSync(work, { recursive: true, force: true });
  }
  return result;
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (n) => argv.includes(n);
  const value = (n) => { const i = argv.indexOf(n); return i === -1 ? undefined : argv[i + 1]; };
  /** @type {Array<{ name: string, transcript: string, app: string }>} */
  let builds;
  if (value('--corpus')) builds = JSON.parse(readFileSync(value('--corpus'), 'utf8'));
  else if (value('--transcript') && value('--app')) builds = [{ name: 'build', transcript: value('--transcript'), app: value('--app') }];
  else {
    console.error('usage: replay.mjs --corpus corpus.json | --transcript t.jsonl --app <dir>   [--json] [--keep]');
    process.exit(2);
  }
  const only = value('--only');
  if (only) builds = builds.filter((b) => b.name.includes(only));
  const results = builds.map((b) => {
    const r = replayBuild(b, { keep: flag('--keep') });
    if (!flag('--json')) {
      const mark = (x) => (x == null ? '-' : x.ok ? 'pass' : 'FAIL');
      console.log(`${r.name.padEnd(28)} check ${mark(r.check)}  typecheck ${mark(r.typecheck)}  test ${r.agentTests ? mark(r.test) : 'none'}` +
        `  (${r.writes} writes, ${r.edits} edits${r.editMisses.length ? `, ${r.editMisses.length} edit misses` : ''}, verify: ${r.firstVerify})${r.error ? `  ERROR ${r.error}` : ''}`);
      for (const v of r.check?.ok === false ? r.check.rules : []) console.log(`    check: ${v}`);
      for (const e of r.typecheck?.ok === false ? r.typecheck.errors.slice(0, 6) : []) console.log(`    tsc: ${e}`);
      if (r.test?.ok === false && r.test.tail) console.log(r.test.tail.split('\n').map((l) => `    test: ${l}`).join('\n'));
    }
    return r;
  });
  const n = results.length;
  const count = (k) => results.filter((r) => r[k]?.ok).length;
  const all = results.filter((r) => r.check?.ok && r.typecheck?.ok && r.test?.ok).length;
  const summary = { builds: n, check: count('check'), typecheck: count('typecheck'), test: count('test'), allThree: all };
  if (flag('--json')) console.log(JSON.stringify({ summary, results }, null, 2));
  else console.log(`\nfirst drafts passing on this branch: check ${summary.check}/${n}, typecheck ${summary.typecheck}/${n}, test ${summary.test}/${n}, all three ${all}/${n}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
