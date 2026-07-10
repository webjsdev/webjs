/**
 * Cross-runtime app-source deploy signal (#899). The signal is composed from a
 * full-source `fs` walk (`seenFilesFor`) and a `node:crypto` digest
 * (`setAppSourceId`), both of which Bun implements independently, so the signal
 * must derive identically on Node and Bun. Run:
 *
 *   node test/bun/app-source-signal.mjs
 *   bun  test/bun/app-source-signal.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const graphMod = pathToFileURL(join(ROOT, 'packages/server/src/module-graph.js')).href;
const importmapMod = pathToFileURL(join(ROOT, 'packages/server/src/importmap.js')).href;

const { buildModuleGraph, seenFilesFor } = await import(graphMod);
const { setAppSourceId, appSourceId } = await import(importmapMod);

// Full-source walk includes a server-only leaf.
const dir = mkdtempSync(join(tmpdir(), 'webjs-bun-appsrc-'));
mkdirSync(join(dir, 'app'), { recursive: true });
mkdirSync(join(dir, 'lib'), { recursive: true });
writeFileSync(join(dir, 'app', 'page.ts'), 'export default () => 1;\n');
writeFileSync(join(dir, 'lib', 'q.server.ts'), "export const q = 'ssr-only';\n");
const seen = [...seenFilesFor(await buildModuleGraph(dir))].map((p) => p.slice(dir.length));
assert.ok(seen.some((p) => p.endsWith('/app/page.ts')), `page in source set on ${runtime}`);
assert.ok(seen.some((p) => p.endsWith('/lib/q.server.ts')), `server-only file in source set on ${runtime}`);

// The digest is deterministic and matches the same value both runtimes produce
// for a fixed input (sha256 hex, first 16 chars).
setAppSourceId('a:1\nb:2\n@webjsdev/server:0.8.0');
const id = appSourceId();
assert.equal(id, '271c02b6b5d0150b', `the fixed input digests to the SAME known value on ${runtime} (cross-runtime identity)`);
setAppSourceId('a:1\nb:2\n@webjsdev/server:0.8.0');
assert.equal(appSourceId(), id, `deterministic on ${runtime}`);
setAppSourceId('a:1\nb:9\n@webjsdev/server:0.8.0');
assert.notEqual(appSourceId(), id, `a source byte change moves the id on ${runtime}`);

console.log(`OK  app-source signal derives identically (fs walk + crypto digest) on ${runtime} (#899)`);
