/**
 * The CLI keeps a copy of the server's env-file loader (it loads env before
 * the server package is imported). The two must stay byte-identical, or
 * `webjs dev` resolves PORT from one set of files and the server reads its
 * config from another.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('packages/cli/lib/env-files.js is byte-identical to the server copy', () => {
  const server = readFileSync(resolve(ROOT, 'packages/server/src/env-files.js'), 'utf8');
  const cli = readFileSync(resolve(ROOT, 'packages/cli/lib/env-files.js'), 'utf8');
  assert.equal(cli, server, 'edit both copies together');
});
