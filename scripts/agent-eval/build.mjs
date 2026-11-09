#!/usr/bin/env node
/**
 * Clean multi-feature builds (#1686): a headless agent builds one spec from
 * `specs/` in a fresh scaffold OUTSIDE this repo, with only the scaffold's own
 * settings, hooks and MCP servers, and the run is graded on how close it came
 * to right the first time.
 *
 *   node scripts/agent-eval/build.mjs --spec roomly                     # 1 build, Haiku
 *   node scripts/agent-eval/build.mjs --spec inbox --runs 3 --jobs 3
 *   node scripts/agent-eval/build.mjs --spec roomly --framework ../webjs-main --label before
 *   node scripts/agent-eval/build.mjs --summary <out-dir>               # re-read finished builds
 *
 * Each build: scaffold with the framework checkout's own `webjs create`, link
 * that checkout's `node_modules`, commit the scaffold as the root commit, then
 * run `claude -p` in the app with `--setting-sources project,local` (the
 * machine's user settings, hooks and CLAUDE.md never apply) and
 * `--strict-mcp-config` over the app's own `.claude.json`. The transcript is
 * stream-json, the same shape `replay.mjs` reads.
 *
 * Graded per build, into `<out>/<build>/result.json` and the printed table:
 *   - first: whether the agent's FIRST `webjs check`, typecheck and test run
 *     each passed (read from the transcript's tool results);
 *   - final: this branch's check, typecheck and tests on the finished app;
 *   - draft: the first draft replayed and graded (`replay.mjs`);
 *   - rework: edits to a file the agent wrote, after its first failed check;
 *   - cost: tool calls, input / output tokens, minutes.
 *
 * Local only: it calls a model and costs money per build.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, readdirSync, createWriteStream } from 'node:fs';
import { parse as parsePath } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyKind, verifyPassed, replayBuild } from './replay.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** The prompt: the spec inside a frame naming no WebJs API beyond its CLI. */
export function promptFor(spec, appDir, port) {
  return `You are building a real full-stack web app with WebJs, a framework you may not know well. A fresh app has already been scaffolded for you at:

  ${appDir}

Work ONLY inside that directory. Start by reading its AGENTS.md. Dependencies are preinstalled through a linked node_modules, so never run npm install / npm ci, and pass --no-deps to any UI kit add command. You are on a git feature branch; commit as you go (git -c user.email=a@a -c user.name=agent commit ...).

${spec.trim()}

When done, verify it yourself: \`npx webjs check\` must report no violations, \`npx webjs typecheck\` must pass, \`npm test\` must pass, and the app must boot (\`npx webjs dev --port ${port}\`, then exercise the routes with curl, then STOP the server). Do not leave any server running.

Then reply with a short report: what you built, the verification results, and every point of friction (anything in WebJs that did not work the way your Lit / Next.js habits expected).`;
}

/** Read a stream-json transcript into the per-build metrics. */
export function metricsOf(transcriptPath) {
  const firsts = { check: null, typecheck: null, test: null };
  const pending = new Map();
  const written = new Set();
  let firstFailedVerify = false;
  let rework = 0;
  let toolCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let durationMs = 0;
  let resultText = '';
  for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.type === 'result') { durationMs = e.duration_ms || 0; resultText = e.result || ''; continue; }
    const content = e.message?.content;
    if (!Array.isArray(content)) continue;
    if (e.type === 'assistant') {
      const u = e.message.usage || {};
      inputTokens += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
      outputTokens += u.output_tokens || 0;
      for (const c of content) {
        if (c?.type !== 'tool_use') continue;
        toolCalls++;
        const inp = c.input || {};
        if (c.name === 'Bash') {
          const kind = verifyKind(String(inp.command || ''));
          if (kind) pending.set(c.id, kind);
        } else if (c.name === 'Write' || c.name === 'Edit' || c.name === 'MultiEdit') {
          const p = inp.file_path || '';
          if (written.has(p) && firstFailedVerify) rework++;
          written.add(p);
        }
      }
    } else if (e.type === 'user') {
      for (const c of content) {
        if (c?.type !== 'tool_result' || !pending.has(c.tool_use_id)) continue;
        const kind = pending.get(c.tool_use_id);
        const out = typeof c.content === 'string' ? c.content : (c.content || []).map((x) => x?.text || '').join('\n');
        const ok = !c.is_error && verifyPassed(kind, out);
        if (firsts[kind] === null) firsts[kind] = ok;
        if (!ok) firstFailedVerify = true;
      }
    }
  }
  return { firsts, rework, toolCalls, inputTokens, outputTokens, minutes: Math.round(durationMs / 600) / 100, report: resultText };
}

