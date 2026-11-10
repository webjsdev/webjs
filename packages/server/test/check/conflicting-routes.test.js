/**
 * `no-conflicting-routes` (#1686): two files that resolve to one url, the two
 * conflicts Next.js refuses at build time. Each case has a legal neighbour
 * beside it, since route groups and dynamic segments are both ordinary.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { checkConventions, RULES } from '../../src/check.js';

const page = "import { html } from '@webjsdev/core';\nexport default () => html`<p>x</p>`;\n";
const handler = 'export async function GET() { return new Response("ok"); }\n';

async function hits(files) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-conflicting-routes-'));
  try {
    for (const [rel, body] of Object.entries(files)) {
      await mkdir(dirname(join(dir, rel)), { recursive: true });
      await writeFile(join(dir, rel), body);
    }
    return (await checkConventions(dir)).filter((v) => v.rule === 'no-conflicting-routes');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('the rule is listed', () => {
  assert.ok(RULES.some((r) => r.name === 'no-conflicting-routes'));
});

test('two route groups serving the same url are refused', async () => {
  const v = await hits({ 'app/(marketing)/page.ts': page, 'app/(app)/page.ts': page });
  assert.equal(v.length, 1);
  assert.equal(v[0].file, 'app/(marketing)/page.ts');
  assert.match(v[0].message, /same URL as app\/\(app\)\/page\.ts/);
});

test('route groups at different urls are fine', async () => {
  assert.equal((await hits({ 'app/(marketing)/page.ts': page, 'app/(app)/dashboard/page.ts': page })).length, 0);
});

test('two param names at one dynamic position are refused', async () => {
  const v = await hits({ 'app/posts/[id]/page.ts': page, 'app/(blog)/posts/[slug]/page.ts': page });
  assert.equal(v.length, 1);
});

test('a page and a route handler at one url are refused; under api/ it is fine', async () => {
  const v = await hits({ 'app/feed/page.ts': page, 'app/feed/route.ts': handler });
  assert.equal(v.length, 1);
  assert.equal(v[0].file, 'app/feed/route.ts');
  assert.equal((await hits({ 'app/feed/page.ts': page, 'app/api/feed/route.ts': handler })).length, 0);
});
