/**
 * The `@example` extractor / stripper (#983).
 *
 * The module JSDoc's `@example` block is the SINGLE source of the structural
 * snippet: `extractExample` serves it (view / MCP), `stripExample` removes it
 * from the copied file and leaves a pointer. Both key on the same delimiter.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractExample, stripExample, hasExample, pointerLine } from '../src/registry/example.js';

const SRC = `/**
 * Accordion: native <details>/<summary>.
 *
 * a11y: give each <details> the same name for exclusive-open.
 *
 * @example
 * \`\`\`html
 * <div class=\${accordionClass()}>
 *   <details name="faq" class=\${accordionItemClass()}>
 *     <summary class=\${accordionTriggerClass()}>Q</summary>
 *     <div class=\${accordionContentClass()}>A</div>
 *   </details>
 * </div>
 * \`\`\`
 */

export const accordionClass = () => 'w-full';
`;

test('hasExample: true when the JSDoc carries an @example', () => {
  assert.equal(hasExample(SRC), true);
  assert.equal(hasExample('/** just docs */\nexport const x = 1;'), false);
});

test('extractExample: unwraps the fenced snippet, preserves inner indentation', () => {
  const ex = extractExample(SRC);
  assert.match(ex, /^<div class=\$\{accordionClass\(\)\}>/);
  assert.match(ex, /\n {2}<details name="faq"/); // nested indent kept
  assert.doesNotMatch(ex, /```/); // fence removed
  assert.doesNotMatch(ex, /@example/);
});

test('stripExample: removes the example, leaves a pointer, keeps the helpers', () => {
  const out = stripExample(SRC, 'accordion');
  assert.doesNotMatch(out, /@example/);
  assert.doesNotMatch(out, /<details name="faq"/); // structure gone
  assert.match(out, /a11y: give each/); // lean header (a11y note) kept
  assert.ok(out.includes(pointerLine('accordion'))); // pointer present
  assert.match(out, /export const accordionClass/); // helper code untouched
  // The block still closes cleanly.
  assert.match(out, /\*\//);
});

test('stripExample: no-op when there is no @example', () => {
  const src = '/** just docs */\nexport const x = 1;';
  assert.equal(stripExample(src, 'x'), src);
});

test('extractExample: empty string when there is no @example', () => {
  assert.equal(extractExample('/** docs */\nexport const x = 1;'), '');
});
