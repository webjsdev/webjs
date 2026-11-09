/**
 * The Node dev resolve hook (#1689, `src/dev/esm-hot-hooks.js`): an edited app
 * module and its importers re-evaluate after `bumpModuleVersions`, and nothing
 * else does.
 *
 * `module.registerHooks` is process-global and cannot be uninstalled, so every
 * case runs in a CHILD `node` on a fixture app written to a tmp dir. The child
 * installs the hook (and the `'use server'` seed hook, which a facade case
 * needs), then registers a logging resolve hook of its own. Hooks run newest
 * first, so the logger wraps ours and records the URL ours returned, which is
 * how the case sees what Node actually linked without a test seam in the hook.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOKS = pathToFileURL(join(HERE, '../../src/dev/esm-hot-hooks.js')).href;
const SEED = pathToFileURL(join(HERE, '../../src/action-seed.js')).href;

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-esm-hot-'));
  const w = (rel, src) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), src);
  };
  w('package.json', JSON.stringify({ name: 'esm-hot', type: 'module', imports: { '#*': './*' } }));
  w('app/page.ts', [
    "import { v } from '#lib/mid.ts';",
    "import { hit } from '../lib/state.ts';",
    "import { act } from '../lib/act.server.ts';",
    "import fake from 'fake';",
    'export default async (): Promise<string> => [v, hit(), await act(), fake].join("|");',
    '',
  ].join('\n'));
  w('lib/mid.ts', "export { v } from './dep.ts';\nexport const lazy = () => import('./dep.ts').then((m) => m.v);\n");
  w('lib/dep.ts', "export const v: string = 'dep-1';\n");
  w('lib/state.ts', 'let n = 0;\nexport function hit(): number { return ++n; }\n');
  w('lib/act.server.ts', "'use server';\nimport { v } from './dep.ts';\nexport async function act(): Promise<string> { return 'act:' + v; }\n");
  w('node_modules/fake/package.json', JSON.stringify({ name: 'fake', type: 'module', main: 'index.js' }));
  w('node_modules/fake/index.js', "export default 'fake';\n");
  return dir;
}

/**
 * The child: install the hooks, render the page, edit `dep.ts`, optionally
 * bump, render again, and report what it saw as one JSON line.
 */
function driver(dir, { bump }) {
  return `
import { registerHooks } from 'node:module';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { installEsmHotHooks, bumpModuleVersions, moduleVersion } from ${JSON.stringify(HOOKS)};
import { registerActionHooks } from ${JSON.stringify(SEED)};
const dir = ${JSON.stringify(dir)};
const installed = installEsmHotHooks(dir);
await registerActionHooks({ seed: true, dev: true });
const urls = [];
registerHooks({ resolve(s, c, next) { const r = next(s, c); urls.push(r.url); return r; } });
const page = pathToFileURL(dir + '/app/page.ts').href + '?t=1';
const render = async () => (await import(page + '&n=' + Math.random())).default();
const mid0 = await import(pathToFileURL(dir + '/lib/mid.ts').href);
const first = await render();
writeFileSync(dir + '/lib/dep.ts', "export const v: string = 'dep-2';\\n");
const bumped = ${bump ? "[...bumpModuleVersions([dir + '/lib/dep.ts'])].map((f) => f.slice(dir.length + 1)).sort()" : '[]'};
const second = await render();
const lazy = await mid0.lazy();
console.log(JSON.stringify({ installed, first, second, lazy, bumped, urls, depVersion: moduleVersion(dir + '/lib/dep.ts') }));
`;
}

/**
 * A child for the not-yet-created import: `wrap.ts` imports `later.ts`, which
 * does not exist, so the first render fails; then `later.ts` is written and
 * bumped, and the page is rendered again.
 */
function laterDriver(dir) {
  return `
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { installEsmHotHooks, bumpModuleVersions } from ${JSON.stringify(HOOKS)};
const dir = ${JSON.stringify(dir)};
installEsmHotHooks(dir);
writeFileSync(dir + '/lib/wrap.ts', "export { later } from './later.ts';\\n");
writeFileSync(dir + '/app/p2.ts', "import { later } from '../lib/wrap.ts';\\nexport default (): string => later;\\n");
const page = (n) => pathToFileURL(dir + '/app/p2.ts').href + '?t=' + n;
let first;
try { await import(page(1)); first = 'loaded'; } catch (e) { first = e.code || 'error'; }
writeFileSync(dir + '/lib/later.ts', "export const later: string = 'here';\\n");
bumpModuleVersions([dir + '/lib/later.ts']);
let second;
try { second = (await import(page(2))).default(); } catch (e) { second = e.code || String(e); }
console.log(JSON.stringify({ first, second }));
`;
}

