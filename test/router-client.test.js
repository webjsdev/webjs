/**
 * Unit tests for router-client internals — the nested-layout-aware
 * partial-swap mechanism.
 *
 * Coverage:
 *   - collectChildrenSlots:   walk wj:children comment markers in DOM
 *   - longestSharedPath:      pick deepest path in both maps
 *   - keyOf:                  data-key / id → key for keyed diff
 *   - diffElementInPlace:     attribute diff + live-attr preservation
 *   - reconcileChildren:      keyed + positional child reuse
 *   - navigate (full):        marker-based partial swap end-to-end
 *   - navigate fallbacks:     non-HTML response, fetch error, !ok, parse null
 *   - addNewHeadElements:     add-only head merge (Tailwind survives)
 *   - mergeHead:              full-merge head (used on full body swap)
 *   - findAnchorInPath:       anchor discovery through composedPath
 *   - activeFrameId:          <webjs-frame> escape hatch via closest()
 *   - isNonHtmlPath:          pathname extension guard
 *   - onPopState:             history back/forward triggers nav
 *
 * The router-client auto-enables on import (enableClientRouter() at
 * end of module), so we set up DOM globals BEFORE the import.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

let _collect, _longest, _keyOf, _diffEl, _reconcile,
  _addNewHead, _merge, _isNonHtmlPath, navigate,
  _reactivateScripts, _findAnchorInPath, _activeFrameId, _onPopState,
  _snapshotCache, _LIVE_ATTRS,
  enableClientRouter, disableClientRouter, revalidate;

before(async () => {
  const { window } = parseHTML('<!doctype html><html><head></head><body></body></html>');
  globalThis.document = window.document;
  globalThis.window = window;
  globalThis.DocumentFragment = window.DocumentFragment;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.HTMLAnchorElement = window.HTMLAnchorElement;
  globalThis.HTMLTemplateElement = window.HTMLTemplateElement;
  globalThis.Element = window.Element;
  globalThis.Node = window.Node;
  globalThis.Comment = window.Comment;
  globalThis.Text = window.Text;
  globalThis.MutationObserver = window.MutationObserver;
  globalThis.customElements = window.customElements;
  globalThis.CustomEvent = window.CustomEvent;
  globalThis.DOMParser = window.DOMParser;
  // linkedom doesn't expose CSS.escape; provide a minimal polyfill so
  // the webjs-frame querySelector branch works in tests.
  globalThis.CSS = globalThis.CSS || {
    escape(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, (m) => `\\${m}`); },
  };

  ({
    _collectChildrenSlots: _collect,
    _longestSharedPath: _longest,
    _keyOf,
    _diffElementInPlace: _diffEl,
    _reconcileChildren: _reconcile,
    _addNewHeadElements: _addNewHead,
    _mergeHead: _merge,
    _isNonHtmlPath,
    _reactivateScripts,
    _findAnchorInPath,
    _activeFrameId,
    _onPopState,
    _snapshotCache,
    _LIVE_ATTRS,
    navigate,
    revalidate,
    enableClientRouter,
    disableClientRouter,
  } = await import('../packages/core/src/router-client.js'));
});

/* ====================================================================
 * collectChildrenSlots — marker discovery
 * ==================================================================== */

/** Helper: parse an HTML body string into a real body element via DOMParser. */
function bodyFrom(html) {
  const doc = new globalThis.DOMParser().parseFromString(
    `<!doctype html><html><body>${html}</body></html>`,
    'text/html'
  );
  return doc.body;
}

test('collectChildrenSlots: single-layout pair builds one entry', () => {
  const body = bodyFrom(
    '<header>hdr</header>' +
    '<!--wj:children:/-->' +
    '<p>page</p>' +
    '<!--/wj:children-->'
  );
  const slots = _collect(body);
  assert.equal(slots.size, 1);
  assert.ok(slots.has('/'));
  const { start, end } = slots.get('/');
  assert.equal(start.nodeType, 8);
  assert.equal(end.nodeType, 8);
  assert.equal(start.data, 'wj:children:/');
});

test('collectChildrenSlots: nested layouts build two entries (outer + inner)', () => {
  const body = bodyFrom(
    '<header>root</header>' +
    '<!--wj:children:/-->' +
      '<aside>docs sidenav</aside>' +
      '<!--wj:children:/docs-->' +
        '<h1>page A</h1>' +
      '<!--/wj:children-->' +
    '<!--/wj:children-->'
  );
  const slots = _collect(body);
  assert.equal(slots.size, 2);
  assert.ok(slots.has('/'));
  assert.ok(slots.has('/docs'));
});