function grade(appDir, cli) {
  const run = (args) => {
    const r = spawnSync(process.execPath, [cli, ...args], { cwd: appDir, encoding: 'utf8', timeout: 600_000, env: { ...process.env, CI: '1', NODE_TEST_CONTEXT: '' } });
    return r.status === 0;
  };
  return { check: run(['check']), typecheck: run(['typecheck']), test: run(['test', '--server']) };
}

async function oneBuild({ spec, specName, index, out, framework, model, label, timeoutS, port }) {
  const name = `${label}-${specName}${index}`;
  const parent = join(out, name);
  mkdirSync(parent, { recursive: true });
  const { scaffoldApp } = await import(pathToFileURL(join(framework, 'packages/cli/lib/create.js')).href);
  const log = console.log;
  console.log = () => {};
  try { await scaffoldApp(specName, parent, { template: 'full-stack', install: false, skipCi: true }); } finally { console.log = log; }
  const app = join(parent, specName);
  // The scaffold is the root commit, made with the app's own hooks off (its
  // pre-commit hook refuses a commit on main) and BEFORE node_modules is
  // linked, so the link is never staged. The agent works on a feature branch,
  // as a person starting work would.
  const git = (...a) => spawnSync('git', ['-c', 'user.email=a@a', '-c', 'user.name=eval', '-c', 'core.hooksPath=/dev/null', ...a], { cwd: app, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-q', '-m', 'scaffold');
  git('checkout', '-q', '-b', `feature/${specName}`);
  linkNodeModules(framework, app);
  const transcript = join(parent, 'transcript.jsonl');
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith('CLAUDE_CODE') || k === 'CLAUDECODE') delete env[k];
  const args = ['-p', promptFor(spec, app, port), '--model', model, '--output-format', 'stream-json', '--verbose',
    '--permission-mode', 'bypassPermissions', '--setting-sources', 'project,local',
    '--strict-mcp-config', '--mcp-config', join(app, '.claude.json'), '--no-session-persistence'];
  const started = Date.now();
  await new Promise((done) => {
    const child = spawn('claude', args, { cwd: app, env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(createWriteStream(transcript));
    child.stderr.pipe(createWriteStream(join(parent, 'stderr.log')));
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutS * 1000);
    child.on('close', () => { clearTimeout(timer); done(); });
  });
  const cli = join(framework, 'packages/cli/bin/webjs.js');
  const result = {
    name, spec: specName, model, framework, wallMinutes: Math.round((Date.now() - started) / 600) / 100,
    ...metricsOf(transcript),
    final: grade(app, cli),
    draft: (() => { try { const d = replayBuild({ name, transcript, app }); return { check: d.check?.ok ?? null, typecheck: d.typecheck?.ok ?? null, test: d.test?.ok ?? null }; } catch (e) { return { error: String(e) }; } })(),
  };
  writeFileSync(join(parent, 'result.json'), JSON.stringify(result, null, 2));
  return result;
}

/**
 * The workspace apps this monorepo's `node_modules` carries under
 * `@webjsdev/` (the blog example, the gallery, the website). A real install
 * has none of them, and an agent that finds one learns from it instead of
 * from the brief, so the build never sees them.
 */
const WORKSPACE_APPS = new Set(['example-blog', 'gallery', 'website']);

/**
 * Give the app a `node_modules` of links to the framework checkout's, minus
 * the workspace apps.
 * @param {string} framework @param {string} app
 */
function linkNodeModules(framework, app) {
  const src = join(framework, 'node_modules');
  const dst = join(app, 'node_modules');
  mkdirSync(dst);
  for (const name of readdirSync(src)) {
    if (name !== '@webjsdev') { symlinkSync(join(src, name), join(dst, name)); continue; }
    mkdirSync(join(dst, name));
    for (const pkg of readdirSync(join(src, name))) {
      if (!WORKSPACE_APPS.has(pkg)) symlinkSync(join(src, name, pkg), join(dst, name, pkg));
    }
  }
}

/**
 * Claude Code reads a CLAUDE.md (and an AGENTS.md through it) from every
 * directory above the working one, so a build under `~/.claude/` would carry
 * the machine owner's own instructions. Refuse an output directory with one
 * above it.
 * @param {string} out
 */
function assertNoAncestorInstructions(out) {
  let dir = resolve(out);
  const { root } = parsePath(dir);
  while (dir !== root) {
    for (const f of ['CLAUDE.md', 'AGENTS.md']) {
      if (existsSync(join(dir, f))) throw new Error(`build.mjs: ${join(dir, f)} sits above --out, so every build would load it. Pick an output directory outside it (the default is under /var/tmp).`);
    }
    dir = dirname(dir);
  }
}

const yn = (v) => (v === true ? 'pass' : v === false ? 'FAIL' : '-');

function printTable(results) {
  console.log('build                 first: check type test | draft: check type test | final: check type test | rework calls  in(M) min');
  for (const r of results) {
    const f = r.firsts || {};
    console.log(`${r.name.padEnd(21)} ${yn(f.check).padEnd(5)} ${yn(f.typecheck).padEnd(4)} ${yn(f.test).padEnd(4)}  | ${yn(r.draft?.check).padEnd(5)} ${yn(r.draft?.typecheck).padEnd(4)} ${yn(r.draft?.test).padEnd(4)}  | ${yn(r.final?.check).padEnd(5)} ${yn(r.final?.typecheck).padEnd(4)} ${yn(r.final?.test).padEnd(4)}  | ${String(r.rework).padEnd(6)} ${String(r.toolCalls).padEnd(5)} ${(r.inputTokens / 1e6).toFixed(1).padEnd(5)} ${r.wallMinutes}`);
  }
  const all3 = (o) => o && o.check === true && o.typecheck === true && o.test === true;
  console.log(`first attempt all three: ${results.filter((r) => all3(r.firsts)).length}/${results.length}; draft all three: ${results.filter((r) => all3(r.draft)).length}/${results.length}; final all three: ${results.filter((r) => all3(r.final)).length}/${results.length}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const summary = arg('summary');
  if (summary) {
    const results = readdirSync(summary).map((d) => join(summary, d, 'result.json')).filter(existsSync).map((f) => JSON.parse(readFileSync(f, 'utf8')));
    printTable(results);
    process.exit(0);
  }
  const specName = arg('spec');
  if (!specName) { console.error('usage: build.mjs --spec <roomly|pollster|trackr|inbox> [--runs N] [--jobs N] [--model haiku] [--framework <checkout>] [--label after] [--out <dir>]'); process.exit(2); }
  const spec = readFileSync(join(HERE, 'specs', `${specName}.md`), 'utf8');
  const runs = Number(arg('runs', '1'));
  const jobs = Number(arg('jobs', '3'));
  const out = resolve(arg('out', join('/var/tmp', 'webjs-builds')));
  assertNoAncestorInstructions(out);
  const opts = { spec, specName, out, framework: resolve(arg('framework', REPO)), model: arg('model', 'haiku'), label: arg('label', 'after'), timeoutS: Number(arg('timeout', '5400')) };
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, runs) }, async (_, w) => {
    while (next < runs) {
      const index = ++next;
      results.push(await oneBuild({ ...opts, index, port: 8900 + index * 10 + w }));
    }
  }));
  results.sort((a, b) => a.name.localeCompare(b.name));
  printTable(results);
}
