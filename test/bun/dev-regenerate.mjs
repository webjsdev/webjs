/**
 * Cross-runtime proof that on-request regeneration (#967) and its build record
 * (#1672) behave identically on Node and Bun. WebJs runs on Node 24+ OR Bun
 * (#508), and this feature exercises runtime-sensitive surfaces:
 * `child_process.spawn` with `shell: true` + a `node_modules/.bin`-augmented
 * PATH (exit codes and signals), `fs/promises` stat / readdir / rename, the
 * temp-file-then-rename manifest write, and `node:crypto` hashing. Run from the
 * repo root:
 *
 *   node test/bun/dev-regenerate.mjs
 *   bun  test/bun/dev-regenerate.mjs
 *
 * Every command is a portable POSIX shell line, so it needs no compiler and no
 * `node`/`bun` on PATH. Each appends to `ran.log`, which counts the runs.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  maybeRegenerate,
  readRegenerateRules,
  readRegenerateManifest,
  regenerateOutputs,
  regenerateStatus,
  REGENERATE_MANIFEST,
  _resetInFlight,
} from '../../packages/server/src/dev-regenerate.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const OUT = 'public/tailwind.css';

/** An app with one rule running `command`, sources, and an existing output. */
function app(command) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-1672-bun-'));
  mkdirSync(join(dir, 'app'), { recursive: true });
  mkdirSync(join(dir, 'public'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'x',
    webjs: { dev: { regenerate: [{ output: OUT, command, inputs: ['app', 'public/input.css'] }] } },
  }));
  writeFileSync(join(dir, 'public', 'input.css'), '@import "tailwindcss";');
  writeFileSync(join(dir, 'app', 'page.ts'), 'export default () => 1;');
  writeFileSync(join(dir, OUT), '.old{}');
  return dir;
}
const runs = (dir) => (existsSync(join(dir, 'ran.log')) ? readFileSync(join(dir, 'ran.log'), 'utf8').length : 0);
const css = (dir) => readFileSync(join(dir, OUT), 'utf8');
const quiet = { warn: () => {} };

// readRegenerateRules parses + normalizes the same on both runtimes.
{
  const dir = app('true');
  const rules = await readRegenerateRules(dir);
  assert.equal(rules.length, 1, `[${runtime}] one rule parsed`);
  assert.equal(rules[0].output, OUT, `[${runtime}] output normalized`);
}

// A build is recorded, and a rebuild with UNCHANGED bytes is then fresh. The
// command writes the same bytes every time, the shape of an edit that adds no
// class. Before #1672 that left the output older than its inputs forever.
{
  _resetInFlight();
  const dir = app(`printf x >> ran.log; printf '.same{}' > ${OUT}`);
  const rules = await readRegenerateRules(dir);
  await maybeRegenerate(dir, OUT, rules, quiet);
  assert.equal(runs(dir), 1, `[${runtime}] an unrecorded output is built`);
  assert.ok(existsSync(join(dir, REGENERATE_MANIFEST)), `[${runtime}] the build is recorded`);
  writeFileSync(join(dir, 'app', 'page.ts'), 'export default () => 2;');
  await maybeRegenerate(dir, OUT, rules, quiet);
  assert.equal(runs(dir), 2, `[${runtime}] an edit rebuilds`);
  await maybeRegenerate(dir, OUT, rules, quiet);
  assert.equal(runs(dir), 2, `[${runtime}] the identical output is fresh`);
  assert.equal(css(dir), '.same{}', `[${runtime}] output intact`);
}

// The output is moved aside, so a command that exits 0 without writing it is
// caught: the old output is restored, nothing is recorded, and it retries.
{
  _resetInFlight();
  const dir = app(`printf x >> ran.log; printf '.x{}' > public/elsewhere.css`);
  const rules = await readRegenerateRules(dir);
  const warned = [];
  await maybeRegenerate(dir, OUT, rules, { warn: (m) => warned.push(m) });
  assert.equal(css(dir), '.old{}', `[${runtime}] previous output restored`);
  assert.match(warned[0] || '', /did not write public\/tailwind\.css/, `[${runtime}] the misconfigured rule is named`);
  await maybeRegenerate(dir, OUT, rules, quiet);
  assert.equal(runs(dir), 2, `[${runtime}] and it is retried, not recorded`);
}

// A failing command and a command killed by a signal are never recorded.
for (const tail of ['exit 3', 'kill -TERM $$']) {
  _resetInFlight();
  const dir = app(`printf x >> ran.log; printf '.half' > ${OUT}; ${tail}`);
  const rules = await readRegenerateRules(dir);
  await maybeRegenerate(dir, OUT, rules, quiet);
  assert.equal(css(dir), '.old{}', `[${runtime}] ${tail}: last good output restored`);
  assert.equal((await readRegenerateManifest(dir)).outputs[OUT], undefined, `[${runtime}] ${tail}: nothing recorded`);
  await maybeRegenerate(dir, OUT, rules, quiet);
  assert.equal(runs(dir), 2, `[${runtime}] ${tail}: retried`);
}

// An input dated in the future does not hide a later edit, and a deleted input
// is seen: freshness is fingerprint equality, not mtime ordering.
{
  _resetInFlight();
  const dir = app(`printf x >> ran.log; printf '.y{}' > ${OUT}`);
  const future = new Date(Date.now() + 86_400_000);
  writeFileSync(join(dir, 'app', 'restored.ts'), 'export const a = 1;');
  utimesSync(join(dir, 'app', 'restored.ts'), future, future);
  const rules = await readRegenerateRules(dir);
  await maybeRegenerate(dir, OUT, rules, quiet);
  writeFileSync(join(dir, 'app', 'page.ts'), 'export default () => "flex";');
  await maybeRegenerate(dir, OUT, rules, quiet);
  assert.equal(runs(dir), 2, `[${runtime}] an edit after a future-dated input is seen`);
  unlinkSync(join(dir, 'app', 'restored.ts'));
  await maybeRegenerate(dir, OUT, rules, quiet);
  assert.equal(runs(dir), 3, `[${runtime}] a deleted input is seen`);
}

// An output inside its own input directory is not counted as an input, so
// rewriting it does not invalidate the build that wrote it.
{
  _resetInFlight();
  const dir = app(`printf x >> ran.log; printf '.w{}' > ${OUT}`);
  const rules = (await readRegenerateRules(dir)).map((r) => ({ ...r, inputs: ['app', 'public'] }));
  await maybeRegenerate(dir, OUT, rules, quiet);
  await maybeRegenerate(dir, OUT, rules, quiet);
  assert.equal(runs(dir), 1, `[${runtime}] the output is not its own input`);
}

// regenerateOutputs (the `webjs regenerate` engine) and regenerateStatus (what
// the doctor reads) agree with the dev path.
{
  _resetInFlight();
  const dir = app(`printf x >> ran.log; printf '.z{}' > ${OUT}`);
  assert.equal((await regenerateStatus(dir))[0].state, 'unrecorded', `[${runtime}] unrecorded before a build`);
  const [r] = await regenerateOutputs(dir, quiet);
  assert.equal(r.built && r.ok, true, `[${runtime}] built by regenerateOutputs`);
  assert.equal((await regenerateStatus(dir))[0].state, 'fresh', `[${runtime}] fresh after it`);
  await maybeRegenerate(dir, OUT, await readRegenerateRules(dir), quiet);
  assert.equal(runs(dir), 1, `[${runtime}] the dev path trusts that record`);
}

console.log(`[dev-regenerate] #967/#1672 regeneration + build record OK on ${runtime}`);
