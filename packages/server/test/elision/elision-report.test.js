/**
 * The app-level elision report contract (#1308).
 *
 * `analyzeAppElision` is the ONE function `webjs elision`, `webjs elision
 * --json`, the MCP `list_elision` tool, and both `webjs doctor` elision checks
 * read, so its shape IS the public contract. It had no test at all before this
 * file (the #646 version was only exercised indirectly, through the doctor
 * advisory's message text).
 *
 * The properties asserted here are the ones a consumer depends on and that a
 * refactor can silently break: every path app-relative (no absolute filesystem
 * path anywhere, INCLUDING inside a prose `reason`), every array sorted by
 * `file`, the summary counts equal to the array lengths, each `skipped` value
 * distinguishable, and one row of every `evidence` value. Route modules never
 * ship (#1686), so a route row is its kind plus the component frontier the
 * boot imports in its place, and those rows are reported with elision off too.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';

import { analyzeAppElision } from '../../src/elision-report.js';

/** @param {Record<string, string>} files  app-relative path -> source */
async function withApp(files, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-elision-report-'));
  try {
    for (const [rel, src] of Object.entries(files)) {
      const abs = join(dir, rel);
      await mkdir(join(abs, '..'), { recursive: true });
      await writeFile(abs, src);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const DISPLAY_ONLY = `
import { WebComponent, html } from '@webjsdev/core';
export class Badge extends WebComponent {
  render() { return html\`<span>verified</span>\`; }
}
Badge.register('my-badge');
`;

const INTERACTIVE = `
import { WebComponent, html } from '@webjsdev/core';
export class Counter extends WebComponent {
  render() { return html\`<button @click=\${() => {}}>+</button>\`; }
}
Counter.register('my-counter');
`;

/**
 * A badge whose own source is inert but whose IMPORT does client work.
 *
 * Fixture sources here are template literals, never plain strings. The
 * scanner-fuzz corpus sweep reads every file under `test/elision`.
 * `redactStringsAndTemplates` keeps a plain-string body VERBATIM, so the
 * embedded html-template BACKTICK survives into the mask, `matchClosingBrace`
 * returns -1, and the class-body extractor yields 0 bodies against 1
 * name-window match. That internal count assert THROWS, the corpus test's
 * try/catch pushes the throw into `misses`, and `misses` is asserted, so the
 * suite FAILS. A bare over-match would be fine (that direction is explicitly
 * accepted); this is a count mismatch, which is not the same thing. Verified
 * both by reverting a fixture and by an independent check.
 * This file is where that was first hit.
 */
const BADGE_IMPORTING_SIGNAL = `
import { WebComponent, html } from '@webjsdev/core';
import { n } from '../lib/live.js';
export class Badge extends WebComponent {
  render() { return html\`<span>\${String(n)}</span>\`; }
}
Badge.register('my-badge');
`;

/** An interactive shell that renders the badge's tag. */
const SHELL_RENDERING_BADGE = `
import { WebComponent, html } from '@webjsdev/core';
import '../components/badge.js';
export class Shell extends WebComponent {
  render() { return html\`<button @click=\${() => {}}><my-badge></my-badge></button>\`; }
}
Shell.register('my-shell');
`;

/** A badge registered with a COMPUTED tag, which the scanner never sees. */
const BADGE_COMPUTED_TAG = `
import { WebComponent, html } from '@webjsdev/core';
const TAG = 'dyn-' + 'badge';
export class DynBadge extends WebComponent {
  render() { return html\`<span>x</span>\`; }
}
DynBadge.register(TAG);
`;

/** Every string value anywhere in the report, for the no-absolute-path sweep. */
function allStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) allStrings(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) allStrings(v, out);
  return out;
}

test('the full shape: verdicts, sorting, summary, and no absolute path anywhere', async () => {
  await withApp({
    'components/badge.js': DISPLAY_ONLY,
    'components/counter.js': INTERACTIVE,
    'app/page.js': "import { html } from '@webjsdev/core';\nimport '../components/counter.js';\nexport default () => html`<my-counter></my-counter>`;",
    'app/about/page.js': "import { html } from '@webjsdev/core';\nimport '../../components/badge.js';\nexport default () => html`<my-badge></my-badge>`;",
  }, async (dir) => {
    const r = await analyzeAppElision(dir);
    assert.equal(r.analysed, true);
    assert.equal(r.skipped, null);
    assert.equal(r.elide, true);

    const badge = r.components.find((c) => c.file.includes('badge'));
    const counter = r.components.find((c) => c.file.includes('counter'));
    assert.deepEqual(badge, { file: 'components/badge.js', tags: ['my-badge'], verdict: 'elided', evidence: null, reason: null, by: null });
    assert.equal(counter.verdict, 'shipped');
    assert.equal(counter.evidence, 'own');
    assert.match(counter.reason, /@event binding/);
    assert.equal(counter.by, null);

    const about = r.routeModules.find((m) => m.file.includes('about'));
    const home = r.routeModules.find((m) => m.file === 'app/page.js');
    assert.deepEqual(about, { file: 'app/about/page.js', kind: 'page', emits: [], hints: [] },
      'a page whose only component is elided loads no JavaScript');
    assert.deepEqual(home, { file: 'app/page.js', kind: 'page', emits: ['components/counter.js'], hints: [] },
      'a page is replaced by the components it imports');

    // Sorted by file, so two runs diff cleanly.
    for (const arr of [r.components, r.routeModules, r.orphans]) {
      assert.deepEqual(arr.map((x) => x.file), [...arr.map((x) => x.file)].sort(), 'rows are sorted by file');
    }
    // Summary equals the arrays it summarises.
    assert.equal(r.summary.components, r.components.length);
    assert.equal(r.summary.elided, r.components.filter((c) => c.verdict === 'elided').length);
    assert.equal(r.summary.shipped, r.components.filter((c) => c.verdict === 'shipped').length);
    assert.equal(r.summary.routeModules, r.routeModules.length);
    assert.equal(r.summary.zeroJs, r.routeModules.filter((m) => m.emits.length === 0).length);
    assert.equal(r.summary.carriers, r.routeModules.filter((m) => m.emits.length > 0).length);
    assert.equal(r.summary.zeroJs, 1);
    assert.equal(r.summary.carriers, 1);
    assert.equal(r.summary.orphans, r.orphans.length);

    // No absolute path may reach the contract, including inside a reason
    // sentence, which `analyzeElision` builds from absolute paths.
    for (const s of allStrings(r)) {
      assert.ok(!s.includes(dir), `report leaked an absolute path: ${s}`);
      for (const word of s.split(/\s+/)) assert.ok(!isAbsolute(word), `report leaked an absolute path: ${s}`);
    }
    // JSON-serializable, since two consumers print it verbatim.
    assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
  });
});

test('a route module never ships, so browser-meant code in it is a hint, not a verdict (#1686)', async () => {
  // This page used to ship whole, blocked by lib/track.js touching `window`.
  // Now it runs only on the server: the row names its kind and loads nothing.
  // A BINDING import (track) is not hinted; the side-effect import of
  // lib/boot.js is, since whatever it sets up happens on the server only.
  await withApp({
    'lib/track.js': 'window.__hits = (window.__hits || 0) + 1;\nexport const track = () => {};',
    'lib/boot.js': 'document.title = "set at load";\nexport {};',
    'app/page.js': "import { html } from '@webjsdev/core';\nimport { track } from '../lib/track.js';\nimport '../lib/boot.js';\nexport default () => html`<p>${String(track)}</p>`;",
    'app/layout.js': "import { html } from '@webjsdev/core';\nexport default ({ children }) => html`<main>${children}</main>`;",
  }, async (dir) => {
    const r = await analyzeAppElision(dir);
    const home = r.routeModules.find((m) => m.file === 'app/page.js');
    assert.equal(home.kind, 'page');
    assert.deepEqual(home.emits, [], 'a route module never ships, whatever it imports');
    assert.equal(home.hints.length, 1, JSON.stringify(home.hints));
    assert.match(home.hints[0], /`\.\.\/lib\/boot\.js` runs only on the server/);
    const layout = r.routeModules.find((m) => m.file === 'app/layout.js');
    assert.deepEqual(layout, { file: 'app/layout.js', kind: 'layout', emits: [], hints: [] });
    // Hints are app-relative prose too.
    for (const h of home.hints) assert.ok(!h.includes(dir), `hint leaked an absolute path: ${h}`);
  });
});

test('every route-module kind is reported, never global-error', async () => {
  await withApp({
    'app/page.js': 'export default () => null;',
    'app/layout.js': 'export default ({ children }) => children;',
    'app/error.js': 'export default () => null;',
    'app/loading.js': 'export default () => null;',
    'app/not-found.js': 'export default () => null;',
    'app/forbidden.js': 'export default () => null;',
    'app/unauthorized.js': 'export default () => null;',
    'app/global-error.js': 'export default () => null;',
  }, async (dir) => {
    const r = await analyzeAppElision(dir);
    const kinds = Object.fromEntries(r.routeModules.map((m) => [m.file, m.kind]));
    assert.deepEqual(kinds, {
      'app/error.js': 'error',
      'app/forbidden.js': 'forbidden',
      'app/layout.js': 'layout',
      'app/loading.js': 'loading',
      'app/not-found.js': 'not-found',
      'app/page.js': 'page',
      'app/unauthorized.js': 'unauthorized',
    });
  });
});

test('evidence: observed', async () => {
  await withApp({
    'components/badge.js': DISPLAY_ONLY,
    'components/observer.js': "customElements.whenDefined('my-badge').then(() => {});",
    // The observer rides a shipping component: only a module the browser can
    // load observes anything (#1686).
    'components/counter.js': INTERACTIVE.replace("import { WebComponent, html } from '@webjsdev/core';", "import { WebComponent, html } from '@webjsdev/core';\nimport './observer.js';"),
    'app/page.js': "import { html } from '@webjsdev/core';\nimport '../components/badge.js';\nimport '../components/counter.js';\nexport default () => html`<my-badge></my-badge><my-counter></my-counter>`;",
  }, async (dir) => {
    const r = await analyzeAppElision(dir);
    const badge = r.components.find((c) => c.file.includes('badge'));
    assert.equal(badge.verdict, 'shipped');
    assert.equal(badge.evidence, 'observed');
    assert.equal(badge.by, 'components/observer.js');
    assert.equal(badge.reason, 'its registration is observed by components/observer.js');
  });
});

test('an observer only a page imports observes nothing: the page never runs in a browser (#1686)', async () => {
  await withApp({
    'components/badge.js': DISPLAY_ONLY,
    'components/observer.js': "customElements.whenDefined('my-badge').then(() => {});",
    'app/page.js': "import { html } from '@webjsdev/core';\nimport '../components/badge.js';\nimport '../components/observer.js';\nexport default () => html`<my-badge></my-badge>`;",
  }, async (dir) => {
    const r = await analyzeAppElision(dir);
    const badge = r.components.find((c) => c.file.includes('badge'));
    assert.equal(badge.verdict, 'elided');
  });
});

test('evidence: closure', async () => {
  await withApp({
    'lib/live.js': "import { signal } from '@webjsdev/core';\nexport const n = signal(0);",
    'components/badge.js': BADGE_IMPORTING_SIGNAL,
    'app/page.js': "import { html } from '@webjsdev/core';\nimport '../components/badge.js';\nexport default () => html`<my-badge></my-badge>`;",
  }, async (dir) => {
    const r = await analyzeAppElision(dir);
    const badge = r.components.find((c) => c.file.includes('components/badge'));
    assert.equal(badge.verdict, 'shipped');
    assert.equal(badge.evidence, 'closure');
    assert.equal(badge.by, 'lib/live.js');
    assert.match(badge.reason, /^its import lib\/live\.js /);
  });
});

test('evidence: render', async () => {
  await withApp({
    'components/badge.js': DISPLAY_ONLY,
    'components/shell.js': SHELL_RENDERING_BADGE,
    'app/page.js': "import { html } from '@webjsdev/core';\nimport '../components/shell.js';\nexport default () => html`<my-shell></my-shell>`;",
  }, async (dir) => {
    const r = await analyzeAppElision(dir);
    const badge = r.components.find((c) => c.file.includes('components/badge'));
    assert.equal(badge.verdict, 'shipped');
    // The render rule and the import rule both reach it; first match wins, and
    // either is a truthful account of why the module stays on the wire.
    assert.ok(['render', 'import'].includes(badge.evidence), `unexpected evidence ${badge.evidence}`);
    assert.equal(badge.by, 'components/shell.js');
  });
});

test('an orphan class is reported with no verdict', async () => {
  await withApp({
    'components/dyn-badge.js': BADGE_COMPUTED_TAG,
    'app/page.js': "import { html } from '@webjsdev/core';\nimport '../components/dyn-badge.js';\nexport default () => html`<p>hi</p>`;",
  }, async (dir) => {
    const r = await analyzeAppElision(dir);
    assert.deepEqual(r.orphans, [{ file: 'components/dyn-badge.js', className: 'DynBadge' }]);
    assert.equal(r.components.length, 0, 'the scanner never saw it, so there is no verdict for it');
    assert.equal(r.summary.orphans, 1);
  });
});

test('skipped: no-app', async () => {
  await withApp({ 'components/badge.js': DISPLAY_ONLY }, async (dir) => {
    const r = await analyzeAppElision(dir);
    assert.equal(r.analysed, false);
    assert.equal(r.skipped, 'no-app');
    assert.deepEqual(r.components, []);
    assert.equal(r.elide, false);
    assert.deepEqual(r.summary, { components: 0, elided: 0, shipped: 0, routeModules: 0, zeroJs: 0, carriers: 0, orphans: 0 });
  });
});

test('elision off is still analysed: every component ships, route rows still reported', async () => {
  await withApp({
    'package.json': JSON.stringify({ name: 'x', webjs: { elide: false } }),
    'components/badge.js': DISPLAY_ONLY,
    'app/page.js': "import { html } from '@webjsdev/core';\nimport '../components/badge.js';\nexport default () => html`<my-badge></my-badge>`;",
  }, async (dir) => {
    const r = await analyzeAppElision(dir);
    assert.equal(r.analysed, true);
    assert.equal(r.skipped, null);
    assert.equal(r.elide, false, 'a machine consumer tells the switch apart by `elide`');
    assert.deepEqual(r.components, [{
      file: 'components/badge.js', tags: ['my-badge'], verdict: 'shipped', evidence: null, reason: 'elision is disabled', by: null,
    }]);
    assert.deepEqual(r.routeModules, [{ file: 'app/page.js', kind: 'page', emits: ['components/badge.js'], hints: [] }],
      'a page never ships even with elision off; the display-only badge it imports loads in its place');
  });
});

test('elision off via the WEBJS_ELIDE override', async () => {
  await withApp({
    'app/page.js': "import { html } from '@webjsdev/core';\nexport default () => html`<p>hi</p>`;",
  }, async (dir) => {
    const ORIG = process.env.WEBJS_ELIDE;
    try {
      process.env.WEBJS_ELIDE = '0';
      const r = await analyzeAppElision(dir);
      assert.equal(r.analysed, true);
      assert.equal(r.elide, false);
    } finally {
      if (ORIG === undefined) delete process.env.WEBJS_ELIDE;
      else process.env.WEBJS_ELIDE = ORIG;
    }
  });
});

test('a malformed app degrades to an analysed empty report rather than throwing', async () => {
  // The third `skipped` value, `unanalysable`, is DEFENSIVE and has no
  // filesystem trigger: every builder in the pipeline is individually
  // error-tolerant, so an `app` that is a plain file, a directory the walk
  // cannot read, a page/route collision, and a malformed `imports` map all
  // produce an EMPTY analysis rather than a throw (each verified by hand
  // against this build). The value still belongs in the contract, because the
  // catch must be able to name itself instead of lying as `no-app`.
  //
  // What matters to a consumer, and what IS testable, is that none of these
  // shapes throws or returns a half-report.
  for (const files of [
    { app: 'not a directory' },
    { 'app/page.js': 'export default () => null;', 'app/route.js': 'export const GET = () => new Response(1);' },
    { 'package.json': '{"name":"x","imports":"nope"}', 'app/page.js': 'export default () => null;' },
  ]) {
    await withApp(files, async (dir) => {
      const r = await analyzeAppElision(dir);
      assert.ok(Array.isArray(r.components) && Array.isArray(r.routeModules) && Array.isArray(r.orphans));
      assert.equal(typeof r.summary.components, 'number');
      assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
    });
  }
});

test('every no-verdict report carries the identical empty shape', async () => {
  // A consumer branches on `skipped` and then reads the arrays; those must be
  // present and empty on EVERY skip path, never undefined.
  const empty = {
    components: [], routeModules: [], orphans: [],
    summary: { components: 0, elided: 0, shipped: 0, routeModules: 0, zeroJs: 0, carriers: 0, orphans: 0 },
  };
  await withApp({ 'components/badge.js': DISPLAY_ONLY }, async (dir) => {
    const r = await analyzeAppElision(dir);
    assert.equal(r.skipped, 'no-app');
    assert.deepEqual({ components: r.components, routeModules: r.routeModules, orphans: r.orphans, summary: r.summary }, empty);
  });
});
