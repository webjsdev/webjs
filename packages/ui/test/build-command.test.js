import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from '../src/commands/build.js';

function tmpRegistry() {
  const d = mkdtempSync(join(tmpdir(), 'webjsui-build-'));
  mkdirSync(join(d, 'components'), { recursive: true });
  writeFileSync(join(d, 'components', 'button.ts'), 'export const Button = "btn";\n');
  writeFileSync(join(d, 'components', 'card.ts'), 'export const Card = "card";\n');
  writeFileSync(join(d, 'registry.json'), JSON.stringify({
    name: 'test',
    homepage: 'https://example.test',
    items: [
      {
        name: 'button',
        type: 'registry:ui',
        files: [{ path: 'components/button.ts', type: 'registry:ui' }],
      },
      {
        name: 'card',
        type: 'registry:ui',
        registryDependencies: ['button'],
        files: [{ path: 'components/card.ts', type: 'registry:ui' }],
      },
    ],
  }));
  return d;
}

test('build: emits r/<name>.json per item with inlined content', async () => {
  const d = tmpRegistry();
  try {
    await build.parseAsync(['registry.json', '--cwd', d, '--output', './r'], { from: 'user' });
    const buttonJson = JSON.parse(readFileSync(join(d, 'r', 'button.json'), 'utf8'));
    assert.equal(buttonJson.name, 'button');
    assert.equal(buttonJson.type, 'registry:ui');
    assert.equal(buttonJson.files[0].content, 'export const Button = "btn";\n');
    assert.ok(buttonJson.$schema, 'should add $schema');
  } finally { rmSync(d, { recursive: true }); }
});

test('build: emits index.json with flat list', async () => {
  const d = tmpRegistry();
  try {
    await build.parseAsync(['registry.json', '--cwd', d], { from: 'user' });
    const idx = JSON.parse(readFileSync(join(d, 'r', 'index.json'), 'utf8'));
    assert.equal(idx.length, 2);
    assert.deepEqual(idx.map((i) => i.name).sort(), ['button', 'card']);
  } finally { rmSync(d, { recursive: true }); }
});

test('build: emits registry.json (full manifest copy)', async () => {
  const d = tmpRegistry();
  try {
    await build.parseAsync(['registry.json', '--cwd', d], { from: 'user' });
    const manifest = JSON.parse(readFileSync(join(d, 'r', 'registry.json'), 'utf8'));
    assert.equal(manifest.name, 'test');
    assert.equal(manifest.items.length, 2);
  } finally { rmSync(d, { recursive: true }); }
});

test('build: preserves registryDependencies in output', async () => {
  const d = tmpRegistry();
  try {
    await build.parseAsync(['registry.json', '--cwd', d], { from: 'user' });
    const cardJson = JSON.parse(readFileSync(join(d, 'r', 'card.json'), 'utf8'));
    assert.deepEqual(cardJson.registryDependencies, ['button']);
  } finally { rmSync(d, { recursive: true }); }
});

test('build: fails on missing manifest', async (t) => {
  const d = mkdtempSync(join(tmpdir(), 'webjsui-build-missing-'));
  const origExit = process.exit;
  const origError = console.error;
  let exited = false;
  process.exit = ((c) => { exited = true; throw new Error('exit:' + c); });
  console.error = () => {};
  try {
    await assert.rejects(
      () => build.parseAsync(['registry.json', '--cwd', d], { from: 'user' }),
      /exit:1/,
    );
    assert.ok(exited);
  } finally {
    process.exit = origExit;
    console.error = origError;
    rmSync(d, { recursive: true });
  }
});
