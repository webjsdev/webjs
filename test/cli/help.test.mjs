/**
 * Tests for `webjs help <command>` (#975): per-command usage + Examples.
 *
 * A bare `webjs help` still prints the full USAGE banner; `webjs help <cmd>`
 * prints that command's usage line, summary, and an Examples block. An unknown
 * command falls back to the banner with a short note. Every documented command
 * must expose at least one example (that is the whole point: an agent reads the
 * exact invocation instead of guessing flags).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..', '..');
const CLI = resolve(REPO, 'packages', 'cli', 'bin', 'webjs.js');

function help(...args) {
  return spawnSync(process.execPath, [CLI, 'help', ...args], { encoding: 'utf8' });
}

test('bare `webjs help` prints the full USAGE banner', () => {
  const r = help();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /webjs commands:/);
  assert.match(r.stdout, /webjs routes/);
});

test('`webjs help routes` prints usage + summary + examples', () => {
  const r = help('routes');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^Usage: webjs routes \[--json\] \[--table\]/m);
  assert.match(r.stdout, /^Examples:/m);
  assert.match(r.stdout, /webjs routes --json/);
  assert.match(r.stdout, /webjs routes --table/);
});

test('`webjs help doctor` documents --json and --strict', () => {
  const r = help('doctor');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Usage: webjs doctor \[--json\] \[--strict\]/);
  assert.match(r.stdout, /webjs doctor --strict/);
  assert.match(r.stdout, /webjs doctor --json/);
});

test('`webjs help <unknown>` falls back to the banner with a note', () => {
  const r = help('bogus');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /No per-command help for "bogus"/);
  assert.match(r.stdout, /webjs commands:/);
});

// Drift guard: every command in the HELP map must carry a usage + at least one
// example. Reads the HELP object literal out of the CLI source so a new command
// added without an example reds this test.
test('every HELP entry has a usage line and at least one example', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(CLI, 'utf8');
  const start = src.indexOf('const HELP = {');
  assert.ok(start >= 0, 'HELP map is present in the CLI');
  // Slice out the object literal up to the printCommandHelp function.
  const end = src.indexOf('function printCommandHelp', start);
  const block = src.slice(start, end);
  // Each top-level command entry looks like `  name: {` at two-space indent.
  const commands = [...block.matchAll(/^ {2}([a-z]+): \{/gm)].map((m) => m[1]);
  assert.ok(commands.length >= 10, `found the HELP commands (${commands.length})`);
  for (const cmd of commands) {
    const r = help(cmd);
    assert.match(r.stdout, /^Usage: /m, `${cmd} shows a usage line`);
    assert.match(r.stdout, /^Examples:/m, `${cmd} shows an Examples block`);
    // At least one example line under Examples (indented, non-empty).
    const after = r.stdout.split('Examples:')[1] || '';
    assert.match(after, /\n {2}\S/, `${cmd} lists at least one example`);
  }
});