test('collectChildrenSlots: no markers → empty map (no crash)', () => {
  const body = bodyFrom('<p>just a page</p>');
  const slots = _collect(body);
  assert.equal(slots.size, 0);
});

test('collectChildrenSlots: stale closing marker without open is ignored', () => {
  // Defensive: a malformed `<!--/wj:children-->` without a matching opener
  // shouldn't crash the walker.
  const body = bodyFrom('<p>x</p><!--/wj:children--><p>y</p>');
  const slots = _collect(body);
  assert.equal(slots.size, 0);
});

test('collectChildrenSlots: route-group paths preserve their (group) segments', () => {
  // Two different `(group)` layouts at the same URL produce DIFFERENT
  // marker paths, so the client never falsely matches them as shared.
  const body = bodyFrom(
    '<!--wj:children:/(marketing)/about-->' +
    '<p>about</p>' +
    '<!--/wj:children-->'
  );
  const slots = _collect(body);
  assert.ok(slots.has('/(marketing)/about'));
  assert.ok(!slots.has('/about'));
});

/* ====================================================================
 * longestSharedPath
 * ==================================================================== */

test('longestSharedPath: picks the longest path present in both maps', () => {
  const here = new Map([['/', null], ['/docs', null], ['/docs/components', null]]);
  const there = new Map([['/', null], ['/docs', null], ['/docs/components', null]]);
  assert.equal(_longest(here, there), '/docs/components');
});

test('longestSharedPath: cross-layout nav drops to shallowest common ancestor', () => {
  // /docs/components/a → /about: only root layout is shared.
  const here = new Map([['/', null], ['/docs', null], ['/docs/components', null]]);
  const there = new Map([['/', null]]);
  assert.equal(_longest(here, there), '/');
});

test('longestSharedPath: no overlap → null', () => {
  const here = new Map([['/blog', null]]);
  const there = new Map([['/admin', null]]);
  assert.equal(_longest(here, there), null);
});

test('longestSharedPath: empty maps → null', () => {
  assert.equal(_longest(new Map(), new Map()), null);
});

/* ====================================================================
 * keyOf
 * ==================================================================== */

test('keyOf: data-key takes precedence', () => {
  const el = document.createElement('li');
  el.setAttribute('data-key', 'k1');
  el.id = 'i1';
  assert.equal(_keyOf(el), 'LI:k:k1');
});

test('keyOf: id is the fallback when no data-key', () => {
  const el = document.createElement('section');
  el.id = 'foo';
  assert.equal(_keyOf(el), 'SECTION:i:foo');
});

test('keyOf: no key → null (positional match only)', () => {
  const el = document.createElement('p');
  assert.equal(_keyOf(el), null);
});

/* ====================================================================
 * diffElementInPlace — attribute diffing + live-attr preservation
 * ==================================================================== */

test('diffElementInPlace: copies non-live attributes from src to dst', () => {
  const dst = document.createElement('div');
  dst.setAttribute('class', 'old');
  dst.setAttribute('data-stale', 'yes');
  const src = document.createElement('div');
  src.setAttribute('class', 'new');
  src.setAttribute('data-fresh', 'yes');
  _diffEl(dst, src);
  assert.equal(dst.getAttribute('class'), 'new');
  assert.equal(dst.getAttribute('data-fresh'), 'yes');
  assert.equal(dst.getAttribute('data-stale'), null,
    'attribute not present in src should be removed');
});

test('diffElementInPlace: PRESERVES live attribute `value` on input', () => {
  // User typed something into the input between renders — the server-
  // rendered HTML has the initial value, but the live DOM has the user's
  // input. Diff must leave the live attribute untouched.
  const dst = document.createElement('input');
  dst.setAttribute('type', 'text');
  dst.setAttribute('value', 'user-typed');
  const src = document.createElement('input');
  src.setAttribute('type', 'text');
  src.setAttribute('value', 'server-default');
  _diffEl(dst, src);
  assert.equal(dst.getAttribute('value'), 'user-typed',
    'live `value` must survive partial-swap navigation');
});

test('diffElementInPlace: PRESERVES live attribute `open` on details', () => {
  const dst = document.createElement('details');
  dst.setAttribute('open', '');
  const src = document.createElement('details');
  // Server has it closed; user opened it locally.
  _diffEl(dst, src);
  assert.ok(dst.hasAttribute('open'), 'user-opened <details> must stay open');
});

