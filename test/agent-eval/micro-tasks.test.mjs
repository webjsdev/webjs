/**
 * The micro-eval tasks (#1686): each is a request a person would write, so a
 * prompt that names a WebJs API would teach the answer it is meant to measure.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TASKS, microPrompt } from '../../scripts/agent-eval/micro.mjs';

test('every task has a unique id, a prompt and at least one route to probe', () => {
  assert.equal(new Set(TASKS.map((t) => t.id)).size, TASKS.length);
  for (const t of TASKS) {
    assert.ok(t.prompt.length > 40, t.id);
    assert.ok(t.paths.length && t.paths.every((p) => p.startsWith('/')), t.id);
  }
});

test('no prompt names a WebJs API, and the frame forbids running commands', () => {
  for (const t of TASKS) {
    assert.doesNotMatch(microPrompt(t, '/tmp/site'), /WebComponent|createAuth|'use server'|html`|actionData|getSession|cookies\(\)/, t.id);
  }
  assert.match(microPrompt(TASKS[0], '/tmp/site'), /cannot run any command/);
});
