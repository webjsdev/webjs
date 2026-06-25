// The spawn preload (#704) reads the app's pinned dep versions from cwd. The Bun
// onLoad side effect is a no-op on Node (typeof Bun === 'undefined'), so importing
// the module here is safe and `pinVersionsFor` is unit-testable without Bun.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pinVersionsFor } from '../../src/bun-pin-preload.js';

test('pinVersionsFor: bun.lock exact wins, package.json semver forwards, no manifest is empty', () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-preload-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    dependencies: { 'drizzle-orm': '1.0.0-rc.3', zod: '^3.0.0', local: 'workspace:*' },
  }));
  // Same source as the server pin, so the spawned tool and the server agree.
  assert.deepEqual(pinVersionsFor(dir), { 'drizzle-orm': '1.0.0-rc.3', zod: '^3.0.0' });

  writeFileSync(join(dir, 'bun.lock'), '{\n  "packages": {\n    "zod": ["zod@3.22.4", "", {}, "sha512-x"]\n  }\n}');
  assert.equal(pinVersionsFor(dir).zod, '3.22.4', 'bun.lock exact wins over the range');

  assert.deepEqual(pinVersionsFor(join(tmpdir(), 'webjs-preload-none-' + Date.now())), {}, 'no package.json -> empty');
});
