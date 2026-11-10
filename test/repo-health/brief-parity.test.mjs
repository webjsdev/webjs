/**
 * The WebJs brief is written once and carried verbatim in three places.
 *
 * `packages/mcp/src/brief.js` exports it (the MCP `init` tool returns it), and
 * the repo-root `AGENTS.md` plus the scaffold's `packages/cli/templates/AGENTS.md`
 * paste it under the `## The WebJs brief` heading. The brief is the whole of the
 * agent-facing documentation, so a copy that drifts teaches an agent something
 * the other two do not. Assert all three are byte-identical.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { BRIEF, BRIEF_HEADING } = await import(resolve(repoRoot, 'packages/mcp/src/brief.js'));

/**
 * The body of the `## ` section whose heading line is exactly `heading`, from
 * the line after the heading up to the next `## ` heading, trimmed. Returns
 * null when the heading is absent.
 *
 * @param {string} md
 * @param {string} heading
 * @returns {string | null}
 */
export function sectionBody(md, heading) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.trimEnd() === heading);
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,2}\s/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n').trim();
}

/**
 * The brief section of `md`, cut at the first paragraph that is not part of the
 * brief. Both AGENTS.md files may follow the brief with their own prose in the
 * same section, so compare only the leading run that the brief occupies.
 *
 * @param {string} md
 * @returns {string | null}
 */
function briefIn(md) {
  const body = sectionBody(md, BRIEF_HEADING);
  if (body === null) return null;
  return body.slice(0, BRIEF.length);
}

for (const file of ['AGENTS.md', 'packages/cli/templates/AGENTS.md']) {
  test(`${file} carries the brief verbatim under "${BRIEF_HEADING}"`, () => {
    const md = readFileSync(resolve(repoRoot, file), 'utf8');
    const got = briefIn(md);
    assert.notEqual(got, null, `${file} has no "${BRIEF_HEADING}" heading`);
    assert.equal(got, BRIEF, `${file} drifted from packages/mcp/src/brief.js; paste the brief from there`);
  });
}

test('the brief stays brief', () => {
  const lines = BRIEF.split('\n').length;
  assert.ok(lines <= 40, `the brief is ${lines} lines; it is meant to stay short`);
});

test('a drifted copy is caught (counterfactual)', () => {
  const md = `${BRIEF_HEADING}\n\n${BRIEF.replace('light DOM', 'shadow DOM')}\n`;
  assert.notEqual(briefIn(md), BRIEF);
  assert.equal(briefIn('# nothing here\n'), null);
});
