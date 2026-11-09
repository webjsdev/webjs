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

/**
 * Which verification a Bash command runs, if any. Only a command SEGMENT that
 * starts the runner counts (after `cd`, `timeout N`, env assignments and the
 * like), so `grep -rn "node --test" package.json` or `cat x | grep webjs check`
 * is not a test or check run: matching the text anywhere counted such greps as
 * failed first runs.
 * @param {string} cmd
 */
export function verifyKind(cmd) {
  // Heredoc bodies are file content, and a quoted argument (a grep pattern
  // with `\|` in it) is never a command boundary, so both are blanked first.
  const heredocFree = cmd.replace(/<<-?\s*'?(\w+)'?[\s\S]*?\n\1\b/g, '').replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""');
  for (let seg of heredocFree.split(/\s*(?:&&|\|\||;|\n|\|(?!\|))\s*/)) {
    seg = seg.replace(/^(?:\(|\{)\s*/, '');
    for (;;) {
      const next = seg.replace(/^(?:timeout\s+\S+|env|time|[A-Z_][A-Z0-9_]*=\S*|CI=\S*)\s+/, '');
      if (next === seg) break;
      seg = next;
    }
    const run = /^(?:npx\s+(?:--no-install\s+)?|node\s+(?:\S*\/)?|bunx\s+|\.\/node_modules\/\.bin\/)?(?:webjs(?:\.js)?|\S*\/webjs(?:\.js)?)\s+(check|typecheck|test)\b/.exec(seg);
    if (run) {
      if (run[1] === 'check' && /--rules/.test(seg)) continue;
      return run[1] === 'typecheck' ? 'typecheck' : run[1];
    }
    if (/^(?:npx\s+)?tsc\b/.test(seg)) return 'typecheck';
    if (/^(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test\b/.test(seg) || /^node\s+(?:--[\w-]+\s+)*--test\b/.test(seg) || /^bun\s+test\b/.test(seg)) return 'test';
    if (/^(?:npm|pnpm|yarn|bun)\s+run\s+(?:typecheck|check)\b/.test(seg)) return /typecheck/.test(seg) ? 'typecheck' : 'check';
  }
  return null;
}

/**
 * Whether a verification run's output reports success.
 * @param {'check'|'typecheck'|'test'} kind @param {string} out
 */
/** A shell command that changes files: an in-place edit, a move, a copy, a delete, a redirect into a file, or the gallery reset. */
// `git show REF:path > dest`, the one git command that writes a file.
const RESTORE_RE = /\bgit show [^:\s]+:("[^"]+"|\S+)\s*>\s*("[^"]+"|\S+)/g;
/** A command that starts a dev / prod server or leaves a process running in the background. */
export const STARTS_PROCESS_RE = /\b(?:npx\s+)?webjs(?:\.js)?\s+(?:dev|start)\b|\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:dev|start)\b|\bnohup\b|\bdisown\b|&\s*(?:$|\n|;|\))/m;
const MUTATES_RE = /\bpython3?\s+-\s*<<|\bnode\s+(?:-e|--eval)\b[^\n]*writeFileSync|\bmkdir\s|\bsed\s+-i|\bmv\s|\bcp\s|\brm\s|cat\s*>|\btee\s|>\s*[\w./#-]+\.(?:ts|js|mjs|json|css|md)\b|gallery:clear|clear-gallery/;

export function verifyPassed(kind, out) {
  if (kind === 'check') return /all checks pass/.test(out) && !/\d+ violation/.test(out);
  if (kind === 'typecheck') return !/error TS\d+/.test(out) && !/[Ee]xit code [1-9]/.test(out);
  const fails = [...out.matchAll(/ℹ fail (\d+)/g), ...out.matchAll(/(\d+) failed/g)].map((m) => Number(m[1]));
  if (fails.length) return fails.every((n) => n === 0);
  return /all tests passed|ℹ pass \d+/.test(out) && !/[Ee]xit code [1-9]/.test(out);
}

/**
 * An absolute path an agent wrote, mapped to the app-relative path. Agents
 * sometimes worked in a git worktree inside the app (`.wt-<x>/`,
 * `.worktrees/<x>/`, `.claude/worktrees/<x>/`), which folds back onto the app.
 * @param {string} abs @param {string} appDir
 * @returns {string|null}
 */
export function appRelative(abs, appDir) {
  const root = appDir.replace(/[\\/]+$/, '') + '/';
  if (!abs.startsWith(root)) return null;
  let rel = abs.slice(root.length);
  rel = rel.replace(/^(?:\.wt-[^/]+|\.worktrees\/[^/]+|\.claude\/worktrees\/[^/]+|\.wt\/[^/]+)\//, '');
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
  /** @type {Map<string, any>} tool_use id -> its verify op, to fill in the outcome */
  const pendingVerify = new Map();

  for (const line of readFileSync(transcript, 'utf8').split('\n')) {
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.type === 'user') {
      for (const c of e.message?.content || []) {
        if (c?.type !== 'tool_result') continue;
        const op = pendingVerify.get(c.tool_use_id);
        if (!op) continue;
        const out = typeof c.content === 'string' ? c.content
          : (c.content || []).map((x) => (x && x.text) || '').join('\n');
        // A shell command that was refused or failed changed nothing, so
        // replaying it would invent a change the agent never made.
        if (op.type === 'sh' || op.type === 'restore') { op.ran = !c.is_error; continue; }
        op.ok = !c.is_error && verifyPassed(op.kind, out);
      }
      continue;
    }
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
        if (kind) {
          // A command that edits and then verifies (`sed -i ... && npx webjs
          // typecheck`): the edit is part of the draft, so the segments before
          // the verification are replayed as a shell op of their own.
          const before = mutatingPrefix(cmd);
          if (before) ops.push({ type: 'sh', cmd: before, ran: true, creates: appCreates(before, appDir) });
          const op = { type: 'verify', kind, cmd, ok: null }; ops.push(op); pendingVerify.set(c.id, op);
        }
        else if (RESTORE_RE.test(cmd)) {
          // A file brought back from the scaffold commit (`git show REF:path >
          // dest`). Every other git command is left out of the replay.
          RESTORE_RE.lastIndex = 0;
          for (const m of cmd.matchAll(RESTORE_RE)) {
            const unq = (x) => x.replace(/^"|"$/g, '').replace(/\\(.)/g, '$1');
            if (m[2] === '/dev/null') continue;
            const op = { type: 'restore', from: unq(m[1]), path: unq(m[2]), ran: true };
            ops.push(op);
            pendingVerify.set(c.id, op);
          }
        } else if (MUTATES_RE.test(cmd) && /^\s*(?:cd\s+\S+\s*&&\s*)?git\b/.test(cmd) && !cmd.includes('<<') && !/\bgit\s+worktree\b/.test(cmd)) {
          // Moving files into a new worktree is a no-op once worktree paths
          // fold onto the app, so a `git worktree` command is skipped whole.
          // A git command followed by file changes (`git commit ...; mkdir -p
          // modules/x`): git itself is never replayed, the rest is.
          const rest = cmd.split(/\s*(?:&&|;|\|\||\n)\s*/).filter((seg) => seg && !/^(?:git|cd)\b/.test(seg) && !/\|\s*head\b/.test(seg)).join(' ; ');
          if (rest && MUTATES_RE.test(rest)) {
            const op = { type: 'sh', cmd: rest, ran: true, creates: appCreates(rest, appDir) };
            ops.push(op);
            pendingVerify.set(c.id, op);
          }
        } else if (MUTATES_RE.test(cmd) && !/^\s*(?:cd\s+\S+\s*&&\s*)?git\b/.test(cmd)) {
          const op = { type: 'sh', cmd, ran: true, creates: appCreates(cmd, appDir) };
          ops.push(op);
          pendingVerify.set(c.id, op);
        }
        else if (/\bui\s+add\b|db[: ]generate/.test(cmd)) ops.push({ type: 'cmd', cmd });
      }
    }
  }
  // The last op that creates a file not written before. A shell `cat > file`
  // counts: outside a repo guard, agents write most files with heredocs.
  const seen = new Set();
  let lastNew = -1;
  ops.forEach((o, i) => {
    const paths = o.type === 'write' ? [o.path] : o.type === 'sh' ? o.creates : [];
    for (const p of paths) if (!seen.has(p)) { seen.add(p); lastNew = i; }
  });
  const cut = ops.findIndex((o, i) => i > lastNew && o.type === 'verify');
  // An edit or a rewrite of a file the agent already wrote, made after a
  // verification run that FAILED, is a correction prompted by that output, so
  // it is dropped. After a passing run the agent is still building, so its
  // edits are part of the draft.
  const written = new Set();
  let afterFailure = false;
  const kept = (cut === -1 ? ops : ops.slice(0, cut)).filter((o) => {
    if (o.type === 'verify') { if (o.ok === false) afterFailure = true; else if (o.ok === true) afterFailure = false; return false; }
    if (o.type === 'write') { const isNew = !written.has(o.path); written.add(o.path); return isNew || !afterFailure; }
    if (o.type === 'sh' && o.creates.length) {
      const isNew = o.creates.some((p) => !written.has(p));
      for (const p of o.creates) written.add(p);
      return isNew || !afterFailure;
    }
    if (o.type === 'edit' || o.type === 'sh' || o.type === 'restore') return !afterFailure;
    return true;
  });
  const firstVerify = cut === -1 ? null : { kind: ops[cut].kind, cmd: ops[cut].cmd };
  return { ops: kept, firstVerify };
}

