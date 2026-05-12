import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { diff } from '../src/commands/diff.js';

const origFetch = globalThis.fetch;
const origLog = console.log;

const REG = {
  button: {
    name: 'button', type: 'registry:ui',
    files: [{ path: 'components/button.ts', type: 'registry:ui', content: 'export const Button = "v2";' }],
  },
};

function stubFetch() {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.endsWith('/index.json')) {
      return new Response(JSON.stringify(Object.values(REG)), { status: 200 });
    }
    const name = u.split('/').pop().replace('.json', '');
    if (!REG[name]) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(REG[name]), { status: 200 });
  };
}

function setupProject() {
  const d = mkdtempSync(join(tmpdir(), 'webjsui-diff-'));
  writeFileSync(join(d, 'components.json'), JSON.stringify({
    style: 'default',
    tailwind: { css: 'app/globals.css', baseColor: 'neutral', cssVariables: true },
    aliases: { components: 'components', utils: 'lib/utils', ui: 'components/ui', lib: 'lib' },
  }));
  mkdirSync(join(d, 'components', 'ui'), { recursive: true });
  return d;
}

function captureLog(fn) {
  const out = [];
  console.log = (...args) => out.push(args.join(' '));
  return fn().finally(() => { console.log = origLog; }).then(() => out.join('\n'));
}

test('diff — reports no changes when local matches registry', async () => {
  stubFetch();
  const d = setupProject();
  try {
    writeFileSync(join(d, 'components', 'ui', 'button.ts'), 'export const Button = "v2";');
    const output = await captureLog(() =>
      diff.parseAsync(['button', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' }),
    );
    assert.match(output, /match the registry/);
  } finally {
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('diff — flags differing local copy', async () => {
  stubFetch();
  const d = setupProject();
  try {
    writeFileSync(join(d, 'components', 'ui', 'button.ts'), 'export const Button = "LOCAL_DIFF";');
    const output = await captureLog(() =>
      diff.parseAsync(['button', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' }),
    );
    assert.match(output, /differ/);
    assert.match(output, /button/);
  } finally {
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('diff — diffs all components when no name given', async () => {
  stubFetch();
  const d = setupProject();
  try {
    writeFileSync(join(d, 'components', 'ui', 'button.ts'), 'export const Button = "STALE";');
    const output = await captureLog(() =>
      diff.parseAsync(['--cwd', d, '--registry', 'http://test/r'], { from: 'user' }),
    );
    assert.match(output, /button/);
  } finally {
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('diff — exits with error when components.json missing', async () => {
  const d = mkdtempSync(join(tmpdir(), 'webjsui-diff-noconf-'));
  const origExit = process.exit;
  const origError = console.error;
  process.exit = ((c) => { throw new Error('exit:' + c); });
  console.error = () => {};
  try {
    await assert.rejects(
      () => diff.parseAsync(['--cwd', d], { from: 'user' }),
      /exit:1/,
    );
  } finally {
    process.exit = origExit;
    console.error = origError;
    rmSync(d, { recursive: true });
  }
});
