import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { add, rewriteUtilsImport } from '../src/commands/add.js';

const origFetch = globalThis.fetch;

const REG = {
  button: {
    name: 'button', type: 'registry:ui',
    dependencies: ['@webjskit/core'],
    registryDependencies: ['lib-utils'],
    files: [{ path: 'components/button.ts', type: 'registry:ui', content: 'export const Button = "btn";' }],
  },
  card: {
    name: 'card', type: 'registry:ui',
    dependencies: ['@webjskit/core'],
    registryDependencies: ['button'],
    files: [{ path: 'components/card.ts', type: 'registry:ui', content: 'export const Card = "card";' }],
  },
  'lib-utils': {
    name: 'lib-utils', type: 'registry:lib',
    files: [{ path: 'lib/utils.ts', type: 'registry:lib', content: 'export const cn = () => "";', target: 'lib/utils.ts' }],
  },
  dialog: {
    name: 'dialog', type: 'registry:ui',
    dependencies: ['@webjskit/core', '@floating-ui/dom'],
    files: [{ path: 'components/dialog.ts', type: 'registry:ui', content: 'export const Dialog = "dlg";' }],
  },
};

function stubFetch() {
  globalThis.fetch = async (url) => {
    const name = String(url).split('/').pop().replace('.json', '');
    if (!REG[name]) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(REG[name]), { status: 200 });
  };
}

function tmp() {
  const d = mkdtempSync(join(tmpdir(), 'webjsui-add-'));
  // Pre-seed a components.json so `add` proceeds
  writeFileSync(join(d, 'components.json'), JSON.stringify({
    $schema: 'https://ui.webjs.dev/schema.json',
    style: 'default',
    tailwind: { css: 'app/globals.css', baseColor: 'neutral', cssVariables: true },
    aliases: { components: 'components', utils: 'lib/utils', ui: 'components/ui', lib: 'lib' },
  }));
  return d;
}

