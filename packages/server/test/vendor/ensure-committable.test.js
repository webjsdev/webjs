// Tests for ensureVendorCommittable (#448): after `webjs vendor pin` writes
// its (opt-in) output to .webjs/vendor/, that output must be committable. A
// .gitignore that excludes `.webjs/` silently swallows the pins the user
// deliberately created. This helper self-heals the app's .gitignore when the
// pin output is ignored, and is a no-op when it is already committable.
//
// The tests build real git repos in a tmp dir and assert via `git check-ignore`
// (the same probe webjs check uses), so they prove the END STATE: not ignored.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureVendorCommittable } from '../../src/vendor.js';

// The scaffold's correct three-line vendor exception.
const SCAFFOLD_IGNORE =
  '# deps\nnode_modules/\n\n# webjs caches\n**/.webjs/*\n!**/.webjs/vendor/\n!**/.webjs/vendor/**\n';

/** Strip inherited GIT_* so cwd is the sole repo authority (mirrors the helper). */
function gitEnv() {
  const { GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, GIT_PREFIX, ...rest } = process.env;
  return rest;
}

/** True when `git check-ignore -q <rel>` reports the path as ignored in `dir`. */
function isIgnored(dir, rel) {
  const r = spawnSync('git', ['check-ignore', '-q', rel], { cwd: dir, stdio: 'pipe', env: gitEnv() });
  return r.status === 0;
}

/** Create an isolated git repo at a fresh tmp dir with the given .gitignore. */
async function makeRepo(gitignore) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-vendor-commit-'));
  spawnSync('git', ['init', '-q'], { cwd: dir, env: gitEnv() });
  if (gitignore != null) await writeFile(join(dir, '.gitignore'), gitignore);
  // Write a representative pin file so check-ignore probes a real path.
  await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
  await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), '{"imports":{}}');
  return dir;
}

const PROBE = '.webjs/vendor/importmap.json';

