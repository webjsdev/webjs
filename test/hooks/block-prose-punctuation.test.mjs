import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../.claude/hooks/block-prose-punctuation.sh'
);

/** Run the hook with the given content as a Write payload. Returns the result. */
function runContent(content) {
  return spawnSync('bash', [HOOK], {
    input: JSON.stringify({ tool_input: { content } }),
    encoding: 'utf8',
  });
}

// The brand token and the em-dash are assembled at runtime so this source
// file never itself carries a literal form the live hook would block.
const B = 'web' + 'js';

test('blocks em-dash anywhere', () => {
  const emDash = String.fromCharCode(0x2014);
  assert.equal(runContent(`foo ${emDash} bar`).status, 2);
});

test('blocks lowercase brand at a line start', () => {
  const r = runContent(`${B} ships a cache() helper.`);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /lowercase "webjs" at a prose sentence start/);
});

test('blocks lowercase brand after a full stop', () => {
  assert.equal(runContent(`The wire round-trips. ${B} rewrites the import.`).status, 2);
});

test('blocks lowercase brand after a question mark and exclamation', () => {
  assert.equal(runContent(`Prefer Bun? ${B} runs on Bun too.`).status, 2);
  assert.equal(runContent(`Fast! ${B} skips the build step.`).status, 2);
});

test('blocks emphasis-wrapped brand at a sentence start', () => {
  assert.equal(runContent(`**${B}** is AI-first.`).status, 2);
  assert.equal(runContent(`_${B}_ is neat.`).status, 2);
});

test('blocks brand right after a prose HTML tag', () => {
  assert.equal(runContent(`<p>${B} is a framework.</p>`).status, 2);
});

test('blocks brand at a markdown list / heading / blockquote start', () => {
  assert.equal(runContent(`- ${B} ships the cache helper.`).status, 2);
  assert.equal(runContent(`## ${B} overview`).status, 2);
  assert.equal(runContent(`> ${B} runs on Node and Bun.`).status, 2);
});

test('allows the correctly-capitalized brand', () => {
  assert.equal(runContent('WebJs ships a cache() helper.').status, 0);
});

test('allows a CLI subcommand reference (kept lowercase)', () => {
  assert.equal(runContent(`Run \`${B} dev\` to start.`).status, 0);
  assert.equal(runContent(`- ${B} check runs the validator.`).status, 0);
  assert.equal(runContent(`${B} create my-app --template api`).status, 0);
});

test('allows the brand mid-sentence', () => {
  assert.equal(runContent(`Most ${B} apps ship without a build step.`).status, 0);
});

test('allows the brand as a domain / package / config / env token', () => {
  assert.equal(runContent(`Set it in ${B}.dev config.`).status, 0);
  assert.equal(runContent(`Import from @${B}dev/core.`).status, 0);
  assert.equal(runContent('Reads WEBJS_PUBLIC_API_URL at boot.').status, 0);
});

test('allows the brand inside an inline code span mid-sentence', () => {
  assert.equal(runContent(`The \`${B}\` command exists.`).status, 0);
});

test('flags a verb that merely starts with a CLI subcommand string', () => {
  // "webjs seeds ..." must stay flagged as a real sentence start (not the
  // `seed` CLI), so this is a BLOCK, proving the word-boundary guard works.
  assert.equal(runContent(`${B} seeds each SSR action result.`).status, 2);
});