test('add: writes a single component to components/ui/', async () => {
  stubFetch();
  const d = tmp();
  try {
    await add.parseAsync(['button', '--yes', '--no-deps', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' });
    const buttonPath = join(d, 'components', 'ui', 'button.ts');
    assert.ok(existsSync(buttonPath), 'button.ts should exist');
    assert.equal(readFileSync(buttonPath, 'utf8'), 'export const Button = "btn";');
  } finally {
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('add: resolves transitive registry dependencies', async () => {
  stubFetch();
  const d = tmp();
  try {
    await add.parseAsync(['card', '--yes', '--no-deps', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' });
    assert.ok(existsSync(join(d, 'components', 'ui', 'card.ts')), 'card should be added');
    assert.ok(existsSync(join(d, 'components', 'ui', 'button.ts')), 'transitive button should be added');
    assert.ok(existsSync(join(d, 'lib', 'utils.ts')), 'transitive lib-utils should be added');
  } finally {
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('add: multiple components at once', async () => {
  stubFetch();
  const d = tmp();
  try {
    await add.parseAsync(['button', 'dialog', '--yes', '--no-deps', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' });
    assert.ok(existsSync(join(d, 'components', 'ui', 'button.ts')));
    assert.ok(existsSync(join(d, 'components', 'ui', 'dialog.ts')));
  } finally {
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('add: respects registry:lib `target` field for utils.ts placement', async () => {
  stubFetch();
  const d = tmp();
  try {
    await add.parseAsync(['card', '--yes', '--no-deps', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' });
    // lib-utils has `target: 'lib/utils.ts'`: it should land there, not in components/ui/
    assert.ok(existsSync(join(d, 'lib', 'utils.ts')));
    assert.ok(!existsSync(join(d, 'components', 'ui', 'utils.ts')));
  } finally {
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('add: fails fast if components.json is missing', async () => {
  stubFetch();
  const d = mkdtempSync(join(tmpdir(), 'webjsui-add-noconf-'));
  const origExit = process.exit;
  const origError = console.error;
  const origInfo = console.log;
  process.exit = ((c) => { throw new Error('exit:' + c); });
  console.error = () => {};
  console.log = () => {};
  try {
    await assert.rejects(
      () => add.parseAsync(['button', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' }),
      /exit:1/,
    );
  } finally {
    process.exit = origExit;
    console.error = origError;
    console.log = origInfo;
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('add: fails fast if no components specified', async () => {
  stubFetch();
  const d = tmp();
  const origExit = process.exit;
  const origError = console.error;
  const origInfo = console.log;
  process.exit = ((c) => { throw new Error('exit:' + c); });
  console.error = () => {};
  console.log = () => {};
  try {
    await assert.rejects(
      () => add.parseAsync(['--cwd', d, '--registry', 'http://test/r'], { from: 'user' }),
      /exit:1/,
    );
  } finally {
    process.exit = origExit;
    console.error = origError;
    console.log = origInfo;
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('add: --overwrite replaces existing files without prompt', async () => {
  stubFetch();
  const d = tmp();
  const { mkdirSync } = await import('node:fs');
  try {
    mkdirSync(join(d, 'components', 'ui'), { recursive: true });
    writeFileSync(join(d, 'components', 'ui', 'button.ts'), 'OLD');
    await add.parseAsync(['button', '--overwrite', '--no-deps', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' });
    assert.equal(readFileSync(join(d, 'components', 'ui', 'button.ts'), 'utf8'), 'export const Button = "btn";');
  } finally {
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

/* -------------------- rewriteUtilsImport (unit tests) -------------------- */

test('rewriteUtilsImport: maps to lib/utils/cn alias for a Tier-1 file', () => {
  const cwd = '/app';
  const config = {
    resolvedPaths: {
      utils: '/app/lib/utils/cn.ts',
    },
  };
  const target = '/app/components/ui/button.ts';
  const content =
    `import { cn } from '../lib/utils.ts';\nexport const buttonClass = () => cn('p-2');`;
  const out = rewriteUtilsImport(content, target, config);
  assert.match(out, /from '\.\.\/\.\.\/lib\/utils\/cn\.ts'/);
  assert.doesNotMatch(out, /from '\.\.\/lib\/utils\.ts'/);
});

test('rewriteUtilsImport: handles the legacy lib/utils alias (cn at lib/utils.ts)', () => {
  const config = { resolvedPaths: { utils: '/app/lib/utils.ts' } };
  const out = rewriteUtilsImport(
    `import { cn } from '../lib/utils.ts';`,
    '/app/components/ui/button.ts',
    config,
  );
  assert.match(out, /from '\.\.\/\.\.\/lib\/utils\.ts'/);
});

test('rewriteUtilsImport: handles src/lib (vite default)', () => {
  const config = { resolvedPaths: { utils: '/app/src/lib/utils.ts' } };
  const out = rewriteUtilsImport(
    `import { cn } from '../lib/utils.ts';`,
    '/app/src/components/ui/button.ts',
    config,
  );
  assert.match(out, /from '\.\.\/\.\.\/lib\/utils\.ts'/);
});

test('rewriteUtilsImport: handles double-quoted form', () => {
  const config = { resolvedPaths: { utils: '/app/lib/utils/cn.ts' } };
  const out = rewriteUtilsImport(
    `import { cn } from "../lib/utils.ts";`,
    '/app/components/ui/button.ts',
    config,
  );
  assert.match(out, /from "\.\.\/\.\.\/lib\/utils\/cn\.ts"/);
});

test('rewriteUtilsImport: no-op when content has no utils import', () => {
  const config = { resolvedPaths: { utils: '/app/lib/utils/cn.ts' } };
  const out = rewriteUtilsImport(
    `export const x = 1;`,
    '/app/components/ui/x.ts',
    config,
  );
  assert.equal(out, 'export const x = 1;');
});

test('rewriteUtilsImport: gracefully no-ops if config lacks resolvedPaths.utils', () => {
  const out = rewriteUtilsImport(
    `import { cn } from '../lib/utils.ts';`,
    '/app/components/ui/button.ts',
    {},
  );
  // Returns content unchanged so we never crash; the file may still be
  // broken, but that's a configuration error in components.json.
  assert.match(out, /from '\.\.\/lib\/utils\.ts'/);
});

/* -------------------- integration: add rewrites the import -------------------- */

test('add: rewrites a registry component\'s ../lib/utils.ts import to the user\'s aliases.utils path', async () => {
  // Local stub of fetch that returns a button.ts whose body imports
  // the registry-relative '../lib/utils.ts'. After `add`, the written
  // file should reference the user's lib/utils/cn.ts instead.
  const origFetchLocal = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const name = String(url).split('/').pop().replace('.json', '');
    if (name === 'button') {
      return new Response(JSON.stringify({
        name: 'button', type: 'registry:ui',
        files: [{
          path: 'components/button.ts',
          type: 'registry:ui',
          content: `import { cn } from '../lib/utils.ts';\nexport const buttonClass = () => cn('p-2');\n`,
        }],
      }), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  };
  const d = mkdtempSync(join(tmpdir(), 'webjsui-add-rewrite-'));
  writeFileSync(join(d, 'components.json'), JSON.stringify({
    $schema: 'https://ui.webjs.dev/schema.json',
    style: 'default',
    tailwind: { css: 'app/globals.css', baseColor: 'neutral', cssVariables: true },
    aliases: { components: 'components', utils: 'lib/utils/cn', ui: 'components/ui', lib: 'lib' },
  }));
  try {
    // Unique --registry URL so the in-memory fetcher cache (keyed by URL)
    // doesn't return content from an earlier test that reused 'button'.
    await add.parseAsync(['button', '--yes', '--no-deps', '--cwd', d, '--registry', 'http://test/rewrite'], { from: 'user' });
    const body = readFileSync(join(d, 'components', 'ui', 'button.ts'), 'utf8');
    assert.match(body, /from '\.\.\/\.\.\/lib\/utils\/cn\.ts'/);
    assert.doesNotMatch(body, /from '\.\.\/lib\/utils\.ts'/);
  } finally {
    globalThis.fetch = origFetchLocal;
    rmSync(d, { recursive: true });
  }
});
