/**
 * #1398: the pure live-reload classifier. A dev edit to a page or a layout can
 * be applied in place, because pages and layouts never hydrate, so the freshly
 * rendered server HTML is the complete truth for them. A dev edit to anything
 * the BROWSER holds cannot, because `customElements.define` is once-per-tag and
 * a module URL is fetched once per document.
 *
 * The ladder is exercised here against a synthetic `ctx` so the decision is
 * testable without booting a server. `classify-live.test.js` is the end-to-end
 * counterfactual that the verdict actually reaches the wire.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyChangedPath, mergeVerdicts, RELOAD_VERDICTS } from '../../src/dev-classify.js';

const APP = '/app';
const p = (rel) => `${APP}/${rel}`;

/** A ctx describing a small app with one page, one layout, one component. */
function ctx(over = {}) {
  return {
    appDir: APP,
    sep: '/',
    analysisReady: true,
    // What the browser can ACTUALLY load: the component, a util it imports, and
    // an action file it imports (the graph keeps a `.server.*` node and stops).
    shippedFiles: new Set([
      p('components/counter.ts'),
      p('lib/utils/format.ts'),
      p('modules/todos/actions/create.server.ts'),
    ]),
    // Every app source the graph walked, shipped or not.
    graphFiles: new Set([
      p('app/page.ts'),
      p('app/layout.ts'),
      p('app/blog/[slug]/page.ts'),
      p('components/counter.ts'),
      p('lib/utils/format.ts'),
      p('modules/todos/actions/create.server.ts'),
      p('modules/posts/queries/list.server.ts'),
    ]),
    pageFiles: new Set([p('app/page.ts'), p('app/blog/[slug]/page.ts')]),
    ...over,
  };
}

test('a page module morphs in place', () => {
  const v = classifyChangedPath(p('app/page.ts'), ctx());
  assert.equal(v.v, 'page');
  assert.equal(v.why, 'page-module');
  assert.equal(v.by, 'app/page.ts', 'the diagnostic path is app-relative');

  assert.equal(classifyChangedPath(p('app/blog/[slug]/page.ts'), ctx()).v, 'page');
});

test('a layout module takes the whole-body shell swap', () => {
  // A layout's OWN markup sits outside every `<!--wj:children:...-->` range, so
  // a boundary morph would silently do nothing. It is not a page and not
  // shipped, so it falls to the server-only rung.
  const v = classifyChangedPath(p('app/layout.ts'), ctx());
  assert.equal(v.v, 'shell');
  assert.equal(v.why, 'server-only-module');
});

test('a component module is a full reload', () => {
  const v = classifyChangedPath(p('components/counter.ts'), ctx());
  assert.equal(v.v, 'reload');
  assert.equal(v.why, 'ships-to-browser');
});

// The reachability answer, and the reason the classification cannot be a
// path-shape heuristic. Nothing about `lib/utils/format.ts` says "component".
test('a util reachable from a component is a full reload, by reachability alone', () => {
  assert.equal(classifyChangedPath(p('lib/utils/format.ts'), ctx()).v, 'reload');
});

// A page that imports a client-effecting non-component util SHIPS WHOLE (the
// import-only rule, #605 / #963), and editing it changes browser-bound JS. The
// shipped closure is checked BEFORE the page rung precisely so this wins.
test('a page that ships to the browser reloads despite being a page', () => {
  const c = ctx();
  c.shippedFiles.add(p('app/page.ts'));
  const v = classifyChangedPath(p('app/page.ts'), c);
  assert.equal(v.v, 'reload');
  assert.equal(v.why, 'ships-to-browser');
});

test('an action reachable from a shipping component reloads; one reachable only from a page does not', () => {
  // Adding an export to an action a shipping component imports changes the
  // generated RPC stub the browser holds, so it must reload.
  assert.equal(classifyChangedPath(p('modules/todos/actions/create.server.ts'), ctx()).v, 'reload');
  // The same kind of file, reached only from a page, never enters the browser.
  const v = classifyChangedPath(p('modules/posts/queries/list.server.ts'), ctx());
  assert.equal(v.v, 'shell');
  assert.equal(v.why, 'server-only-module');
});

// `public/` is outside the module graph, so the server cannot tell what the
// file is or what depends on it, and most of what lives there (an image, a
// font, a service worker) is something no re-render picks up.
test('a public/ asset other than a stylesheet is a full reload, never a morph', () => {
  for (const f of ['public/logo.png', 'public/sw.js', 'public/fonts/inter.woff2']) {
    const v = classifyChangedPath(p(f), ctx());
    assert.equal(v.v, 'reload', f);
    assert.equal(v.why, 'unknown-path', f);
  }
});

// #1689: a stylesheet the browser does not hold as a module swaps in place.
// The tab refreshes every same-origin sheet, so a public/ sheet, a partial
// anywhere in the app, and a regenerate input all take the same verdict.
test('a stylesheet outside the shipped graph is a css swap', () => {
  for (const f of ['public/app.css', 'app/x.css', 'styles/partials/buttons.css']) {
    const v = classifyChangedPath(p(f), ctx());
    assert.deepEqual(v, { v: 'css', by: f, why: 'stylesheet', css: true }, f);
  }
});

