import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { add } from '../src/commands/add.js';

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

test('add — writes a single component to components/ui/', async () => {
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

test('add — resolves transitive registry dependencies', async () => {
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

test('add — multiple components at once', async () => {
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

test('add — respects registry:lib `target` field for utils.ts placement', async () => {
  stubFetch();
  const d = tmp();
  try {
    await add.parseAsync(['card', '--yes', '--no-deps', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' });
    // lib-utils has `target: 'lib/utils.ts'` — it should land there, not in components/ui/
    assert.ok(existsSync(join(d, 'lib', 'utils.ts')));
    assert.ok(!existsSync(join(d, 'components', 'ui', 'utils.ts')));
  } finally {
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('add — fails fast if components.json is missing', async () => {
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

test('add — fails fast if no components specified', async () => {
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

test('add — --overwrite replaces existing files without prompt', async () => {
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