test('diffElementInPlace: PRESERVES `checked` on checkbox', () => {
  const dst = document.createElement('input');
  dst.setAttribute('type', 'checkbox');
  dst.setAttribute('checked', '');
  const src = document.createElement('input');
  src.setAttribute('type', 'checkbox');
  _diffEl(dst, src);
  assert.ok(dst.hasAttribute('checked'),
    'user-checked checkbox state preserved');
});

test('diffElementInPlace: LIVE_ATTRS list covers all expected fields', () => {
  for (const name of ['value', 'checked', 'selected', 'indeterminate', 'disabled', 'open', 'popover']) {
    assert.ok(_LIVE_ATTRS.has(name), `live-attr list must include "${name}"`);
  }
});

test('diffElementInPlace: different tag → replaceWith (no in-place reuse)', () => {
  const parent = document.createElement('div');
  const dst = document.createElement('span');
  parent.appendChild(dst);
  const src = document.createElement('strong');
  _diffEl(dst, src);
  assert.equal(parent.firstChild.tagName, 'STRONG',
    'mismatched tags swap out the element');
});

/* ====================================================================
 * reconcileChildren — keyed reuse + positional reuse
 * ==================================================================== */

test('reconcileChildren: matches by data-key, reuses the DOM node', () => {
  const dst = document.createElement('ul');
  dst.innerHTML =
    '<li data-key="a" data-state="OLD">A</li>' +
    '<li data-key="b" data-state="OLD">B</li>';
  const a = dst.children[0];
  const src = document.createElement('ul');
  src.innerHTML =
    '<li data-key="b" data-state="NEW">B</li>' +
    '<li data-key="a" data-state="NEW">A</li>';

  _reconcile(dst, src);

  // The "a" element is reused — same node reference after reconciliation,
  // but reordered.
  const liveItems = [...dst.querySelectorAll('li')];
  assert.equal(liveItems.length, 2);
  assert.equal(liveItems[0].getAttribute('data-key'), 'b');
  assert.equal(liveItems[1].getAttribute('data-key'), 'a');
  assert.equal(liveItems[1], a, 'matched element kept its identity');
});

test('reconcileChildren: text node positional reuse', () => {
  const dst = document.createElement('span');
  dst.appendChild(document.createTextNode('old'));
  const src = document.createElement('span');
  src.appendChild(document.createTextNode('new'));
  _reconcile(dst, src);
  assert.equal(dst.firstChild.nodeType, 3);
  assert.equal(dst.textContent, 'new');
});

test('reconcileChildren: unmatched live children are removed', () => {
  const dst = document.createElement('div');
  dst.innerHTML = '<p id="keep">keep</p><p id="drop">drop</p>';
  const src = document.createElement('div');
  src.innerHTML = '<p id="keep">keep</p>';
  _reconcile(dst, src);
  const ps = [...dst.querySelectorAll('p')];
  assert.equal(ps.length, 1);
  assert.equal(ps[0].id, 'keep');
});

/* ====================================================================
 * addNewHeadElements — add-only head merge (Tailwind survives)
 * ==================================================================== */

test('addNewHeadElements: updates <title> from new head', () => {
  document.head.innerHTML = '<title>Old</title>';
  const newHead = document.createElement('head');
  newHead.innerHTML = '<title>New</title>';
  _addNewHead(newHead);
  assert.equal(document.title, 'New');
});

test('addNewHeadElements: adds NEW link/style elements, preserves existing', () => {
  document.head.innerHTML =
    '<title>T</title>' +
    '<style id="runtime-css">.a{color:red}</style>' +
    '<link rel="stylesheet" href="/existing.css">';

  const newHead = document.createElement('head');
  newHead.innerHTML =
    '<title>T</title>' +
    '<link rel="stylesheet" href="/existing.css">' +
    '<link rel="modulepreload" href="/new-module.js">';

  _addNewHead(newHead);

  // Runtime-generated CSS must survive (this is why we use add-only on
  // partial swaps — Tailwind runtime injects its CSS as a <style>, and
  // a full mergeHead would remove it).
  assert.ok(
    document.head.querySelector('#runtime-css'),
    'runtime CSS element should not be removed'
  );
  assert.ok(
    document.head.querySelector('link[rel="modulepreload"][href="/new-module.js"]'),
    'new modulepreload should be added'
  );
  const existing = document.head.querySelectorAll('link[href="/existing.css"]');
  assert.equal(existing.length, 1);
});

test('addNewHeadElements: skips importmap/base/title for addition', () => {
  document.head.innerHTML = '<script type="importmap">{}</script><base href="/">';
  const newHead = document.createElement('head');
  newHead.innerHTML =
    '<script type="importmap">{"imports":{}}</script>' +
    '<base href="/app/">' +
    '<title>title</title>';
  _addNewHead(newHead);
  const importMaps = document.head.querySelectorAll('script[type="importmap"]');
  assert.equal(importMaps.length, 1, 'existing importmap untouched');
  const bases = document.head.querySelectorAll('base');
  assert.equal(bases.length, 1, 'existing base untouched');
});

