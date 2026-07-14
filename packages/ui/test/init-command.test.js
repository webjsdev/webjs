import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { init } from '../src/commands/init.js';

const origFetch = globalThis.fetch;

function stubFetch() {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.endsWith('/lib-utils.json')) {
      return new Response(JSON.stringify({
        name: 'lib-utils', type: 'registry:lib',
        files: [{ path: 'lib/utils.ts', type: 'registry:lib', content: 'export function cn(){}\n' }],
      }), { status: 200 });
    }
    if (u.endsWith('/lib-dom.json')) {
      return new Response(JSON.stringify({
        name: 'lib-dom', type: 'registry:lib',
        files: [{ path: 'lib/dom.ts', type: 'registry:lib', content: 'export function onBeforeCache(){ return () => {}; }\n' }],
      }), { status: 200 });
    }
    if (u.includes('/theme-')) {
      return new Response(JSON.stringify({
        name: 'theme-neutral', type: 'registry:theme',
        files: [{ path: 'themes/index.css', type: 'registry:file', target: 'app/globals.css', content: '/* @webjsdev/ui theme */\n:root { --primary: #000; }\n' }],
      }), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  };
}

function tmp() {
  const d = mkdtempSync(join(tmpdir(), 'webjsui-init-'));
  // Make it look like a webjs project so defaults pick the right paths.
  writeFileSync(join(d, 'package.json'), JSON.stringify({ dependencies: { '@webjsdev/server': '*' } }));
  return d;
}

test('init: writes components.json with project-detected defaults', async () => {
  stubFetch();
  const d = tmp();
  try {
    await init.parseAsync(['--yes', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' });
    const cfg = JSON.parse(readFileSync(join(d, 'components.json'), 'utf8'));
    assert.equal(cfg.style, 'default');
    assert.equal(cfg.tailwind.baseColor, 'neutral');
    assert.equal(cfg.tailwind.css, 'styles/globals.css'); // webjs default (app/ is routing-only)
    assert.equal(cfg.aliases.ui, 'components/ui');
  } finally {
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('init: writes lib/utils.ts from registry', async () => {
  stubFetch();
  const d = tmp();
  try {
    await init.parseAsync(['--yes', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' });
    assert.ok(existsSync(join(d, 'lib', 'utils.ts')));
    const utils = readFileSync(join(d, 'lib', 'utils.ts'), 'utf8');
    assert.match(utils, /cn/);
  } finally {
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('init: appends theme CSS to globals.css', async () => {
  stubFetch();
  const d = tmp();
  try {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(d, 'styles'), { recursive: true });
    writeFileSync(join(d, 'styles', 'globals.css'), '/* existing */\n');
    await init.parseAsync(['--yes', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' });
    const css = readFileSync(join(d, 'styles', 'globals.css'), 'utf8');
    assert.match(css, /\/\* existing \*\//);
    assert.match(css, /@webjsdev\/ui theme/);
    assert.match(css, /--primary: #000/);
  } finally {
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('init: theme is idempotent (doesn\'t append twice)', async () => {
  stubFetch();
  const d = tmp();
  try {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(d, 'styles'), { recursive: true });
    writeFileSync(join(d, 'styles', 'globals.css'), '');
    await init.parseAsync(['--yes', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' });
    await init.parseAsync(['--yes', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' });
    const css = readFileSync(join(d, 'styles', 'globals.css'), 'utf8');
    const occurrences = (css.match(/@webjsdev\/ui theme/g) || []).length;
    assert.equal(occurrences, 1, 'theme block should only appear once');
  } finally {
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('init: accepts --base-color override', async () => {
  stubFetch();
  const d = tmp();
  try {
    await init.parseAsync(['--yes', '--base-color', 'zinc', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' });
    const cfg = JSON.parse(readFileSync(join(d, 'components.json'), 'utf8'));
    assert.equal(cfg.tailwind.baseColor, 'zinc');
  } finally {
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('init: accepts --css override', async () => {
  stubFetch();
  const d = tmp();
  try {
    await init.parseAsync(['--yes', '--css', 'src/styles.css', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' });
    const cfg = JSON.parse(readFileSync(join(d, 'components.json'), 'utf8'));
    assert.equal(cfg.tailwind.css, 'src/styles.css');
  } finally {
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

// #983: init must exit non-zero when the theme tokens could not be written
// (the old soft-fail left an unstyled install with a clean exit code). The
// counterfactual is the local-first success case just above it.
test('init: hard-fails (exit non-zero) when the theme cannot be written', async () => {
  globalThis.fetch = async () => new Response('nope', { status: 404 });
  const origExit = process.exit;
  const origErr = console.error;
  const origLog = console.log;
  let code = null;
  process.exit = (c) => { code = c; throw new Error('__exit__'); };
  console.log = () => {};
  console.error = () => {};
  const d = tmp();
  try {
    // A registry URL not used elsewhere, so the fetcher's per-URL cache can't
    // shadow this 404 with an earlier test's cached success.
    await init
      .parseAsync(['--yes', '--cwd', d, '--registry', 'http://hardfail/r'], { from: 'user' })
      .catch((e) => { if (e.message !== '__exit__') throw e; });
    assert.equal(code, 1, 'init exits non-zero on an unwritten theme');
  } finally {
    process.exit = origExit;
    console.error = origErr;
    console.log = origLog;
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('init: local-first (default registry) writes the theme and exits 0', async () => {
  // No fetch stub: proves the theme resolves from the PACKAGED registry with no
  // network. This is the counterfactual to the hard-fail test above.
  globalThis.fetch = async () => { throw new Error('should not fetch'); };
  const origExit = process.exit;
  let exited = false;
  process.exit = () => { exited = true; throw new Error('__exit__'); };
  const origLog = console.log;
  console.log = () => {};
  const d = tmp();
  try {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(d, 'styles'), { recursive: true });
    writeFileSync(join(d, 'styles', 'globals.css'), '/* existing */\n');
    await init.parseAsync(['--yes', '--cwd', d], { from: 'user' });
    assert.equal(exited, false, 'init did not exit non-zero');
    const css = readFileSync(join(d, 'styles', 'globals.css'), 'utf8');
    assert.match(css, /@webjsdev\/ui theme/);
  } finally {
    process.exit = origExit;
    console.log = origLog;
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});