/**
 * The files a shell command writes whole: `cat > path` / `cat >path` (not an
 * append), with the path as written (relative to where the command runs).
 * @param {string} cmd
 * @returns {string[]}
 */
export function shellCreates(cmd) {
  const out = [];
  for (const m of cmd.matchAll(/\bcat\s*>(?!>)\s*("[^"]+"|'[^']+'|[^\s;&|<>]+)/g)) {
    out.push(m[1].replace(/^["']|["']$/g, ''));
  }
  return out;
}

/**
 * The files a shell command creates INSIDE the app: a relative path, or an
 * absolute one under the app (folded the way `appRelative` folds a Write). A
 * probe script the agent wrote under /tmp is not part of the app.
 * @param {string} cmd @param {string} appDir
 */
function appCreates(cmd, appDir) {
  return shellCreates(cmd)
    .map((p) => (p.startsWith('/') ? appRelative(p, appDir) : p))
    .filter((p) => p);
}

/**
 * The command itself when it writes files as well as verifying (a heredoc
 * write followed by `npx webjs check`); else ''. Splitting it would mangle a
 * heredoc body, so the whole command is replayed, check included.
 * @param {string} cmd
 */
function mutatingPrefix(cmd) {
  return MUTATES_RE.test(cmd) ? cmd : '';
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
    // Always THIS repo's node_modules, so every draft is graded against the
    // current branch: an eval app may link an older framework checkout (an A/B
    // baseline arm does), which would grade the draft against old code.
    symlinkSync(join(REPO, 'node_modules'), join(draft, 'node_modules'));
    for (const f of ['.env', '.env.local']) if (existsSync(join(appDir, f))) cpSync(join(appDir, f), join(draft, f));

    const ranUiAdd = ops.some((o) => o.type === 'cmd' && /\bui\s+add\b/.test(o.cmd));
    const ranDbGenerate = ops.some((o) => o.type === 'cmd' && /db[: ]generate/.test(o.cmd));
    const appPathRe = new RegExp(appDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '(?:/(?:\\.wt-[^/\\s]+|\\.worktrees/[^/\\s]+|\\.claude/worktrees/[^/\\s]+|\\.wt/[^/\\s]+))?', 'g');
    result.shell = 0;
    for (const op of ops) {
      if (op.type === 'cmd') continue;
      if (op.type === 'restore') {
        if (!op.ran) continue;
        try {
          const body = execFileSync('git', ['-C', draft, 'show', `${root}:${op.from}`]);
          mkdirSync(dirname(join(draft, op.path)), { recursive: true });
          writeFileSync(join(draft, op.path), body);
          result.writes++;
        } catch { result.editMisses.push(op.path); }
        continue;
      }
      if (op.type === 'sh') {
        if (!op.ran) continue;
        // A command that starts a server or backgrounds a process changes no
        // source file, and replaying it left the server running after the
        // draft was gone: one held a port a later clean build then collided on.
        if (STARTS_PROCESS_RE.test(op.cmd)) continue;
        const cmd = op.cmd.replace(appPathRe, draft);
        spawnSync('bash', ['-c', cmd], { cwd: draft, encoding: 'utf8', timeout: 60_000, env: { ...process.env, CI: '1' } });
        result.shell++;
        continue;
      }
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
    // The kit files `webjs ui add` copies in are never agent-authored, and an
    // agent may have brought them in several ways (`ui add`, a copy from another
    // checkout, then removing the stray copy), so they always come from the
    // finished app, AFTER the replay so a replayed `rm` cannot remove them.
    void ranUiAdd;
    {
      for (const rel of [...listFiles(join(appDir, 'components/ui')).map((f) => join('components/ui', f)), 'lib/utils/cn.ts', 'lib/utils/dom.ts', 'components.json']) {
        const from = join(appDir, rel);
        if (existsSync(from) && !existsSync(join(draft, rel))) { mkdirSync(dirname(join(draft, rel)), { recursive: true }); cpSync(from, join(draft, rel)); }
      }
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
