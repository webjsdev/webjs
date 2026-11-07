import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { diff } from '../src/commands/diff.js';
import { add } from '../src/commands/add.js';

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

test('diff: reports no changes when local matches registry', async () => {
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

test('diff: flags differing local copy', async () => {
  stubFetch();
  const d = setupProject();
  try {
    writeFileSync(join(d, 'components', 'ui', 'button.ts'), 'export const Button = "LOCAL_DIFF";');
    const output = await captureLog(() =>
      diff.parseAsync(['button', '--cwd', d, '--registry', 'http://test/r'], { from: 'user' }),
    );
    assert.match(output, /differ/);
    assert.match(output, /button/);
    // #1264: the overwrite command it suggests has to resolve for the reader.
    assert.match(output, /npx @webjsdev\/ui add <name> -o/);
    assert.doesNotMatch(output, /(?<!\/)\bwebjsui add/);
  } finally {
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('diff: diffs all components when no name given', async () => {
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

test('diff: a pristine `add` reports MATCH (import-rewrite + example-strip parity, #983)', async () => {
  // A component that BOTH imports ../lib/utils.ts AND carries an @example, so
  // the transform is non-trivial. `add` writes the transformed file; `diff`
  // must compare against the SAME transform, not the raw registry content, or a
  // pristine install falsely reports as differing (the pre-existing bug).
  const content =
    '/**\n * Button.\n *\n * @example\n * ```html\n * <button class=${buttonClass()}></button>\n * ```\n */\n' +
    "import { cn } from '../lib/utils.ts';\nexport const buttonClass = () => cn('p-2');\n";
  const item = { name: 'button', type: 'registry:ui', files: [{ path: 'components/button.ts', type: 'registry:ui', content }] };
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.endsWith('/index.json')) return new Response(JSON.stringify([{ name: 'button', type: 'registry:ui' }]), { status: 200 });
    const name = u.split('/').pop().replace('.json', '');
    if (name === 'button') return new Response(JSON.stringify(item), { status: 200 });
    return new Response('not found', { status: 404 });
  };
  const d = setupProject();
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    await add.parseAsync(['button', '--yes', '--no-deps', '--cwd', d, '--registry', 'http://test/parity'], { from: 'user' });
    const output = await captureLog(() =>
      diff.parseAsync(['button', '--cwd', d, '--registry', 'http://test/parity'], { from: 'user' }),
    );
    assert.match(output, /match the registry/, 'a pristine add must diff clean');
    // Counterfactual: a genuine local edit is still flagged.
    writeFileSync(join(d, 'components', 'ui', 'button.ts'), 'export const buttonClass = () => "EDITED";');
    const output2 = await captureLog(() =>
      diff.parseAsync(['button', '--cwd', d, '--registry', 'http://test/parity'], { from: 'user' }),
    );
    assert.match(output2, /differ/, 'a real local edit is flagged');
  } finally {
    console.warn = origWarn;
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('diff: exits with error when components.json missing', async () => {
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

/* -------------------- blocks (#1666, D18) -------------------- */

// Two blocks writing the same page target, as every login block does, each
// importing a component, so a pristine install only diffs clean when `diff`
// compares against the import-rewritten file at the block's own target.
const BLOCK_REG = {
  card: {
    name: 'card', type: 'registry:ui',
    files: [{ path: 'components/card.ts', type: 'registry:ui', content: 'export const cardClass = () => "card";\n' }],
  },
  'login-a': {
    name: 'login-a', type: 'registry:block', categories: ['login'], registryDependencies: ['card'],
    files: [{ path: 'blocks/login-a/page.ts', type: 'registry:page', target: 'app/login/page.ts', content: "import { cardClass } from '../../components/card.ts';\nexport default () => cardClass('a');\n" }],
  },
  'login-b': {
    name: 'login-b', type: 'registry:block', categories: ['login'], registryDependencies: ['card'],
    files: [{ path: 'blocks/login-b/page.ts', type: 'registry:page', target: 'app/login/page.ts', content: "import { cardClass } from '../../components/card.ts';\nexport default () => cardClass('b');\n" }],
  },
};

function stubBlockFetch() {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.endsWith('/index.json')) return new Response(JSON.stringify(Object.values(BLOCK_REG)), { status: 200 });
    const name = u.split('/').pop().replace('.json', '');
    if (!BLOCK_REG[name]) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(BLOCK_REG[name]), { status: 200 });
  };
}

test('diff <block>: a pristine add diffs clean at the block\'s target, an edit is flagged', async () => {
  stubBlockFetch();
  const d = setupProject();
  try {
    await captureLog(() => add.parseAsync(['login-a', '--yes', '--no-deps', '--cwd', d, '--registry', 'http://test/blocks'], { from: 'user' }));
    const clean = await captureLog(() => diff.parseAsync(['login-a', '--cwd', d, '--registry', 'http://test/blocks'], { from: 'user' }));
    assert.match(clean, /match the registry/, 'the import-rewritten page matches');

    writeFileSync(join(d, 'app', 'login', 'page.ts'), '// edited\n');
    const edited = await captureLog(() => diff.parseAsync(['login-a', '--cwd', d, '--registry', 'http://test/blocks'], { from: 'user' }));
    assert.match(edited, /login-a.*app\/login\/page\.ts differs from registry/);
  } finally {
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});

test('diff with no name: a target shared by two blocks matches either, and is reported once when it matches neither', async () => {
  stubBlockFetch();
  const d = setupProject();
  try {
    await captureLog(() => add.parseAsync(['login-a', '--yes', '--no-deps', '--cwd', d, '--registry', 'http://test/blocks'], { from: 'user' }));
    const clean = await captureLog(() => diff.parseAsync(['--cwd', d, '--registry', 'http://test/blocks'], { from: 'user' }));
    assert.match(clean, /match the registry/, 'login-b writing the same file does not make login-a\'s page stale');

    writeFileSync(join(d, 'app', 'login', 'page.ts'), '// edited\n');
    const edited = await captureLog(() => diff.parseAsync(['--cwd', d, '--registry', 'http://test/blocks'], { from: 'user' }));
    assert.match(edited, /app\/login\/page\.ts differs from every item that writes it \(login-a, login-b\)/);
    assert.match(edited, /^1 file differ/m);
  } finally {
    globalThis.fetch = origFetch;
    rmSync(d, { recursive: true });
  }
});
