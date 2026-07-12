import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stripPlaceholderMarkers, clearPlaceholders, MARKER } from '../../lib/clear-placeholders.js';

test('stripPlaceholderMarkers: removes only the marker comment lines, keeps code verbatim', () => {
  const src = [
    `// ${MARKER}. Keep and adapt it, or prune it, then delete this marker line.`,
    "import { html } from '@webjsdev/core';",
    'export default function Page() { return html`<h1>Hi</h1>`; }',
  ].join('\n');
  const { content, removed } = stripPlaceholderMarkers(src);
  assert.equal(removed, 1, 'one marker line removed');
  assert.doesNotMatch(content, new RegExp(MARKER), 'marker token is gone');
  assert.match(content, /import \{ html \}/, 'code is preserved');
  assert.match(content, /return html/, 'code is preserved');
});

test('stripPlaceholderMarkers: a file with no marker is untouched (counterfactual)', () => {
  const src = "export const x = 1;\nexport const y = 2;\n";
  const { content, removed } = stripPlaceholderMarkers(src);
  assert.equal(removed, 0, 'nothing removed');
  assert.equal(content, src, 'content byte-identical');
});

test('clearPlaceholders: walks the app, strips markers, reports per-file, skips node_modules', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-clear-'));
  try {
    mkdirSync(join(dir, 'app', 'features', 'x'), { recursive: true });
    mkdirSync(join(dir, 'node_modules', 'pkg'), { recursive: true });
    writeFileSync(join(dir, 'app', 'page.ts'), `// ${MARKER}. demo\nexport default () => 'home';\n`);
    writeFileSync(join(dir, 'app', 'features', 'x', 'page.ts'), `// ${MARKER}. demo\nexport default () => 'x';\n`);
    writeFileSync(join(dir, 'app', 'clean.ts'), `export const ok = true;\n`);
    // A marker inside node_modules must NOT be touched (dependency code).
    writeFileSync(join(dir, 'node_modules', 'pkg', 'index.js'), `// ${MARKER}\n`);

    const report = clearPlaceholders(dir);

    assert.equal(report.length, 2, 'exactly the two marked app files were rewritten');
    assert.doesNotMatch(readFileSync(join(dir, 'app', 'page.ts'), 'utf8'), new RegExp(MARKER));
    assert.doesNotMatch(readFileSync(join(dir, 'app', 'features', 'x', 'page.ts'), 'utf8'), new RegExp(MARKER));
    assert.match(readFileSync(join(dir, 'node_modules', 'pkg', 'index.js'), 'utf8'), new RegExp(MARKER),
      'node_modules is skipped (counterfactual: fails if the walker descends into deps)');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
