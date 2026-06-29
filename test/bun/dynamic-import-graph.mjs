/**
 * Cross-runtime proof that string-literal dynamic-import tracking (#751)
 * behaves identically on Node and Bun. webjs runs on Node 24+ OR Bun, and the
 * module-graph scanner + authorization gate (`reachableFromEntries`) sit on the
 * serve path that decides 404-vs-serve, so the dynamic-edge tracking must agree
 * across runtimes. Run from the repo root:
 *
 *   node test/bun/dynamic-import-graph.mjs
 *   bun  test/bun/dynamic-import-graph.mjs
 *
 * Asserts, on whichever runtime executes it: a string-literal `import('./x.ts')`
 * is admitted to the gate (servable) but kept out of the preload set, while the
 * `.server.*` boundary still holds for a dynamic import.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import {
  buildModuleGraph, reachableFromEntries, transitiveDeps, dynamicEdges,
} from '../../packages/server/src/module-graph.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

const dir = mkdtempSync(join(tmpdir(), 'webjs-751-bun-'));
function write(rel, body) {
  const abs = join(dir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
}
write('components/host.ts', `import { eager } from './eager.ts';
  export const load = () => import('./widget.ts');
  export const data = () => import('./data.server.ts');`);
write('components/eager.ts', `export const eager = 1;`);
write('components/widget.ts', `export const widget = 1;`);
write('components/data.server.ts', `'use server';
  import { secret } from './secret.server.ts';
  export async function getData() { return secret; }`);
write('components/secret.server.ts', `export const secret = 42;`);

const graph = await buildModuleGraph(dir);
const host = join(dir, 'components/host.ts');
const widget = join(dir, 'components/widget.ts');
const eager = join(dir, 'components/eager.ts');
const dataServer = join(dir, 'components/data.server.ts');
const secretServer = join(dir, 'components/secret.server.ts');

const servable = reachableFromEntries(graph, [host], dir);
assert.ok(servable.has(widget), `[${runtime}] dynamic target is servable`);
assert.ok(dynamicEdges(graph).get(host)?.has(widget), `[${runtime}] recorded as a dynamic edge`);
assert.ok(servable.has(dataServer), `[${runtime}] dynamic .server target admitted (stub)`);
assert.ok(!servable.has(secretServer), `[${runtime}] .server boundary holds (server-only import out)`);

const preload = transitiveDeps(graph, [host], dir);
assert.ok(preload.includes(eager), `[${runtime}] static import IS preloaded`);
assert.ok(!preload.includes(widget), `[${runtime}] dynamic import is NOT eagerly preloaded`);

console.log(`[dynamic-import-graph] #751 OK on ${runtime}`);
