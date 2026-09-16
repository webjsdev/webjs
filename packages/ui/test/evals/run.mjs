#!/usr/bin/env node
/**
 * The `webjsui lint` measurement gate (#1478, D10). NOT part of `npm test`:
 * the package script globs `test/*.test.js` and the root walker collects
 * `*.test.js` / `*.test.mjs`, so this file is never executed by either. It
 * spends model budget and needs the signed-in `claude` CLI, so it runs on
 * demand, and its result is recorded as a comment on the issue.
 *
 * The question it answers is the one shadcn's `docs/evals.md` answers for
 * `@shadcn/lint`: does a diagnostic at the line, naming the app's own tokens
 * and variants, converge an agent in fewer correction rounds than the same
 * rules as prose? Three arms per task, so the diagnostics are isolated from
 * the rules text:
 *
 *   before      the agent performs the task, no linter anywhere.
 *   after       a fresh agent starts from that exact output, receives the
 *               task, the rule descriptions and `webjsui lint --json`
 *               diagnostics, for up to three correction rounds.
 *   rules only  the control: same starting output, same rules text, same
 *               three rounds, NO diagnostics. The agent reviews its own file
 *               and a hidden lint check decides whether it gets another round.
 *
 * Each arm is one `claude -p <prompt> --model <id> --output-format json` call
 * spawned with `cwd` set to a scratch copy of `gallery`, with `--allowedTools`
 * limited to file reads and edits so the agent cannot run the linter itself
 * on the arms that must not see it. `gallery` ships no `components.json`, so
 * the copy gets one written here (D10), with all three rules at `warn`.
 *
 * The gate: `after` rounds strictly lower than `rules only` on at least two of
 * the three models measured (`claude-sonnet-5`, `claude-opus-5`,
 * `claude-haiku-4-5-20251001`, the same three shadcn measured), with findings
 * reaching zero on the `after` arm. Only a positive gate adds the skill
 * pointer, the scaffold `lint` block and the `webjs.ci` step (phase 3).
 *
 * Usage, from the repo root:
 *   node packages/ui/test/evals/run.mjs --model claude-sonnet-5 [--tasks temptation|neutral|all] [--rounds 3] [--keep]
 */

import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../../..');
const GALLERY = join(REPO, 'gallery');
const WEBJSUI = join(REPO, 'packages/ui/bin/webjsui.js');

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args.set(a.slice(2), process.argv[i + 1]?.startsWith('--') || process.argv[i + 1] === undefined ? true : process.argv[++i]);
}
const MODEL = args.get('model');
if (typeof MODEL !== 'string') {
  console.error('usage: node packages/ui/test/evals/run.mjs --model <claude-sonnet-5|claude-opus-5|claude-haiku-4-5-20251001> [--tasks temptation|neutral|all] [--rounds 3] [--keep]');
  process.exit(1);
}
const ROUNDS = Number(args.get('rounds') ?? 3);
const TASK_SET = args.get('tasks') ?? 'all';
const KEEP = args.get('keep') === true;

const LINT_BLOCK = {
  rules: {
    'no-raw-colors': 'warn',
    'no-arbitrary-values': { severity: 'warn', allow: ['layout'] },
    'no-restyle': { severity: 'warn', allow: ['layout', 'rounded'] },
  },
};

const RULES_TEXT = `Design-system rules for this app (Tailwind + the copied ui kit in components/ui/):
1. no-raw-colors: never use a Tailwind palette colour utility (text-red-600, bg-sky-500, border-gray-200, ...). Use the app's theme tokens declared in public/input.css instead (text-destructive, text-muted-foreground, bg-primary, border-border, ...).
2. no-arbitrary-values: never use an arbitrary value in brackets for spacing, colour, typography, shape, effects or motion (p-[13px], text-[#333], rounded-[14px], ring-[3px]). Use a theme scale step. Layout values (w-[...], h-[...]) are allowed. Arbitrary VARIANTS ([&_svg]:size-4) are fine.
3. no-restyle: do not compose classes over a kit helper (cn(buttonClass(), 'bg-pink-500') or class="\${buttonClass()} rounded-xl"). Pick a variant or size the helper exposes. Layout classes (w-, h-, m-, flex, ...) and the plain rounded-* radius group are allowed beside a helper.`;

function loadTasks() {
  const sets = TASK_SET === 'all' ? ['temptation', 'neutral'] : [TASK_SET];
  return sets.flatMap((s) => JSON.parse(readFileSync(join(HERE, 'tasks', `${s}.json`), 'utf8')).map((t) => ({ ...t, set: s })));
}

