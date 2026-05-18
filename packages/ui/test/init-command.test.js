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
    if (u.includes('/theme-')) {
      return new Response(JSON.stringify({
        name: 'theme-neutral', type: 'registry:theme',
        files: [{ path: 'themes/index.css', type: 'registry:file', target: 'app/globals.css', content: '/* @webjskit/ui theme */\n:root { --primary: #000; }\n' }],
      }), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  };
}

function tmp() {
  const d = mkdtempSync(join(tmpdir(), 'webjsui-init-'));
  // Make it look like a webjs project so defaults pick the right paths.
  writeFileSync(join(d, 'package.json'), JSON.stringify({ dependencies: { '@webjskit/server': '*' } }));
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
    assert.equal(cfg.tailwind.css, 'app/globals.css'); // webjs default
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
    // Pre-seed globals with existing content
    writeFileSync(join(d, 'app', 'globals.css'), '/* existing */\n', { flag: 'w' });
  } catch {
    // First create the directory
  }
  try {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(d, 'app'), { recursive: true });
    writeFileSync(join(d, 'app', 'globals.css'), '/* existing */\n');
    await init.parseAsync(['--yes', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' });
    const css = readFileSync(join(d, 'app', 'globals.css'), 'utf8');
    assert.match(css, /\/\* existing \*\//);
    assert.match(css, /@webjskit\/ui theme/);
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
    mkdirSync(join(d, 'app'), { recursive: true });
    writeFileSync(join(d, 'app', 'globals.css'), '');
    await init.parseAsync(['--yes', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' });
    await init.parseAsync(['--yes', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' });
    const css = readFileSync(join(d, 'app', 'globals.css'), 'utf8');
    const occurrences = (css.match(/@webjskit\/ui theme/g) || []).length;
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