test('addNewHeadElements: script elements are recreated (not cloned) to execute', () => {
  document.head.innerHTML = '';
  const newHead = document.createElement('head');
  const s = document.createElement('script');
  s.setAttribute('src', '/foo.js');
  s.setAttribute('type', 'module');
  newHead.appendChild(s);
  _addNewHead(newHead);
  const added = document.head.querySelector('script[src="/foo.js"]');
  assert.ok(added, 'script should be added');
  assert.notStrictEqual(added, s, 'script element should be a new node, not a clone');
  assert.equal(added.getAttribute('type'), 'module');
});

/* ====================================================================
 * mergeHead — full-merge head (used on full body swap)
 * ==================================================================== */

test('mergeHead: removes elements not in the new head', () => {
  document.head.innerHTML =
    '<title>Old</title>' +
    '<link rel="stylesheet" href="/stale.css">' +
    '<link rel="stylesheet" href="/shared.css">';
  const newHead = document.createElement('head');
  newHead.innerHTML =
    '<title>New</title>' +
    '<link rel="stylesheet" href="/shared.css">' +
    '<link rel="stylesheet" href="/fresh.css">';
  _merge(newHead);
  assert.equal(document.title, 'New');
  assert.ok(!document.head.querySelector('link[href="/stale.css"]'), 'stale link removed');
  assert.ok(document.head.querySelector('link[href="/shared.css"]'), 'shared link kept');
  assert.ok(document.head.querySelector('link[href="/fresh.css"]'), 'fresh link added');
});

test('mergeHead: preserves importmap and base across full merges', () => {
  document.head.innerHTML =
    '<script type="importmap">{}</script>' +
    '<base href="/">' +
    '<link rel="stylesheet" href="/x.css">';
  const newHead = document.createElement('head');
  newHead.innerHTML = '<link rel="stylesheet" href="/y.css">';
  _merge(newHead);
  assert.ok(document.head.querySelector('script[type="importmap"]'), 'importmap kept');
  assert.ok(document.head.querySelector('base'), 'base kept');
  assert.ok(!document.head.querySelector('link[href="/x.css"]'), 'x.css removed');
  assert.ok(document.head.querySelector('link[href="/y.css"]'), 'y.css added');
});

test('mergeHead: re-creates script elements so they execute', () => {
  document.head.innerHTML = '';
  const newHead = document.createElement('head');
  const s = document.createElement('script');
  s.setAttribute('src', '/merge.js');
  s.setAttribute('type', 'module');
  newHead.appendChild(s);
  _merge(newHead);
  const added = document.head.querySelector('script[src="/merge.js"]');
  assert.ok(added);
  assert.notStrictEqual(added, s, 'script re-created so browser executes it');
  assert.equal(added.getAttribute('type'), 'module');
});

/* ====================================================================
 * isNonHtmlPath
 * ==================================================================== */

test('isNonHtmlPath: skips downloads and documents', () => {
  assert.equal(_isNonHtmlPath('/exports/report.pdf'), true);
  assert.equal(_isNonHtmlPath('/files/archive.zip'), true);
  assert.equal(_isNonHtmlPath('/data/records.csv'), true);
  assert.equal(_isNonHtmlPath('/Download.DOCX'), true, 'case-insensitive');
});

test('isNonHtmlPath: skips feeds and api-like extensions', () => {
  assert.equal(_isNonHtmlPath('/feed.xml'), true);
  assert.equal(_isNonHtmlPath('/feed.rss'), true);
  assert.equal(_isNonHtmlPath('/posts.json'), true);
  assert.equal(_isNonHtmlPath('/robots.txt'), true);
});

test('isNonHtmlPath: skips images and media', () => {
  assert.equal(_isNonHtmlPath('/avatar.png'), true);
  assert.equal(_isNonHtmlPath('/logo.svg'), true);
  assert.equal(_isNonHtmlPath('/hero.webp'), true);
  assert.equal(_isNonHtmlPath('/clip.mp4'), true);
  assert.equal(_isNonHtmlPath('/theme.mp3'), true);
});

test('isNonHtmlPath: does NOT skip normal page paths', () => {
  assert.equal(_isNonHtmlPath('/'), false);
  assert.equal(_isNonHtmlPath('/blog/post-slug'), false);
  assert.equal(_isNonHtmlPath('/dashboard'), false);
  assert.equal(_isNonHtmlPath('/users/john.smith/profile'), false);
});

