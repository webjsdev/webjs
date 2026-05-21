import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { scaffoldApp } from '../../packages/cli/lib/create.js';

async function tempCwd() {
  return mkdtemp(join(tmpdir(), 'webjs-scaffold-'));
}

test('scaffoldApp rejects unknown templates', async () => {
  const cwd = await tempCwd();
  try {
    await assert.rejects(
      () => scaffoldApp('my-app', cwd, { template: 'todo' }),
      /Unknown template 'todo'/,
    );
    await assert.rejects(
      () => scaffoldApp('my-app', cwd, { template: 'blog' }),
      /Unknown template 'blog'/,
    );
    await assert.rejects(
      () => scaffoldApp('my-app', cwd, { template: 'ecommerce' }),
      /Unknown template 'ecommerce'/,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('scaffoldApp error message mentions the valid templates', async () => {
  const cwd = await tempCwd();
  try {
    try {
      await scaffoldApp('my-app', cwd, { template: 'nope' });
      assert.fail('should have thrown');
    } catch (err) {
      assert.match(err.message, /full-stack/);
      assert.match(err.message, /api/);
      assert.match(err.message, /saas/);
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
