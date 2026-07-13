import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dbGenerateTtyHint } from '../../lib/db-hints.js';

const TTY_ERR = 'Error: Interactive prompts require a TTY terminal (process.stdin.isTTY or process.stdout.isTTY is false).';

test('dbGenerateTtyHint: fires when a non-TTY generate hit the rename prompt (keyed on stderr, not exit code)', () => {
  // drizzle-kit exits 0 on this failure, so the signal must be the stderr text.
  const hint = dbGenerateTtyHint('generate', false, TTY_ERR);
  assert.ok(hint, 'a hint is returned');
  assert.match(hint, /interactive terminal/, 'names the interactive-terminal fix');
  assert.match(hint, /db\/migrations/, 'names the reset-initial-migration escape');
});

test('dbGenerateTtyHint: stays silent on the paths that are NOT the rename dead-end', () => {
  // Counterfactuals: each returns null. The stderr-keyed guard is what fixes the
  // earlier over-fire (an unrelated non-TTY failure no longer misdiagnoses).
  assert.equal(dbGenerateTtyHint('generate', false, '[✓] Your SQL migration ➜ ...'), null, 'a successful run prints nothing');
  assert.equal(dbGenerateTtyHint('generate', false, 'Error: schema.server.ts type error TS2322'), null, 'an unrelated generate failure is NOT diagnosed as a rename prompt');
  assert.equal(dbGenerateTtyHint('generate', false, ''), null, 'empty stderr prints nothing');
  assert.equal(dbGenerateTtyHint('generate', true, TTY_ERR), null, 'an interactive TTY answers the prompt itself');
  assert.equal(dbGenerateTtyHint('migrate', false, TTY_ERR), null, 'only generate has the rename prompt');
  assert.equal(dbGenerateTtyHint('push', false, TTY_ERR), null, 'push is not affected');
});