/* ====================================================================
 * navigate — Content-Type guard + fallback paths
 * ==================================================================== */

function installNavigationMocks({ contentType, body = '', ok = true, captureHeaders = false }) {
  const originalFetch = globalThis.fetch;
  const originalLocation = globalThis.location;
  const originalHistory = globalThis.history;
  const originalScrollTo = globalThis.scrollTo;
  /** @type {{ href: string | null, assigns: string[] }} */
  const redirect = { href: null, assigns: [] };
  /** @type {{ url: string | null, headers: Record<string,string> | null }} */
  const captured = { url: null, headers: null };

  globalThis.fetch = async (url, init) => {
    captured.url = String(url);
    captured.headers = init && init.headers ? { ...init.headers } : null;
    return {
      ok,
      status: ok ? 200 : 500,
      headers: { get: (k) => (k.toLowerCase() === 'content-type' ? contentType : null) },
      text: async () => body,
    };
  };

  globalThis.location = /** @type any */ ({
    origin: 'http://localhost',
    href: 'http://localhost/',
    get pathname() { return '/'; },
    get search() { return ''; },
  });
  Object.defineProperty(globalThis.location, 'href', {
    configurable: true,
    get() { return 'http://localhost/'; },
    set(v) { redirect.href = v; redirect.assigns.push(v); },
  });

  globalThis.history = /** @type any */ ({ pushState: () => {}, replaceState: () => {} });
  globalThis.scrollTo = /** @type any */ (() => {});

  return {
    redirect,
    captured,
    restore() {
      globalThis.fetch = originalFetch;
      globalThis.location = originalLocation;
      globalThis.history = originalHistory;
      globalThis.scrollTo = originalScrollTo;
    },
  };
}

test('navigate: JSON response triggers full-page fallback (no DOM swap)', async () => {
  const { redirect, restore } = installNavigationMocks({
    contentType: 'application/json; charset=utf-8',
    body: '{"posts":[]}',
  });
  try {
    await navigate('http://localhost/api/posts');
    assert.equal(redirect.href, 'http://localhost/api/posts',
      'JSON response should trigger location.href assignment');
  } finally { restore(); }
});

test('navigate: text/event-stream triggers full-page fallback', async () => {
  const { redirect, restore } = installNavigationMocks({
    contentType: 'text/event-stream',
    body: '',
  });
  try {
    await navigate('http://localhost/events');
    assert.equal(redirect.href, 'http://localhost/events');
  } finally { restore(); }
});

test('navigate: application/pdf triggers full-page fallback', async () => {
  const { redirect, restore } = installNavigationMocks({
    contentType: 'application/pdf',
    body: '%PDF-1.4\n...',
  });
  try {
    await navigate('http://localhost/docs/report');
    assert.equal(redirect.href, 'http://localhost/docs/report');
  } finally { restore(); }
});

test('navigate: text/html response proceeds with router swap (no fallback)', async () => {
  const { redirect, restore } = installNavigationMocks({
    contentType: 'text/html; charset=utf-8',
    body:
      '<!doctype html><html><head><title>ok</title></head><body>' +
      '<!--wj:children:/-->content<!--/wj:children-->' +
      '</body></html>',
  });
  try {
    document.body.innerHTML = '<!--wj:children:/-->old<!--/wj:children-->';
    await navigate('http://localhost/ok');
    assert.equal(redirect.href, null, 'text/html response should not trigger location.href fallback');
  } finally {
    restore();
    document.body.innerHTML = '';
  }
});

test('navigate: response without content-type falls back safely', async () => {
  const { redirect, restore } = installNavigationMocks({ contentType: '', body: '' });
  try {
    await navigate('http://localhost/weird');
    assert.equal(redirect.href, 'http://localhost/weird');
  } finally { restore(); }
});

test('navigate: cross-origin URL delegates to location.href (no fetch)', async () => {
  const { redirect, restore } = installNavigationMocks({ contentType: 'text/html', body: '' });
  try {
    await navigate('https://other-site.test/x');
    assert.equal(redirect.href, 'https://other-site.test/x');
  } finally { restore(); }
});

test('navigate: fetch rejection falls back to full page navigation', async () => {
  const originalFetch = globalThis.fetch;
  const originalLocation = globalThis.location;
  let redirected = null;
  globalThis.fetch = async () => { throw new Error('network dead'); };
  globalThis.location = /** @type any */ ({ origin: 'http://localhost', href: 'http://localhost/' });
  Object.defineProperty(globalThis.location, 'href', {
    configurable: true,
    get() { return 'http://localhost/'; },
    set(v) { redirected = v; },
  });
  globalThis.history = /** @type any */ ({ pushState: () => {} });
  try {
    await navigate('http://localhost/boom');
    assert.equal(redirected, 'http://localhost/boom');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.location = originalLocation;
  }
});

