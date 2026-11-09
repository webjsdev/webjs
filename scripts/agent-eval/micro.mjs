#!/usr/bin/env node
/**
 * Micro-evals (#1686): a model's FIRST draft of one small, habit-shaped feature,
 * at a fraction of a full build's cost. Each task runs in a fresh scaffold set
 * up exactly as `build.mjs` sets one up (outside the repo, only the scaffold's
 * own settings, the framework linked as npm installs it; the app folder is
 * `site`, since one named `app` made every path read `app/app/...`). The agent may read
 * and write files but runs NO command, so it cannot iterate: what it writes is
 * its first draft. Turns are capped.
 *
 *   node scripts/agent-eval/micro.mjs --list                     # the tasks, no model call
 *   node scripts/agent-eval/micro.mjs --task guestbook            # one task
 *   node scripts/agent-eval/micro.mjs                             # every task
 *   node scripts/agent-eval/micro.mjs --framework <checkout> --label before
 *
 * Graded per task: `webjs check`, `webjs typecheck`, and `webjs status --boot`
 * on the routes the task names (a 5xx, or any 4xx on a named path, fails).
 * Results go to `<out>/<label>-<task>/result.json` and a table.
 *
 * Local only: it calls a model. `--list` and `--no-agent` cost nothing.
 */
import { writeFileSync, readFileSync, existsSync, readdirSync, createWriteStream } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareApp, agentEnv, assertNoAncestorInstructions, metricsOf } from './build.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Each task: a request a person would write, naming no WebJs API, and the routes it must serve. */
export const TASKS = [
  {
    id: 'guestbook',
    prompt: 'Add a guestbook at /guestbook. It lists the entries saved in the app\'s database (add a table for them), newest first, and has a form (name and message) that saves a new entry and also works with JavaScript disabled. Submitting an empty message shows an error on the same page and keeps what was typed.',
    paths: ['/guestbook'],
  },
  {
    id: 'like-button',
    prompt: 'Add a reusable like-button component: it shows a heart and a count, adds one to the count when clicked, and reflects whether it has been liked as an attribute so CSS can style the liked state. Use it on the home page with a starting count of 3.',
    paths: ['/'],
  },
  {
    id: 'json-api',
    prompt: 'Add a JSON API for products stored in the app\'s database (add the table). GET /api/products returns the products, filtered by an optional ?q= (case-insensitive match on the name) and by any number of ?tag= values (a product must have every tag given). POST /api/products takes a JSON body { name, tags } and answers 201 with the created product, or 400 when the name is missing.',
    paths: ['/api/products', '/api/products?q=a&tag=x&tag=y'],
  },
  {
    id: 'auth',
    prompt: 'Add email and password accounts: a /signup page and a /login page (both forms work with JavaScript disabled), users stored in the app\'s database with hashed passwords, a log-out button, and a /dashboard page that shows the signed-in user\'s email. A signed-out visitor to /dashboard is sent to /login.',
    paths: ['/signup', '/login', '/dashboard'],
  },
  {
    id: 'blog',
    prompt: 'Add a small blog with posts stored in the app\'s database (seed two posts). /posts lists them and /posts/[slug] shows one post, with the post\'s title as the page title. An unknown slug shows a custom not-found page, and the post page has a loading state.',
    paths: ['/posts'],
  },
  {
    id: 'live-stats',
    prompt: 'Add a /stats page with a component that shows the number of rows in the app\'s users table and the current server time, and refreshes both every 10 seconds without reloading the page. The page must show real numbers on first load, before any JavaScript runs.',
    paths: ['/stats'],
  },
  {
    id: 'theme-cookie',
    prompt: 'Add a /settings page with a form to choose a light or dark theme (it works with JavaScript disabled). The choice is remembered in a cookie and applied to the <html> element of every page of the site.',
    paths: ['/settings', '/'],
  },
  {
    id: 'todos',
    prompt: 'Add a /todos page backed by the app\'s database (add the table). A form adds a todo and works with JavaScript disabled. Each todo has a checkbox that marks it done: with JavaScript the change shows at once and is then saved on the server, and it is undone with a message if saving fails.',
    paths: ['/todos'],
  },
];

