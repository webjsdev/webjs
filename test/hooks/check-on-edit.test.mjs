// The scaffolded check-on-edit PostToolUse hook: after an edit to an app
// source file it runs `webjs check --json` and hands the EDITED file's
// violations back to the agent (decision: block, with each fix), and stays
// silent for a clean file, a non-source path, a file outside the app, or an
// app with no local `webjs` bin.
//
// The `webjs` bin is a stub script (WEBJS_CHECK_ON_EDIT_BIN, or a fake
// node_modules/.bin entry) that prints a canned report, so the test exercises
// the hook's own logic without booting the framework. One case runs the REAL
// CLI against a throwaway app to prove the two agree on the violation shape.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOOK_SH = join(REPO, 'packages/cli/templates/.claude/hooks/check-on-edit.sh');
const CLI = join(REPO, 'packages/cli/bin/webjs.js');

/** A throwaway app dir (package.json + app/) with an optional stub bin. */
function makeApp({ report, withBin = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-check-on-edit-'));
  mkdirSync(join(dir, 'app'), { recursive: true });
  mkdirSync(join(dir, 'components'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), '{"name":"t","type":"module"}');
  if (withBin) {
    mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
    const bin = join(dir, 'node_modules', '.bin', 'webjs');
    const body = JSON.stringify(JSON.stringify(report ?? { violations: [], summary: { count: 0 } }));
    writeFileSync(bin, `#!/usr/bin/env node\nprocess.stdout.write(${body});\nprocess.exit(1);\n`);
    chmodSync(bin, 0o755);
  }
  return dir;
}

function runHook(dir, filePath, env = {}) {
  const r = spawnSync('bash', [HOOK_SH], {
    cwd: dir,
    input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: filePath } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir, WEBJS_NO_CHECK_ON_EDIT: '', WEBJS_CHECK_ON_EDIT_BIN: '', ...env },
    encoding: 'utf8',
  });
  return { status: r.status, out: r.stdout.trim() };
}

const VIOLATION = {
  rule: 'reactive-props-no-class-field',
  file: 'components/counter.ts',
  message: 'class field `count = 0` shadows the reactive accessor',
  fix: 'set the default in the constructor after super()',
};