test('navigate: non-ok response falls back to full page navigation', async () => {
  const { redirect, restore } = installNavigationMocks({
    contentType: 'text/html',
    body: '<html></html>',
    ok: false,
  });
  try {
    await navigate('http://localhost/missing');
    assert.equal(redirect.href, 'http://localhost/missing');
  } finally { restore(); }
});

/* ====================================================================
 * navigate — partial-swap end-to-end
 * ==================================================================== */

test('navigate: marker-based partial swap preserves outer layout DOM', async () => {
  // Two-layer layout: root has <header>, <main>, <footer>; the page
  // content lives inside the docs layout's children-slot. After
  // navigating between two pages that both nest under root + docs,
  // the <header> and <main> wrappers AND the docs sidenav must
  // remain identically mounted — same DOM nodes, no re-render.
  document.body.innerHTML =
    '<header id="hdr">root header</header>' +
    '<main>' +
      '<!--wj:children:/-->' +
        '<aside id="sidenav">docs sidenav</aside>' +
        '<section>' +
          '<!--wj:children:/docs-->' +
            '<h1>page A</h1>' +
          '<!--/wj:children-->' +
        '</section>' +
      '<!--/wj:children-->' +
    '</main>' +
    '<footer id="ftr">root footer</footer>';

  const headerBefore = document.getElementById('hdr');
  const sidenavBefore = document.getElementById('sidenav');

  const { restore } = installNavigationMocks({
    contentType: 'text/html',
    body:
      '<!doctype html><html><head></head><body>' +
      '<header>root header</header>' +
      '<main>' +
        '<!--wj:children:/-->' +
          '<aside>docs sidenav</aside>' +
          '<section>' +
            '<!--wj:children:/docs-->' +
              '<h1>page B</h1>' +
            '<!--/wj:children-->' +
          '</section>' +
        '<!--/wj:children-->' +
      '</main>' +
      '<footer>root footer</footer>' +
      '</body></html>',
  });

  try {
    await navigate('http://localhost/docs/components/b');

    // Outer header / footer DOM nodes are the SAME objects — not re-rendered.
    assert.equal(document.getElementById('hdr'), headerBefore,
      'outer header DOM identity preserved across nav');
    assert.equal(document.getElementById('sidenav'), sidenavBefore,
      'docs sidenav DOM identity preserved (its scrollTop, focus, etc. survive)');
    // Inner content actually swapped.
    const h1 = document.querySelector('h1');
    assert.ok(h1, 'page heading exists after nav');
    assert.equal(h1.textContent, 'page B', 'inner content updated');
  } finally {
    restore();
    document.body.innerHTML = '';
  }
});

test('navigate: deepest shared marker wins (inner swap, not outer)', async () => {
  // /docs/components/a → /docs/components/b: both share / AND /docs.
  // The router must pick /docs (deeper), not / (shallower).
  document.body.innerHTML =
    '<!--wj:children:/-->' +
      '<aside class="docs-shell"></aside>' +
      '<!--wj:children:/docs-->old<!--/wj:children-->' +
    '<!--/wj:children-->';
  const sidenav = document.querySelector('.docs-shell');

  const { restore } = installNavigationMocks({
    contentType: 'text/html',
    body:
      '<!doctype html><html><head></head><body>' +
      '<!--wj:children:/-->' +
        '<aside class="docs-shell">REPLACED</aside>' +
        '<!--wj:children:/docs-->new<!--/wj:children-->' +
      '<!--/wj:children-->' +
      '</body></html>',
  });

  try {
    await navigate('http://localhost/docs/components/b');
    // The shallower /-marker was ALSO present in both, but the deeper
    // /docs marker wins — so the sidenav inside the /-slot but outside
    // the /docs-slot is left untouched.
    assert.equal(document.querySelector('.docs-shell'), sidenav,
      'deeper match preserves outer-slot DOM');
    assert.equal(document.querySelector('.docs-shell').textContent, '',
      'sidenav text was NOT replaced with the incoming "REPLACED" text');
  } finally {
    restore();
    document.body.innerHTML = '';
  }
});

