import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { list } from '../src/commands/list.js';
import { view } from '../src/commands/view.js';
import { info } from '../src/commands/info.js';

const origFetch = globalThis.fetch;
const origLog = console.log;

const ITEMS = [
  { name: 'button', type: 'registry:ui', description: 'A button' },
  { name: 'card', type: 'registry:ui', description: 'A card' },
  { name: 'lib-utils', type: 'registry:lib' },
];

function stubFetch() {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.endsWith('/index.json')) {
      return new Response(JSON.stringify(ITEMS), { status: 200 });
    }
    const name = u.split('/').pop().replace('.json', '');
    if (name === 'button') {
      return new Response(JSON.stringify({
        name: 'button', type: 'registry:ui', description: 'A button',
        files: [{ path: 'components/button.ts', type: 'registry:ui', content: '// button source' }],
      }), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  };
}

function captureLog(fn) {
  const out = [];
  console.log = (...args) => out.push(args.join(' '));
  return fn().finally(() => { console.log = origLog; }).then(() => out.join('\n'));
}

test('list: prints all registry:ui items', async () => {
  stubFetch();
  try {
    const output = await captureLog(() =>
      list.parseAsync(['--registry', 'http://test/r'], { from: 'user' }),
    );
    assert.match(output, /button/);
    assert.match(output, /card/);
    // libs are filtered out: only ui-typed entries
    assert.doesNotMatch(output, /lib-utils/);
  } finally { globalThis.fetch = origFetch; }
});

test('list: filters by substring', async () => {
  stubFetch();
  try {
    const output = await captureLog(() =>
      list.parseAsync(['card', '--registry', 'http://test/r'], { from: 'user' }),
    );
    assert.match(output, /card/);
    assert.doesNotMatch(output, /^\s*button\s*$/m);
  } finally { globalThis.fetch = origFetch; }
});

test('view: prints component source', async () => {
  stubFetch();
  try {
    const output = await captureLog(() =>
      view.parseAsync(['button', '--registry', 'http://test/r'], { from: 'user' }),
    );
    assert.match(output, /button source/);
    assert.match(output, /components\/button\.ts/);
  } finally { globalThis.fetch = origFetch; }
});

test('info: reports missing config, and no longer prints a project type', async () => {
  const d = mkdtempSync(join(tmpdir(), 'webjsui-info-'));
  writeFileSync(join(d, 'package.json'), JSON.stringify({ dependencies: { '@webjsdev/server': '*' } }));
  try {
    const output = await captureLog(() =>
      info.parseAsync(['--cwd', d], { from: 'user' }),
    );
    assert.match(output, /components\.json/);
    // #1129: the project-type line is gone along with the detection it read.
    assert.doesNotMatch(output, /Project/);
    // #1264: the repair command it points at has to resolve for the reader.
    assert.match(output, /npx @webjsdev\/ui init/);
    assert.doesNotMatch(output, /`webjsui init`/);
  } finally { rmSync(d, { recursive: true }); }
});

test('info: reports config when present, read from the file not inferred', async () => {
  const d = mkdtempSync(join(tmpdir(), 'webjsui-info-cfg-'));
  // A Next-shaped dependency set with a components.json that carries its own
  // paths. Nothing about the host project is inspected any more, so the values
  // reported are exactly the ones on disk. This is why #1129 needed no
  // migration: an already-initialised project keeps reading its own file.
  writeFileSync(join(d, 'package.json'), JSON.stringify({ dependencies: { next: '14.0.0' } }));
  writeFileSync(join(d, 'components.json'), JSON.stringify({
    style: 'default',
    tailwind: { css: 'app/globals.css', baseColor: 'zinc', cssVariables: true },
    aliases: { components: 'components', utils: 'lib/utils' },
  }));
  try {
    const output = await captureLog(() =>
      info.parseAsync(['--cwd', d], { from: 'user' }),
    );
    assert.match(output, /zinc/);
    assert.match(output, /app\/globals\.css/);
    assert.match(output, /lib\/utils/);
    assert.doesNotMatch(output, /next/);
  } finally { rmSync(d, { recursive: true }); }
});