/** The prompt frame: the task, and that the draft is all there is. */
export function microPrompt(task, appDir) {
  return `You are working in a WebJs app at:

  ${appDir}

Work only inside that directory. Read its AGENTS.md first. Then:

${task.prompt}

You cannot run any command in this session (no shell, no tests, no dev server), so write the code right the first time. Dependencies are already installed. When you are done, reply with the list of files you wrote.`;
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function grade(app, cli, paths) {
  const run = (args) => {
    const r = spawnSync(process.execPath, [cli, ...args], { cwd: app, encoding: 'utf8', timeout: 300_000, env: { ...process.env, CI: '1', NODE_TEST_CONTEXT: '' } });
    return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
  };
  // A migration for any table the draft added, the way `npm run dev` would
  // generate and apply one before serving (the agent could not run it).
  run(['db', 'generate']);
  run(['db', 'migrate']);
  const check = run(['check']);
  const typecheck = run(['typecheck']);
  const status = run(['status', '--boot', ...paths]);
  const lines = (o, re) => o.out.split('\n').filter((l) => re.test(l)).slice(0, 8);
  return {
    check: check.ok, typecheck: typecheck.ok, routes: status.ok,
    detail: {
      check: lines(check, /✗|violation|rule/),
      typecheck: lines(typecheck, /error TS/),
      routes: lines(status, /\b[45]\d\d\b|error|Error/),
    },
  };
}

async function runTask(task, { framework, out, model, label, maxTurns }) {
  const parent = join(out, `${label}-${task.id}`);
  const app = await prepareApp({ framework, parent, appName: 'site' });
  const transcript = join(parent, 'transcript.jsonl');
  const args = ['-p', microPrompt(task, app), '--model', model, '--output-format', 'stream-json', '--verbose',
    '--permission-mode', 'bypassPermissions', '--setting-sources', 'project,local',
    '--strict-mcp-config', '--mcp-config', join(app, '.claude.json'), '--no-session-persistence',
    '--max-turns', String(maxTurns),
    '--disallowedTools', 'Bash', 'BashOutput', 'KillShell', 'Task', 'WebFetch', 'WebSearch'];
  if (process.argv.includes('--no-agent')) writeFileSync(transcript, '');
  else await new Promise((done) => {
    const child = spawn('claude', args, { cwd: app, env: agentEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(createWriteStream(transcript));
    child.stderr.pipe(createWriteStream(join(parent, 'stderr.log')));
    const timer = setTimeout(() => child.kill('SIGTERM'), 900_000);
    child.on('close', () => { clearTimeout(timer); done(); });
  });
  const m = metricsOf(transcript);
  const result = { task: task.id, label, model, framework, toolCalls: m.toolCalls, inputTokens: m.inputTokens, outputTokens: m.outputTokens, ...grade(app, join(framework, 'packages/cli/bin/webjs.js'), task.paths) };
  writeFileSync(join(parent, 'result.json'), JSON.stringify(result, null, 2));
  return result;
}

const yn = (v) => (v ? 'pass' : 'FAIL');

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (process.argv.includes('--list')) {
    for (const t of TASKS) console.log(`${t.id.padEnd(13)} ${t.paths.join(' ')}\n  ${t.prompt}\n`);
    process.exit(0);
  }
  const out = resolve(arg('out', '/var/tmp/webjs-micro'));
  assertNoAncestorInstructions(out);
  const only = arg('task');
  const tasks = only ? TASKS.filter((t) => only.split(',').includes(t.id)) : TASKS;
  const opts = { framework: resolve(arg('framework', REPO)), out, model: arg('model', 'haiku'), label: arg('label', 'after'), maxTurns: Number(arg('max-turns', '15')) };
  const jobs = Number(arg('jobs', '4'));
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, tasks.length) }, async () => {
    while (next < tasks.length) results.push(await runTask(tasks[next++], opts));
  }));
  results.sort((a, b) => a.task.localeCompare(b.task));
  console.log('task          check typecheck routes | calls  in(K) out(K)');
  for (const r of results) {
    console.log(`${r.task.padEnd(13)} ${yn(r.check).padEnd(5)} ${yn(r.typecheck).padEnd(9)} ${yn(r.routes).padEnd(6)} | ${String(r.toolCalls).padEnd(6)} ${String(Math.round(r.inputTokens / 1000)).padEnd(5)} ${Math.round(r.outputTokens / 1000)}`);
    for (const k of ['check', 'typecheck', 'routes']) for (const l of r.detail[k]) if (!r[k]) console.log(`    ${k}: ${l.trim().slice(0, 160)}`);
  }
  const all = results.filter((r) => r.check && r.typecheck && r.routes).length;
  console.log(`first draft right on all three: ${all}/${results.length}; input ${Math.round(results.reduce((a, r) => a + r.inputTokens, 0) / 1000)}K tokens`);
}