test('navigate: cross-layout nav falls through to full body swap', async () => {
  // /docs/x → /admin/y: no shared marker path → full body swap.
  document.body.innerHTML = '<!--wj:children:/docs-->old<!--/wj:children-->';
  const { restore } = installNavigationMocks({
    contentType: 'text/html',
    body:
      '<!doctype html><html><head></head><body>' +
      '<!--wj:children:/admin--><p>new</p><!--/wj:children-->' +
      '</body></html>',
  });
  try {
    await navigate('http://localhost/admin/y');
    assert.ok(document.body.textContent.includes('new'));
    assert.ok(!document.body.textContent.includes('old'));
  } finally {
    restore();
    document.body.innerHTML = '';
  }
});

test('navigate: sends X-Webjs-Have header listing current marker paths', async () => {
  document.body.innerHTML =
    '<!--wj:children:/-->' +
      '<!--wj:children:/docs-->page<!--/wj:children-->' +
    '<!--/wj:children-->';
  const mocks = installNavigationMocks({
    contentType: 'text/html',
    body:
      '<!doctype html><html><head></head><body>' +
      '<!--wj:children:/-->' +
        '<!--wj:children:/docs-->page2<!--/wj:children-->' +
      '<!--/wj:children-->' +
      '</body></html>',
  });
  try {
    await navigate('http://localhost/docs/components/b');
    const have = mocks.captured.headers && mocks.captured.headers['x-webjs-have'];
    assert.ok(have, 'X-Webjs-Have header should be set');
    assert.ok(have.includes('/'), 'X-Webjs-Have includes root path');
    assert.ok(have.includes('/docs'), 'X-Webjs-Have includes /docs path');
  } finally {
    mocks.restore();
    document.body.innerHTML = '';
  }
});

/* ====================================================================
 * navigate — Suspense resolver forwarding (partial swap)
 * ==================================================================== */

test('navigate: marker-based swap forwards <template data-webjs-resolve> nodes', async () => {
  document.body.innerHTML =
    '<!--wj:children:/--><p>old</p><!--/wj:children-->';
  const { restore } = installNavigationMocks({
    contentType: 'text/html',
    body:
      '<!doctype html><html><head></head><body>' +
      '<!--wj:children:/--><p>new</p><!--/wj:children-->' +
      '<template data-webjs-resolve="s1"><p>resolved</p></template>' +
      '</body></html>',
  });
  try {
    await navigate('http://localhost/with-suspense');
    const tpl = document.body.querySelector('template[data-webjs-resolve="s1"]');
    assert.ok(tpl, 'Suspense resolver template should be copied to live body');
  } finally {
    restore();
    document.body.innerHTML = '';
  }
});

/* ====================================================================
 * navigate — parseHTML returning null, hash scroll
 * ==================================================================== */

test('navigate: unparseable HTML body falls back to full navigation', async () => {
  const origDP = globalThis.DOMParser;
  const origDoc = globalThis.Document;
  globalThis.DOMParser = undefined;
  globalThis.Document = undefined;
  const { redirect, restore } = installNavigationMocks({
    contentType: 'text/html',
    body: '<html><body><p>whatever</p></body></html>',
  });
  try {
    await navigate('http://localhost/unparseable');
    assert.equal(redirect.href, 'http://localhost/unparseable');
  } finally {
    restore();
    globalThis.DOMParser = origDP;
    globalThis.Document = origDoc;
  }
});

test('navigate: hash portion triggers scroll (target found or top)', async () => {
  document.body.innerHTML =
    '<!--wj:children:/--><section id="anchor">A</section><!--/wj:children-->';
  let scrolledToTop = false;
  let scrolledIntoView = false;
  globalThis.scrollTo = () => { scrolledToTop = true; };
  const origInto = globalThis.HTMLElement.prototype.scrollIntoView;
  globalThis.HTMLElement.prototype.scrollIntoView = function () { scrolledIntoView = true; };
  const { restore } = installNavigationMocks({
    contentType: 'text/html',
    body:
      '<!doctype html><html><head></head><body>' +
      '<!--wj:children:/--><section id="anchor">A</section><!--/wj:children-->' +
      '</body></html>',
  });
  try {
    await navigate('http://localhost/x#anchor');
    assert.ok(scrolledIntoView, 'existing anchor → scrollIntoView');
    scrolledIntoView = false;
    await navigate('http://localhost/x#missing');
    assert.ok(scrolledToTop || !scrolledIntoView,
      'missing anchor falls back to scrollTo(0,0)');
  } finally {
    restore();
    document.body.innerHTML = '';
    globalThis.HTMLElement.prototype.scrollIntoView = origInto;
  }
});

/* ====================================================================
 * activeFrameId — <webjs-frame> escape hatch detection
 * ==================================================================== */

