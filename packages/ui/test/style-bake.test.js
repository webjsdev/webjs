/**
 * The style bake (#1666, D8): the CSS map parser, the class-string lexer and
 * the bake itself, from src/registry/style-bake.js.
 *
 * The createStyleMap cases are ported from shadcn's own
 * `packages/shadcn/src/styles/create-style-map.test.ts`, so the parser is held
 * to the same selector semantics as the original. The bake cases are written
 * for this lexical port, since shadcn's transform tests are about JSX and cva.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createStyleMap,
  classSegments,
  segmentValue,
  bakeClassList,
  bakeSource,
  leftoverCnNames,
  resolveStyleName,
  CN_ALLOWLIST,
} from '../src/registry/style-bake.js';

const values = (src) => classSegments(src).map((s) => segmentValue(src, s));

// --- createStyleMap (ported from shadcn) -----------------------------------

test('createStyleMap: extracts the @apply classes of a nested rule', () => {
  const css = `.style-nova { .cn-alert-dialog-content { @apply bg-background gap-4 rounded-xl border; } }`;
  assert.deepEqual(createStyleMap(css), { 'cn-alert-dialog-content': 'bg-background gap-4 rounded-xl border' });
});

test('createStyleMap: joins several @apply directives in one rule', () => {
  const css = `.cn-button { @apply rounded-lg border; @apply text-sm; }`;
  assert.deepEqual(createStyleMap(css), { 'cn-button': 'rounded-lg border text-sm' });
});

test('createStyleMap: a rule nested inside another maps its own name', () => {
  const css = `.cn-card { @apply rounded-xl border; .cn-card-header { @apply gap-2 px-6; } }`;
  assert.deepEqual(createStyleMap(css), { 'cn-card': 'rounded-xl border', 'cn-card-header': 'gap-2 px-6' });
});

test('createStyleMap: a rule with no @apply contributes nothing', () => {
  assert.deepEqual(createStyleMap(`.cn-button { color: red; }`), {});
});

test('createStyleMap: & is dropped and the LAST cn- class is the subject', () => {
  const css = `.cn-button { @apply rounded-lg; &.cn-button-variant-default { @apply bg-primary text-white; } }`;
  assert.deepEqual(createStyleMap(css), { 'cn-button': 'rounded-lg', 'cn-button-variant-default': 'bg-primary text-white' });
});

test('createStyleMap: a later rule for the same name is PREPENDED', () => {
  const css = `.cn-button { @apply rounded-lg; } .cn-button { @apply border; }`;
  assert.deepEqual(createStyleMap(css), { 'cn-button': 'border rounded-lg' });
});

test('createStyleMap: classes that are not cn- names are ignored', () => {
  const css = `.button { @apply rounded-lg border; } .some-other-class { @apply text-sm; } .cn-button { @apply px-4; }`;
  assert.deepEqual(createStyleMap(css), { 'cn-button': 'px-4' });
});

test('createStyleMap: a comma list maps every member, and comments are skipped', () => {
  const css = `/* .cn-ghost { @apply nope; } */ .cn-a, .x .cn-b[data-open] { @apply p-2; }`;
  assert.deepEqual(createStyleMap(css), { 'cn-a': 'p-2', 'cn-b': 'p-2' });
});

test('createStyleMap: brackets inside an @apply value do not confuse the parser', () => {
  const css = `.cn-x { @apply [&_svg:not([class*='size-'])]:size-4 has-[>svg]:px-3; }`;
  assert.deepEqual(createStyleMap(css), { 'cn-x': "[&_svg:not([class*='size-'])]:size-4 has-[>svg]:px-3" });
});

// --- classSegments ----------------------------------------------------------

test('classSegments: string literals of every quote kind, comments skipped', () => {
  const src = `// 'not me'\n/* "nor me" */\nconst a = 'one'; const b = "two"; const c = \`three\`;`;
  assert.deepEqual(values(src), ['one', 'two', 'three']);
});

test('classSegments: a regex literal is not read as a string', () => {
  const src = `const r = /'quoted'/g; const s = 'real';`;
  assert.deepEqual(values(src), ['real']);
});

test('classSegments: division is not mistaken for a regex', () => {
  const src = `const x = a / 2; const s = 'real'; const y = b / 3;`;
  assert.deepEqual(values(src), ['real']);
});

test('classSegments: html class attributes are found, holes excluded, other attributes ignored', () => {
  const src = 'const t = html`<div id="x" class="a b ${c} d e" title="t"><span class=\'f\'></span></div>`;';
  assert.deepEqual(values(src), ['a b ', ' d e', 'f']);
});

test('classSegments: strings inside an html hole are ordinary strings', () => {
  const src = "const t = html`<i class=${cn('p-2', \"m-1\")}></i>`;";
  assert.deepEqual(values(src), ['p-2', 'm-1']);
});

test('classSegments: a template with holes that is not html contributes nothing of its own', () => {
  const src = "const t = `size-${n} p-2`; const s = 'x';";
  assert.deepEqual(values(src), ['x']);
});

test('classSegments: escapes are cooked', () => {
  const src = `const s = 'it\\'s'; const d = "a\\"b";`;
  assert.deepEqual(values(src), ["it's", 'a"b']);
});

// --- bake -------------------------------------------------------------------

const MAP = {
  'cn-button': 'rounded-md border text-sm',
  'cn-button-variant-default': 'bg-primary text-primary-foreground',
  'cn-svg': "[&_svg:not([class*='size-'])]:size-4",
};

