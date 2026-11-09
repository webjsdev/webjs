/**
 * Cross-runtime proof that WebJs loads env files in Next.js's order on both
 * runtimes. Bun has no `process.loadEnvFile` (the loader this replaces), so
 * a Bun app used to see none of its `.env` through the framework.
 *
 *   node test/bun/env-files.mjs
 *   bun --no-env-file test/bun/env-files.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { loadEnvFiles } = await import(pathToFileURL(resolve(__dirname, '../../packages/server/src/env-files.js')).href);
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

const dir = mkdtempSync(join(tmpdir(), 'wj-env-'));
try {
  writeFileSync(join(dir, '.env'), 'A=env\nB=env\nC=env\n');
  writeFileSync(join(dir, '.env.production'), 'A=prod\nB=prod\n');
  writeFileSync(join(dir, '.env.local'), 'A=local\n');
  const env = {};
  const loaded = loadEnvFiles(dir, 'production', env);
  assert.deepEqual(env, { A: 'local', B: 'prod', C: 'env' }, `precedence on ${runtime}`);
  assert.deepEqual(loaded, ['.env.local', '.env.production', '.env']);
  writeFileSync(join(dir, '.env'), "HOST=db\nURL=postgres://${HOST}:${PORT:-5432}/app\nRAW='$HOST'\n");
  const expanded = {};
  loadEnvFiles(dir, 'test', expanded);
  assert.equal(expanded.URL, 'postgres://db:5432/app', `\${NAME} and \${NAME:-default} expand on ${runtime}`);
  assert.equal(expanded.RAW, '$HOST', `a single-quoted value is left as written on ${runtime}`);
  console.log(`ok env files on ${runtime}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
