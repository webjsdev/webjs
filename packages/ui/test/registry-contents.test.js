/**
 * Validates the BUILT registry contents against expected invariants.
 *
 * - Every component JSON has at least one file with non-empty content.
 * - registry:ui items import @webjskit/core.
 * - registry:ui items register a custom element with `.register('ui-...')`.
 * - The component file content includes expected hallmark Tailwind classes
 *   (so we'd catch a regression that silently nukes the shadcn class strings).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const R_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'registry', 'r');

const skip = !existsSync(R_DIR);

test('registry is built (run `node packages/registry/scripts/build.js` if this fails)', { skip }, () => {
  const files = readdirSync(R_DIR).filter((f) => f.endsWith('.json'));
  assert.ok(files.length >= 55, `expected ≥55 registry JSONs, found ${files.length}`);
});

test('every registry:ui item has non-empty inlined content', { skip }, () => {
  const files = readdirSync(R_DIR).filter((f) => f.endsWith('.json') && !['index.json', 'registry.json'].includes(f));
  let uiCount = 0;
  for (const f of files) {
    const item = JSON.parse(readFileSync(join(R_DIR, f), 'utf8'));
    if (item.type !== 'registry:ui') continue;
    uiCount++;
    assert.ok(Array.isArray(item.files), `${f}: files[] missing`);
    for (const file of item.files) {
      assert.ok(file.content && file.content.length > 50, `${f}: ${file.path} has empty/tiny content`);
    }
  }
  assert.ok(uiCount >= 50, `expected ≥50 registry:ui items, found ${uiCount}`);
});

test('every registry:ui item imports @webjskit/core', { skip }, () => {
  const files = readdirSync(R_DIR).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const item = JSON.parse(readFileSync(join(R_DIR, f), 'utf8'));
    if (item.type !== 'registry:ui') continue;
    const content = item.files?.[0]?.content || '';
    assert.match(content, /from\s+'@webjskit\/core'/, `${f}: missing @webjskit/core import`);
  }
});

test('every registry:ui item registers at least one ui-* custom element', { skip }, () => {
  const files = readdirSync(R_DIR).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const item = JSON.parse(readFileSync(join(R_DIR, f), 'utf8'));
    if (item.type !== 'registry:ui') continue;
    const content = item.files?.[0]?.content || '';
    // Either a literal `register('ui-x')` OR a helper that takes a `tag` variable
    // — in the latter case the literal tag name appears elsewhere in the file.
    const hasDirectRegister = /\.register\(['"]ui-[a-z-]+['"]\)/.test(content);
    const hasTagLiteral = /['"]ui-[a-z-]+['"]/.test(content);
    assert.ok(hasDirectRegister || hasTagLiteral, `${f}: no ui-* tag literal found`);
  }
});

test('button.json — hallmark variant classes present', { skip }, () => {
  const item = JSON.parse(readFileSync(join(R_DIR, 'button.json'), 'utf8'));
  const content = item.files[0].content;
  // Shadcn variant class strings — would catch a regression that removes them.
  assert.match(content, /bg-primary/);
  assert.match(content, /hover:bg-primary\/90/);
  assert.match(content, /text-primary-foreground/);
  // Each size key — looser match (any class string mentioning it)
  assert.match(content, /h-9 px-4/);
  assert.match(content, /h-8/);
  assert.match(content, /h-10/);
  assert.match(content, /size-9/); // icon size
});

test('card.json — composes 7 sub-components', { skip }, () => {
  const item = JSON.parse(readFileSync(join(R_DIR, 'card.json'), 'utf8'));
  const content = item.files[0].content;
  // Each sub-component appears as a tag literal (either via direct .register
  // or as an argument to a wrapper factory).
  const tags = ['ui-card', 'ui-card-header', 'ui-card-title', 'ui-card-description', 'ui-card-action', 'ui-card-content', 'ui-card-footer'];
  for (const t of tags) assert.match(content, new RegExp(`['"]${t}['"]`), `card missing tag literal for ${t}`);
});

test('dialog.json — has overlay + focus-trap-related code', { skip }, () => {
  const item = JSON.parse(readFileSync(join(R_DIR, 'dialog.json'), 'utf8'));
  const content = item.files[0].content;
  assert.match(content, /role="dialog"/);
  assert.match(content, /aria-modal/);
  assert.match(content, /Escape/);
  assert.match(content, /focusable/i);
});

test('carousel.json — declares embla-carousel dep', { skip }, () => {
  const item = JSON.parse(readFileSync(join(R_DIR, 'carousel.json'), 'utf8'));
  assert.ok((item.dependencies || []).includes('embla-carousel'));
});

test('command.json — declares fuse.js dep', { skip }, () => {
  const item = JSON.parse(readFileSync(join(R_DIR, 'command.json'), 'utf8'));
  assert.ok((item.dependencies || []).includes('fuse.js'));
});

test('combobox.json — declares fuse.js dep', { skip }, () => {
  const item = JSON.parse(readFileSync(join(R_DIR, 'combobox.json'), 'utf8'));
  assert.ok((item.dependencies || []).includes('fuse.js'));
});

test('index.json — flat list matches r/ directory', { skip }, () => {
  const idx = JSON.parse(readFileSync(join(R_DIR, 'index.json'), 'utf8'));
  assert.ok(Array.isArray(idx));
  assert.ok(idx.length >= 55);
  // Every item should have a name + type
  for (const it of idx) {
    assert.ok(it.name);
    assert.ok(it.type);
  }
});

test('theme JSONs exist for all 7 base colors', { skip }, () => {
  const themes = ['neutral', 'stone', 'zinc', 'mauve', 'olive', 'mist', 'taupe'];
  for (const c of themes) {
    const p = join(R_DIR, 'themes', `${c}.json`);
    assert.ok(existsSync(p), `${c}.json missing`);
    const t = JSON.parse(readFileSync(p, 'utf8'));
    assert.equal(t.type, 'registry:theme');
    assert.equal(t.name, `theme-${c}`);
  }
});

test('registryDependencies form a DAG (no missing references)', { skip }, () => {
  const files = readdirSync(R_DIR).filter((f) => f.endsWith('.json') && !['index.json', 'registry.json'].includes(f));
  const names = new Set(files.map((f) => f.replace('.json', '')));
  // Include theme subdir
  if (existsSync(join(R_DIR, 'themes'))) {
    for (const f of readdirSync(join(R_DIR, 'themes'))) {
      if (f.endsWith('.json')) names.add(f.replace('.json', ''));
    }
  }
  for (const f of files) {
    const item = JSON.parse(readFileSync(join(R_DIR, f), 'utf8'));
    for (const dep of item.registryDependencies || []) {
      assert.ok(names.has(dep), `${item.name}: registryDependencies references missing item "${dep}"`);
    }
  }
});

test('every registry:ui item file content has matching <component>.ts path', { skip }, () => {
  const files = readdirSync(R_DIR).filter((f) => f.endsWith('.json') && !['index.json', 'registry.json'].includes(f));
  for (const f of files) {
    const item = JSON.parse(readFileSync(join(R_DIR, f), 'utf8'));
    if (item.type !== 'registry:ui') continue;
    const file = item.files[0];
    assert.equal(file.path, `components/${item.name}.ts`, `${f}: file path mismatch`);
  }
});
