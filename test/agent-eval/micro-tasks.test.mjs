/**
 * The micro-eval tasks (#1686): each is a request a person would write, so a
 * prompt that names a WebJs API would teach the answer it is meant to measure.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import { TASKS, microPrompt, firstDraftStop, routesWritten } from '../../scripts/agent-eval/micro.mjs';

test('every task has a unique id, a prompt and at least one route to probe', () => {
  assert.equal(new Set(TASKS.map((t) => t.id)).size, TASKS.length);
  for (const t of TASKS) {
    assert.ok(t.prompt.length > 40, t.id);
    assert.ok(t.paths.length && t.paths.every((p) => p.startsWith('/')), t.id);
  }
});

test('no prompt names a WebJs API, and the frame asks for a check (where the run stops)', () => {
  for (const t of TASKS) {
    assert.doesNotMatch(microPrompt(t, '/tmp/site'), /WebComponent|createAuth|'use server'|html`|actionData|getSession|cookies\(\)/, t.id);
  }
  assert.ok(microPrompt(TASKS[0], '/tmp/site').includes('`npx webjs check`'));
});

// The first draft ends at the first check AFTER feature code is written. The
// auth run edited the schema, generated a migration, then ran a baseline
// check, typecheck and test before writing any page, and the old rule graded
// that empty draft.
test('a baseline check before any feature code does not end the first draft', () => {
  const app = '/var/tmp/x/site';
  const st = { wroteFeature: false };
  const edit = (file_path) => ({ type: 'tool_use', name: 'Edit', input: { file_path } });
  const bash = (command) => ({ type: 'tool_use', name: 'Bash', input: { command } });
  assert.equal(firstDraftStop(edit(app + '/db/schema.server.ts'), st, app), false);
  assert.equal(firstDraftStop(bash('npx webjs db generate'), st, app), false);
  assert.equal(firstDraftStop(bash('npx webjs check'), st, app), false, 'a baseline check before the feature');
  assert.equal(firstDraftStop({ type: 'tool_use', name: 'Write', input: { file_path: app + '/app/login/page.ts' } }, st, app), false);
  assert.equal(firstDraftStop(bash('npx webjs check'), st, app), true, 'the first check of the draft');
});

test('a feature file written from the shell starts the draft too', () => {
  const st = { wroteFeature: false };
  firstDraftStop({ type: 'tool_use', name: 'Bash', input: { command: "cat > app/posts/page.ts <<'EOF'\nx\nEOF" } }, st, '/a');
  assert.equal(st.wroteFeature, true);
});

// A check while a named route has no file is a checkpoint, not the draft's
// end: the auth run verified its server layer before writing the pages.
test('the first draft ends only once every named route has a file', () => {
  const app = mkdtempSync(join(tmpdir(), 'micro-routes-'));
  const w = (rel) => { mkdirSync(dirname(join(app, rel)), { recursive: true }); writeFileSync(join(app, rel), ''); };
  try {
    w('app/page.ts');
    assert.equal(routesWritten(app, ['/signup', '/login']), false);
    w('app/(auth)/signup/page.ts');
    assert.equal(routesWritten(app, ['/signup', '/login']), false);
    w('app/(auth)/login/page.ts');
    w('app/api/products/route.ts');
    assert.equal(routesWritten(app, ['/signup', '/login', '/', '/api/products?q=a']), true, 'groups ignored, a query dropped');
    const st = { wroteFeature: true };
    const check = { type: 'tool_use', name: 'Bash', input: { command: 'npx webjs check' } };
    assert.equal(firstDraftStop(check, st, app, () => routesWritten(app, ['/dashboard'])), false);
    assert.equal(firstDraftStop(check, st, app, () => routesWritten(app, ['/login'])), true);
  } finally {
    rmSync(app, { recursive: true, force: true });
  }
});
