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
 * `--strict-mcp-config` over a copy of the app's own `.claude.json` (Playwright
 * pointed at the system Chromium), with a TMPDIR of its own. The transcript is
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
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, symlinkSync, readdirSync, readlinkSync, lstatSync, unlinkSync, rmSync, createWriteStream } from 'node:fs';
import { createServer } from 'node:net';
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

When done, verify it yourself: \`npx webjs check\` must report no violations, \`npx webjs typecheck\` must pass, \`npm test\` must pass, and the app must boot and serve its routes. If you start a server, use port ${port}, and stop it before you finish: leave no server running.

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
  let costUsd = null;
  // stream-json repeats one API message once per content block (thinking,
  // text, tool_use), each carrying the same id, so usage is counted once per
  // message id. Counting it per event inflated input 2.2 to 2.9 times and
  // tracked how much an agent narrated (#1697). A later event of a message can
  // report more output than the first (it is written as the message streams),
  // so each field keeps its largest value seen for the id.
  /** @type {Map<string, { input: number, output: number }>} */
  const perMessage = new Map();
  let durationMs = 0;
  let resultText = '';
  for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!line) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.type === 'result') { durationMs = e.duration_ms || 0; resultText = e.result || ''; costUsd = e.total_cost_usd ?? null; continue; }
    const content = e.message?.content;
    if (!Array.isArray(content)) continue;
    if (e.type === 'assistant') {
      const u = e.message.usage || {};
      const input = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
      const output = u.output_tokens || 0;
      const id = e.message.id;
      if (!id) {
        inputTokens += input;
        outputTokens += output;
      } else {
        const seen = perMessage.get(id) || { input: 0, output: 0 };
        perMessage.set(id, { input: Math.max(seen.input, input), output: Math.max(seen.output, output) });
      }
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
  for (const m of perMessage.values()) { inputTokens += m.input; outputTokens += m.output; }
  return { firsts, rework, toolCalls, inputTokens, outputTokens, costUsd, minutes: Math.round(durationMs / 600) / 100, report: resultText };
}

function grade(appDir, cli) {
  const run = (args) => {
    const r = spawnSync(process.execPath, [cli, ...args], { cwd: appDir, encoding: 'utf8', timeout: 600_000, env: { ...process.env, CI: '1', NODE_TEST_CONTEXT: '' } });
    return r.status === 0;
  };
  return { check: run(['check']), typecheck: run(['typecheck']), test: run(['test', '--server']) };
}

/**
 * A fresh app for one run: the framework checkout's own scaffold, committed as
 * the root commit, on a feature branch, with the framework linked as npm would
 * install it.
 * @param {{ framework: string, parent: string, appName: string }} opts
 * @returns {Promise<string>} the app directory
 */
export async function prepareApp({ framework, parent, appName, template = 'full-stack', db }) {
  mkdirSync(parent, { recursive: true });
  const { scaffoldApp } = await import(pathToFileURL(join(framework, 'packages/cli/lib/create.js')).href);
  const log = console.log;
  console.log = () => {};
  try { await scaffoldApp(appName, parent, { template, install: false, skipCi: true, ...(db ? { db } : {}) }); } finally { console.log = log; }
  const app = join(parent, appName);
  // The scaffold is the root commit, made with the app's own hooks off (its
  // pre-commit hook refuses a commit on main) and BEFORE node_modules is
  // linked, so the link is never staged. The agent works on a feature branch,
  // as a person starting work would.
  const git = (...a) => spawnSync('git', ['-c', 'user.email=a@a', '-c', 'user.name=eval', '-c', 'core.hooksPath=/dev/null', ...a], { cwd: app, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-q', '-m', 'scaffold');
  git('checkout', '-q', '-b', `feature/${appName}`);
  linkNodeModules(framework, app);
  return app;
}

/**
 * The environment a headless agent runs in: none of this session's markers,
 * and, given a build directory, a temp directory of its own. Concurrent builds
 * shared /tmp, so one build's curl cookie jar was read by another, which then
 * chased a session it never created for about 45 turns. The directory is a
 * short one under /tmp, linked from `<buildDir>/tmp`: inside the build
 * directory its path was long enough that Playwright's socket under it passed
 * the 108-byte Unix socket limit, and the browser never launched (#1697, nine
 * turns over four builds).
 * @param {string} [buildDir]
 */
export function agentEnv(buildDir) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith('CLAUDE_CODE') || k === 'CLAUDECODE') delete env[k];
  if (buildDir) {
    mkdirSync(buildDir, { recursive: true });
    const tmp = mkdtempSync(join(existsSync('/tmp') ? '/tmp' : tmpdir(), 'wje-'));
    // A re-run into the same build dir finds the previous link: lstat sees it
    // even when its /tmp target is gone (existsSync follows it and says no,
    // so symlinkSync then threw EEXIST). It is replaced, and the previous
    // run's temp dir removed, so the link always names this run's TMPDIR
    // and old wje-* dirs do not pile up. A real directory (a build dir from
    // before the link) is left alone.
    const link = join(buildDir, 'tmp');
    let previous = null;
    try { previous = lstatSync(link); } catch { /* none yet */ }
    if (previous?.isSymbolicLink()) {
      const old = readlinkSync(link);
      unlinkSync(link);
      if (/\/wje-[^/]+$/.test(old)) rmSync(old, { recursive: true, force: true });
      previous = null;
    }
    if (!previous) symlinkSync(tmp, link);
    env.TMPDIR = env.TMP = env.TEMP = tmp;
  }
  return env;
}

/**
 * A port nothing is listening on, from the OS. Builds started as separate
 * runs used the same fixed port base, so two dev servers met on one port and
 * an agent wrote into another build's database (#1697, eleven turns).
 * @returns {Promise<number>}
 */
export function freePort() {
  return new Promise((ok, fail) => {
    const srv = createServer();
    srv.once('error', fail);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = /** @type {import('node:net').AddressInfo} */ (srv.address());
      srv.close(() => ok(port));
    });
  });
}

/** Where the eval host keeps a system Chromium, which Playwright's MCP cannot find on its own. */
export const SYSTEM_CHROMIUM = '/usr/bin/chromium';

/**
 * The MCP config a build's agent runs with: the app's own `.claude.json`, with
 * the Playwright server pointed at the system Chromium when there is one. In 18
 * builds the Playwright tool looked for its own Chrome download, found none,
 * and the agent fell back to curl. Written beside the app, never into it, so
 * the scaffold the agent commits stays the one users get.
 * @param {string} app the app directory
 * @param {string} buildDir where to write the copy
 * @param {string | null} [chromium] the browser binary, or null for none
 * @returns {string} the config path to pass to --mcp-config
 */
export function evalMcpConfig(app, buildDir, chromium = existsSync(SYSTEM_CHROMIUM) ? SYSTEM_CHROMIUM : null) {
  const config = JSON.parse(readFileSync(join(app, '.claude.json'), 'utf8'));
  const pw = config.mcpServers && config.mcpServers.playwright;
  if (pw && chromium && !(pw.args || []).includes('--executable-path')) {
    pw.args = [...(pw.args || []), '--executable-path', chromium];
  }
  const file = join(buildDir, 'mcp.json');
  writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
  return file;
}

async function oneBuild({ spec, specName, index, out, framework, model, label, timeoutS, port }) {
  const name = `${label}-${specName}${index}`;
  const parent = join(out, name);
  const app = await prepareApp({ framework, parent, appName: specName });
  const transcript = join(parent, 'transcript.jsonl');
  const env = agentEnv(parent);
  const args = ['-p', promptFor(spec, app, port), '--model', model, '--output-format', 'stream-json', '--verbose',
    '--permission-mode', 'bypassPermissions', '--setting-sources', 'project,local',
    '--strict-mcp-config', '--mcp-config', evalMcpConfig(app, parent), '--no-session-persistence'];
  const started = Date.now();
  // --no-agent: scaffold, link and grade the untouched app, calling no model
  // (checks the runner's layout for free).
  if (process.argv.includes('--no-agent')) writeFileSync(transcript, '');
  else await new Promise((done) => {
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
export function linkNodeModules(framework, app) {
  const src = join(framework, 'node_modules');
  const dst = join(app, 'node_modules');
  mkdirSync(dst);
  for (const name of readdirSync(src)) {
    if (name === '.bin') { linkBin(join(src, name), join(dst, name)); continue; }
    if (name !== '@webjsdev') { symlinkSync(join(src, name), join(dst, name)); continue; }
    mkdirSync(join(dst, name));
    for (const pkg of readdirSync(join(src, name))) {
      if (WORKSPACE_APPS.has(pkg)) continue;
      linkPublished(join(src, name, pkg), join(dst, name, pkg));
    }
  }
}

/**
 * `node_modules/.bin`, entry by entry. npm writes each bin as a relative link
 * (`../@webjsdev/cli/bin/webjs.js`), and linking the directory whole resolved
 * those against the checkout it physically lives in, so in a linked worktree
 * every eval app's `npx webjs` ran the PRIMARY checkout's CLI instead of the
 * framework under test (#1697). A framework package's bin keeps its relative
 * target, which now lands on the app's own link to that package; any other
 * bin links to the original entry.
 * @param {string} srcBin @param {string} dstBin
 */
function linkBin(srcBin, dstBin) {
  mkdirSync(dstBin);
  for (const entry of readdirSync(srcBin)) {
    const from = join(srcBin, entry);
    let target = null;
    try { target = readlinkSync(from); } catch { /* a real file */ }
    if (target && target.startsWith('../@webjsdev/')) symlinkSync(target, join(dstBin, entry));
    else symlinkSync(from, join(dstBin, entry));
  }
}

/**
 * A framework package as npm would install it: its `package.json` and the
 * entries its `files` list publishes (plus its own nested `node_modules`), each
 * linked, never the contributor files beside them. A checkout carries
 * `AGENTS.md`, `CLAUDE.md` and `test/` in every package, and Claude Code loads
 * a CLAUDE.md from a directory the agent works in, so a whole-directory link
 * handed the agent a 2,000-line contributor guide no real install has.
 * @param {string} pkgDir @param {string} dst
 */
function linkPublished(pkgDir, dst) {
  let files = null;
  try { files = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).files; } catch { /* no manifest */ }
  if (!Array.isArray(files)) { symlinkSync(pkgDir, dst); return; }
  mkdirSync(dst);
  for (const entry of ['package.json', 'node_modules', ...files]) {
    const from = join(pkgDir, entry.replace(/\/$/, ''));
    const to = join(dst, entry.replace(/\/$/, ''));
    if (!existsSync(from) || existsSync(to)) continue;
    mkdirSync(dirname(to), { recursive: true });
    symlinkSync(from, to);
  }
}

/**
 * Claude Code reads a CLAUDE.md (and an AGENTS.md through it) from every
 * directory above the working one, so a build under `~/.claude/` would carry
 * the machine owner's own instructions. Refuse an output directory with one
 * above it.
 * @param {string} out
 */
export function assertNoAncestorInstructions(out) {
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
  console.log('build                 first: check type test | draft: check type test | final: check type test | rework calls  in(M) cost  min');
  for (const r of results) {
    const f = r.firsts || {};
    console.log(`${r.name.padEnd(21)} ${yn(f.check).padEnd(5)} ${yn(f.typecheck).padEnd(4)} ${yn(f.test).padEnd(4)}  | ${yn(r.draft?.check).padEnd(5)} ${yn(r.draft?.typecheck).padEnd(4)} ${yn(r.draft?.test).padEnd(4)}  | ${yn(r.final?.check).padEnd(5)} ${yn(r.final?.typecheck).padEnd(4)} ${yn(r.final?.test).padEnd(4)}  | ${String(r.rework).padEnd(6)} ${String(r.toolCalls).padEnd(5)} ${(r.inputTokens / 1e6).toFixed(1).padEnd(5)} ${(r.costUsd == null ? '-' : '$' + r.costUsd.toFixed(2)).padEnd(5)} ${r.wallMinutes}`);
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
  if (!specName) { console.error('usage: build.mjs --spec <roomly|pollster|trackr|inbox> [--runs N] [--jobs N] [--model haiku] [--framework <checkout>] [--label after] [--out <dir>] [--port-base <n>]'); process.exit(2); }
  const spec = readFileSync(join(HERE, 'specs', `${specName}.md`), 'utf8');
  const runs = Number(arg('runs', '1'));
  const jobs = Number(arg('jobs', '3'));
  const out = resolve(arg('out', join('/var/tmp', 'webjs-builds')));
  assertNoAncestorInstructions(out);
  const opts = { spec, specName, out, framework: resolve(arg('framework', REPO)), model: arg('model', 'haiku'), label: arg('label', 'after'), timeoutS: Number(arg('timeout', '5400')) };
  // Each build asks the OS for a free port; --port-base pins them instead.
  const portBase = arg('port-base') ? Number(arg('port-base')) : null;
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, runs) }, async (_, w) => {
    while (next < runs) {
      const index = ++next;
      const port = portBase === null ? await freePort() : portBase + index * 10 + w;
      results.push(await oneBuild({ ...opts, index, port }));
    }
  }));
  results.sort((a, b) => a.name.localeCompare(b.name));
  printTable(results);
}
