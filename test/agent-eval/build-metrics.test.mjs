/**
 * The clean build runner's transcript metrics (#1686): what counts as the
 * agent's FIRST check, typecheck and test run, whether each passed, and what
 * counts as rework, read from a stream-json transcript like `claude -p`
 * writes. No model is called.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { metricsOf, promptFor } from '../../scripts/agent-eval/build.mjs';

/** A stream-json transcript from a list of events. */
function transcript(events) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-build-metrics-'));
  const file = join(dir, 't.jsonl');
  writeFileSync(file, events.map((e) => JSON.stringify(e)).join('\n') + '\n');
  return { file, dir };
}
const use = (id, name, input) => ({ type: 'assistant', message: { usage: { input_tokens: 100, cache_read_input_tokens: 900, output_tokens: 10 }, content: [{ type: 'tool_use', id, name, input }] } });
const result = (id, text, isError = false) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: text, is_error: isError }] } });

test('the first run of each verification is what counts, and rework is an edit after a failed one', () => {
  const { file, dir } = transcript([
    { type: 'system', subtype: 'init' },
    use('w1', 'Write', { file_path: '/app/app/page.ts', content: 'x' }),
    use('w2', 'Write', { file_path: '/app/lib/a.ts', content: 'x' }),
    use('e1', 'Edit', { file_path: '/app/app/page.ts', old_string: 'x', new_string: 'y' }),
    use('c1', 'Bash', { command: 'npx webjs check' }),
    result('c1', 'webjs check: 1 violation(s) found', true),
    use('e2', 'Edit', { file_path: '/app/app/page.ts', old_string: 'y', new_string: 'z' }),
    use('c2', 'Bash', { command: 'npx webjs check' }),
    result('c2', 'webjs check: all checks pass'),
    use('t1', 'Bash', { command: 'npx webjs typecheck' }),
    result('t1', ''),
    { type: 'result', duration_ms: 120_000, result: 'Built it.' },
  ]);
  try {
    const m = metricsOf(file);
    assert.deepEqual(m.firsts, { check: false, typecheck: true, test: null }, 'the failed first check stands; the later pass does not replace it');
    assert.equal(m.rework, 1, 'the edit before the first failure is building, the one after it is rework');
    assert.equal(m.toolCalls, 7);
    assert.equal(m.inputTokens, 7000, 'fresh plus cached input');
    assert.equal(m.minutes, 2);
    assert.equal(m.report, 'Built it.');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the prompt carries the spec and names no WebJs API beyond its CLI', () => {
  const p = promptFor('Build "X", a thing.', '/tmp/app', 8900);
  assert.match(p, /Build "X", a thing\./);
  assert.match(p, /\/tmp\/app/);
  assert.match(p, /webjs dev --port 8900/);
  assert.doesNotMatch(p, /WebComponent|createAuth|html`|'use server'/, 'the frame teaches nothing the brief should');
});
