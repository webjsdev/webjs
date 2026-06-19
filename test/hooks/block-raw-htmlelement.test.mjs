import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../.claude/hooks/block-raw-htmlelement.sh'
);

/** Helper to run the hook with custom file path, content, and edits. */
function runHook(filePath, content = null, newString = null, edits = null) {
  const toolInput = { file_path: filePath };
  if (content !== null) {
    toolInput.content = content;
  }
  if (newString !== null) {
    toolInput.new_string = newString;
  }
  if (edits !== null) {
    toolInput.edits = edits;
  }
  return spawnSync('bash', [HOOK], {
    input: JSON.stringify({ tool_input: toolInput }),
    encoding: 'utf8',
  });
}

/** Set up a temporary directory with a webjs package.json. */
function setupTempProject(isWebjs = true) {
  const tempDir = mkdtempSync(join(tmpdir(), 'webjs-hook-test-'));
  const pkgContent = isWebjs
    ? JSON.stringify({ dependencies: { '@webjsdev/core': 'latest' } })
    : JSON.stringify({ dependencies: {} });
  writeFileSync(join(tempDir, 'package.json'), pkgContent);
  return tempDir;
}

test('blocks classes extending raw HTMLElement inside webjs project', () => {
  const tempDir = setupTempProject(true);
  try {
    const filePath = join(tempDir, 'components/test-el.ts');
    mkdirSync(dirname(filePath), { recursive: true });

    // Write action
    const r1 = runHook(filePath, 'class TestEl extends HTMLElement {}');
    assert.equal(r1.status, 2, 'should block raw HTMLElement during Write');
    assert.match(r1.stderr, /BLOCKED: a webjs custom element must extend the WebComponent base class/);

    // Edit action
    const r2 = runHook(filePath, null, 'class TestEl extends HTMLElement {}');
    assert.equal(r2.status, 2, 'should block raw HTMLElement during Edit');

    // MultiEdit action
    const r3 = runHook(filePath, null, null, [{ new_string: 'class TestEl extends HTMLElement {}' }]);
    assert.equal(r3.status, 2, 'should block raw HTMLElement during MultiEdit');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('allows classes extending WebComponent', () => {
  const tempDir = setupTempProject(true);
  try {
    const filePath = join(tempDir, 'components/test-el.ts');
    mkdirSync(dirname(filePath), { recursive: true });

    const r = runHook(filePath, 'class TestEl extends WebComponent {}');
    assert.equal(r.status, 0, 'should allow WebComponent');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('allows raw HTMLElement when escape hatch comment is present', () => {
  const tempDir = setupTempProject(true);
  try {
    const filePath = join(tempDir, 'components/test-el.ts');
    mkdirSync(dirname(filePath), { recursive: true });

    const code = `
      // webjs-allow-htmlelement: customized built-in element
      class MyButton extends HTMLElement {}
    `;
    const r = runHook(filePath, code);
    assert.equal(r.status, 0, 'should allow HTMLElement when comment is present');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('allows raw HTMLElement in framework source files', () => {
  const tempDir = setupTempProject(true);
  try {
    // Simulated path inside packages/
    const filePath = join(tempDir, 'packages/core/src/component.ts');
    mkdirSync(dirname(filePath), { recursive: true });

    const r = runHook(filePath, 'class WebComponent extends HTMLElement {}');
    assert.equal(r.status, 0, 'should allow raw HTMLElement inside packages/');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('allows raw HTMLElement outside of webjs projects', () => {
  const tempDir = setupTempProject(false);
  try {
    const filePath = join(tempDir, 'components/vanilla-el.ts');
    mkdirSync(dirname(filePath), { recursive: true });

    const r = runHook(filePath, 'class VanillaEl extends HTMLElement {}');
    assert.equal(r.status, 0, 'should allow raw HTMLElement when not in a webjs project');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ignores non-TS/JS extensions', () => {
  const tempDir = setupTempProject(true);
  try {
    const filePath = join(tempDir, 'components/notes.md');
    mkdirSync(dirname(filePath), { recursive: true });

    const r = runHook(filePath, 'class MyEl extends HTMLElement {}');
    assert.equal(r.status, 0, 'should ignore markdown files');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
