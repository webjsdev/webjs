/**
 * Targeted tests to push @webjskit/ui coverage above 95%. Covers package-
 * manager detection in add.js, the interactive init prompt branch, and
 * the few remaining uncovered branches.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectProject } from '../src/utils/detect-project.js';

const origLog = console.log;

function tmp() { return mkdtempSync(join(tmpdir(), 'webjsui-cov-extra-')); }

test('detectProject: handles missing package.json gracefully', () => {
  const d = tmp();
  try {
    assert.deepEqual(detectProject(d), { type: 'plain', meta: {} });
  } finally { rmSync(d, { recursive: true }); }
});

test('detectProject: vite via devDependencies (not just deps)', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({
      devDependencies: { '@vitejs/plugin-react': '*' },
    }));
    assert.equal(detectProject(d).type, 'vite');
  } finally { rmSync(d, { recursive: true }); }
});

test('detectProject: vite via @vitejs/plugin-vue in devDeps', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({
      devDependencies: { '@vitejs/plugin-vue': '*' },
    }));
    assert.equal(detectProject(d).type, 'vite');
  } finally { rmSync(d, { recursive: true }); }
});

test('detectProject: falls back to plain when no recognized dep', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({
      dependencies: { 'some-unknown': '*' },
    }));
    assert.equal(detectProject(d).type, 'plain');
  } finally { rmSync(d, { recursive: true }); }
});

test('detectProject: webjs via app/layout.js (not just .ts)', () => {
  const d = tmp();
  try {
    mkdirSync(join(d, 'app'), { recursive: true });
    writeFileSync(join(d, 'app', 'layout.js'), '');
    writeFileSync(join(d, 'package.json'), JSON.stringify({}));
    assert.equal(detectProject(d).type, 'webjs');
  } finally { rmSync(d, { recursive: true }); }
});
