#!/usr/bin/env node
/**
 * The agent eval: can an agent write correct WebJs from Lit and Next.js habits
 * plus the five-line brief alone?
 *
 * For each task it scaffolds a fresh app (whose only WebJs documentation is
 * the brief in AGENTS.md), hands the
 * task's prompt to an agent CLI running inside the app, then grades the result
 * with `grade.mjs`. It prints a pass table and writes JSON next to it.
 *
 * Local only, never CI: it calls a real model, so it costs money per run and
 * its results vary from run to run. CI covers the same surfaces
 * deterministically with the muscle-memory corpus in test/muscle-memory/.
 *
 *   node scripts/agent-eval/run.mjs                       # every task, Claude Code
 *   node scripts/agent-eval/run.mjs --task guestbook-action
 *   node scripts/agent-eval/run.mjs --agent "codex exec {prompt}"
 *   node scripts/agent-eval/run.mjs --keep                # keep the apps for inspection
 *
 * `--agent` is a command line; `{prompt}` is replaced by the task prompt as ONE
 * argument. The default runs Claude Code headless with edits allowed.
 */
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { scaffoldApp } from '../../packages/cli/lib/create.js';
import { TASKS } from './tasks.mjs';
import { gradeApp } from './grade.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_AGENT = 'claude -p {prompt} --permission-mode bypassPermissions';

/** @param {string[]} argv */
export function parseArgs(argv) {
  const opts = { agent: DEFAULT_AGENT, tasks: /** @type {string[]} */ ([]), keep: false, out: join(ROOT, 'agent-eval-results.json'), timeoutMs: 15 * 60_000 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--agent') opts.agent = argv[++i];
    else if (a === '--task') opts.tasks.push(argv[++i]);
    else if (a === '--keep') opts.keep = true;
    else if (a === '--out') opts.out = resolve(argv[++i]);
    else if (a === '--timeout') opts.timeoutMs = Number(argv[++i]) * 1000;
    else throw new Error(`unknown argument ${a}`);
  }
  return opts;
}

/**
 * Split an agent command line into argv, putting the prompt in as ONE
 * argument where `{prompt}` stands.
 * @param {string} template @param {string} prompt
 */
export function agentArgv(template, prompt) {
  const parts = template.trim().split(/\s+/);
  if (!parts.includes('{prompt}')) parts.push('{prompt}');
  return parts.map((p) => (p === '{prompt}' ? prompt : p));
}

/**
 * Scaffold an app whose only WebJs documentation is the brief.
 * @param {string} cwd @param {string} name
 */
export async function prepareApp(cwd, name) {
  await scaffoldApp(name, cwd, { template: 'full-stack' });
  const appDir = join(cwd, name);
  await symlink(join(ROOT, 'node_modules'), join(appDir, 'node_modules'));
  return appDir;
}

/**
 * Run one task end to end.
 * @param {import('./tasks.mjs').EvalTask} task
 * @param {{ agent: string, keep: boolean, timeoutMs: number }} opts
 */
export async function runTask(task, opts) {
  const cwd = await mkdtemp(join(tmpdir(), `webjs-eval-${task.id}-`));
  const started = Date.now();
  try {
    const appDir = await prepareApp(cwd, 'app');
    const [cmd, ...args] = agentArgv(opts.agent, task.prompt);
    const run = spawnSync(cmd, args, { cwd: appDir, encoding: 'utf8', timeout: opts.timeoutMs, maxBuffer: 64 * 1024 * 1024 });
    const agentError = run.error ? String(run.error.message) : run.status !== 0 ? `agent exited ${run.status}` : null;
    const grade = await gradeApp(appDir, task.probes);
    return { id: task.id, seconds: Math.round((Date.now() - started) / 1000), agentError, appDir: opts.keep ? appDir : null, ...grade };
  } finally {
    if (!opts.keep) await rm(cwd, { recursive: true, force: true });
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const tasks = opts.tasks.length ? TASKS.filter((t) => opts.tasks.includes(t.id)) : TASKS;
  if (tasks.length === 0) throw new Error(`no task matches ${opts.tasks.join(', ')}`);
  const results = [];
  for (const task of tasks) {
    process.stderr.write(`[agent-eval] ${task.id} ...\n`);
    const r = await runTask(task, opts);
    results.push(r);
    process.stderr.write(`[agent-eval] ${task.id}: ${r.ok ? 'PASS' : 'FAIL'} (${r.seconds}s)\n`);
  }
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n| task | result | check violations | failed probes |\n|---|---|---|---|`);
  for (const r of results) {
    const failed = r.boot ? `boot: ${r.boot}` : r.probes.filter((p) => !p.ok).map((p) => `${p.probe}: ${p.detail}`).join('; ');
    console.log(`| ${r.id} | ${r.ok ? 'pass' : 'FAIL'} | ${r.check.map((v) => v.rule).join(', ') || 'none'} | ${failed || 'none'} |`);
  }
  console.log(`\n${passed}/${results.length} tasks passed.`);
  await writeFile(opts.out, JSON.stringify({ agent: opts.agent, passed, total: results.length, results }, null, 2));
  process.exitCode = passed === results.length ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exitCode = 2; });
}
