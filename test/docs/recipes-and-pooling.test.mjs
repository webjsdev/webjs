/**
 * Tests for #272 (updated in #969, and again when the agent skill was replaced
 * by the brief): the canonical recipes are now the brief itself (routing, server
 * actions, components) plus the scaffold AGENTS.md's persistence rule, and the
 * deployment doc carries the Postgres connection-pool section.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createRequestHandler } from '@webjsdev/server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
// The docs are served by the marketing app at webjs.dev/docs.
const DOCS_DIR = resolve(ROOT, 'website');

test('the brief and the scaffold AGENTS.md carry the canonical recipes and the persistence rule', async () => {
  const { BRIEF } = await import(resolve(ROOT, 'packages', 'mcp', 'src', 'brief.js'));
  // A page, a dynamic route, a server action, an interactive component.
  for (const p of ['app/page.ts', '[param]', "'use server'", 'WebComponent']) {
    assert.ok(BRIEF.includes(p), `the brief must name ${p}`);
  }
  const scaffold = await readFile(resolve(ROOT, 'packages', 'cli', 'templates', 'AGENTS.md'), 'utf8');
  // The persistence anti-pattern (never JSON files).
  assert.ok(/never in a JSON file/i.test(scaffold), 'the scaffold AGENTS.md warns against JSON-file persistence');
});

test('the deployment doc documents Postgres connection pooling', async () => {
  const app = await createRequestHandler({ appDir: DOCS_DIR, dev: false });
  if (app.warmup) await app.warmup();
  const res = await app.handle(new Request('http://localhost/docs/deployment'));
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(/new Pool\(\{[^}]*max|max: (1|10)/.test(html), 'documents bounding the pg Pool with max (not a Prisma connection_limit URL param)');
  assert.ok(/pooler|PgBouncer/i.test(html), 'documents when to use a pooler');
  assert.ok(/max_connections/.test(html), 'explains the max_connections constraint');
  assert.ok(/DATABASE_URL="postgresql:/.test(html), 'gives a concrete DATABASE_URL example');
  assert.ok(/single|one Node process|per instance/i.test(html), 'sizes it for the single-process server');
});
