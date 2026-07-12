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

test('stripPlaceholderMarkers: removes a WHOLE multi-line HTML comment marker, no orphaned text', () => {
  // The layout footer marker is a 4-line <!-- ... --> block. Removing only the
  // token line would orphan lines 2-4 and a dangling --> as raw text inside the
  // html`` template. Regression guard for that corruption.
  const src = [
    '      </main>',
    `      <!-- ${MARKER}. This "Built with" footer is SCAFFOLD`,
    '           branding, not your app. REMOVE it before shipping.',
    '           webjs check fails while the marker remains. -->',
    '      <footer>real footer</footer>',
  ].join('\n');
  const { content, removed } = stripPlaceholderMarkers(src);
  assert.equal(removed, 3, 'the whole 3-line comment block is removed');
  assert.doesNotMatch(content, new RegExp(MARKER), 'token gone');
  assert.doesNotMatch(content, /branding, not your app/, 'no orphaned prose survives');
  assert.doesNotMatch(content, /-->/, 'no dangling comment terminator');
  assert.match(content, /<\/main>/, 'surrounding markup kept');
  assert.match(content, /<footer>real footer<\/footer>/, 'the real footer is kept');
});

test('stripPlaceholderMarkers: removes a wrapped multi-line // marker, no orphaned prose', () => {
  const src = [
    `// ${MARKER}. Keep and adapt it, or prune it (delete this`,
    '// file), then delete this marker line. webjs check fails while the marker',
    '// remains.',
    "export default function Page() { return null; }",
  ].join('\n');
  const { content, removed } = stripPlaceholderMarkers(src);
  assert.equal(removed, 3, 'all three // comment lines removed');
  assert.doesNotMatch(content, /Keep and adapt|marker line|remains/, 'no orphaned // prose');
  assert.match(content, /export default function Page/, 'code kept');
});

test('stripPlaceholderMarkers: keeps a SEPARATE educational comment that follows the marker', () => {
  // Real scaffold shape (app/features/routing/page.ts): a one-line marker ending
  // in the closing clause, then an unrelated `//` explanation paragraph. The
  // marker must be cut at its clause, never eat the following comment or code.
  const src = [
    `// ${MARKER}. Feature gallery route. Keep and adapt it, then delete this marker line. webjs check fails while the marker remains.`,
    '// Routing basics: a static page that links to a dynamic route. app/ is',
    '// routing only; [id] is a dynamic segment read from params.',
    "import { html } from '@webjsdev/core';",
  ].join('\n');
  const { content, removed, markers } = stripPlaceholderMarkers(src);
  assert.equal(markers, 1, 'one marker cleared');
  assert.equal(removed, 1, 'only the marker line removed');
  assert.doesNotMatch(content, new RegExp(MARKER), 'marker gone');
  assert.match(content, /Routing basics/, 'the educational comment is KEPT (regression: greedy run must not eat it)');
  assert.match(content, /import \{ html \}/, 'code kept');
});

test('stripPlaceholderMarkers: a wrapped marker followed by a doc block keeps the doc block', () => {
  // Real scaffold shape (app/global-error.ts): the marker sentence WRAPS across
  // three `//` lines, then a `//` separator, then a distinct doc paragraph.
  const src = [
    `// ${MARKER}. Keep and adapt it, or prune it (delete this`,
    '// file), then delete this marker line. webjs check fails while the marker',
    '// remains.',
    '//',
    '// app/global-error.ts is the ROOT-ONLY app-wide error boundary. Keep it',
    '// static HTML with no components.',
    "import { html } from '@webjsdev/core';",
  ].join('\n');
  const { content, removed } = stripPlaceholderMarkers(src);
  assert.equal(removed, 3, 'only the 3 wrapped marker lines removed, not the doc block');
  assert.doesNotMatch(content, /delete this marker line|marker remains/, 'marker prose gone');
  assert.match(content, /ROOT-ONLY app-wide error boundary/, 'the doc paragraph is KEPT');
  assert.match(content, /import \{ html \}/, 'code kept');
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
