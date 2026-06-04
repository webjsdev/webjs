/**
 * Tests for #272: the agent-docs/recipes.md restore (the schema-first recipe +
 * the anti-pattern warnings + the common recipes the root AGENTS.md references)
 * and the deployment-doc Prisma connection-pool section.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequestHandler } from '@webjsdev/server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const DOCS_DIR = resolve(ROOT, 'docs');

test('agent-docs/recipes.md exists so the AGENTS.md references resolve', async () => {
  const path = resolve(ROOT, 'agent-docs', 'recipes.md');
  assert.ok(existsSync(path), 'agent-docs/recipes.md must exist');
  // The root AGENTS.md references it; that link must point at a real file.
  const agents = await readFile(resolve(ROOT, 'AGENTS.md'), 'utf8');
  assert.ok(agents.includes('agent-docs/recipes.md'), 'AGENTS.md references recipes.md');
});

test('recipes.md has the schema-first recipe, the anti-pattern warnings, and the common recipes', async () => {
  const md = await readFile(resolve(ROOT, 'agent-docs', 'recipes.md'), 'utf8');
  // Schema-first recipe + its steps.
  assert.ok(/Schema-first/i.test(md), 'has the schema-first recipe');
  assert.ok(md.includes('db:migrate'), 'covers the migrate step');
  assert.ok(/queries\/|actions\//.test(md), 'covers one-file-per query/action');
  // The two non-negotiable anti-patterns are called out explicitly.
  assert.ok(/NEVER leave the example/i.test(md), 'warns against the example User model');
  assert.ok(/NEVER persist app data|JSON files/i.test(md), 'warns against JSON-file persistence');
  // The common recipes the AGENTS.md recipes section points at are present.
  for (const recipe of ['Add a page', 'Add a dynamic route', 'Add a server action', 'Add a component']) {
    assert.ok(md.includes(recipe), `recipes.md must include "${recipe}"`);
  }
});

test('the deployment doc documents Prisma connection pooling for Postgres', async () => {
  const app = await createRequestHandler({ appDir: DOCS_DIR, dev: false });
  if (app.warmup) await app.warmup();
  const res = await app.handle(new Request('http://localhost/docs/deployment'));
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('connection_limit'), 'documents connection_limit');
  assert.ok(/pooler|PgBouncer/i.test(html), 'documents when to use a pooler');
  assert.ok(/max_connections/.test(html), 'explains the max_connections constraint');
  assert.ok(/DATABASE_URL="postgresql:/.test(html), 'gives a concrete DATABASE_URL example');
  assert.ok(/single|one Node process|per instance/i.test(html), 'sizes it for the single-process server');
});
