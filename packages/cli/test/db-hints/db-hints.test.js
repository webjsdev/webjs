import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dbGenerateTtyHint } from '../../lib/db-hints.js';

test('dbGenerateTtyHint: surfaces the escape hatch when generate dead-ends off a non-TTY', () => {
  const hint = dbGenerateTtyHint('generate', 1, undefined);
  assert.ok(hint, 'a hint is returned');
  assert.match(hint, /interactive terminal/, 'names the interactive-terminal fix');
  assert.match(hint, /db\/migrations/, 'names the reset-initial-migration escape');
});

test('dbGenerateTtyHint: stays silent on the paths that do NOT dead-end', () => {
  // Counterfactual: each of these must return null, or the hint would fire on a
  // healthy run and mislead.
  assert.equal(dbGenerateTtyHint('generate', 0, undefined), null, 'success prints nothing');
  assert.equal(dbGenerateTtyHint('generate', 1, true), null, 'an interactive TTY answers the prompt itself');
  assert.equal(dbGenerateTtyHint('migrate', 1, undefined), null, 'only generate has the rename prompt');
  assert.equal(dbGenerateTtyHint('push', 1, undefined), null, 'push is not affected');
});