// A CSS module script (`import s from './x.css' with { type: 'css' }`) is a
// browser module, so it is in the shipped closure and the shipped rung wins.
test('a CSS module script in the shipped closure still ships to the browser', () => {
  const c = ctx();
  c.shippedFiles.add(p('components/counter.css'));
  const v = classifyChangedPath(p('components/counter.css'), c);
  assert.equal(v.v, 'reload');
  assert.equal(v.why, 'ships-to-browser');
});

test('a brand-new or deleted file the graph has never seen is a full reload', () => {
  const v = classifyChangedPath(p('components/brand-new.ts'), ctx());
  assert.equal(v.v, 'reload');
  assert.equal(v.why, 'unknown-path');
});

// An extra `webjs.dev.watch` root (#894) is content the server reads at render
// time, never a browser module, and any layout may render it.
test('a path outside the appDir takes the shell swap', () => {
  const v = classifyChangedPath('/repo/content/post.md', ctx());
  assert.equal(v.v, 'shell');
  assert.equal(v.why, 'extra-watch-root');
  assert.equal(v.by, '/repo/content/post.md', 'an unrelativizable path reports absolute');
});

// A sibling directory sharing a prefix is NOT containment.
test('a sibling dir sharing the appDir prefix is not treated as inside it', () => {
  const v = classifyChangedPath('/app-old/app/page.ts', ctx());
  assert.equal(v.why, 'extra-watch-root');
});

// Vite's pessimistic seed: an empty or unresolvable result is a reload.
test('a cold analysis reloads for every input', () => {
  const cold = ctx({ analysisReady: false });
  for (const f of ['app/page.ts', 'app/layout.ts', 'components/counter.ts', 'public/app.css']) {
    const v = classifyChangedPath(p(f), cold);
    assert.equal(v.v, 'reload', `${f} reloads while the analysis is cold`);
    assert.equal(v.why, 'analysis-cold');
  }
});

test('an empty path reloads', () => {
  assert.equal(classifyChangedPath('', ctx()).v, 'reload');
});

test('RELOAD_VERDICTS is ordered strongest first', () => {
  assert.deepEqual([...RELOAD_VERDICTS], ['reload', 'shell', 'page', 'component', 'css']);
});

// Every ordered pair, both directions, so a comparison that got the sign
// backwards cannot pass. A window mixing a page edit and a component edit is a
// component edit.
test('mergeVerdicts picks the strongest over all ordered pairs', () => {
  const mk = (v) => ({ v, by: v, why: v });
  for (const a of RELOAD_VERDICTS) {
    for (const b of RELOAD_VERDICTS) {
      const expected = RELOAD_VERDICTS.indexOf(a) <= RELOAD_VERDICTS.indexOf(b) ? a : b;
      const merged = mergeVerdicts(mk(a), mk(b));
      assert.equal(merged.v, expected, `${a} vs ${b}`);
      assert.equal(merged.by, expected, `${a} vs ${b} keeps the stronger one's by`);
      assert.equal(merged.why, expected, `${a} vs ${b} keeps the stronger one's why`);
    }
  }
});

test('mergeVerdicts treats null as nothing and an unknown name as strongest', () => {
  const page = { v: 'page', by: '', why: '' };
  assert.equal(mergeVerdicts(null, page), page);
  assert.equal(mergeVerdicts(page, null), page);
  assert.equal(mergeVerdicts(null, null), null);
  assert.equal(mergeVerdicts(page, { v: 'nonsense', by: '', why: '' }).v, 'nonsense',
    'an unrecognised verdict ranks strongest, so it can only ever over-reload');
});

// A batch keeps the strongest response but must not drop the weaker changes'
// own work (#1689): a page edit plus a component edit still re-imports the
// component's modules, and a stylesheet edit anywhere in the batch still
// refreshes the sheets.
test('mergeVerdicts unions modules and ORs css across a batch', () => {
  const page = { v: 'page', by: 'app/page.ts', why: 'page-module' };
  const comp = { v: 'component', by: 'components/a.ts', why: 'hot-swap', modules: ['/components/b.ts?t=2', '/components/a.ts?t=2'] };
  const comp2 = { v: 'component', by: 'components/c.ts', why: 'hot-swap', modules: ['/components/a.ts?t=2', '/components/c.ts?t=3'] };
  const css = { v: 'css', by: 'public/app.css', why: 'stylesheet', css: true };

  const a = mergeVerdicts(mergeVerdicts(mergeVerdicts(page, comp), comp2), css);
  assert.equal(a.v, 'page', 'page outranks component and css');
  assert.equal(a.by, 'app/page.ts');
  assert.deepEqual(a.modules, ['/components/a.ts?t=2', '/components/b.ts?t=2', '/components/c.ts?t=3'],
    'the sorted union, each url once');
  assert.equal(a.css, true, 'a stylesheet change anywhere in the batch is kept');

  const b = mergeVerdicts(css, comp);
  assert.equal(b.v, 'component');
  assert.equal(b.css, true, 'css survives a stronger verdict arriving after it');

  const c = mergeVerdicts(page, { v: 'shell', by: 'app/layout.ts', why: 'server-only-module' });
  assert.equal('modules' in c, false, 'no modules key when neither side has any');
  assert.equal('css' in c, false, 'no css key when neither side sets it');
});
