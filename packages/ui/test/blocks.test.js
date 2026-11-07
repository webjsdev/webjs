/**
 * The shipped blocks (#1666, D18): `registry:block` items, "a ready-made view
 * you install and then edit". These assert on the REAL manifest and sources,
 * so a block that installs files nowhere, imports a module that does not
 * exist, or renders a `cn-*` name into an app fails here rather than in a
 * user's project.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { add } from '../src/commands/add.js';
import { CN_ALLOWLIST } from '../src/registry/style-bake.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REGISTRY = join(HERE, '..', 'packages', 'registry');
const manifest = JSON.parse(readFileSync(join(REGISTRY, 'registry.json'), 'utf8'));
const items = new Map(manifest.items.map((i) => [i.name, i]));
const blocks = manifest.items.filter((i) => i.type === 'registry:block');

test('the registry ships the ten authentication blocks', () => {
  // A floor, so every per-block assertion below cannot pass vacuously.
  assert.ok(blocks.length >= 10, `expected at least 10 registry:block items, found ${blocks.length}`);
  for (const n of ['login-01', 'login-02', 'login-03', 'login-04', 'login-05', 'signup-01', 'signup-02', 'signup-03', 'signup-04', 'signup-05']) {
    assert.equal(items.get(n)?.type, 'registry:block', `${n} is a registry:block`);
  }
});

test('every registry:block file carries an explicit target under the app', () => {
  // Keyed on the ITEM type, so a block whose page is typed registry:page is
  // still held to it. Without a target `add` falls back to a per-type folder
  // and two blocks' page.ts files would land on one another.
  for (const b of blocks) {
    assert.ok(b.files?.length, `${b.name} has files`);
    for (const f of b.files) {
      assert.equal(typeof f.target, 'string', `${b.name}: ${f.path} has a target`);
      assert.match(f.target, /^(app|modules|components|lib|public)\//, `${b.name}: ${f.target} lands under the app`);
      assert.doesNotMatch(f.target, /\.\./, `${b.name}: ${f.target} stays inside the app`);
    }
  }
});

test('every registry:block file exists on disk and is not empty', () => {
  // The composers degrade a missing file to empty content, so a typo in a
  // manifest path would otherwise install an empty file without a word.
  for (const b of blocks) {
    for (const f of b.files) {
      const abs = join(REGISTRY, f.path);
      assert.ok(existsSync(abs), `${b.name}: ${f.path} exists`);
      assert.ok(readFileSync(abs, 'utf8').trim().length > 0, `${b.name}: ${f.path} is not empty`);
    }
  }
});

test('every block carries a description, categories, and registry dependencies that exist', () => {
  for (const b of blocks) {
    assert.ok(b.description, `${b.name} has a description`);
    assert.ok(b.categories?.length, `${b.name} has categories`);
    for (const d of b.registryDependencies || []) assert.ok(items.has(d), `${b.name}: dependency ${d} is in the manifest`);
  }
});

test('every relative import in a block resolves to a registry file the install also writes', () => {
  // `add` rewrites a registry-relative import to where its file landed, which
  // works only when the imported file is the block's own or belongs to an
  // item the block depends on (transitively).
  for (const b of blocks) {
    const reachable = new Set(b.files.map((f) => posix.normalize(f.path)));
    const seen = new Set();
    const visit = (name) => {
      if (seen.has(name)) return;
      seen.add(name);
      const it = items.get(name);
      for (const f of it?.files || []) reachable.add(posix.normalize(f.path));
      for (const d of it?.registryDependencies || []) visit(d);
    };
    for (const d of b.registryDependencies || []) visit(d);
    for (const f of b.files.filter((x) => x.path.endsWith('.ts'))) {
      const src = readFileSync(join(REGISTRY, f.path), 'utf8');
      for (const [, spec] of src.matchAll(/(?:from|import)\s+'(\.{1,2}\/[^']+)'/g)) {
        const target = posix.normalize(posix.join(posix.dirname(f.path), spec));
        assert.ok(existsSync(join(REGISTRY, target)), `${b.name}: ${f.path} imports ${spec}, which exists`);
        assert.ok(reachable.has(target), `${b.name}: ${target} is written by the block or one of its dependencies`);
      }
    }
  }
});

/** A components.json project inside the package, so `@webjsdev/core` resolves from it. */
function project() {
  const d = join(HERE, '.baked', `blocks-${process.pid}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(join(d, 'styles'), { recursive: true });
  writeFileSync(join(d, 'components.json'), JSON.stringify({
    style: 'default',
    tailwind: { css: 'styles/globals.css', baseColor: 'neutral', cssVariables: true },
    aliases: { components: 'components', utils: 'lib/utils/cn', ui: 'components/ui', lib: 'lib' },
  }));
  return d;
}

async function quiet(fn) {
  const log = console.log;
  console.log = () => {};
  try { return await fn(); } finally { console.log = log; }
}

for (const name of ['login-04', 'signup-01']) {
  test(`add ${name}: the installed page renders on the server, plain Tailwind, with a real form`, async () => {
    const d = project();
    try {
      await quiet(() => add.parseAsync([name, '--yes', '--no-deps', '--cwd', d], { from: 'user' }));
      const kind = name.split('-')[0];
      const page = join(d, 'app', kind, 'page.ts');
      assert.ok(existsSync(page), 'the page lands at its target');
      assert.ok(existsSync(join(d, 'components', `${kind}-form.ts`)), 'the form lands at its target');

      const mod = await import(pathToFileURL(resolve(page)).href);
      const { renderToString } = await import('@webjsdev/core/server');
      const out = await renderToString(mod.default());
      assert.match(out, /<form[\s>]/, 'a real form');
      assert.match(out, /id="email" name="email"/, 'a named email control, so it submits');
      assert.match(out, /data-slot="field-label" for="email"/, 'labelled');
      assert.doesNotMatch(out, /class="[^"]*\bcn-[a-z]/, 'no cn-* name reaches the rendered page');
      assert.match(out, /inline-flex/, 'the baked button classes are there');
      assert.ok(mod.metadata?.title, 'the page names itself');
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
}

for (const name of ['sidebar-07', 'sidebar-13', 'sidebar-15', 'dashboard-01']) {
  test(`add ${name}: the installed dashboard page renders on the server, plain Tailwind, in the kit's sidebar`, async () => {
    // sidebar-07 is the docs lead, sidebar-13 renders inside a dialog and
    // sidebar-15 mounts two sidebars, so the three cover every shell shape;
    // dashboard-01 adds the chart and the data table elements.
    const d = project();
    try {
      await quiet(() => add.parseAsync([name, '--yes', '--no-deps', '--cwd', d], { from: 'user' }));
      const page = join(d, 'app', 'dashboard', 'page.ts');
      assert.ok(existsSync(page), 'the page lands at its target');
      for (const f of items.get(name).files) assert.ok(existsSync(join(d, f.target)), `${f.target} is written`);

      const mod = await import(pathToFileURL(resolve(page)).href);
      const { renderToString } = await import('@webjsdev/core/server');
      const out = await renderToString(mod.default());
      assert.match(out, /<ui-sidebar-provider[\s>]/, 'the kit sidebar shell');
      assert.match(out, /data-sidebar="menu-button"/, 'menu buttons from the sidebar helpers');
      // The bake keeps its allowlisted hooks (the trigger icon's cn-rtl-flip);
      // any other cn-* name is one it failed to replace.
      const kept = [...out.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => m[1].split(/\s+/))
        .filter((c) => /^cn-[a-z]/.test(c) && !CN_ALLOWLIST.has(c));
      assert.deepEqual([...new Set(kept)], [], 'no unbaked cn-* name reaches the rendered page');
      assert.ok(mod.metadata?.title, 'the page names itself');
      if (name === 'dashboard-01') {
        // The data table serves its first page, and every row rides on the element.
        assert.equal([...out.matchAll(/<tr data-slot="table-row" data-row-id=/g)].length, 10, 'ten body rows');
        assert.match(out, /<dashboard-01-data-table rows="\[\{&quot;id&quot;:1,/, 'the rows attribute');
      }
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
}

for (const name of ['preview', 'preview-02', 'preview-03']) {
  test(`add ${name}: the installed board renders every card on the server, plain Tailwind`, async () => {
    // The configurator's component boards: dozens of cards on one page, so an
    // import the install cannot resolve or an unbaked name in any card shows
    // up here.
    const d = project();
    try {
      await quiet(() => add.parseAsync([name, '--yes', '--no-deps', '--cwd', d], { from: 'user' }));
      const page = join(d, 'app', name, 'page.ts');
      assert.ok(existsSync(page), 'the page lands at its target');
      for (const f of items.get(name).files) assert.ok(existsSync(join(d, f.target)), `${f.target} is written`);

      const mod = await import(pathToFileURL(resolve(page)).href);
      const { renderToString } = await import('@webjsdev/core/server');
      const out = await renderToString(mod.default());
      assert.match(out, /data-slot="capture-target"/, 'the board grid');
      const kept = [...out.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => m[1].split(/\s+/))
        .filter((c) => /^cn-[a-z]/.test(c) && !CN_ALLOWLIST.has(c));
      assert.deepEqual([...new Set(kept)], [], 'no unbaked cn-* name reaches the rendered page');
      assert.ok(mod.metadata?.title, 'the page names itself');
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
}
