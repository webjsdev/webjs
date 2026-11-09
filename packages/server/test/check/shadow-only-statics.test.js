/**
 * `static-styles-need-shadow` and `shadow-options-need-shadow`: a light-DOM
 * component (the WebJs default, the reverse of Lit's) declaring `static
 * styles` or `static shadowRootOptions` ships something nothing applies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

import { checkConventions, RULES } from '../../src/check.js';

async function rulesFor(source) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-shadow-statics-'));
  try {
    const f = join(dir, 'components', 'el.ts');
    await mkdir(dirname(f), { recursive: true });
    await writeFile(f, source);
    return (await checkConventions(dir))
      .filter((v) => v.rule === 'static-styles-need-shadow' || v.rule === 'shadow-options-need-shadow')
      .map((v) => v.rule)
      .sort();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const head = "import { WebComponent, html, css } from '@webjsdev/core';\n";
const tail = "  render() { return html`<p>x</p>`; }\n}\nEl.register('x-el');\n";

test('both rules are registered', () => {
  for (const name of ['static-styles-need-shadow', 'shadow-options-need-shadow']) {
    assert.ok(RULES.some((r) => r.name === name), name);
  }
});

test('static styles on a light-DOM component is flagged', async () => {
  assert.deepEqual(
    await rulesFor(head + 'class El extends WebComponent {\n  static styles = css`p { color: red; }`;\n' + tail),
    ['static-styles-need-shadow'],
  );
});

test('an explicit static shadow = false is flagged the same way', async () => {
  assert.deepEqual(
    await rulesFor(head + 'class El extends WebComponent({ n: Number }) {\n  static shadow = false;\n  static get styles() { return css`p{}`; }\n' + tail),
    ['static-styles-need-shadow'],
  );
});

test('shadowRootOptions on a light-DOM component is flagged', async () => {
  assert.deepEqual(
    await rulesFor(head + "class El extends WebComponent {\n  static shadowRootOptions = { mode: 'open', delegatesFocus: true };\n" + tail),
    ['shadow-options-need-shadow'],
  );
});

test('a shadow component with styles and options passes', async () => {
  assert.deepEqual(
    await rulesFor(head + "class El extends WebComponent {\n  static shadow = true;\n  static shadowRootOptions = { mode: 'open', delegatesFocus: true };\n  static styles = css`:host{display:block}`;\n" + tail),
    [],
  );
});

test('an unevaluable static shadow, a nested class, and a mention in a template pass', async () => {
  assert.deepEqual(
    await rulesFor(head + 'const ON = true;\nclass El extends WebComponent {\n  static shadow = ON;\n  static styles = css`p{}`;\n' + tail),
    [],
  );
  assert.deepEqual(
    await rulesFor(
      head +
        'class El extends WebComponent {\n  helper() { return class Inner { static styles = 1; }; }\n' +
        '  render() { return html`<pre>static styles = css</pre>`; }\n}\nEl.register(\'x-el\');\n',
    ),
    [],
  );
});
