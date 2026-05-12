import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getConfig, writeConfig, CONFIG_FILE } from '../src/utils/get-config.js';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'webjsui-config-'));
}

test('getConfig — returns null if components.json missing', () => {
  const d = tmp();
  try {
    assert.equal(getConfig(d), null);
  } finally { rmSync(d, { recursive: true }); }
});

test('writeConfig + getConfig — round-trip', () => {
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

test('getConfig — rejects invalid config', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, CONFIG_FILE), JSON.stringify({ aliases: {} }));
    assert.throws(() => getConfig(d));
  } finally { rmSync(d, { recursive: true }); }
});