// The style bake (#1666): `view` and the projector it shares with the MCP `ui`
// tool print what an app would get, so no cn-* name may appear in either.
test('view projection: uiComponent is baked, for the default and for a named style', async () => {
  const { uiComponent } = await import('../src/registry/extract.js');
  const { bakeForStyle, leftoverCnNames } = await import('../src/registry/style-bake.js');
  const { loadRegistryItem } = await import('../src/registry/local.js');
  for (const style of [undefined, 'nova']) {
    const c = uiComponent('button', { style });
    assert.ok(c, 'button projects');
    const src = loadRegistryItem('button').files.map((f) => bakeForStyle(f.content, style)).join('\n');
    assert.deepEqual(leftoverCnNames(src), [], `the baked button source carries no cn-* name (style ${style ?? 'default'})`);
    assert.ok(c.helpers.some((h) => /buttonClass/.test(h)), 'the helper signatures survive the bake');
  }
});

/* -------------------- blocks (#1666, D18) -------------------- */

test('list: prints components, blocks and charts in labelled groups', async () => {
  const output = await captureLog(() => list.parseAsync([], { from: 'user' }));
  assert.match(output, /Components:/);
  assert.match(output, /Blocks \(a ready-made view you install and then edit\):/);
  assert.match(output, /login-01/);
  assert.match(output, /\d+ components, \d+ blocks/);
  assert.ok(output.indexOf('Components:') < output.indexOf('Blocks'), 'components first');
});

test('list --type block --json: one compact array of blocks, nothing else on stdout', async () => {
  const output = await captureLog(() => list.parseAsync(['--type', 'block', '--json'], { from: 'user' }));
  const items = JSON.parse(output);
  assert.ok(items.length >= 10);
  assert.ok(items.every((i) => i.type === 'block'), 'blocks only');
  assert.deepEqual(Object.keys(items[0]).sort(), ['categories', 'description', 'name', 'type']);
  assert.ok(!output.includes('\n'), 'compact, one line');
});

test('list --category signup: only the blocks in that category', async () => {
  const output = await captureLog(() => list.parseAsync(['--category', 'signup', '--json'], { from: 'user' }));
  assert.deepEqual(JSON.parse(output).map((i) => i.name), ['signup-01', 'signup-02', 'signup-03', 'signup-04', 'signup-05']);
});

test('view <block>: description, install command and file targets, then the sources', async () => {
  const output = await captureLog(() => view.parseAsync(['login-04'], { from: 'user' }));
  assert.match(output, /A login page with form and image\./);
  assert.match(output, /Install: npx @webjsdev\/ui add login-04/);
  assert.match(output, /app\/login\/page\.ts/);
  assert.match(output, /public\/placeholder\.svg/);
  assert.match(output, /export function loginForm/, 'the sources follow');
});

test('view <block> --files-only stops before the sources; --json is one document', async () => {
  const short = await captureLog(() => view.parseAsync(['login-01', '--files-only'], { from: 'user' }));
  assert.match(short, /components\/login-form\.ts/);
  assert.doesNotMatch(short, /export function loginForm/);

  const json = JSON.parse(await captureLog(() => view.parseAsync(['login-01', '--json', '--files-only'], { from: 'user' })));
  assert.equal(json.install, 'npx @webjsdev/ui add login-01');
  assert.deepEqual(json.categories, ['authentication', 'login']);
  assert.ok(json.files.every((f) => f.target && f.content === undefined));
});

test('info: counts the blocks and charts beside the components', async () => {
  const d = mkdtempSync(join(tmpdir(), 'webjsui-info-kit-'));
  try {
    const output = await captureLog(() => info.parseAsync(['--cwd', d], { from: 'user' }));
    assert.match(output, /\d+ components, \d+ blocks, \d+ charts/);
  } finally { rmSync(d, { recursive: true }); }
});
