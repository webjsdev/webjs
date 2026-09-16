/**
 * `webjsui lint` end to end (`src/commands/lint.js` + `src/lint/index.js`)
 * against a temp app, through `runLint` (the command's pure core) and the
 * registered Commander command.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { runLint, lint } from '../src/commands/lint.js';

const BLOG = new URL('../../../examples/blog/', import.meta.url);
// The four blog files that carried `text-red-600` when #1478 was filed. Read
// live, with the expected line computed from the content, so a reflow of the
// blog (or applying the linter's own recommendation there) cannot red this
// suite; the verbatim shape is pinned separately by FEEDBACK_PAGE below.
const BLOG_FILES = [
  'app/feedback/page.ts',
  'app/feedback/triage/page.ts',
  'app/feedback/triage-split/page.ts',
  'modules/feedback/components/feedback-form.ts',
];
const linesWith = (src, needle) => src.split('\n').map((l, i) => (l.includes(needle) ? i + 1 : 0)).filter(Boolean);
// The exact template shape of examples/blog/app/feedback/page.ts:29 at bf201e7c
// (a nested html template in a conditional hole), inline so it cannot drift.
const FEEDBACK_PAGE = [
  "import { html } from '@webjsdev/core';",
  "import { submitFeedback } from '#modules/feedback/actions/submit-feedback.server.ts';",
  '',
  'export default function Feedback({ actionData }: { actionData?: { fieldErrors?: Record<string, string>; values?: Record<string, string> } }) {',
  "  const err = actionData?.fieldErrors?.email;",
  "  const val = actionData?.values?.email || '';",
  '  return html`',
  '    <h1>Feedback</h1>',
  '      <form action=${submitFeedback}>',
  '        <label for="email">Email',
  '          <input id="email" name="email" type="email" value=${val} class="border rounded px-2 py-1">',
  '        </label>',
  "        ${err ? html`<p id=\"email-error\" class=\"text-sm text-red-600\">${err}</p>` : ''}",
  '        <button type="submit" class="border rounded px-3 py-1">Submit</button>',
  '      </form>',
  '  `;',
  '}',
  '',
].join('\n');

const THEME = '@import "tailwindcss";\n@theme {\n  --color-primary: var(--primary);\n  --color-destructive: var(--destructive);\n  --color-muted-foreground: var(--muted-foreground);\n}\n';
const CONFIG = (lint) => ({
  style: 'default',
  tailwind: { css: 'public/input.css', baseColor: 'neutral', cssVariables: true },
  aliases: { components: 'components', utils: 'lib/utils/cn', ui: 'components/ui', lib: 'lib' },
  ...(lint === undefined ? {} : { lint }),
});
const ALL_WARN = { rules: { 'no-raw-colors': 'warn', 'no-arbitrary-values': 'warn', 'no-restyle': { allow: ['layout', 'rounded'] } } };

function app(files, lint) {
  const d = mkdtempSync(join(tmpdir(), 'webjsui-lint-'));
  const write = (rel, content) => { mkdirSync(join(d, dirname(rel)), { recursive: true }); writeFileSync(join(d, rel), content); };
  if (lint !== null) write('components.json', JSON.stringify(CONFIG(lint)));
  write('public/input.css', THEME);
  for (const [rel, content] of Object.entries(files)) write(rel, content);
  return d;
}

test('lint: no components.json exits 1 with the init hint', () => {
  const d = app({}, null);
  try {
    const r = runLint({ cwd: d });
    assert.equal(r.code, 1);
    assert.match(r.lines.join('\n'), /components\.json not found \(run `npx @webjsdev\/ui init`\)/);
  } finally { rmSync(d, { recursive: true }); }
});

test('lint: an invalid lint block exits 1 naming the issue', () => {
  const d = app({}, { rules: { 'no-such': 'warn' } });
  try {
    const r = runLint({ cwd: d });
    assert.equal(r.code, 1);
    assert.match(r.lines.join('\n'), /components\.json is invalid: lint\.rules/);
  } finally { rmSync(d, { recursive: true }); }
});

test('lint: no lint block reports nothing and exits 0 (the opt-in guarantee)', () => {
  const d = app({ 'app/page.ts': 'html`<p class="text-red-600 p-[13px]">`' }, undefined);
  try {
    const r = runLint({ cwd: d });
    assert.equal(r.code, 0);
    assert.deepEqual(r.lines, ['webjsui lint: no rules configured (add a "lint" block to components.json)']);
    assert.equal(r.report.summary.count, 0);
  } finally { rmSync(d, { recursive: true }); }
});

test('lint: COUNTERFACTUAL, the blog feedback shape is reported at its line and clears with text-destructive', () => {
  const d = app({ 'app/feedback/page.ts': FEEDBACK_PAGE }, { rules: { 'no-raw-colors': 'warn' } });
  try {
    const r = runLint({ cwd: d });
    assert.equal(r.report.summary.count, 1);
    const [v] = r.report.violations;
    assert.equal(v.rule, 'no-raw-colors');
    assert.equal(v.file, 'app/feedback/page.ts');
    assert.equal(v.line, 13);
    assert.equal(v.column, 57);
    assert.equal(v.class, 'text-red-600');
    assert.equal(v.fix, 'text-destructive');
    assert.match(v.message, /\(declared in public\/input\.css\)/);
    writeFileSync(join(d, 'app/feedback/page.ts'), FEEDBACK_PAGE.replace('text-red-600', 'text-destructive'));
    assert.equal(runLint({ cwd: d }).report.summary.count, 0);
  } finally { rmSync(d, { recursive: true }); }
});

test('lint: every text-red-600 in the live blog feedback files is reported at its line', () => {
  const files = {};
  const expected = [];
  for (const rel of BLOG_FILES) {
    const src = readFileSync(new URL(rel, BLOG), 'utf8');
    files[rel] = src;
    for (const line of linesWith(src, 'text-red-600')) expected.push([rel, line]);
  }
  const d = app(files, { rules: { 'no-raw-colors': 'warn' } });
  try {
    const r = runLint({ cwd: d });
    const got = r.report.violations.map((v) => [v.file, v.line]);
    assert.deepEqual(got.sort(), expected.sort());
    assert.equal(r.code, 0); // warnings only
  } finally { rmSync(d, { recursive: true }); }
});

test('lint: components/ui/** is skipped by default, and the same file elsewhere is reported', () => {
  const file = 'export const BASE = "focus-visible:ring-[3px]";\nexport const t = html`<button class="ring-[3px]">`;';
  const d = app({ 'components/ui/button.ts': file, 'components/toolbar.ts': file }, { rules: { 'no-arbitrary-values': 'warn' } });
  try {
    const r = runLint({ cwd: d });
    assert.deepEqual(r.report.violations.map((v) => v.file), ['components/toolbar.ts']);
    // A negated ignore entry widens the scope over whatever it MATCHES.
    for (const neg of ['!components/ui/**', '!components/ui/*', '!components/ui/button.ts']) {
      writeFileSync(join(d, 'components.json'), JSON.stringify(CONFIG({ ignore: [neg], rules: { 'no-arbitrary-values': 'warn' } })));
      assert.deepEqual(runLint({ cwd: d }).report.violations.map((v) => v.file), ['components/toolbar.ts', 'components/ui/button.ts'], neg);
    }
    writeFileSync(join(d, 'components.json'), JSON.stringify(CONFIG({ ignore: ['!components/ui/other.ts'], rules: { 'no-arbitrary-values': 'warn' } })));
    assert.deepEqual(runLint({ cwd: d }).report.violations.map((v) => v.file), ['components/toolbar.ts']);
    // A plain ignore entry narrows it.
    writeFileSync(join(d, 'components.json'), JSON.stringify(CONFIG({ ignore: ['components/tool*'], rules: { 'no-arbitrary-values': 'warn' } })));
    assert.deepEqual(runLint({ cwd: d }).report.violations, []);
  } finally { rmSync(d, { recursive: true }); }
});

test('lint: no-restyle reads the APP copy of the helper through its import', () => {
  const button = readFileSync(new URL('../packages/registry/components/button.ts', import.meta.url), 'utf8')
    .replace("import { cn } from '../lib/utils.ts';", "import { cn } from '#lib/utils/cn.ts';")
    .replace("  'icon-lg': 'size-10',", "  'icon-lg': 'size-10',\n  none: '',");
  const d = app({
    'components/ui/button.ts': button,
    'lib/utils/cn.ts': 'export function cn(...a) { return a.join(" "); }',
    'components/toolbar.ts': "import { cn } from '#lib/utils/cn.ts';\nimport { buttonClass } from '#components/ui/button.ts';\nexport const t = html`<button class=${cn(buttonClass({ size: 'none' }), 'w-9 h-9 rounded-full bg-pink-500')}>`;",
  }, { rules: { 'no-restyle': { severity: 'error', allow: ['layout', 'rounded'] } } });
  try {
    const r = runLint({ cwd: d });
    assert.equal(r.code, 1);
    assert.equal(r.report.summary.errors, 1);
    const [v] = r.report.violations;
    assert.equal(v.class, 'bg-pink-500');
    // The value list comes from the app's copy (which added `none`), not the packaged registry.
    assert.match(v.message, /Use a buttonClass variant: default, destructive, outline, secondary, ghost, link \(declared in components\/ui\/button\.ts\)\./);
    assert.match(runLint({ cwd: d, json: false }).lines.join('\n'), /✗ \[no-restyle\] components\/toolbar\.ts:3:\d+/);
  } finally { rmSync(d, { recursive: true }); }
});

test('lint: --json emits { violations, summary } with the documented fields', () => {
  const d = app({ 'app/page.ts': 'html`<p class="text-red-600 p-[13px]">`' }, ALL_WARN);
  try {
    const r = runLint({ cwd: d, json: true });
    const doc = JSON.parse(r.lines.join('\n'));
    assert.deepEqual(Object.keys(doc.summary), ['count', 'errors', 'warnings', 'byRule']);
    assert.equal(doc.summary.count, 2);
    assert.equal(doc.summary.errors, 0);
    assert.equal(doc.summary.warnings, 2);
    assert.deepEqual(doc.summary.byRule, { 'no-raw-colors': 1, 'no-arbitrary-values': 1 });
    for (const v of doc.violations) for (const k of ['rule', 'severity', 'file', 'line', 'column', 'class', 'message']) assert.ok(k in v, k);
  } finally { rmSync(d, { recursive: true }); }
});

test('lint: exit codes follow errors and --max-warnings', () => {
  const d = app({ 'app/page.ts': 'html`<p class="text-red-600">`' }, { rules: { 'no-raw-colors': 'warn' } });
  try {
    assert.equal(runLint({ cwd: d }).code, 0);
    assert.equal(runLint({ cwd: d, maxWarnings: '0' }).code, 1);
    assert.equal(runLint({ cwd: d, maxWarnings: '5' }).code, 0);
    // A cap that is not an integer is refused rather than silently lifted.
    const bad = runLint({ cwd: d, maxWarnings: 'abc' });
    assert.equal(bad.code, 1);
    assert.match(bad.lines[0], /--max-warnings expects an integer/);
    writeFileSync(join(d, 'components.json'), JSON.stringify(CONFIG({ rules: { 'no-raw-colors': 'error' } })));
    assert.equal(runLint({ cwd: d }).code, 1);
    writeFileSync(join(d, 'components.json'), JSON.stringify(CONFIG({ rules: { 'no-raw-colors': 'off' } })));
    const off = runLint({ cwd: d });
    assert.equal(off.code, 0);
    assert.equal(off.report.configured, false);
  } finally { rmSync(d, { recursive: true }); }
});

test('lint: a token-less theme disables no-raw-colors with a warning and leaves the other rules running', () => {
  const d = app({ 'app/page.ts': 'html`<p class="text-red-600 p-[13px]">`' }, ALL_WARN);
  try {
    writeFileSync(join(d, 'public/input.css'), '@import "tailwindcss";');
    const r = runLint({ cwd: d });
    assert.equal(r.report.warnings.length, 1);
    assert.match(r.report.warnings[0], /no-raw-colors is off for this run: no --color-\* tokens found .* public\/input\.css/);
    assert.deepEqual(r.report.violations.map((v) => v.rule), ['no-arbitrary-values']);
    assert.match(r.lines[0], /^⚠ no-raw-colors is off/);
  } finally { rmSync(d, { recursive: true }); }
});

test('lint: the Commander command prints the report and sets exitCode', async () => {
  const d = app({ 'app/page.ts': 'html`<p class="text-red-600">`' }, { rules: { 'no-raw-colors': 'error' } });
  const origLog = console.log;
  const out = [];
  console.log = (...a) => out.push(a.join(' '));
  try {
    await lint.parseAsync(['--cwd', d], { from: 'user' });
    assert.match(out.join('\n'), /webjsui lint: 1 problem\(s\) found \(1 error, 0 warnings\)/);
    assert.match(out.join('\n'), /✗ \[no-raw-colors\] app\/page\.ts:1:\d+/);
    assert.equal(process.exitCode, 1);
  } finally {
    console.log = origLog;
    process.exitCode = 0;
    rmSync(d, { recursive: true });
  }
});

test('lint: --json answers the missing and invalid config exits with an error document', () => {
  const missing = app({}, null);
  const invalid = app({}, { rules: { 'no-such': 'warn' } });
  try {
    for (const [d, re] of [[missing, /components\.json not found/], [invalid, /components\.json is invalid/]]) {
      const r = runLint({ cwd: d, json: true });
      assert.equal(r.code, 1);
      const doc = JSON.parse(r.lines.join('\n'));
      assert.match(doc.error, re);
      assert.deepEqual(doc.violations, []);
      assert.equal(doc.summary.count, 0);
    }
  } finally { rmSync(missing, { recursive: true }); rmSync(invalid, { recursive: true }); }
});
