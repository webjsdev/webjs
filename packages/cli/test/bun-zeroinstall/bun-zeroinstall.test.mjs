// #704: running spawned CLI tooling (drizzle-kit, tsc) under Bun zero-install.
// The pure helpers are unit-tested here; the real bun --preload spawn behaviour
// (pinning a tool's transitive import without breaking a CJS dep) is a
// cross-runtime assertion under bun.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isBunZeroInstall, pinnedBinSpec, bunToolArgv } from '../../lib/bun-zeroinstall.js';

test('isBunZeroInstall: false on Node (no process.versions.bun), regardless of node_modules', () => {
  assert.equal(isBunZeroInstall(process.cwd()), false);
});

test('pinnedBinSpec: pins to the app-declared version, bare when undeclared/unsafe', () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-zi-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    dependencies: { 'drizzle-kit': '1.0.0-rc.3', caretpre: '^1.0.0-rc.3' },
  }));
  assert.equal(pinnedBinSpec('drizzle-kit', 'bin.cjs', dir), 'drizzle-kit@1.0.0-rc.3/bin.cjs',
    'exact declared version is inlined');
  assert.equal(pinnedBinSpec('typescript', 'bin/tsc', dir), 'typescript/bin/tsc',
    'undeclared tool stays bare (resolves to latest)');
  assert.equal(pinnedBinSpec('caretpre', 'bin', dir), 'caretpre/bin',
    'a caret-prerelease is not inline-safe (#703), so it stays bare');
});

test('bunToolArgv: --preload <preload> <runner> <binSpec> <argv0> ...args', () => {
  const argv = bunToolArgv({
    preloadPath: '/abs/bun-pin-preload.js', binSpec: 'drizzle-kit@1.0.0-rc.3/bin.cjs',
    argv0: 'drizzle-kit', args: ['generate', '--config', 'drizzle.config.ts'],
  });
  assert.equal(argv[0], '--preload');
  assert.equal(argv[1], '/abs/bun-pin-preload.js');
  assert.ok(argv[2].endsWith('bun-tool-run.mjs'), 'runner is third');
  assert.equal(argv[3], 'drizzle-kit@1.0.0-rc.3/bin.cjs', 'pinned bin spec is passed');
  assert.equal(argv[4], 'drizzle-kit', 'argv0 for the tool CLI');
  assert.deepEqual(argv.slice(5), ['generate', '--config', 'drizzle.config.ts']);
});
