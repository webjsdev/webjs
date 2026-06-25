/**
 * Cross-runtime proof that `webjs db` / `typecheck` tooling resolves correctly
 * under Bun zero-install (#704). The cli spawns a tool via
 * `bun --preload <server pin> <runner> <pinned-bin-spec> <argv0> ...args`: the
 * cli pins the bin spec to the app-declared version, and the server pin preload
 * rewrites the tool's TRANSITIVE app imports (the user schema's bare deps) to the
 * app-declared versions, WITHOUT touching cached deps (which would break a CJS
 * module). This script spawns that exact shape and asserts both halves:
 *
 *   bun test/bun/zeroinstall-tooling.mjs
 *
 * It declares `lodash@4.17.20` (NOT latest, which is 4.17.21) so a successful
 * pin is observable as the loaded `_.VERSION`, and lodash is CommonJS so a
 * non-empty default export also proves the cache-excluding filter keeps CJS
 * intact. Bun-only (it spawns `bun --preload`); on Node it is a no-op pass.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

if (typeof Bun === 'undefined') {
  console.log('zeroinstall-tooling: skipped on Node (spawns bun --preload); covered on Bun.');
  process.exit(0);
}

const preload = join(repoRoot, 'packages/server/src/bun-pin-preload.js');
const runner = join(repoRoot, 'packages/cli/lib/bun-tool-run.mjs');

const dir = mkdtempSync(join(tmpdir(), 'webjs-zi-tool-'));
try {
  // No node_modules: genuine zero-install. Declare a NON-latest exact version.
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'app', dependencies: { lodash: '4.17.20' } }));
  // A "tool bin" that loads the user schema (mimics drizzle-kit/bin.cjs).
  writeFileSync(join(dir, 'tool-bin.mjs'), "await import('./schema.mjs');\n");
  // The user schema imports a BARE declared dep (mimics db/schema.server.ts).
  writeFileSync(join(dir, 'schema.mjs'),
    "import _ from 'lodash';\nconsole.log('RESULT ' + JSON.stringify({ version: _.VERSION, hasGet: typeof _.get }));\n");

  // The cli pre-pins the bin spec; here the "bin" is the local tool-bin file.
  const r = spawnSync('bun', ['--preload', preload, runner, join(dir, 'tool-bin.mjs'), 'drizzle-kit', 'generate'],
    { cwd: dir, encoding: 'utf8', timeout: 120000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const m = out.match(/RESULT (\{.*\})/);
  assert.ok(m, 'the tool ran and the schema loaded; got:\n' + out.slice(0, 400));
  const got = JSON.parse(m[1]);

  // Pinning: the bare `import 'lodash'` resolved to the app-declared 4.17.20,
  // NOT bun's default latest (4.17.21).
  assert.equal(got.version, '4.17.20', 'the schema dep was pinned to the app-declared version, not latest');
  // CJS intact: the cache-excluding filter left lodash (CommonJS) loadable.
  assert.equal(got.hasGet, 'function', 'the CommonJS dep kept its exports (cache files not rewritten)');

  console.log('zeroinstall-tooling: OK (pinned lodash@4.17.20, CJS exports intact)');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
