import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectProject, defaultsForProject } from '../src/utils/detect-project.js';

function tmp() {
  const d = mkdtempSync(join(tmpdir(), 'webjsui-detect-'));
  return d;
}

test('detectProject — webjs (has @webjskit/server in deps)', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({ dependencies: { '@webjskit/server': '*' } }));
    assert.equal(detectProject(d).type, 'webjs');
  } finally { rmSync(d, { recursive: true }); }
});

test('detectProject — next', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({ dependencies: { next: '14.0.0' } }));
    assert.equal(detectProject(d).type, 'next');
  } finally { rmSync(d, { recursive: true }); }
});

test('detectProject — vite', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({ devDependencies: { vite: '*' } }));
    assert.equal(detectProject(d).type, 'vite');
  } finally { rmSync(d, { recursive: true }); }
});

test('detectProject — plain when no package.json', () => {
  const d = tmp();
  try {
    assert.equal(detectProject(d).type, 'plain');
  } finally { rmSync(d, { recursive: true }); }
});

test('defaultsForProject — webjs uses app/globals.css', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({ dependencies: { '@webjskit/server': '*' } }));
    const def = defaultsForProject(d);
    assert.equal(def.tailwindCss, 'app/globals.css');
    assert.equal(def.aliases.ui, 'components/ui');
  } finally { rmSync(d, { recursive: true }); }
});

test('defaultsForProject — next uses @/ aliases', () => {
  const d = tmp();
  try {
    writeFileSync(join(d, 'package.json'), JSON.stringify({ dependencies: { next: '*' } }));
    const def = defaultsForProject(d);
    assert.equal(def.aliases.ui, '@/components/ui');
  } finally { rmSync(d, { recursive: true }); }
});
