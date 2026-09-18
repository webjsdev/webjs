/**
 * `webjsui lint` theme-token reader (`src/lint/theme-tokens.js`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseThemeTokens, readThemeTokens } from '../src/lint/theme-tokens.js';

const KIT_THEME = new URL('../packages/registry/themes/index.css', import.meta.url);

test('parseThemeTokens: reads both `@theme inline` and plain `@theme`', () => {
  assert.deepEqual(
    parseThemeTokens('@theme inline {\n  --radius-sm: 1px;\n  --color-destructive: var(--destructive);\n}'),
    ['destructive'],
  );
  assert.deepEqual(
    parseThemeTokens('@import "tailwindcss";\n@theme {\n  --color-primary: var(--primary);\n  --color-success: var(--success);\n  --font-sans: x;\n}\n:root { --color-not-a-token: red; }'),
    ['primary', 'success'],
  );
});

test('readThemeTokens: the kit theme declares 32 colour tokens', () => {
  const { tokens } = readThemeTokens(KIT_THEME);
  assert.equal(tokens.length, 32);
  for (const t of ['destructive', 'muted-foreground', 'primary', 'background']) assert.ok(tokens.includes(t), t);
});

test('readThemeTokens: missing, unparsable and token-less files yield an empty array', () => {
  const d = mkdtempSync(join(tmpdir(), 'webjsui-lint-theme-'));
  try {
    assert.deepEqual(readThemeTokens(join(d, 'nope.css')).tokens, []);
    writeFileSync(join(d, 'broken.css'), '@theme {\n --color-x: 1');
    assert.deepEqual(readThemeTokens(join(d, 'broken.css')).tokens, []);
    writeFileSync(join(d, 'empty.css'), '@import "tailwindcss";\n.x { color: red; }');
    const r = readThemeTokens(join(d, 'empty.css'));
    assert.deepEqual(r.tokens, []);
    assert.equal(r.path, join(d, 'empty.css'));
  } finally { rmSync(d, { recursive: true }); }
});

test('parseThemeTokens: a commented-out token is not a token, and a brace in a comment does not close the block', () => {
  const css = '/* @theme { --color-fake: red; } */\n@theme inline {\n  --color-a: red;\n  /* --color-old: blue; } */\n  --color-b: blue;\n}';
  assert.deepEqual(parseThemeTokens(css), ['a', 'b']);
});