function run(dir, opts) {
  // Outside the app root: the driver imports app modules, so inside it the
  // hook would rightly record it as one more importer.
  const out = mkdtempSync(join(tmpdir(), 'webjs-esm-hot-driver-'));
  try {
    const file = join(out, 'driver.mjs');
    writeFileSync(file, opts.later ? laterDriver(dir) : driver(dir, opts));
    const r = spawnSync(process.execPath, [file], { cwd: dir, encoding: 'utf8', timeout: 60_000 });
    assert.equal(r.status, 0, `the driver exited cleanly\n--- stderr ---\n${r.stderr}`);
    const line = r.stdout.trim().split('\n').pop();
    return JSON.parse(line);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

// Each render imports a fresh page URL (the `n` query), so a stale result can
// only come from the page's DEPENDENCIES being cached, which is the exact
// staleness the hook exists to remove.
test('a bumped module and its importers re-evaluate, and an untouched module keeps its instance', { skip: !!process.versions.bun }, () => {
  const dir = fixture();
  try {
    const out = run(dir, { bump: true });
    assert.equal(out.installed, true);
    assert.equal(out.first, 'dep-1|1|act:dep-1|fake');
    // dep re-evaluated (through the `#` alias and the `export from` in mid),
    // the action module above it too, and the state module did NOT: its
    // counter kept counting instead of starting over at 1.
    assert.equal(out.second, 'dep-2|2|act:dep-2|fake');
    assert.deepEqual(out.bumped, ['app/page.ts', 'lib/act.server.ts', 'lib/dep.ts', 'lib/mid.ts'],
      'the edited file and every transitive importer the hook recorded, nothing else');
    assert.ok(out.depVersion > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a dynamic import from an OLD module instance gets the new version', { skip: !!process.versions.bun }, () => {
  const dir = fixture();
  try {
    const out = run(dir, { bump: true });
    assert.equal(out.lazy, 'dep-2', 'the hook runs for a dynamic import too, so no resolve cache keeps the old URL');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the seed facade and its webjs-seed-orig original carry the same webjs-v', { skip: !!process.versions.bun }, () => {
  const dir = fixture();
  try {
    const out = run(dir, { bump: true });
    const act = out.urls.filter((u) => u.includes('/lib/act.server.ts'));
    const versioned = act.filter((u) => u.includes('webjs-v='));
    const facade = versioned.find((u) => !u.includes('webjs-seed-orig'));
    const orig = versioned.find((u) => u.includes('webjs-seed-orig'));
    assert.ok(facade && orig, `both the facade and the original were linked at a version: ${act.join(', ')}`);
    const v = (u) => new URL(u).searchParams.get('webjs-v');
    assert.equal(v(facade), v(orig), 'facade and original move together');
    assert.equal(v(facade), String(out.depVersion), 'with the one version the bump assigned');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a node_modules module is never versioned', { skip: !!process.versions.bun }, () => {
  const dir = fixture();
  try {
    const out = run(dir, { bump: true });
    const fake = out.urls.filter((u) => u.includes('/node_modules/fake/'));
    assert.ok(fake.length > 0, 'the package was resolved at all');
    for (const u of fake) assert.doesNotMatch(u, /webjs-v=/, u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// An agent often writes the import before the file it names. The importer
// failed to link, and the importer itself never changes, so nothing gives it a
// new URL. That works only because Node does not keep a link that failed on
// resolution; this guards that the hook does not break it (a hook that, say,
// cached its own resolutions would pin the failure).
test('an unchanged module whose import failed to resolve links once the file exists', { skip: !!process.versions.bun }, () => {
  const dir = fixture();
  try {
    const out = run(dir, { later: true });
    assert.equal(out.first, 'ERR_MODULE_NOT_FOUND', 'the first render fails on the missing file');
    assert.equal(out.second, 'here', 'once the file exists, the unchanged importer links again');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// COUNTERFACTUAL: the same edit with no bump stays stale, so the bump is what
// carries a dependency edit, not the fresh page URL.
test('without the bump the page still sees the old dependency', { skip: !!process.versions.bun }, () => {
  const dir = fixture();
  try {
    const out = run(dir, { bump: false });
    assert.equal(out.second, 'dep-1|2|act:dep-1|fake');
    assert.equal(out.depVersion, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Review of #1689: on Bun a rebuild looks for an edit fs.watch dropped by
// statting served modules, and it used to stat EVERY module the process ever
// served on every save. The dropped event is a sibling in the same directory,
// so the scan is limited to the directories the batch reported; a module
// elsewhere keeps its stamp and is found by the rebuild that reports its own
// directory.
test('movedServedModules checks only the directories it is given', async () => {
  const { recordModuleLoad, movedServedModules } = await import('../../src/dev/esm-hot-hooks.js');
  const key = Symbol.for('webjs.dev.esmHot');
  const saved = globalThis[key];
  const dir = mkdtempSync(join(tmpdir(), 'webjs-moved-served-'));
  try {
    globalThis[key] = { roots: new Set([dir]), versions: new Map(), importers: new Map(), next: 1, installed: true, loaded: new Map() };
    mkdirSync(join(dir, 'a'));
    mkdirSync(join(dir, 'b'));
    const a = join(dir, 'a/x.ts');
    const b = join(dir, 'b/y.ts');
    writeFileSync(a, 'export const x = 1;\n');
    writeFileSync(b, 'export const y = 1;\n');
    recordModuleLoad(a);
    recordModuleLoad(b);
    writeFileSync(a, 'export const x = 22;\n');
    writeFileSync(b, 'export const y = 22;\n');
    assert.deepEqual(movedServedModules(new Set([join(dir, 'a')])), [a], 'only the reported directory is scanned');
    assert.deepEqual(movedServedModules(new Set([join(dir, 'b')])), [b], 'the other module kept its stamp for its own rebuild');
    assert.deepEqual(movedServedModules(), [], 'with no directories every module is scanned, and nothing moved since');
  } finally {
    globalThis[key] = saved;
    rmSync(dir, { recursive: true, force: true });
  }
});

// Review of #1689: a module the CommonJS loader holds cannot be versioned (an
// ESM import of a `.cjs` file resolves to a format the hook leaves alone, and
// `require` caches by filename), so an edit to one stayed stale in the one
// long-lived dev process. The hook records each such app file, and the dev
// server asks the supervisor to restart for an edit to one.
test('a CommonJS app module is recorded, an ESM one is not', () => {
  const dir = fixture();
  const out = mkdtempSync(join(tmpdir(), 'webjs-esm-hot-driver-'));
  try {
    writeFileSync(join(dir, 'lib/legacy.cjs'), "module.exports = { v: 'A' };\n");
    writeFileSync(join(dir, 'lib/data.json'), '{ "v": "B" }\n');
    writeFileSync(join(dir, 'app/cjs.ts'), [
      "import legacy from '../lib/legacy.cjs';",
      "import { createRequire } from 'node:module';",
      "import { v } from '../lib/dep.ts';",
      'const require = createRequire(import.meta.url);',
      "export default (): string => legacy.v + require('../lib/data.json').v + v;",
      '',
    ].join('\n'));
    const file = join(out, 'driver.mjs');
    writeFileSync(file, `
import { pathToFileURL } from 'node:url';
import { installEsmHotHooks, isCommonJsModule } from ${JSON.stringify(HOOKS)};
const dir = ${JSON.stringify(dir)};
installEsmHotHooks(dir);
const value = (await import(pathToFileURL(dir + '/app/cjs.ts').href)).default();
console.log(JSON.stringify({ value, legacy: isCommonJsModule(dir + '/lib/legacy.cjs'), data: isCommonJsModule(dir + '/lib/data.json'), esm: isCommonJsModule(dir + '/lib/dep.ts'), fake: isCommonJsModule(dir + '/node_modules/fake/index.js') }));
`);
    const r = spawnSync(process.execPath, [file], { cwd: dir, encoding: 'utf8', timeout: 60_000 });
    assert.equal(r.status, 0, r.stderr);
    const got = JSON.parse(r.stdout.trim().split('\n').pop());
    assert.deepEqual(got, { value: 'ABdep-1', legacy: true, data: true, esm: false, fake: false });
  } finally {
    rmSync(out, { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
  }
});