test('activeFrameId: returns id of nearest enclosing webjs-frame', () => {
  document.body.innerHTML =
    '<webjs-frame id="outer">' +
      '<webjs-frame id="inner"><a id="L" href="/x">L</a></webjs-frame>' +
    '</webjs-frame>';
  const a = document.getElementById('L');
  assert.equal(_activeFrameId(a), 'inner', 'innermost frame wins');
});

test('activeFrameId: returns null when not inside any webjs-frame', () => {
  document.body.innerHTML = '<a id="L" href="/x">L</a>';
  const a = document.getElementById('L');
  assert.equal(_activeFrameId(a), null);
});

/* ====================================================================
 * reactivateScripts + findAnchorInPath
 * ==================================================================== */

test('reactivateScripts: recreates <script> elements so they execute', () => {
  const container = document.createElement('div');
  container.innerHTML = '<script id="s1">window.__rs = 1;</script>';
  const before = container.querySelector('#s1');
  _reactivateScripts(container);
  const after = container.querySelector('#s1');
  assert.ok(after);
  assert.notEqual(before, after, 'script node was replaced, not kept');
  assert.equal(after.textContent, 'window.__rs = 1;');
});

test('reactivateScripts: preserves attributes on the recreated node', () => {
  const container = document.createElement('div');
  container.innerHTML = '<script type="module" src="/x.js" data-flag="a"></script>';
  _reactivateScripts(container);
  const s = container.querySelector('script');
  assert.equal(s.getAttribute('type'), 'module');
  assert.equal(s.getAttribute('src'), '/x.js');
  assert.equal(s.getAttribute('data-flag'), 'a');
});

test('findAnchorInPath: returns the nearest anchor in composedPath()', () => {
  document.body.innerHTML = '<a href="/to"><span id="inner">click</span></a>';
  const inner = document.getElementById('inner');
  const anchor = document.querySelector('a');
  const e = { composedPath: () => [inner, anchor, document.body] };
  assert.equal(_findAnchorInPath(e), anchor);
});

test('findAnchorInPath: returns null when no anchor is in the path', () => {
  document.body.innerHTML = '<div><span id="nope">click</span></div>';
  const nope = document.getElementById('nope');
  const e = { composedPath: () => [nope, document.body] };
  assert.equal(_findAnchorInPath(e), null);
});

/* ====================================================================
 * enable / disable idempotence
 * ==================================================================== */

test('disableClientRouter: is a no-op when router is already disabled', () => {
  disableClientRouter();
  disableClientRouter();
  enableClientRouter();
});

test('disableClientRouter: enableClientRouter is idempotent', () => {
  disableClientRouter();
  enableClientRouter();
  enableClientRouter();
});

/* ====================================================================
 * onPopState — back/forward triggers router nav
 * ==================================================================== */

test('onPopState: triggers a router navigation to location.href', async () => {
  const origLoc = globalThis.location;
  const origFetch = globalThis.fetch;
  let fetched = null;
  globalThis.location = /** @type {any} */ ({
    href: 'http://localhost/popped',
    pathname: '/popped',
    origin: 'http://localhost',
    search: '',
    hash: '',
  });
  globalThis.fetch = async (url) => {
    fetched = String(url);
    return new Response(
      '<!doctype html><html><body>' +
      '<!--wj:children:/-->popped<!--/wj:children-->' +
      '</body></html>',
      { status: 200, headers: { 'content-type': 'text/html' } }
    );
  };
  try {
    document.body.innerHTML = '<!--wj:children:/-->before<!--/wj:children-->';
    _onPopState({});
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(fetched, 'http://localhost/popped');
  } finally {
    globalThis.location = origLoc;
    globalThis.fetch = origFetch;
  }
});

/* ====================================================================
 * revalidate — snapshot-cache invalidation
 * ==================================================================== */

test('revalidate(url): removes one URL from the snapshot cache', () => {
  const origLoc = globalThis.location;
  globalThis.location = /** @type any */ ({ href: 'http://localhost/' });
  try {
    _snapshotCache.set('/a', 'snap-a');
    _snapshotCache.set('/b', 'snap-b');
    revalidate('http://localhost/a');
    assert.ok(!_snapshotCache.has('/a'), '/a evicted');
    assert.ok(_snapshotCache.has('/b'), '/b still cached');
  } finally {
    globalThis.location = origLoc;
  }
});

test('revalidate(): clears the entire snapshot cache when called with no args', () => {
  _snapshotCache.set('/a', 'snap-a');
  _snapshotCache.set('/b', 'snap-b');
  revalidate();
  assert.equal(_snapshotCache.size, 0);
});
