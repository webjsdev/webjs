import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  registryItemSchema,
  registrySchema,
  rawConfigSchema,
} from '../src/registry/schema.js';

test('registryItemSchema: accepts a minimal ui item', () => {
  const item = {
    name: 'button',
    type: 'registry:ui',
    files: [{ path: 'components/button.ts', type: 'registry:ui', content: '' }],
  };
  assert.doesNotThrow(() => registryItemSchema.parse(item));
});

test('registryItemSchema: rejects unknown type', () => {
  assert.throws(() => registryItemSchema.parse({ name: 'x', type: 'registry:wat', files: [] }));
});

test('registryItemSchema: registry:file requires target', () => {
  assert.throws(() =>
    registryItemSchema.parse({
      name: 'x',
      type: 'registry:file',
      files: [{ path: 'x.css', type: 'registry:file' /* no target */ }],
    }),
  );
});

test('registrySchema: accepts the full manifest shape', () => {
  const manifest = {
    name: 'test',
    items: [
      { name: 'button', type: 'registry:ui', files: [{ path: 'b.ts', type: 'registry:ui' }] },
      { name: 'card', type: 'registry:ui', files: [{ path: 'c.ts', type: 'registry:ui' }] },
    ],
  };
  assert.doesNotThrow(() => registrySchema.parse(manifest));
});

test('rawConfigSchema: fills defaults', () => {
  const parsed = rawConfigSchema.parse({
    style: 'default',
    tailwind: { css: 'app/globals.css', baseColor: 'neutral' },
    aliases: { components: 'components', utils: 'lib/utils' },
  });
  assert.equal(parsed.tailwind.cssVariables, true);
  assert.equal(parsed.iconLibrary, 'lucide');
});

test('rawConfigSchema: rejects missing tailwind', () => {
  assert.throws(() =>
    rawConfigSchema.parse({ style: 'default', aliases: { components: 'c', utils: 'u' } }),
  );
});

test('rawConfigSchema: `lint` is optional, and a rule takes a bare severity or the object form', () => {
  const base = {
    style: 'default',
    tailwind: { css: 'app/globals.css' },
    aliases: { components: 'components', utils: 'lib/utils' },
  };
  // Every existing components.json (no `lint` key) still validates.
  assert.equal(rawConfigSchema.parse(base).lint, undefined);
  const parsed = rawConfigSchema.parse({
    ...base,
    lint: {
      rules: {
        'no-raw-colors': 'error',
        'no-arbitrary-values': { allow: ['layout'] },
        'no-restyle': { severity: 'error', allow: ['layout', 'rounded'] },
      },
    },
  });
  assert.equal(parsed.lint.rules['no-raw-colors'], 'error');
  // The object form defaults `severity` to warn.
  assert.equal(parsed.lint.rules['no-arbitrary-values'].severity, 'warn');
  assert.deepEqual(parsed.lint.rules['no-arbitrary-values'].allow, ['layout']);
  assert.deepEqual(parsed.lint.ignore, []);
  // An empty block is valid: every rule is absent, so every rule is off.
  assert.deepEqual(rawConfigSchema.parse({ ...base, lint: {} }).lint.rules, {});
});