function scratchCopy() {
  const dir = mkdtempSync(join(tmpdir(), 'webjsui-eval-'));
  cpSync(GALLERY, dir, {
    recursive: true,
    filter: (src) => !/\/(node_modules|\.webjs|db)(\/|$)/.test(src),
  });
  writeFileSync(join(dir, 'components.json'), JSON.stringify({
    $schema: 'https://ui.webjs.dev/schema.json',
    style: 'default',
    tailwind: { css: 'public/input.css', baseColor: 'neutral', cssVariables: true },
    aliases: { components: 'components', utils: 'lib/utils/cn', ui: 'components/ui', lib: 'lib' },
    iconLibrary: 'lucide',
    lint: LINT_BLOCK,
  }, null, 2) + '\n');
  return dir;
}

function lint(cwd) {
  const r = spawnSync(process.execPath, [WEBJSUI, 'lint', '--json', '--cwd', cwd], { encoding: 'utf8' });
  try { return JSON.parse(r.stdout); } catch { return { violations: [], summary: { count: 0 }, raw: r.stdout + r.stderr }; }
}

function agent(cwd, prompt) {
  const r = spawnSync('claude', [
    '-p', prompt,
    '--model', MODEL,
    '--output-format', 'json',
    '--allowedTools', 'Read,Edit,Write,MultiEdit,Glob,Grep',
  ], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`claude exited ${r.status}: ${r.stderr.slice(0, 500)}`);
  let cost = 0;
  try { cost = JSON.parse(r.stdout).total_cost_usd ?? 0; } catch { /* keep 0 */ }
  return { cost };
}

const fmt = (v) => `${v.file}:${v.line}:${v.column} [${v.rule}] ${v.message}`;

function runTask(task) {
  const result = { id: task.id, set: task.set, before: {}, after: {}, rulesOnly: {} };

  // BEFORE: the task alone.
  const before = scratchCopy();
  const b = agent(before, task.prompt);
  const beforeLint = lint(before);
  result.before = { findings: beforeLint.summary.count, cost: b.cost };

  // AFTER: fresh agent per round, diagnostics in the prompt.
  const after = mkdtempSync(join(tmpdir(), 'webjsui-eval-after-'));
  cpSync(before, after, { recursive: true });
  let rounds = 0, cost = 0, findings = lint(after).summary.count;
  while (findings > 0 && rounds < ROUNDS) {
    const diag = lint(after).violations.map(fmt).join('\n');
    const a = agent(after, `${task.prompt}\n\nThe file you produced was linted against the app's design system. Fix every finding below, keeping the feature intact.\n\n${RULES_TEXT}\n\nFindings from \`webjsui lint --json\`:\n${diag}`);
    cost += a.cost; rounds++;
    findings = lint(after).summary.count;
  }
  result.after = { rounds, findings, cost };

  // RULES ONLY: same start, same rules text, no diagnostics; a hidden lint decides the next round.
  const rulesOnly = mkdtempSync(join(tmpdir(), 'webjsui-eval-rules-'));
  cpSync(before, rulesOnly, { recursive: true });
  rounds = 0; cost = 0; findings = lint(rulesOnly).summary.count;
  while (findings > 0 && rounds < ROUNDS) {
    const a = agent(rulesOnly, `${task.prompt}\n\nReview the file you produced against the app's design-system rules below and fix anything that breaks them, keeping the feature intact.\n\n${RULES_TEXT}`);
    cost += a.cost; rounds++;
    findings = lint(rulesOnly).summary.count;
  }
  result.rulesOnly = { rounds, findings, cost };

  if (!KEEP) for (const d of [before, after, rulesOnly]) rmSync(d, { recursive: true, force: true });
  else result.dirs = { before, after, rulesOnly };
  return result;
}

const tasks = loadTasks();
const results = [];
for (const task of tasks) {
  process.stderr.write(`[${MODEL}] ${task.set}/${task.id} ... `);
  try {
    const r = runTask(task);
    results.push(r);
    process.stderr.write(`before=${r.before.findings} after=${r.after.rounds}r/${r.after.findings}f rules=${r.rulesOnly.rounds}r/${r.rulesOnly.findings}f\n`);
  } catch (e) {
    process.stderr.write(`FAILED ${e.message}\n`);
    results.push({ id: task.id, set: task.set, error: e.message });
  }
}

const ok = results.filter((r) => !r.error);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const summary = {
  model: MODEL,
  date: new Date().toISOString().slice(0, 10),
  tasks: ok.length,
  failed: results.length - ok.length,
  before: { meanFindings: mean(ok.map((r) => r.before.findings)) },
  after: { meanRounds: mean(ok.map((r) => r.after.rounds)), zeroFindings: ok.filter((r) => r.after.findings === 0).length, cost: ok.reduce((a, r) => a + r.after.cost, 0) },
  rulesOnly: { meanRounds: mean(ok.map((r) => r.rulesOnly.rounds)), zeroFindings: ok.filter((r) => r.rulesOnly.findings === 0).length, cost: ok.reduce((a, r) => a + r.rulesOnly.cost, 0) },
};
summary.diagnosticsWin = summary.after.meanRounds < summary.rulesOnly.meanRounds && summary.after.zeroFindings === ok.length;
console.log(JSON.stringify({ summary, results }, null, 2));
