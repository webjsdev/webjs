import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getConfig, writeConfig, CONFIG_FILE } from '../src/utils/get-config.js';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'webjsui-config-'));
}

test('getConfig: returns null if components.json missing', () => {
  const d = tmp();
  try {
    assert.equal(getConfig(d), null);
  } finally { rmSync(d, { recursive: true }); }
});

test('writeConfig + getConfig: round-trip', () => {
  const d = tmp();
  try {
    const cfg = {
      style: 'default',
      tailwind: { css: 'app/globals.css', baseColor: 'neutral', cssVariables: true },
      aliases: { components: 'components', utils: 'lib/utils' },
    };
    writeConfig(d, cfg);
    const parsed = getConfig(d);
    assert.equal(parsed.tailwind.baseColor, 'neutral');
    assert.equal(parsed.aliases.components, 'components');
    assert.ok(parsed.resolvedPaths.cwd);
    assert.ok(parsed.resolvedPaths.ui.endsWith('components/ui'));
  } finally { rmSync(d, { recursive: true }); }
});

test('getConfig: rejects invalid config', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, CONFIG_FILE), JSON.stringify({ aliases: {} }));
    assert.throws(() => getConfig(d));
  } finally { rmSync(d, { recursive: true }); }
});

test('getConfig: a `lint` block round-trips with no get-config change', () => {
  const d = tmp();
  try {
    writeConfig(d, {
      style: 'default',
      tailwind: { css: 'public/input.css', baseColor: 'neutral', cssVariables: true },
      aliases: { components: 'components', utils: 'lib/utils/cn', ui: 'components/ui', lib: 'lib' },
      lint: {
        ignore: ['app/legacy/**'],
        rules: {
          'no-raw-colors': 'warn',
          'no-restyle': { severity: 'error', allow: ['layout', 'rounded'] },
        },
      },
    });
    const parsed = getConfig(d);
    assert.equal(parsed.lint.rules['no-restyle'].severity, 'error');
    assert.deepEqual(parsed.lint.rules['no-restyle'].allow, ['layout', 'rounded']);
    assert.equal(parsed.lint.rules['no-raw-colors'], 'warn');
    assert.deepEqual(parsed.lint.ignore, ['app/legacy/**']);
    assert.ok(parsed.resolvedPaths.tailwindCss.endsWith('public/input.css'));
  } finally { rmSync(d, { recursive: true }); }
});

test('getConfig: a `lint` block with an unknown rule or severity throws (strict schemas)', () => {
  const base = {
    style: 'default',
    tailwind: { css: 'public/input.css' },
    aliases: { components: 'components', utils: 'lib/utils/cn' },
  };
  const d = tmp();
  try {
    writeConfig(d, { ...base, lint: { rules: { 'no-such-rule': 'warn' } } });
    assert.throws(() => getConfig(d));
    writeConfig(d, { ...base, lint: { rules: { 'no-raw-colors': 'loud' } } });
    assert.throws(() => getConfig(d));
    writeConfig(d, { ...base, lint: { rules: { 'no-raw-colors': { severity: 'warn', alow: [] } } } });
    assert.throws(() => getConfig(d));
  } finally { rmSync(d, { recursive: true }); }
});
