/**
 * Drift guard for issue #1031: a hand-maintained `.d.ts` overlay must not
 * declare a VALUE export that the runtime `.js` does not actually provide. The
 * sibling `dts-export-coverage.test.mjs` (#388) proves the forward direction
 * (every runtime export HAS a declaration, so a real import type-checks); this
 * proves the REVERSE (every declared value export EXISTS at runtime, so a
 * type-checking `import { x }` cannot crash with `x` undefined at load). A
 * phantom declaration is the DX failure this closes: the editor confidently
 * offers an import that blows up at runtime.
 *
 * Why NOT a full signature diff. An earlier attempt emitted declarations from
 * the JSDoc and compared shapes, but WebJs's overlays are DELIBERATELY richer
 * than the loose JSDoc (`WebComponent` is `@returns {any}`; `register` types its
 * arg as a hand-written `WebComponentConstructor` where the JSDoc infers
 * `typeof WebComponent`). Consumers' editors read the overlay, not the JSDoc, so
 * that divergence is by design and harmless, yet no structural check can tell a
 * benign refinement from a real contradiction without a large allowlist over the
 * most important types. So per-signature correctness of the complex exports is
 * covered POSITIVELY by targeted `test/types/*.test-d.ts` fixtures instead, and
 * this guard sticks to the one thing that is both automatable and unambiguous:
 * export EXISTENCE.
 *
 * Mechanism, per package: copy the `.js` sources into a temp dir DROPPING every
 * `.d.ts` (tsc prefers a sibling `.d.ts`, which would defeat the comparison),
 * then a fixture reads `keyof typeof import(<js entry>)` (the runtime VALUE
 * exports; `typeof import()` naturally excludes type-only exports like
 * interfaces) and `keyof typeof import(<overlay>)`, and forces a named error for
 * every value export in the overlay that is absent from the runtime.
 *
 * Counterfactual: a synthetic overlay that declares a value the impl lacks is
 * reported by name; one that declares only real values (plus a type-only export)
 * is clean.
 *
 * Scope: each overlay is checked against its NODE runtime sibling (the `.js`
 * beside the `.d.ts`, which is also the `source`/Node condition). The one
 * dual-surface entry is `@webjsdev/core`'s `.`: the bare specifier resolves in
 * the BROWSER to a slim bundle that intentionally drops the server-only exports
 * (`renderToString` / `renderToStream` / `setCspNonceProvider`, which Node
 * consumers import from `@webjsdev/core/server`). Those stay declared on `.` for
 * the Node bare-specifier path, so they are NOT phantoms here; the browser strip
 * is a separate, documented split this guard does not model (tracked in #1035).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, cpSync, writeFileSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');
const tscBin = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

// Published packages whose `.d.ts` are HAND-WRITTEN overlays over `.js` JSDoc.
// The entry map is read from each package's own `exports`, so a new subpath
// entry is covered with no edit here.
// `minEntries` is a sanity floor: if `entryPairs` ever returns fewer overlay
// entries than this (a renamed `exports` shape, a mapping regression), the test
// FAILS loudly instead of silently checking nothing. The counts match today's
// `exports` maps; raising an export count only makes the floor stricter.
const PACKAGES = [
  { name: '@webjsdev/core', dir: 'packages/core', minEntries: 12 },
  { name: '@webjsdev/server', dir: 'packages/server', minEntries: 3 },
];

// KNOWN, REAL, TRACKED phantoms, keyed `<package>#<export>`. These are NOT false
// positives: each is a genuine phantom the guard correctly caught, deferred to a
// tracked issue because the fix touches the published type surface and belongs
// in its own change. Each entry MUST cite its issue and is deleted the moment
// that issue lands (the guard then proves the fix). Do NOT add a new entry to
// silence a fresh finding without first filing the issue and confirming the
// phantom is real.
const KNOWN_PHANTOMS = new Map(Object.entries({
  '@webjsdev/core#WebComponentBase':
    'internal base class exported as a value by the overlay but absent at runtime; fix tracked in #1032',
}));

/** Recursively copy only `.js` files (skip `.d.ts`, dist, node_modules, test). */
function copyJsTree(srcDir, destDir) {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'test') continue;
    const s = join(srcDir, entry.name);
    const d = join(destDir, entry.name);
    if (entry.isDirectory()) copyJsTree(s, d);
    else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.d.ts')) {
      mkdirSync(dirname(d), { recursive: true });
      cpSync(s, d);
    }
  }
}

