/**
 * A docs sample that declares `static styles` on a component must also declare
 * `static shadow = true`. WebJs renders light DOM by default (the reverse of
 * Lit), so `static styles` on a light-DOM component is never applied and
 * `webjs check` refuses it (`static-styles-need-shadow`). Four samples on the
 * components page taught exactly that habit until an audit caught them, and a
 * reader copies a sample verbatim, so the docs are held to the rule the
 * checker enforces.
 *
 * A sample that shows the refused shape on purpose says so with a
 * `static-styles-need-shadow` mention in the same code block.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOCS = join(ROOT, 'website/app/(site)/docs');

function pages(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...pages(abs));
    else if (name === 'page.ts') out.push(abs);
  }
  return out;
}

test('every docs sample with static styles opts into shadow DOM', () => {
  const offenders = [];
  for (const file of pages(DOCS)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/<code-block[^>]*>([\s\S]*?)<\/code-block>/g)) {
      const block = m[1];
      // One class body at a time, so a block holding two components is judged per class.
      const classes = block.split(/(?=\bclass\s+\w+\s+extends\s+WebComponent)/).filter((c) => /^class\s+\w+\s+extends\s+WebComponent/.test(c));
      for (const cls of classes) {
        if (!/\bstatic\s+styles\b/.test(cls)) continue;
        if (/\bstatic\s+shadow\s*=\s*true\b/.test(cls)) continue;
        if (block.includes('static-styles-need-shadow')) continue;
        const name = /^class\s+(\w+)/.exec(cls)[1];
        const line = src.slice(0, m.index).split('\n').length;
        offenders.push(`${relative(ROOT, file)}:${line} class ${name}`);
      }
    }
  }
  assert.deepEqual(offenders, [], 'add `static shadow = true` to these samples (or drop `static styles`)');
});