test('patches a .gitignore that swallows the pins, making them committable', async () => {
  const dir = await makeRepo('# deps\nnode_modules/\n.webjs/\n');
  try {
    assert.equal(isIgnored(dir, PROBE), true, 'precondition: a bare `.webjs/` ignores the pin');

    const r = await ensureVendorCommittable(dir);
    assert.deepEqual(r, { ignored: true, patched: true, gitignorePath: join(dir, '.gitignore') });

    // The end state the issue asks for: the pin is NOT ignored anymore.
    assert.equal(isIgnored(dir, PROBE), false, 'pin is committable after the patch');

    const text = await readFile(join(dir, '.gitignore'), 'utf8');
    assert.match(text, /^!\*\*\/\.webjs\/vendor\/$/m);
    assert.match(text, /^!\*\*\/\.webjs\/vendor\/\*\*$/m);
    // The bare `.webjs/` DIRECTORY exclusion must be rewritten to the glob
    // form, because git cannot re-include a child of an excluded directory;
    // a plain append would leave the pin ignored.
    assert.doesNotMatch(text, /^\.webjs\/$/m, 'bare `.webjs/` directory exclusion rewritten');
    assert.match(text, /^\*\*\/\.webjs\/\*$/m, 'rewritten to the contents-glob form');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('healing keeps the transient `.webjs` caches ignored', async () => {
  // The no-vendor default must not regress: routes.d.ts and other cache
  // output stay out of git after we make the vendor pin committable.
  const dir = await makeRepo('.webjs/\n');
  try {
    await mkdir(join(dir, '.webjs'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'routes.d.ts'), 'export {}');
    const r = await ensureVendorCommittable(dir);
    assert.equal(r.patched, true);
    assert.equal(isIgnored(dir, '.webjs/vendor/importmap.json'), false, 'vendor committable');
    assert.equal(isIgnored(dir, '.webjs/routes.d.ts'), true, 'cache still ignored');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a broader unrelated rule that the exception cannot fix: revert + report not-patched', async () => {
  // `.web*/` excludes the `.webjs` DIRECTORY via a glob the rewrite does
  // not normalize, so git can never re-include a child of it. The vendor
  // exception cannot help; the helper must not claim success and must
  // leave the .gitignore exactly as it found it.
  const dir = await makeRepo('.web*/\n');
  try {
    assert.equal(isIgnored(dir, PROBE), true, 'precondition: .web*/ ignores the pin');
    const before = await readFile(join(dir, '.gitignore'), 'utf8');
    const r = await ensureVendorCommittable(dir);
    assert.deepEqual(r, { ignored: true, patched: false, gitignorePath: join(dir, '.gitignore') });
    const after = await readFile(join(dir, '.gitignore'), 'utf8');
    assert.equal(after, before, 'edit reverted when it could not make the pin committable');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a CRLF .gitignore is healed and stays consistently CRLF', async () => {
  // A Windows-checkout .gitignore uses CRLF endings. The heal rewrites a
  // line and appends a block; both must use CRLF so the file does not end
  // up mixed (mixed endings churn diffs and trip some tooling).
  const dir = await makeRepo('# deps\r\nnode_modules/\r\n.webjs/\r\n');
  try {
    assert.equal(isIgnored(dir, PROBE), true, 'precondition: CRLF `.webjs/` ignores the pin');

    const r = await ensureVendorCommittable(dir);
    assert.equal(r.patched, true);
    assert.equal(isIgnored(dir, PROBE), false, 'pin is committable after the patch');

    const text = await readFile(join(dir, '.gitignore'), 'utf8');
    // Every line ending is CRLF: no bare LF that is not preceded by CR.
    assert.doesNotMatch(text, /(^|[^\r])\n/, 'no bare-LF line ending survives');
    assert.match(text, /\r\n/, 'still CRLF');
    // The rewritten exclusion and the appended negations are present.
    assert.match(text, /^\*\*\/\.webjs\/\*\r$/m, 'bare `.webjs/` rewritten with CRLF');
    assert.match(text, /^!\*\*\/\.webjs\/vendor\/\r$/m);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a `.webjs/**` glob exclusion is made committable by appending the exception', async () => {
  // `.webjs/**` excludes the directory's contents (not the directory
  // itself), so unlike a bare `.webjs/` the later negation CAN re-include
  // vendor. The rewrite does not touch it; the append + re-probe suffices.
  const dir = await makeRepo('node_modules/\n.webjs/**\n');
  try {
    assert.equal(isIgnored(dir, PROBE), true, 'precondition: `.webjs/**` ignores the pin');
    await writeFile(join(dir, '.webjs', 'routes.d.ts'), 'export {}');

    const r = await ensureVendorCommittable(dir);
    assert.equal(r.patched, true);
    assert.equal(isIgnored(dir, PROBE), false, 'pin committable after append');
    assert.equal(isIgnored(dir, '.webjs/routes.d.ts'), true, 'cache still ignored');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a `.webjs/*` glob exclusion is made committable by appending the exception', async () => {
  // `.webjs/*` is a very common form (it is what the scaffold uses, minus
  // the `**/` prefix). It excludes direct children only, so the vendor
  // negation re-includes the pin without any rewrite.
  const dir = await makeRepo('node_modules/\n.webjs/*\n');
  try {
    assert.equal(isIgnored(dir, PROBE), true, 'precondition: `.webjs/*` ignores the pin');
    await writeFile(join(dir, '.webjs', 'routes.d.ts'), 'export {}');

    const r = await ensureVendorCommittable(dir);
    assert.equal(r.patched, true);
    assert.equal(isIgnored(dir, PROBE), false, 'pin committable after append');
    assert.equal(isIgnored(dir, '.webjs/routes.d.ts'), true, 'cache still ignored');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('no-vendor / already-correct app: .gitignore is left byte-for-byte unchanged', async () => {
  const dir = await makeRepo(SCAFFOLD_IGNORE);
  try {
    assert.equal(isIgnored(dir, PROBE), false, 'scaffold already un-ignores vendor');
    const before = await readFile(join(dir, '.gitignore'), 'utf8');

    const r = await ensureVendorCommittable(dir);
    assert.deepEqual(r, { ignored: false, patched: false, gitignorePath: null });

    const after = await readFile(join(dir, '.gitignore'), 'utf8');
    assert.equal(after, before, 'a committable app sees no .gitignore change');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('is idempotent: a second pin does not duplicate the exception lines', async () => {
  const dir = await makeRepo('.webjs/\n');
  try {
    await ensureVendorCommittable(dir);
    const afterFirst = await readFile(join(dir, '.gitignore'), 'utf8');

    const r2 = await ensureVendorCommittable(dir);
    // After the first patch the pin is no longer ignored, so the second
    // call short-circuits to a no-op.
    assert.deepEqual(r2, { ignored: false, patched: false, gitignorePath: null });
    const afterSecond = await readFile(join(dir, '.gitignore'), 'utf8');
    assert.equal(afterSecond, afterFirst, 'no duplicate vendor lines on re-run');

    const negations = (afterSecond.match(/^!\*\*\/\.webjs\/vendor\/$/gm) || []).length;
    assert.equal(negations, 1, 'exactly one `!**/.webjs/vendor/` line');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('completes a partially-correct .gitignore by appending only the missing line', async () => {
  // Has the parent exclusion + the dir negation, but missing the `/**`
  // negation, which on some git versions leaves children ignored.
  const dir = await makeRepo('**/.webjs/*\n!**/.webjs/vendor/\n');
  try {
    const before = await readFile(join(dir, '.gitignore'), 'utf8');
    const r = await ensureVendorCommittable(dir);
    // If git already reports it committable, the helper is a clean no-op;
    // if not, it appends ONLY the missing `/**` line. Either way the end
    // state must be committable and no line is duplicated.
    assert.equal(isIgnored(dir, PROBE), false, 'committable after completing the pattern');
    if (r.patched) {
      const after = await readFile(join(dir, '.gitignore'), 'utf8');
      const dirNeg = (after.match(/^!\*\*\/\.webjs\/vendor\/$/gm) || []).length;
      assert.equal(dirNeg, 1, 'the already-present line is not duplicated');
    } else {
      assert.equal(before, await readFile(join(dir, '.gitignore'), 'utf8'));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('no app .gitignore to patch: reports ignored-but-not-patched, writes nothing', async () => {
  // The ignore comes from .git/info/exclude, not a tracked .gitignore. The
  // helper must not fabricate a .gitignore the user never had.
  const dir = await makeRepo(null);
  try {
    await writeFile(join(dir, '.git', 'info', 'exclude'), '.webjs/\n');
    assert.equal(isIgnored(dir, PROBE), true, 'precondition: excluded via info/exclude');

    const r = await ensureVendorCommittable(dir);
    assert.deepEqual(r, { ignored: true, patched: false, gitignorePath: null });

    let made = true;
    try { await readFile(join(dir, '.gitignore'), 'utf8'); } catch { made = false; }
    assert.equal(made, false, 'no .gitignore fabricated');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('not a git repo: clean no-op, no .gitignore created', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-vendor-nogit-'));
  try {
    await mkdir(join(dir, '.webjs', 'vendor'), { recursive: true });
    await writeFile(join(dir, '.webjs', 'vendor', 'importmap.json'), '{}');
    const r = await ensureVendorCommittable(dir);
    assert.deepEqual(r, { ignored: false, patched: false, gitignorePath: null });
    let made = true;
    try { await readFile(join(dir, '.gitignore'), 'utf8'); } catch { made = false; }
    assert.equal(made, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