/**
 * The `.d.ts` overlay + its runtime `.js` for every package export that declares
 * a `types`. The impl `.js` is DERIVED from the overlay path (a sibling
 * `foo.d.ts` overlays `foo.js`), NOT read from a `source` field: only some
 * entries carry `source` (the rest map `types` + `default`-to-dist), so keying
 * on `source` silently skipped every server entry and five core subpaths. The
 * derived sibling is the universal, convention-guaranteed mapping.
 */
function entryPairs(pkgDir) {
  const pkg = JSON.parse(readFileSync(join(ROOT, pkgDir, 'package.json'), 'utf8'));
  const pairs = [];
  for (const [key, val] of Object.entries(pkg.exports || {})) {
    if (!val || typeof val !== 'object' || !val.types || !val.types.endsWith('.d.ts')) continue;
    const types = val.types.replace(/^\.\//, '');
    // `impl` is the DERIVED sibling `.js`, not the package.json `source` field.
    pairs.push({ key, types, impl: types.replace(/\.d\.ts$/, '.js') });
  }
  return pairs;
}

function statSafe(p) {
  try { return statSync(p); } catch { return null; }
}

/**
 * Return the overlay's declared VALUE exports that do NOT exist in the runtime
 * `.js` module (the phantom set). Empty when the overlay is honest.
 * `implJs` is a `.js` path (tsc infers its value exports); `overlayDts` a `.d.ts`.
 */
function phantomExports(implJs, overlayDts, workDir, tag) {
  // Strip the trailing extension: TS forbids `.d.ts` (and `.js` without
  // allowImportingTsExtensions) in an import specifier; resolution re-appends it.
  const imp = implJs.replace(/\\/g, '/').replace(/\.js$/, '');
  const dec = overlayDts.replace(/\\/g, '/').replace(/\.d\.ts$/, '');
  const fixture = join(workDir, `phantom-${tag}.ts`);
  writeFileSync(
    fixture,
    `type Impl = typeof import(${JSON.stringify(imp)});\n` +
    `type Decl = typeof import(${JSON.stringify(dec)});\n` +
    // Value exports the overlay declares that the runtime module lacks. `typeof
    // import()` excludes type-only exports, so an interface / type alias in the
    // overlay is never counted. `default` is excluded (a value both may carry).
    `type Phantom = Exclude<Exclude<keyof Decl, keyof Impl>, 'default'> & string;\n` +
    // Re-key to greppable required props; assigning `{}` errors listing each.
    `type Marker = { [K in Phantom as \`DTS_PHANTOM_\${K}\`]: true };\n` +
    `const _assertNoPhantom: Marker = {};\n` +
    `void _assertNoPhantom;\n`,
  );
  const res = spawnSync(
    process.execPath,
    [
      tscBin, '--noEmit', '--strict', '--target', 'esnext', '--module', 'esnext',
      '--moduleResolution', 'bundler', '--lib', 'esnext,dom', '--skipLibCheck', '--allowJs', fixture,
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  // Anti-vacuum: if EITHER import failed to resolve, `Impl`/`Decl` degrade to
  // `any`, `keyof` collapses, and a real phantom would be silently missed. A
  // resolution error (TS2307 / "Cannot find module") means the harness itself is
  // broken, so throw instead of returning a falsely-empty set.
  if (/error TS2307|Cannot find module/.test(out)) {
    throw new Error(`phantom fixture failed to resolve a module (harness broken):\n${out}`);
  }
  return [...new Set([...out.matchAll(/DTS_PHANTOM_([A-Za-z0-9_$]+)/g)].map((m) => m[1]))];
}

for (const { name, dir, minEntries } of PACKAGES) {
  test(`${name}: no .d.ts overlay declares a value the runtime lacks (#1031)`, () => {
    const work = mkdtempSync(join(tmpdir(), 'webjs-dts-phantom-'));
    try {
      const implSrc = join(work, 'impl');
      mkdirSync(implSrc, { recursive: true });
      copyJsTree(join(ROOT, dir), implSrc);

      const entries = entryPairs(dir);
      // Sanity floor: an empty / shrunken entry list means the exports mapping
      // regressed and the guard would check (almost) nothing.
      assert.ok(
        entries.length >= minEntries,
        `${name}: expected >= ${minEntries} overlay entries, got ${entries.length} ` +
          `(exports mapping regressed? the guard would check nothing)`,
      );

      // Collect the RAW phantom set (before known-issue suppression) per entry.
      const raw = [];
      for (const { impl, types } of entries) {
        const implJs = join(implSrc, impl);
        const overlay = join(ROOT, dir, types);
        assert.ok(statSafe(implJs), `runtime source missing for ${name} entry: ${impl}`);
        const tag = impl.replace(/[^A-Za-z0-9]/g, '_');
        for (const exp of phantomExports(implJs, overlay, work, tag)) {
          raw.push({ key: `${name}#${exp}`, label: `${types}: ${exp}` });
        }
      }

      // Live positive control: on the real package, the guard MUST still detect a
      // KNOWN phantom (core's WebComponentBase). If it does not, the mechanism has
      // gone vacuous on the real invocation (resolve-to-any, empty keyof) and the
      // synthetic counterfactuals below would not catch it.
      for (const [pk] of KNOWN_PHANTOMS) {
        if (!pk.startsWith(`${name}#`)) continue;
        assert.ok(
          raw.some((r) => r.key === pk),
          `${name}: expected to still detect the known phantom ${pk} on the real ` +
            `package; not detecting it means the guard went vacuous (check module resolution)`,
        );
      }

      // Fail on any phantom that is NOT a documented, tracked known issue.
      const unexpected = [...new Set(raw.filter((r) => !KNOWN_PHANTOMS.has(r.key)).map((r) => r.label))].sort();
      assert.deepEqual(
        unexpected,
        [],
        `${name} overlays declare value exports the runtime .js does not provide ` +
          `(a type-checking import of these would crash at load):\n  ` + unexpected.join('\n  '),
      );
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
}

// --- Counterfactual: the guard must FIRE on a phantom value export and stay
// SILENT on an honest overlay (real values + a type-only export). Without it, a
// broken fixture (imports degrading to `any`, so `keyof` is empty) would make
// the real guard pass vacuously.

test('counterfactual: a phantom value export is reported by name (#1031)', () => {
  const work = mkdtempSync(join(tmpdir(), 'webjs-dts-phantom-cf-'));
  try {
    // Runtime provides `real`; overlay declares `real` AND a phantom `ghost`.
    writeFileSync(join(work, 'impl.js'), 'export function real() {}\n');
    writeFileSync(
      join(work, 'overlay.d.ts'),
      'export declare function real(): void;\nexport declare function ghost(): void;\n',
    );
    const phantom = phantomExports(join(work, 'impl.js'), join(work, 'overlay.d.ts'), work, 'cf');
    assert.deepEqual(phantom, ['ghost'], `expected only 'ghost' flagged, got: ${phantom.join(', ')}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('counterfactual: an honest overlay (real values + a type-only export) is clean (#1031)', () => {
  const work = mkdtempSync(join(tmpdir(), 'webjs-dts-phantom-cf2-'));
  try {
    writeFileSync(join(work, 'impl.js'), 'export function real() {}\nexport const k = 1;\n');
    // A type-only export (interface) has no runtime counterpart and must NOT be
    // treated as phantom; `typeof import()` never includes it.
    writeFileSync(
      join(work, 'overlay.d.ts'),
      'export declare function real(): void;\nexport declare const k: number;\nexport interface Shape { id: string }\n',
    );
    const phantom = phantomExports(join(work, 'impl.js'), join(work, 'overlay.d.ts'), work, 'cf2');
    assert.deepEqual(phantom, [], `expected no phantom, got: ${phantom.join(', ')}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