test('bakeClassList: mapped classes go FIRST, the name is dropped, duplicates collapse', () => {
  assert.equal(bakeClassList('cn-button inline-flex text-sm', MAP), 'rounded-md border text-sm inline-flex');
});

test('bakeClassList: a name with no entry bakes away to nothing', () => {
  assert.equal(bakeClassList('cn-unknown flex', MAP), 'flex');
});

test('bakeClassList: allowlisted hooks survive the bake', () => {
  for (const hook of CN_ALLOWLIST) assert.equal(bakeClassList(`${hook} cn-button`, MAP), `rounded-md border text-sm ${hook}`);
});

test('bakeClassList: a list with no cn- name is returned unchanged', () => {
  assert.equal(bakeClassList('  flex  gap-2 ', MAP), '  flex  gap-2 ');
});

test('bakeSource: a file with no cn- name is byte-identical', () => {
  const src = `const x = 'flex gap-2'; // cn-ghost in a comment\n`;
  assert.equal(bakeSource(src, MAP), src);
});

// A class carrying the string's own quote moves the string to the other quote
// rather than being escaped: Tailwind reads the raw source and would compile
// the backslashes into the selector (style-bake-quotes.test.js).
test('bakeSource: rewrites single-quoted, double-quoted and template literals, never escaping a quote the map adds', () => {
  const src = `const a = 'cn-svg flex'; const b = "cn-button-variant-default"; const c = \`cn-svg\`;`;
  const out = bakeSource(src, MAP);
  assert.equal(out, `const a = "[&_svg:not([class*='size-'])]:size-4 flex"; const b = "bg-primary text-primary-foreground"; const c = \`[&_svg:not([class*='size-'])]:size-4\`;`);
  // And the result is still valid JavaScript that evaluates to the baked lists.
  const fn = new Function(out.replace(/const /g, 'var ') + '; return [a, b, c];');
  assert.deepEqual(fn(), ["[&_svg:not([class*='size-'])]:size-4 flex", 'bg-primary text-primary-foreground', "[&_svg:not([class*='size-'])]:size-4"]);
});

test('bakeSource: rewrites the static runs of an html class attribute around a hole', () => {
  const src = 'const t = html`<b class="cn-button ${x} cn-button-variant-default"></b>`;';
  assert.equal(bakeSource(src, MAP), 'const t = html`<b class="rounded-md border text-sm ${x} bg-primary text-primary-foreground"></b>`;');
});

test('bakeSource: leaves no cn- name behind outside the allowlist', () => {
  const src = `const a = 'cn-button cn-menu-target p-2'; const t = html\`<i class="cn-svg"></i>\`;`;
  assert.deepEqual(leftoverCnNames(bakeSource(src, MAP)), []);
  assert.deepEqual(leftoverCnNames(src).sort(), ['cn-button', 'cn-svg']);
});

test('resolveStyleName: default and absent mean new-york, an unknown style falls back too', () => {
  assert.equal(resolveStyleName(undefined), 'new-york');
  assert.equal(resolveStyleName('default'), 'new-york');
  assert.equal(resolveStyleName('nova'), 'nova');
  assert.equal(resolveStyleName('nope'), 'new-york');
});

test('classSegments: every registry component lexes without a segment running into code', () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'registry', 'components');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
    const src = readFileSync(join(dir, f), 'utf8');
    for (const seg of classSegments(src)) {
      const v = segmentValue(src, seg);
      if (seg.quote !== '`') assert.ok(!v.includes('\n'), `${f}: a non-template segment spans a newline: ${JSON.stringify(v.slice(0, 80))}`);
    }
  }
});

test('no shipped style maps a marker class, which @apply cannot carry', async () => {
  // A marker (`group`, `group/item`, `peer`) names an element for a group-* or
  // peer-* variant and has no CSS of its own, so Tailwind refuses to @apply it
  // ("Cannot apply unknown utility class `group`") and the site's stylesheet
  // build fails. Markers stay inline in the base-form component instead.
  const { STYLE_NAMES, styleFilePath } = await import('../src/registry/style-bake.js');
  for (const name of STYLE_NAMES) {
    const map = createStyleMap(readFileSync(styleFilePath(name), 'utf8'));
    for (const [cnName, classes] of Object.entries(map)) {
      const markers = classes.split(/\s+/).filter((t) => /^(group|peer)(\/[\w-]+)?$/.test(t));
      assert.deepEqual(markers, [], `style-${name}.css maps ${cnName} to the marker(s) ${markers.join(', ')}`);
    }
  }
});

test('the bake resolves a composed part in its favour: a nova FieldLabel keeps leading-snug, not the Label\'s leading-none', async () => {
  const { bakeForStyle } = await import('../src/registry/style-bake.js');
  const { stripTypeScript } = await import('../../server/src/ts-strip.js');
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { pathToFileURL } = await import('node:url');
  const REG = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'registry');
  const dir = mkdtempSync(join(tmpdir(), 'webjs-bake-field-'));
  writeFileSync(join(dir, 'utils.mjs'), await stripTypeScript(readFileSync(join(REG, 'lib', 'utils.ts'), 'utf8')));
  const { cn } = await import(pathToFileURL(join(dir, 'utils.mjs')).href);
  for (const style of ['nova', 'new-york']) {
    const baked = bakeForStyle(readFileSync(join(REG, 'components', 'field.ts'), 'utf8'), style);
    const label = values(baked).find((v) => v.includes('peer/field-label'));
    const merged = cn(label).split(/\s+/);
    assert.ok(merged.includes('leading-snug'), `${style}: ${merged.join(' ')}`);
    assert.ok(!merged.includes('leading-none'), `${style}: the Label's leading-none is resolved away`);
  }
});