test('returns the edited file\'s violations as PostToolUse feedback', () => {
  const dir = makeApp({ report: { violations: [VIOLATION], summary: { count: 1 } } });
  try {
    const { status, out } = runHook(dir, join(dir, 'components/counter.ts'));
    assert.equal(status, 0, 'the hook itself never fails the tool call');
    const fb = JSON.parse(out);
    assert.equal(fb.decision, 'block', 'violations are fed back to the agent');
    assert.equal(fb.hookSpecificOutput.hookEventName, 'PostToolUse');
    assert.match(fb.reason, /reactive-props-no-class-field/);
    assert.match(fb.reason, /Fix: set the default in the constructor/);
    assert.match(fb.reason, /components\/counter\.ts/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('silent when the violations are all in OTHER files', () => {
  const dir = makeApp({ report: { violations: [VIOLATION], summary: { count: 1 } } });
  try {
    const { out } = runHook(dir, join(dir, 'app/page.ts'));
    assert.equal(out, '', 'a pre-existing problem elsewhere is not replayed');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('silent for a clean check', () => {
  const dir = makeApp();
  try {
    assert.equal(runHook(dir, join(dir, 'components/counter.ts')).out, '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('skips non-source files, declaration files, node_modules, and paths outside the project', () => {
  const dir = makeApp({ report: { violations: [{ ...VIOLATION, file: 'README.md' }], summary: { count: 1 } } });
  const other = mkdtempSync(join(tmpdir(), 'webjs-check-on-edit-other-'));
  try {
    for (const p of [
      join(dir, 'README.md'),
      join(dir, 'components/types.d.ts'),
      join(dir, 'node_modules/x/index.js'),
      join(other, 'components/counter.ts'),
    ]) {
      assert.equal(runHook(dir, p).out, '', `${p} is skipped`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(other, { recursive: true, force: true });
  }
});

test('silent when the app has no local `webjs` bin (never installs anything)', () => {
  const dir = makeApp({ withBin: false });
  try {
    assert.equal(runHook(dir, join(dir, 'components/counter.ts')).out, '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('WEBJS_NO_CHECK_ON_EDIT=1 turns it off', () => {
  const dir = makeApp({ report: { violations: [VIOLATION], summary: { count: 1 } } });
  try {
    assert.equal(runHook(dir, join(dir, 'components/counter.ts'), { WEBJS_NO_CHECK_ON_EDIT: '1' }).out, '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('agrees with the REAL `webjs check` on the violation file shape', () => {
  // A component that registers a tag with no hyphen is a check violation in
  // every app; the real CLI must report it against the edited file's path.
  const dir = makeApp({ withBin: false });
  try {
    writeFileSync(join(dir, 'components/nohyphen.ts'),
      "import { WebComponent, html } from '@webjsdev/core';\nexport class X extends WebComponent { render() { return html`<p>x</p>`; } }\nX.register('nohyphen');\n");
    const bin = join(dir, 'webjs-real');
    writeFileSync(bin, `#!/usr/bin/env bash\nexec "${process.execPath}" "${CLI}" "$@"\n`);
    chmodSync(bin, 0o755);
    const { out } = runHook(dir, join(dir, 'components/nohyphen.ts'), { WEBJS_CHECK_ON_EDIT_BIN: bin });
    const fb = JSON.parse(out);
    assert.equal(fb.decision, 'block');
    assert.match(fb.reason, /tag-name-has-hyphen/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

/** An app whose stub bin answers `check` cleanly and `typecheck` with tsc lines. */
function makeTypecheckApp(tscOutput) {
  const dir = makeApp({ withBin: false });
  writeFileSync(join(dir, 'tsconfig.json'), '{}');
  mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
  const bin = join(dir, 'node_modules', '.bin', 'webjs');
  const check = JSON.stringify(JSON.stringify({ violations: [], summary: { count: 0 } }));
  writeFileSync(bin, `#!/usr/bin/env node
if (process.argv[2] === 'typecheck') { process.stdout.write(${JSON.stringify(tscOutput)}); process.exit(2); }
process.stdout.write(${check});
`);
  chmodSync(bin, 0o755);
  return dir;
}

test('returns the edited TypeScript file\'s type errors, not other files\' or a missing module (#1686)', () => {
  const dir = makeTypecheckApp([
    "modules/inbox/actions.server.ts(24,22): error TS2322: Type 'ActionResult' is not assignable to type 'ActionResult<Message>'.",
    "modules/inbox/actions.server.ts(3,20): error TS2307: Cannot find module '#modules/inbox/queries.server.ts'.",
    "components/thread.ts(9,1): error TS2339: Property 'x' does not exist on type 'Y'.",
  ].join('\n'));
  try {
    mkdirSync(join(dir, 'modules', 'inbox'), { recursive: true });
    const { out } = runHook(dir, join(dir, 'modules/inbox/actions.server.ts'));
    const fb = JSON.parse(out);
    assert.equal(fb.decision, 'block');
    assert.match(fb.reason, /TypeScript found 1 error in modules\/inbox\/actions\.server\.ts/);
    assert.match(fb.reason, /line 24: TS2322/);
    assert.doesNotMatch(fb.reason, /TS2307|components\/thread\.ts/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('WEBJS_NO_TYPECHECK_ON_EDIT=1 skips only the type errors', () => {
  const dir = makeTypecheckApp("components/counter.ts(1,1): error TS2322: Type 'string' is not assignable to type 'number'.");
  try {
    assert.equal(runHook(dir, join(dir, 'components/counter.ts'), { WEBJS_NO_TYPECHECK_ON_EDIT: '1' }).out, '');
    assert.match(JSON.parse(runHook(dir, join(dir, 'components/counter.ts')).out).reason, /TS2322/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
