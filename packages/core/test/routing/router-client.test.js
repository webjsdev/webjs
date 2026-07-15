/**
 * Unit tests for router-client internals: the nested-layout-aware
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
  _reactivateScripts, _findAnchorInPath, _activeFrameId, _resolveTargetFrameId, _onPopState,
  _applySwap, _prefetchCache,
  _snapshotCache, _LIVE_ATTRS, _blurOutgoingFocus,
  _onSubmit, _getSubmitMethod, _getSubmitAction, _buildSubmitFormData,
  _restoreOptimistic, _navToken, _bumpNavToken,
  _currentPageUrl, _setCurrentPageUrl, _resetWarnOnce,
  _eligibleAnchorHref, _prefetchSuppressed, _prefetchMode, _prefetchHasHoverPointer, _prefetch, _prefetchTake,
  _prefetchSaysSaveData, _prefetchPeek, _prefetchInflightSize, _resetPrefetch,
  _viewTransitionsEnabled, _runWithTransition, _regraftPermanentElements,
  enableClientRouter, disableClientRouter, revalidate,
  WebComponent, html;

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
  // linkedom doesn't ship Web Storage either. Tests that exercise the
  // importmap reload-guard need sessionStorage; provide a minimal
  // in-memory shim.
  if (typeof globalThis.sessionStorage === 'undefined') {
    const store = new Map();
    globalThis.sessionStorage = /** @type any */ ({
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
      clear: () => { store.clear(); },
    });
  }

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
    _resolveTargetFrameId,
    _onPopState,
    _applySwap,
    _prefetchCache,
    _snapshotCache,
    _LIVE_ATTRS,
    _blurOutgoingFocus,
    _onSubmit,
    _getSubmitMethod,
    _getSubmitAction,
    _buildSubmitFormData,
    _restoreOptimistic,
    _navToken,
    _bumpNavToken,
    _currentPageUrl,
    _setCurrentPageUrl,
    _resetWarnOnce,
    _eligibleAnchorHref,
    _prefetchSuppressed,
    _prefetchMode,
    _prefetchHasHoverPointer,
    _prefetch,
    _prefetchTake,
    _prefetchSaysSaveData,
    _prefetchPeek,
    _prefetchInflightSize,
    _resetPrefetch,
    _viewTransitionsEnabled,
    _runWithTransition,
    _regraftPermanentElements,
    navigate,
    revalidate,
    enableClientRouter,
    disableClientRouter,
  } = await import('../../src/router-client.js'));

  ({ WebComponent, html } = await import('../../index.js'));
});

/* ====================================================================
 * collectChildrenSlots: marker discovery
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

test('collectChildrenSlots: an orphaned open marker (dropped close) is NOT paired by default', () => {
  // The #994 precondition: the browser's parser dropped the trailing
  // `<!--/wj:children-->`, so the open marker survives with no close. Strict
  // pairing (the default) registers no slot, which is what forced the
  // destructive full-body swap that wiped the navbar.
  const body = bodyFrom(
    '<nav>navbar</nav>' +
    '<!--wj:children:/-->' +
    '<p>page</p>'
    // close comment dropped
  );
  assert.equal(_collect(body).size, 0, 'no slot without recovery (the bug precondition)');
});

test('collectChildrenSlots: recoverOrphans registers a dropped-close open with a null end (#994)', () => {
  const body = bodyFrom(
    '<nav>navbar</nav>' +
    '<!--wj:children:/-->' +
    '<p>page</p>'
    // close comment dropped
  );
  const slots = _collect(body, { recoverOrphans: true });
  assert.equal(slots.size, 1);
  assert.ok(slots.has('/'));
  const { start, end } = slots.get('/');
  assert.equal(start.data, 'wj:children:/');
  assert.equal(end, null, 'a recovered orphan carries end=null (children run to the parent end)');
});

test('collectChildrenSlots: recoverOrphans leaves a well-formed pair untouched (real close wins)', () => {
  const body = bodyFrom(
    '<!--wj:children:/-->' +
    '<p>page</p>' +
    '<!--/wj:children-->'
  );
  const slots = _collect(body, { recoverOrphans: true });
  assert.equal(slots.size, 1);
  const { end } = slots.get('/');
  assert.equal(end.nodeType, 8, 'the real close comment is the end, not null');
});

test('collectChildrenSlots: recoverOrphans keeps a properly-closed inner while recovering a dropped outer close', () => {
  // Outer close dropped, inner pair intact: the navbar-owning outer layout is
  // the one that loses its close, exactly the #994 shape.
  const body = bodyFrom(
    '<nav>navbar</nav>' +
    '<!--wj:children:/-->' +
      '<aside>docs sidenav</aside>' +
      '<!--wj:children:/docs-->' +
        '<h1>page</h1>' +
      '<!--/wj:children-->'
    // outer close dropped
  );
  const slots = _collect(body, { recoverOrphans: true });
  assert.equal(slots.size, 2);
  assert.equal(slots.get('/').end, null, 'the outer orphan is recovered with a null end');
  assert.equal(slots.get('/docs').end.nodeType, 8, 'the intact inner pair keeps its real close');
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
 * resolveTargetFrameId: external data-webjs-frame targeting + _top (#252)
 * ==================================================================== */

/** Build a detached subtree in the live document and return helpers. */
function frameFixture(markup) {
  const root = document.createElement('div');
  root.innerHTML = markup;
  document.body.appendChild(root);
  return {
    root,
    get: (id) => document.getElementById(id),
    cleanup: () => root.remove(),
  };
}

test('resolveTargetFrameId: explicit data-webjs-frame on the trigger targets that frame by id', () => {
  const f = frameFixture(
    '<webjs-frame id="content"></webjs-frame>' +
    '<a id="ext" href="/x" data-webjs-frame="content">go</a>'
  );
  try {
    assert.equal(_resolveTargetFrameId(f.get('ext')), 'content');
  } finally { f.cleanup(); }
});

test('resolveTargetFrameId: the attribute may sit on an ANCESTOR of the trigger', () => {
  const f = frameFixture(
    '<webjs-frame id="content"></webjs-frame>' +
    '<nav data-webjs-frame="content"><a id="ext" href="/x">go</a></nav>'
  );
  try {
    assert.equal(_resolveTargetFrameId(f.get('ext')), 'content');
  } finally { f.cleanup(); }
});

test('resolveTargetFrameId: _top returns null (full nav) even nested inside a frame', () => {
  const f = frameFixture(
    '<webjs-frame id="content"><a id="top" href="/x" data-webjs-frame="_top">out</a></webjs-frame>'
  );
  try {
    assert.equal(_resolveTargetFrameId(f.get('top')), null);
  } finally { f.cleanup(); }
});

test('resolveTargetFrameId: precedence: explicit external id WINS over the enclosing frame', () => {
  // The link is INSIDE frame "inner" but explicitly targets "outer".
  const f = frameFixture(
    '<webjs-frame id="outer"></webjs-frame>' +
    '<webjs-frame id="inner"><a id="lnk" href="/x" data-webjs-frame="outer">go</a></webjs-frame>'
  );
  try {
    assert.equal(_resolveTargetFrameId(f.get('lnk')), 'outer',
      'the explicit attribute overrides closest-enclosing-frame');
  } finally { f.cleanup(); }
});

test('resolveTargetFrameId: no attribute falls back to the closest enclosing frame', () => {
  const f = frameFixture(
    '<webjs-frame id="content"><a id="nested" href="/x">go</a></webjs-frame>'
  );
  try {
    assert.equal(_resolveTargetFrameId(f.get('nested')), 'content');
  } finally { f.cleanup(); }
});

test('resolveTargetFrameId: a plain external trigger (no frame context) returns null', () => {
  const f = frameFixture('<a id="plain" href="/x">go</a>');
  try {
    assert.equal(_resolveTargetFrameId(f.get('plain')), null);
  } finally { f.cleanup(); }
});

test('resolveTargetFrameId: an unresolvable id falls back to null and warns once (no throw)', () => {
  const f = frameFixture('<a id="bad" href="/x" data-webjs-frame="nope">go</a>');
  const origWarn = console.warn;
  const warnings = [];
  console.warn = (...a) => { warnings.push(a.join(' ')); };
  try {
    assert.equal(_resolveTargetFrameId(f.get('bad')), null);
    assert.ok(warnings.some((w) => w.includes('nope')), 'warns about the unresolved id');
  } finally { console.warn = origWarn; f.cleanup(); }
});

test('resolveTargetFrameId: null trigger → null (no crash)', () => {
  assert.equal(_resolveTargetFrameId(null), null);
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
 * diffElementInPlace: attribute diffing + live-attr preservation
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
  // User typed something into the input between renders: the server-
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

test('diffElementInPlace: does NOT recurse into a hydrated component (#906)', () => {
  // A hydrated component owns its rendered subtree: the client renderer
  // stashes a live instance on the host under Symbol.for('webjs.instance'),
  // whose lit-html parts hold direct references to these child nodes.
  // Reconciling into them would swap the nodes out and orphan the parts, so
  // the component's next reactive update writes to detached nodes (a dead
  // click after a soft nav). The router must leave the subtree alone.
  const dst = document.createElement('like-button');
  dst.setAttribute('count', '3');
  dst.innerHTML = '<button>heart 7</button>'; // live: user clicked up to 7
  const liveButton = dst.firstChild;
  /** @type {any} */ (dst)[Symbol.for('webjs.instance')] = { strings: [], parts: [] };

  const src = document.createElement('like-button');
  src.setAttribute('count', '3');
  src.innerHTML = '<button>heart 3</button>'; // incoming SSR: initial state

  _diffEl(dst, src);

  // The live rendered node is preserved by identity, its content untouched.
  assert.equal(dst.firstChild, liveButton, 'component child kept its identity');
  assert.equal(dst.textContent, 'heart 7', 'live component content not morphed');
});

test('diffElementInPlace: hydrated component still gets its attributes synced (#906)', () => {
  // Opacity is only about CHILDREN. Attributes must still sync, because a
  // reactive-property attribute change is how the router drives the
  // component to re-render itself.
  const dst = document.createElement('my-widget');
  dst.setAttribute('label', 'old');
  /** @type {any} */ (dst)[Symbol.for('webjs.instance')] = { strings: [], parts: [] };
  const src = document.createElement('my-widget');
  src.setAttribute('label', 'new');
  _diffEl(dst, src);
  assert.equal(dst.getAttribute('label'), 'new',
    'reactive-prop attribute must still sync so the component re-renders itself');
});

test('diffElementInPlace: a custom element with NO live instance IS reconciled (#906)', () => {
  // The guard keys on the live-instance symbol, not on the tag name: a
  // not-yet-upgraded or display-only custom element has no parts to corrupt
  // and must still reconcile normally.
  const dst = document.createElement('like-button');
  dst.innerHTML = '<button>heart 7</button>';
  const src = document.createElement('like-button');
  src.innerHTML = '<button>heart 3</button>';
  _diffEl(dst, src);
  assert.equal(dst.textContent, 'heart 3',
    'a custom element with no client render reconciles like any element');
});

/* ====================================================================
 * reconcileChildren: keyed reuse + positional reuse
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

  // The "a" element is reused: same node reference after reconciliation,
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
 * addNewHeadElements: add-only head merge (Tailwind survives)
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
  // partial swaps: Tailwind runtime injects its CSS as a <style>, and
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

test('addNewHeadElements: dynamically-created scripts get the meta csp-nonce, not the source page\'s per-request nonce', () => {
  // Set up the meta tag the server emits for the original page load.
  document.head.innerHTML = '<meta name="csp-nonce" content="original-page-nonce">';
  // The fetched new-page head ships a script with the new request's nonce.
  const newHead = document.createElement('head');
  newHead.innerHTML =
    '<meta name="csp-nonce" content="original-page-nonce">' +
    '<script src="/added.js" nonce="new-request-nonce"></script>';
  _addNewHead(newHead);
  const added = document.head.querySelector('script[src="/added.js"]');
  assert.ok(added, 'script should be added');
  // Browser's CSP cache holds the FIRST page-load nonce, so the new
  // script must carry that one (not the per-request nonce that came
  // with the fetched head fragment).
  assert.equal(added.getAttribute('nonce'), 'original-page-nonce',
    'dynamic script nonce must match the page-load meta tag, not the source-page nonce');
});

test('addNewHeadElements: head diff ignores per-request nonce differences (no spurious re-add)', () => {
  // Same script src, same content, but differs only in nonce attribute.
  // Without nonce-aware diff, the current page's script would not match
  // the new page's, and the new page's would be appended every nav.
  document.head.innerHTML =
    '<script src="/x.js" nonce="page-load-nonce"></script>';
  const newHead = document.createElement('head');
  newHead.innerHTML =
    '<script src="/x.js" nonce="some-other-per-request-nonce"></script>';
  const before = document.head.querySelectorAll('script[src="/x.js"]').length;
  _addNewHead(newHead);
  const after = document.head.querySelectorAll('script[src="/x.js"]').length;
  assert.equal(after, before,
    'nonce-only difference must not trigger re-add (would duplicate the script every nav)');
});

/* ====================================================================
 * mergeHead: full-merge head (used on full body swap)
 * ==================================================================== */

test('mergeHead: removes stale non-style elements but never a stylesheet (#936)', () => {
  document.head.innerHTML =
    '<title>Old</title>' +
    '<meta name="stale-meta" content="x">' +
    '<link rel="stylesheet" href="/keep.css">';
  const newHead = document.createElement('head');
  newHead.innerHTML =
    '<title>New</title>' +
    '<meta name="fresh-meta" content="y">' +
    '<link rel="stylesheet" href="/fresh.css">';
  _merge(newHead);
  assert.equal(document.title, 'New');
  assert.ok(!document.head.querySelector('meta[name="stale-meta"]'), 'a stale non-style element is removed');
  assert.ok(document.head.querySelector('meta[name="fresh-meta"]'), 'a fresh element is added');
  // #936: a stylesheet the incoming head lacks must NOT be stripped (it would
  // leave the page unstyled). It stays; a new one is still added.
  assert.ok(document.head.querySelector('link[href="/keep.css"]'), 'the live stylesheet is preserved even though absent from the new head');
  assert.ok(document.head.querySelector('link[href="/fresh.css"]'), 'a new stylesheet is added');
});

test('mergeHead: preserves importmap, base, AND stylesheets across full merges (#936)', () => {
  document.head.innerHTML =
    '<script type="importmap">{}</script>' +
    '<base href="/">' +
    '<link rel="stylesheet" href="/x.css">';
  const newHead = document.createElement('head');
  newHead.innerHTML = '<link rel="stylesheet" href="/y.css">';
  _merge(newHead);
  assert.ok(document.head.querySelector('script[type="importmap"]'), 'importmap kept');
  assert.ok(document.head.querySelector('base'), 'base kept');
  assert.ok(document.head.querySelector('link[href="/x.css"]'), 'the existing stylesheet is preserved (#936), not removed');
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

test('mergeHead: applies meta csp-nonce to created scripts (replaces source nonce)', () => {
  // Same Turbo pattern as addNewHeadElements but exercised through
  // the full-merge code path. Meta is in the current head BEFORE
  // mergeHead runs; the new head is what we navigate to.
  document.head.innerHTML = '<meta name="csp-nonce" content="page-nonce">';
  const newHead = document.createElement('head');
  newHead.innerHTML =
    '<meta name="csp-nonce" content="page-nonce">' +
    '<script src="/m.js" nonce="per-request-stale"></script>';
  _merge(newHead);
  const added = document.head.querySelector('script[src="/m.js"]');
  assert.ok(added, 'script added');
  assert.equal(added.getAttribute('nonce'), 'page-nonce',
    'mergeHead must apply the meta nonce, not the source-page nonce');
});

test('addNewHeadElements + mergeHead: nonce-only diff on <link> tags does not duplicate preloads', () => {
  // Browsers gate cross-origin modulepreload by script-src nonce, so
  // preload links also carry per-request nonces after the recent CSP
  // fix. Without nonce-aware diff, every nav would re-append the
  // same preload because the nonce differs.
  document.head.innerHTML =
    '<link rel="modulepreload" href="https://cdn.example/x.js" crossorigin="anonymous" nonce="page-nonce">';
  const newHead = document.createElement('head');
  newHead.innerHTML =
    '<link rel="modulepreload" href="https://cdn.example/x.js" crossorigin="anonymous" nonce="request-2-nonce">';
  _addNewHead(newHead);
  const links = document.head.querySelectorAll('link[rel="modulepreload"][href="https://cdn.example/x.js"]');
  assert.equal(links.length, 1, 'no duplicate preload after nonce-only diff');
});

test('reactivateScripts: applies meta csp-nonce to re-emitted body scripts', () => {
  // After a full body swap, reactivateScripts walks body scripts and
  // re-creates them so the browser executes them. Each created
  // script must carry the meta nonce, not whatever was in the new
  // page's source.
  document.head.innerHTML = '<meta name="csp-nonce" content="body-nonce">';
  document.body.innerHTML = '<script nonce="stale-source-nonce">window.x = 1;</script>';
  _reactivateScripts(document.body);
  const s = document.body.querySelector('script');
  assert.ok(s, 'script reactivated');
  assert.equal(s.getAttribute('nonce'), 'body-nonce',
    'reactivated body scripts must carry the meta nonce, not the source nonce');
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
 * navigate: Content-Type guard + fallback paths
 * ==================================================================== */

function installNavigationMocks({ contentType, body = '', ok = true, captureHeaders = false, responseHeaders = {} }) {
  const originalFetch = globalThis.fetch;
  const originalLocation = globalThis.location;
  const originalHistory = globalThis.history;
  const originalScrollTo = globalThis.scrollTo;
  /** @type {{ href: string | null, assigns: string[] }} */
  const redirect = { href: null, assigns: [] };
  /** @type {{ url: string | null, headers: Record<string,string> | null }} */
  const captured = { url: null, headers: null };

  // Caller may pass `body` and `responseHeaders` as a function so the
  // mock returns a different shape per call (used to chain navigations
  // against different mismatched importmaps).
  const bodyFn = typeof body === 'function' ? body : () => body;
  const headersFn = typeof responseHeaders === 'function' ? responseHeaders : () => responseHeaders;

  globalThis.fetch = async (url, init) => {
    captured.url = String(url);
    captured.headers = init && init.headers ? { ...init.headers } : null;
    // Normalize all response-header keys to lowercase so headers.get
    // (which itself lowercases its argument per Fetch spec) finds
    // them regardless of how the test author cased the input. Without
    // this, a test passing { 'X-Webjs-Build': 'foo' } would silently
    // see headers.get('x-webjs-build') return null.
    const raw = { 'content-type': contentType, ...headersFn() };
    /** @type {Record<string, string>} */
    const respHeaders = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v != null) respHeaders[String(k).toLowerCase()] = String(v);
    }
    return {
      ok,
      status: ok ? 200 : 500,
      headers: { get: (k) => respHeaders[String(k).toLowerCase()] ?? null },
      text: async () => bodyFn(),
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
  const seen = [];
  const onNav = (e) => seen.push(e.detail);
  document.addEventListener('webjs:navigate', onNav);
  try {
    document.body.innerHTML = '<!--wj:children:/-->old<!--/wj:children-->';
    await navigate('http://localhost/ok');
    assert.equal(redirect.href, null, 'text/html response should not trigger location.href fallback');
    // The navigate event carries a `from: 'navigate'` tag, symmetric with
    // webjs:prefetch's `from: 'prefetch'`, so a listener bound to both can
    // tell a real nav from a speculative prefetch landing.
    assert.ok(seen.length >= 1, 'a webjs:navigate event fired');
    assert.equal(seen[seen.length - 1].from, 'navigate');
    assert.equal(seen[seen.length - 1].url, 'http://localhost/ok');
  } finally {
    document.removeEventListener('webjs:navigate', onNav);
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

test('navigate: importmap mismatch triggers full-page reload (no partial swap)', async () => {
  // After a deploy that bumped a vendor pin, current-tab nav must
  // fall back to a full page load. The new page expects the new
  // module URLs (and new SRI hashes); partial swap leaves the old
  // importmap in place and silently breaks module resolution.
  // Mirrors Turbo's tracked_element_mismatch reload behavior. A real
  // cross-deploy is two DIFFERENT, non-empty published build ids: the
  // old process published "oldbuild", the new one publishes "newbuild".
  document.head.innerHTML = '<script type="importmap" data-webjs-build="oldbuild">{"imports":{"dayjs":"https://ga.jspm.io/npm:dayjs@1.11.13/index.js"}}</script>';
  document.body.innerHTML = '<p>current</p>';
  const newBody =
    '<!doctype html><html><head>' +
    '<script type="importmap" data-webjs-build="newbuild">{"imports":{"dayjs":"https://ga.jspm.io/npm:dayjs@1.11.20/dayjs.min.js"}}</script>' +
    '</head><body><p>after deploy</p></body></html>';
  const { redirect, restore } = installNavigationMocks({
    contentType: 'text/html', body: newBody, responseHeaders: { 'X-Webjs-Build': 'newbuild' },
  });
  try {
    await navigate('http://localhost/posts/123');
    // Hard reload should fire; partial swap must NOT run.
    assert.equal(redirect.href, 'http://localhost/posts/123',
      'mismatched importmap must trigger full reload to the target URL');
    // The current document.body must NOT have been swapped.
    assert.equal(document.body.querySelector('p')?.textContent, 'current',
      'partial swap must have been aborted');
  } finally { restore(); }
});

test('navigate: empty build id during warmup stays soft and preserves page state', async () => {
  // Regression for the exact reported bug: deploying, then typing into the blog
  // signup form, saw the fields cleared by a hard-reload loop. During a
  // runtime-first-boot server's warmup window the published build id is empty
  // until the importmap is final, and the importmap textContent genuinely
  // changes (vendor entries appear) across the first responses. Before the fix
  // the empty-vs-nonempty case fell through to a textContent compare that
  // hard-reloaded; each reload re-fetched a still-warming page and looped,
  // wiping the WHOLE page (outer layout included) every time. After the fix an
  // empty id on either side means "version unknown": the router stays soft and
  // never hard-reloads, so page state that survives a normal navigation
  // survives the warmup too. We assert an outer-layout input here (outside the
  // children markers): a hard reload would have wiped it; the soft swap leaves
  // it untouched.
  document.head.innerHTML = '<script type="importmap" data-webjs-build="">{"imports":{"dayjs":"https://ga.jspm.io/npm:dayjs@1.11.13/index.js"}}</script>';
  document.body.innerHTML =
    '<input id="search">' +
    '<!--wj:children:/-->' +
    '<p>page content</p>' +
    '<!--/wj:children-->';
  // Simulate the user typing into the preserved outer region: sets the IDL
  // value, not the attribute, which is what a hard reload would discard.
  document.getElementById('search').value = 'outer kept';
  const newBody =
    '<!doctype html><html><head>' +
    '<script type="importmap" data-webjs-build="warmbuild">{"imports":{"dayjs":"https://ga.jspm.io/npm:dayjs@1.11.20/dayjs.min.js"}}</script>' +
    '</head><body>' +
    '<input id="search">' +
    '<!--wj:children:/-->' +
    '<p>after warm</p>' +
    '<!--/wj:children-->' +
    '</body></html>';
  // Clear the infinite-reload guard flag a prior reload test may have left in
  // sessionStorage; otherwise a regression could be masked (the guard would bail
  // to a soft swap for the wrong reason instead of because the build id is empty).
  sessionStorage.removeItem('webjs:importmap-reload');
  // Response also carries no build header yet (still warming): the swap must stay soft.
  const { redirect, restore } = installNavigationMocks({ contentType: 'text/html', body: newBody });
  try {
    await navigate('http://localhost/signup');
    assert.ok(!redirect.assigns.includes('http://localhost/signup'),
      'empty current build id must NOT trigger a hard reload during warmup');
    assert.equal(document.getElementById('search').value, 'outer kept',
      'outer-layout input must survive: a hard reload (the bug) would have wiped it');
  } finally { restore(); sessionStorage.removeItem('webjs:importmap-reload'); }
});

test('navigate: identical importmap proceeds with partial swap (no reload)', async () => {
  const map = '{"imports":{"dayjs":"https://ga.jspm.io/npm:dayjs@1.11.13/index.js"}}';
  document.head.innerHTML = `<script type="importmap">${map}</script>`;
  document.body.innerHTML = '<p>current</p>';
  const newBody =
    `<!doctype html><html><head><script type="importmap">${map}</script></head>` +
    `<body><p>new</p></body></html>`;
  const { redirect, restore } = installNavigationMocks({ contentType: 'text/html', body: newBody });
  try {
    await navigate('http://localhost/about');
    // No hard reload: redirect.assigns should not include the target.
    assert.ok(!redirect.assigns.includes('http://localhost/about'),
      'identical importmap must NOT trigger reload; expected partial swap');
  } finally { restore(); }
});

test('navigate: response-header lookup is case-insensitive (mock contract)', async () => {
  // The Fetch spec says Headers.get() is case-insensitive. Our mock
  // normalizes to lowercase so a test passing `X-Webjs-Build` in any
  // casing reaches the production code that calls
  // `resp.headers.get('x-webjs-build')`.
  document.head.innerHTML = '<script type="importmap" data-webjs-build="A">{"imports":{"x":"/x"}}</script>';
  document.body.innerHTML = '<p>current</p>';
  sessionStorage.removeItem('webjs:importmap-reload');
  const { redirect, restore } = installNavigationMocks({
    contentType: 'text/html',
    body: '<p>x</p>',
    responseHeaders: { 'X-Webjs-Build': 'B' }, // intentionally mixed case
  });
  try {
    await navigate('http://localhost/case');
    assert.equal(redirect.href, 'http://localhost/case',
      'mixed-case X-Webjs-Build must still be found by lowercase lookup');
  } finally {
    restore();
    sessionStorage.removeItem('webjs:importmap-reload');
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  }
});

test('navigate: data-webjs-track="reload" signature change triggers hard reload', async () => {
  // Generic Turbo-style tracked-element opt-in: any element in the
  // head marked data-webjs-track="reload" gets included in a signature.
  // Mismatch between current and incoming signature triggers reload.
  document.head.innerHTML = '<meta data-webjs-track="reload" name="build-id" content="rev-1">';
  document.body.innerHTML = '<p>current</p>';
  sessionStorage.removeItem('webjs:importmap-reload');
  const newBody =
    '<!doctype html><html><head>' +
    '<meta data-webjs-track="reload" name="build-id" content="rev-2">' +
    '</head><body><p>after deploy</p></body></html>';
  const { redirect, restore } = installNavigationMocks({
    contentType: 'text/html',
    body: newBody,
  });
  try {
    await navigate('http://localhost/path');
    assert.equal(redirect.href, 'http://localhost/path',
      'data-webjs-track="reload" signature change must trigger reload');
    assert.equal(document.body.querySelector('p')?.textContent, 'current',
      'partial swap must have been aborted');
  } finally {
    restore();
    sessionStorage.removeItem('webjs:importmap-reload');
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  }
});

test('navigate: data-webjs-track="reload" added between deploys triggers reload', async () => {
  // Deploy A had no tracker. Deploy B added one. Currently-loaded
  // page came from A (no tracker); incoming from B (with tracker).
  // currentSig is empty, incomingSig is non-empty. Different.
  // Must reload.
  document.head.innerHTML = '<meta charset="utf-8">';
  document.body.innerHTML = '<p>current</p>';
  sessionStorage.removeItem('webjs:importmap-reload');
  const newBody =
    '<!doctype html><html><head>' +
    '<meta charset="utf-8">' +
    '<meta data-webjs-track="reload" name="build-id" content="rev-2">' +
    '</head><body><p>after</p></body></html>';
  const { redirect, restore } = installNavigationMocks({
    contentType: 'text/html',
    body: newBody,
  });
  try {
    await navigate('http://localhost/added');
    assert.equal(redirect.href, 'http://localhost/added',
      'tracked element added in incoming response must reload');
  } finally {
    restore();
    sessionStorage.removeItem('webjs:importmap-reload');
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  }
});

test('navigate: data-webjs-track="reload" removed between deploys triggers reload', async () => {
  // Inverse: deploy A had tracker, deploy B removed it.
  document.head.innerHTML =
    '<meta charset="utf-8">' +
    '<meta data-webjs-track="reload" name="build-id" content="rev-1">';
  document.body.innerHTML = '<p>current</p>';
  sessionStorage.removeItem('webjs:importmap-reload');
  const newBody =
    '<!doctype html><html><head>' +
    '<meta charset="utf-8">' +
    '</head><body><p>after</p></body></html>';
  const { redirect, restore } = installNavigationMocks({
    contentType: 'text/html',
    body: newBody,
  });
  try {
    await navigate('http://localhost/removed');
    assert.equal(redirect.href, 'http://localhost/removed',
      'tracked element removed in incoming response must reload');
  } finally {
    restore();
    sessionStorage.removeItem('webjs:importmap-reload');
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  }
});

test('navigate: X-Webjs-Have partial response (no head) does NOT reload due to track signature', async () => {
  // Partial responses (X-Webjs-Have short-circuit) carry only the
  // inner body, no head. The current page has tracked elements;
  // incoming has nothing to compare against. Without the guard,
  // every partial nav would reload-loop because incomingSig is
  // empty. The presence-of-head check makes the comparison
  // selective.
  document.head.innerHTML =
    '<meta charset="utf-8">' +
    '<meta data-webjs-track="reload" name="build-id" content="rev-1">';
  document.body.innerHTML = '<p>current</p>';
  sessionStorage.removeItem('webjs:importmap-reload');
  // Partial fragment: no <head>, no <html>, just inner content.
  const partialBody = '<p>partial</p>';
  const { redirect, restore } = installNavigationMocks({
    contentType: 'text/html',
    body: partialBody,
  });
  try {
    await navigate('http://localhost/partial');
    assert.ok(!redirect.assigns.includes('http://localhost/partial'),
      'partial response (no head) must NOT trigger track-signature reload');
  } finally {
    restore();
    sessionStorage.removeItem('webjs:importmap-reload');
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  }
});

test('navigate: data-webjs-track="reload" strips nonce from signature (per-request nonce churn must not infinite-reload)', async () => {
  // A user marking a nonced script with data-webjs-track="reload"
  // would see infinite reloads if the signature included the nonce
  // (every request rotates the nonce, so every nav would mismatch).
  // outerHTMLForDiff strips the nonce attr before signature
  // comparison so only content changes count.
  document.head.innerHTML = '<script nonce="abc" data-webjs-track="reload" src="/build-42.js"></script>';
  document.body.innerHTML = '<p>current</p>';
  sessionStorage.removeItem('webjs:importmap-reload');
  // Incoming has the SAME script but a DIFFERENT per-request nonce
  // (the build hash and src are unchanged). Must NOT reload.
  const newBody =
    '<!doctype html><html><head>' +
    '<script nonce="xyz" data-webjs-track="reload" src="/build-42.js"></script>' +
    '</head><body><p>after</p></body></html>';
  const { redirect, restore } = installNavigationMocks({
    contentType: 'text/html',
    body: newBody,
  });
  try {
    await navigate('http://localhost/same-build');
    assert.ok(!redirect.assigns.includes('http://localhost/same-build'),
      'nonce-only change must NOT trigger reload');
  } finally {
    restore();
    sessionStorage.removeItem('webjs:importmap-reload');
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  }
});

test('navigate: matching data-webjs-track="reload" elements proceed with partial swap', async () => {
  document.head.innerHTML = '<meta data-webjs-track="reload" name="build-id" content="rev-1">';
  document.body.innerHTML = '<p>current</p>';
  sessionStorage.removeItem('webjs:importmap-reload');
  const newBody =
    '<!doctype html><html><head>' +
    '<meta data-webjs-track="reload" name="build-id" content="rev-1">' +
    '</head><body><p>after</p></body></html>';
  const { redirect, restore } = installNavigationMocks({
    contentType: 'text/html',
    body: newBody,
  });
  try {
    await navigate('http://localhost/other');
    assert.ok(!redirect.assigns.includes('http://localhost/other'),
      'identical tracked-element signature must NOT trigger reload');
  } finally {
    restore();
    sessionStorage.removeItem('webjs:importmap-reload');
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  }
});

test('navigate: importmap drift detected via X-Webjs-Build header on partial response', async () => {
  // Partial-response navs (the X-Webjs-Have optimization) carry only
  // the inner body, no head. Without the X-Webjs-Build header the
  // client has nothing to compare against and would silently apply
  // a stale importmap. With the header, the server-side hash is
  // sufficient to detect drift even when the body has no importmap.
  document.head.innerHTML = '<script type="importmap" data-webjs-build="OLDHASH">{"imports":{"dayjs":"/__webjs/vendor/dayjs@1.11.13.js"}}</script>';
  document.body.innerHTML = '<p>current</p>';
  // Simulate a partial response: just the inner body fragment, no
  // <head>, no importmap tag.
  const partialBody = '<p>after deploy</p>';
  sessionStorage.removeItem('webjs:importmap-reload');
  const { redirect, restore } = installNavigationMocks({
    contentType: 'text/html',
    body: partialBody,
    responseHeaders: { 'x-webjs-build': 'NEWHASH' },
  });
  try {
    await navigate('http://localhost/posts/123');
    assert.equal(redirect.href, 'http://localhost/posts/123',
      'partial response with different X-Webjs-Build must trigger reload');
    // The current document.body must NOT have been swapped.
    assert.equal(document.body.querySelector('p')?.textContent, 'current',
      'partial swap must have been aborted');
  } finally {
    restore();
    sessionStorage.removeItem('webjs:importmap-reload');
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  }
});

test('navigate: matching X-Webjs-Build proceeds with partial swap (no reload)', async () => {
  document.head.innerHTML = '<script type="importmap" data-webjs-build="SAMEHASH">{"imports":{"dayjs":"/__webjs/vendor/dayjs@1.11.13.js"}}</script>';
  document.body.innerHTML = '<p>current</p>';
  sessionStorage.removeItem('webjs:importmap-reload');
  const { redirect, restore } = installNavigationMocks({
    contentType: 'text/html',
    body: '<p>after nav</p>',
    responseHeaders: { 'x-webjs-build': 'SAMEHASH' },
  });
  try {
    await navigate('http://localhost/about');
    assert.ok(!redirect.assigns.includes('http://localhost/about'),
      'matching X-Webjs-Build must NOT trigger reload');
  } finally {
    restore();
    sessionStorage.removeItem('webjs:importmap-reload');
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  }
});

test('navigate: two consecutive importmap mismatches → second falls through (infinite-reload guard)', async () => {
  // The reload-guard sessionStorage flag prevents an infinite reload
  // loop if the importmap genuinely changes on every nav (live pin
  // editing in dev, etc).
  document.head.innerHTML = '<script type="importmap" data-webjs-build="HASH0">{"imports":{"a":"/a"}}</script>';
  document.body.innerHTML = '<p>current</p>';
  sessionStorage.removeItem('webjs:importmap-reload');
  let buildVersion = 1;
  const { redirect, restore } = installNavigationMocks({
    contentType: 'text/html',
    body: '<p>partial</p>',
    // Each call returns a different x-webjs-build, simulating churn.
    responseHeaders: () => ({ 'x-webjs-build': `HASH${buildVersion++}` }),
  });
  try {
    await navigate('http://localhost/first');
    assert.equal(redirect.href, 'http://localhost/first',
      'first mismatch must reload');
    assert.equal(sessionStorage.getItem('webjs:importmap-reload'), '1',
      'reload flag must be set after first reload');
    // Second consecutive mismatch (same tab, no clean swap in between):
    // guard must fall through to the partial swap.
    redirect.href = null;
    await navigate('http://localhost/second');
    assert.equal(redirect.href, null,
      'second consecutive mismatch must NOT reload (infinite-loop guard)');
    assert.equal(sessionStorage.getItem('webjs:importmap-reload'), null,
      'flag is cleared by the guard after the second mismatch');
  } finally {
    restore();
    sessionStorage.removeItem('webjs:importmap-reload');
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  }
});

test('popstate cache restore clears the importmap-reload flag', async () => {
  // The bug: the reload-flag clear was nested inside
  // `if (href && !frameId && !revalidating)` so cache restores
  // (revalidating=true, href=null) never cleared the flag. After
  // "reload due to deploy → Back to a cached page", the flag would
  // stay set, suppressing the next legitimate reload. Fix moves the
  // clear to ANY clean swap including revalidation. This test:
  // pre-set the flag, popstate to a cached URL, verify cleared.
  const origLoc = globalThis.location;
  const origFetch = globalThis.fetch;
  const prevPageUrl = _currentPageUrl();
  sessionStorage.setItem('webjs:importmap-reload', '1');
  _snapshotCache.set('/cached-here', {
    html: '<!doctype html><html><head></head><body><!--wj:children:/-->cached<!--/wj:children--></body></html>',
    scrollX: 0,
    scrollY: 0,
  });
  globalThis.location = /** @type any */ ({
    href: 'http://localhost/cached-here',
    pathname: '/cached-here',
    origin: 'http://localhost',
    search: '',
    hash: '',
  });
  _setCurrentPageUrl('http://localhost/elsewhere');
  globalThis.fetch = async () => new Response('<html></html>', {
    status: 200, headers: { 'content-type': 'text/html' },
  });
  const origScrollTo = globalThis.window?.scrollTo;
  if (globalThis.window) globalThis.window.scrollTo = () => {};
  document.head.innerHTML = '';
  document.body.innerHTML = '<!--wj:children:/-->before-pop<!--/wj:children-->';
  try {
    // Synchronous assertion: _onPopState calls performNavigation
    // which runs synchronously until its first await. For a cache-
    // hit popstate, the entire body up to and including the
    // cache-restore applySwap and the (un-awaited) background
    // revalidation kickoff runs sync. So immediately after
    // _onPopState returns, the cache-restore applySwap has run
    // BUT the background revalidation's own applySwap (which would
    // also clear the flag via the no-mismatch path) has not. This
    // isolates the test to the cache-restore clear specifically.
    _onPopState({});
    assert.equal(sessionStorage.getItem('webjs:importmap-reload'), null,
      'cache restore (revalidating=true) MUST clear the reload flag SYNCHRONOUSLY');
    // Let the background revalidation finish (avoid unhandled rejection).
    await new Promise((r) => setTimeout(r, 5));
  } finally {
    _snapshotCache.delete('/cached-here');
    _setCurrentPageUrl(prevPageUrl);
    globalThis.location = origLoc;
    globalThis.fetch = origFetch;
    if (globalThis.window) globalThis.window.scrollTo = origScrollTo;
    sessionStorage.removeItem('webjs:importmap-reload');
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  }
});

test('popstate cache restore scrolls instantly, not animated (#601)', async () => {
  // The restore previously used scrollTo(x, y) (the 2-arg form), which
  // respects an app's `html { scroll-behavior: smooth }` and so ANIMATES
  // the Back/Forward scroll instead of jumping the way native nav does.
  // The fix passes behavior:'instant' to force the jump.
  const origLoc = globalThis.location;
  const origFetch = globalThis.fetch;
  const prevPageUrl = _currentPageUrl();
  _snapshotCache.set('/restore-here', {
    html: '<!doctype html><html><head></head><body><!--wj:children:/-->cached<!--/wj:children--></body></html>',
    scrollX: 0,
    scrollY: 640,
  });
  globalThis.location = /** @type any */ ({
    href: 'http://localhost/restore-here',
    pathname: '/restore-here', origin: 'http://localhost', search: '', hash: '',
  });
  _setCurrentPageUrl('http://localhost/elsewhere');
  globalThis.fetch = async () => new Response('<html></html>', {
    status: 200, headers: { 'content-type': 'text/html' },
  });
  let arg;
  const spy = (a) => { arg = a; };
  const origGlobalScrollTo = globalThis.scrollTo;
  const origWinScrollTo = globalThis.window?.scrollTo;
  globalThis.scrollTo = /** @type any */ (spy);
  if (globalThis.window) globalThis.window.scrollTo = /** @type any */ (spy);
  document.head.innerHTML = '';
  document.body.innerHTML = '<!--wj:children:/-->before-pop<!--/wj:children-->';
  try {
    _onPopState({});
    assert.ok(arg && typeof arg === 'object',
      'restore uses the scrollTo options form, not the 2-arg (x, y) form');
    assert.equal(arg.behavior, 'instant',
      'behavior:instant keeps an app scroll-behavior:smooth from animating the restore');
    assert.equal(arg.top, 640, 'saved scrollY restored as top');
    assert.equal(arg.left, 0, 'saved scrollX restored as left');
    // Let the background revalidation settle (avoid an unhandled rejection).
    await new Promise((r) => setTimeout(r, 5));
  } finally {
    _snapshotCache.delete('/restore-here');
    _setCurrentPageUrl(prevPageUrl);
    globalThis.location = origLoc;
    globalThis.fetch = origFetch;
    globalThis.scrollTo = origGlobalScrollTo;
    if (globalThis.window) globalThis.window.scrollTo = origWinScrollTo;
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  }
});

test('navigate: forward-nav scroll-to-top is instant, not animated (#601)', async () => {
  document.body.innerHTML = '<!--wj:children:/-->before<!--/wj:children-->';
  const { restore } = installNavigationMocks({
    contentType: 'text/html',
    body:
      '<!doctype html><html><head></head><body>' +
      '<!--wj:children:/-->after<!--/wj:children--></body></html>',
  });
  let arg;
  const spy = (a) => { arg = a; };
  const origWinScrollTo = globalThis.window?.scrollTo;
  globalThis.scrollTo = /** @type any */ (spy);
  if (globalThis.window) globalThis.window.scrollTo = /** @type any */ (spy);
  try {
    await navigate('http://localhost/forward');
    assert.ok(arg && typeof arg === 'object',
      'forward nav uses the scrollTo options form, not (0, 0)');
    assert.equal(arg.behavior, 'instant',
      'forward-nav scroll-to-top jumps instantly even under scroll-behavior:smooth');
    assert.equal(arg.top, 0);
    assert.equal(arg.left, 0);
  } finally {
    restore();
    if (globalThis.window) globalThis.window.scrollTo = origWinScrollTo;
    document.body.innerHTML = '';
  }
});

test('navigate: a found hash anchor stays SMOOTH, not forced instant (#601)', async () => {
  // The carve-out for the instant-scroll fix: it must NOT touch the
  // hash-anchor path. A `#section` link (e.g. a menu pointing at a section)
  // should still animate under `scroll-behavior: smooth`, so a found anchor
  // is scrolled via scrollIntoView (which honors the page CSS), NEVER via the
  // forced-instant scrollTo. This guards against a later "tidy-up" that makes
  // section links jump.
  document.body.innerHTML =
    '<!--wj:children:/--><section id="sec">S</section><!--/wj:children-->';
  const { restore } = installNavigationMocks({
    contentType: 'text/html',
    body:
      '<!doctype html><html><head></head><body>' +
      '<!--wj:children:/--><section id="sec">S</section><!--/wj:children--></body></html>',
  });
  let intoViewCalls = 0;
  const scrollToArgs = [];
  const origInto = globalThis.HTMLElement.prototype.scrollIntoView;
  globalThis.HTMLElement.prototype.scrollIntoView = function () { intoViewCalls++; };
  const origWinScrollTo = globalThis.window?.scrollTo;
  const spy = (...a) => { scrollToArgs.push(a); };
  // Set the spies AFTER installNavigationMocks (which stubs globalThis.scrollTo).
  globalThis.scrollTo = /** @type any */ (spy);
  if (globalThis.window) globalThis.window.scrollTo = /** @type any */ (spy);
  try {
    await navigate('http://localhost/page#sec');
    assert.equal(intoViewCalls, 1,
      'a found hash anchor scrolls via scrollIntoView (honors scroll-behavior:smooth)');
    const forcedInstant = scrollToArgs.some((a) => a.length === 1 && a[0] && a[0].behavior === 'instant');
    assert.ok(!forcedInstant,
      'the hash-anchor path must NOT force behavior:instant (that would kill smooth section scrolling)');
  } finally {
    restore();
    globalThis.HTMLElement.prototype.scrollIntoView = origInto;
    if (globalThis.window) globalThis.window.scrollTo = origWinScrollTo;
    document.body.innerHTML = '';
  }
});

test('warns once in dev when <html> has scroll-behavior: smooth, suppressed in prod (#613)', async () => {
  const origGCS = globalThis.getComputedStyle;
  const origWinScrollTo = globalThis.window?.scrollTo;
  const origNodeEnv = process.env.NODE_ENV;
  const origWarn = console.warn;
  const warnings = [];
  console.warn = (...a) => { warnings.push(a.join(' ')); };
  if (globalThis.window) globalThis.window.scrollTo = () => {};
  globalThis.scrollTo = () => {};
  document.body.innerHTML = '<!--wj:children:/-->before<!--/wj:children-->';
  const smoothWarns = () => warnings.filter((w) => /scroll-behavior: smooth/.test(w)).length;
  const navMock = () => installNavigationMocks({
    contentType: 'text/html',
    body: '<!doctype html><html><head></head><body><!--wj:children:/-->after<!--/wj:children--></body></html>',
  });
  try {
    // dev + smooth => warns exactly once across two navs (fire-once guard)
    process.env.NODE_ENV = 'development';
    globalThis.getComputedStyle = () => ({ scrollBehavior: 'smooth' });
    _resetWarnOnce();
    let m = navMock(); globalThis.scrollTo = () => {}; await navigate('http://localhost/p1'); m.restore();
    assert.equal(smoothWarns(), 1, 'warns once on a smooth-scroll forward nav in dev');
    m = navMock(); globalThis.scrollTo = () => {}; await navigate('http://localhost/p2'); m.restore();
    assert.equal(smoothWarns(), 1, 'fire-once: a second nav does not warn again');

    // scroll-behavior auto => no warn
    _resetWarnOnce(); warnings.length = 0;
    globalThis.getComputedStyle = () => ({ scrollBehavior: 'auto' });
    m = navMock(); globalThis.scrollTo = () => {}; await navigate('http://localhost/p3'); m.restore();
    assert.equal(smoothWarns(), 0, 'no warning when scroll-behavior is not smooth');

    // production => suppressed even with smooth
    _resetWarnOnce(); warnings.length = 0;
    globalThis.getComputedStyle = () => ({ scrollBehavior: 'smooth' });
    process.env.NODE_ENV = 'production';
    m = navMock(); globalThis.scrollTo = () => {}; await navigate('http://localhost/p4'); m.restore();
    assert.equal(smoothWarns(), 0, 'suppressed in production');
  } finally {
    console.warn = origWarn;
    globalThis.getComputedStyle = origGCS;
    if (globalThis.window) globalThis.window.scrollTo = origWinScrollTo;
    if (origNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = origNodeEnv;
    _resetWarnOnce();
    document.body.innerHTML = '';
  }
});

test('navigate: clean swap clears reload flag so a later mismatch reloads again', async () => {
  // After "reload due to mismatch → clean nav → later mismatch", the
  // later mismatch must trigger its own fresh reload. Regression for
  // the bug where the flag stayed set across the clean nav and
  // suppressed the legitimate later reload.
  sessionStorage.removeItem('webjs:importmap-reload');
  document.head.innerHTML = '<script type="importmap" data-webjs-build="HASH1">{"imports":{"a":"/a"}}</script>';
  document.body.innerHTML = '<p>current</p>';

  // Step 1: mismatch → reload, flag set.
  let mocks = installNavigationMocks({
    contentType: 'text/html',
    body: '<p>partial</p>',
    responseHeaders: { 'x-webjs-build': 'HASH2' },
  });
  try {
    await navigate('http://localhost/step1');
    assert.equal(mocks.redirect.href, 'http://localhost/step1');
    assert.equal(sessionStorage.getItem('webjs:importmap-reload'), '1');
  } finally { mocks.restore(); }

  // Step 2: clean swap (matching build → no reload). Flag should be cleared.
  document.head.innerHTML = '<script type="importmap" data-webjs-build="HASH2">{"imports":{"a":"/a"}}</script>';
  mocks = installNavigationMocks({
    contentType: 'text/html',
    body: '<p>clean</p>',
    responseHeaders: { 'x-webjs-build': 'HASH2' },
  });
  try {
    await navigate('http://localhost/step2');
    assert.ok(!mocks.redirect.assigns.includes('http://localhost/step2'),
      'matching build must NOT reload');
    assert.equal(sessionStorage.getItem('webjs:importmap-reload'), null,
      'clean swap MUST clear the reload flag (the bug fixed in this commit)');
  } finally { mocks.restore(); }

  // Step 3: another mismatch (e.g. a second deploy) → fresh reload.
  mocks = installNavigationMocks({
    contentType: 'text/html',
    body: '<p>partial2</p>',
    responseHeaders: { 'x-webjs-build': 'HASH3' },
  });
  try {
    await navigate('http://localhost/step3');
    assert.equal(mocks.redirect.href, 'http://localhost/step3',
      'a later mismatch after a clean nav must reload again');
  } finally {
    mocks.restore();
    sessionStorage.removeItem('webjs:importmap-reload');
    // Reset document state so later tests don't inherit our importmap.
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  }
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

test('navigate: non-ok HTML response is rendered in place (validation errors, 404 pages, etc.)', async () => {
  // Phase 4: 4xx/5xx responses with HTML bodies are no longer
  // full-page-fallback'd. The server-rendered validation pattern
  // (POST → 422 with form + errors re-rendered) and "soft 404 pages"
  // both depend on this. Matches Turbo Drive's
  // formSubmissionFailedWithResponse behavior.
  const { redirect, restore } = installNavigationMocks({
    contentType: 'text/html',
    body: '<!doctype html><html><body><h1 id="err-marker">Validation failed</h1></body></html>',
    ok: false,
  });
  try {
    document.body.innerHTML = '<p>old</p>';
    await navigate('http://localhost/missing');
    // No full-page fallback: location.href was NOT reassigned.
    assert.equal(redirect.href, null,
      'HTML 4xx/5xx should render in place, not full-nav-fallback');
    // The new body is in place.
    assert.ok(document.getElementById('err-marker'),
      "non-ok response's HTML body was applied");
  } finally { restore(); }
});

test('navigate: non-ok response with NON-HTML body falls back to full nav', async () => {
  // 500 returning `{"error": "..."}` (JSON) is not something we can
  // render as a page. Hand off to the browser.
  const { redirect, restore } = installNavigationMocks({
    contentType: 'application/json',
    body: '{"error":"boom"}',
    ok: false,
  });
  try {
    await navigate('http://localhost/api-error');
    assert.equal(redirect.href, 'http://localhost/api-error');
  } finally { restore(); }
});

test('navigate: 204 No Content stays on current page (records history, no DOM swap)', async () => {
  // Server returning 204 = "I processed your request, no new page to
  // show." Common for autosave-style submissions where the user stays
  // put.
  const originalFetch = globalThis.fetch;
  const originalLocation = globalThis.location;
  let redirected = null;
  /** @type {{url:string|null}} */
  const pushed = { url: null };
  globalThis.fetch = async () => ({
    ok: true,
    status: 204,
    redirected: false,
    url: 'http://localhost/save',
    headers: { get: () => 'text/html' },
    text: async () => '',
  });
  globalThis.location = /** @type any */ ({ origin: 'http://localhost', href: 'http://localhost/' });
  Object.defineProperty(globalThis.location, 'href', {
    configurable: true, get() { return 'http://localhost/'; },
    set(v) { redirected = v; },
  });
  globalThis.history = /** @type any */ ({
    pushState: (_a, _b, url) => { pushed.url = url; },
    replaceState: () => {},
  });
  globalThis.scrollTo = /** @type any */ (() => {});
  document.body.innerHTML = '<p id="keep">original</p>';
  try {
    await navigate('http://localhost/save');
    assert.equal(redirected, null, 'no full-page fallback');
    assert.ok(document.getElementById('keep'),
      'DOM untouched: 204 means stay on current page');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.location = originalLocation;
  }
});

test('navigate: server-side redirect records the final URL in history (PRG pattern)', async () => {
  // POST → server redirects to GET /dashboard (303 See Other) →
  // fetch auto-follows → we need to record /dashboard, not /signup.
  const originalFetch = globalThis.fetch;
  const originalLocation = globalThis.location;
  /** @type {{url:string|null}} */
  const pushed = { url: null };
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    redirected: true,
    url: 'http://localhost/dashboard',
    headers: { get: () => 'text/html' },
    text: async () => '<!doctype html><html><body><h1 id="dash">Dashboard</h1></body></html>',
  });
  globalThis.location = /** @type any */ ({ origin: 'http://localhost', href: 'http://localhost/' });
  Object.defineProperty(globalThis.location, 'href', {
    configurable: true, get() { return 'http://localhost/'; }, set() {},
  });
  globalThis.history = /** @type any */ ({
    pushState: (_a, _b, url) => { pushed.url = url; },
    replaceState: () => {},
  });
  globalThis.scrollTo = /** @type any */ (() => {});
  try {
    await navigate('http://localhost/signup');
    assert.equal(pushed.url, 'http://localhost/dashboard',
      'history recorded the final (post-redirect) URL, not the originally-requested one');
    assert.ok(document.getElementById('dash'),
      'final page body was applied');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.location = originalLocation;
  }
});

/* ====================================================================
 * navigate: partial-swap end-to-end
 * ==================================================================== */

test('navigate: marker-based partial swap preserves outer layout DOM', async () => {
  // Two-layer layout: root has <header>, <main>, <footer>; the page
  // content lives inside the docs layout's children-slot. After
  // navigating between two pages that both nest under root + docs,
  // the <header> and <main> wrappers AND the docs sidenav must
  // remain identically mounted: same DOM nodes, no re-render.
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

    // Outer header / footer DOM nodes are the SAME objects: not re-rendered.
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
    // /docs marker wins: so the sidenav inside the /-slot but outside
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
 * navigate: Suspense resolver forwarding (partial swap)
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
 * navigate: parseHTML returning null, hash scroll
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
 * activeFrameId: <webjs-frame> escape hatch detection
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
 * onPopState: back/forward triggers router nav
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
 * revalidate: snapshot-cache invalidation
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

/* ====================================================================
 * blurOutgoingFocus: clear stuck focus on the previously-activated
 * element so it doesn't paint a :focus-visible ring when the window
 * regains focus.
 * ==================================================================== */

/** Stub document.activeElement to return the given element. */
function withActiveElement(el, fn) {
  const desc = Object.getOwnPropertyDescriptor(document, 'activeElement');
  Object.defineProperty(document, 'activeElement', { configurable: true, get: () => el });
  try { fn(); } finally {
    if (desc) Object.defineProperty(document, 'activeElement', desc);
    else delete document.activeElement;
  }
}

test('blurOutgoingFocus: calls .blur() on the previously-active element', () => {
  document.body.innerHTML = '<a id="link" href="/x">link</a>';
  const link = document.getElementById('link');
  let blurred = false;
  link.blur = () => { blurred = true; };
  withActiveElement(link, () => _blurOutgoingFocus());
  assert.equal(blurred, true, 'sidenav link is blurred after swap');
});

test('blurOutgoingFocus: no-op when active element is <body>', () => {
  // After certain DOM mutations the browser parks focus on <body>;
  // calling blur() there would be redundant and might dispatch a
  // useless blur event.
  let blurCalls = 0;
  document.body.blur = () => { blurCalls++; };
  withActiveElement(document.body, () => _blurOutgoingFocus());
  assert.equal(blurCalls, 0, '<body> is not blurred');
});

test('blurOutgoingFocus: no-op when there is no active element', () => {
  // Just verify it doesn't throw when activeElement is null/undefined.
  withActiveElement(null, () => _blurOutgoingFocus());
  withActiveElement(undefined, () => _blurOutgoingFocus());
});

test('blurOutgoingFocus: no-op when active element has no blur() method', () => {
  // Pathological case: exotic node types without blur. Should not throw.
  withActiveElement({ /* no blur method */ }, () => _blurOutgoingFocus());
});

/* ====================================================================
 * Form submission: getSubmitMethod / getSubmitAction
 * ==================================================================== */

/** Build a form element in the test document for inspection. */
function formFrom(html) {
  document.body.innerHTML = html;
  return document.querySelector('form');
}

test('getSubmitMethod: submitter formmethod overrides form method', () => {
  const form = formFrom('<form method="post"><button formmethod="put">x</button></form>');
  const submitter = form.querySelector('button');
  assert.equal(_getSubmitMethod(form, submitter), 'put');
});

test('getSubmitMethod: falls back to form method when submitter has no formmethod', () => {
  const form = formFrom('<form method="POST"><button>x</button></form>');
  const submitter = form.querySelector('button');
  assert.equal(_getSubmitMethod(form, submitter), 'post');
});

test('getSubmitMethod: defaults to get when neither has a method', () => {
  const form = formFrom('<form><button>x</button></form>');
  const submitter = form.querySelector('button');
  assert.equal(_getSubmitMethod(form, submitter), 'get');
});

test('getSubmitMethod: tolerates null submitter (programmatic submit)', () => {
  const form = formFrom('<form method="post"></form>');
  assert.equal(_getSubmitMethod(form, null), 'post');
});

test('getSubmitAction: submitter formaction overrides form action', () => {
  const form = formFrom('<form action="/a"><button formaction="/b">x</button></form>');
  const submitter = form.querySelector('button');
  assert.equal(_getSubmitAction(form, submitter), '/b');
});

test('getSubmitAction: falls back to form action when submitter has none', () => {
  const form = formFrom('<form action="/here"><button>x</button></form>');
  const submitter = form.querySelector('button');
  assert.equal(_getSubmitAction(form, submitter), '/here');
});

test('getSubmitAction: empty submitter formaction is honored (means submit-to-self)', () => {
  // Per HTML5 spec, a present-but-empty formaction means "use the form's
  // action URL". We return empty string here; the caller resolves via
  // `new URL('', location.href)` which gives the current document URL.
  const form = formFrom('<form action="/elsewhere"><button formaction="">x</button></form>');
  const submitter = form.querySelector('button');
  assert.equal(_getSubmitAction(form, submitter), '');
});

/* ====================================================================
 * Form submission: onSubmit filter rules
 * ==================================================================== */

/**
 * Construct a fake SubmitEvent for the given form. We can't use a real
 * SubmitEvent in linkedom (it's undefined there), but onSubmit only
 * reads `defaultPrevented`, `target`, `submitter`, and `preventDefault`
 * - easy to fake.
 */
function fakeSubmitEvent(form, submitter) {
  let prevented = false;
  return {
    defaultPrevented: false,
    target: form,
    submitter: submitter || null,
    preventDefault() { prevented = true; this.defaultPrevented = true; },
    _wasPrevented() { return prevented; },
  };
}

test('onSubmit: ignores forms with data-no-router (lets browser submit)', () => {
  const form = formFrom('<form action="/x" method="post" data-no-router></form>');
  const e = fakeSubmitEvent(form);
  _onSubmit(e);
  assert.equal(e._wasPrevented(), false,
    "data-no-router form is NOT intercepted; browser handles it natively");
});

test('onSubmit: ignores forms with target=_blank (popup)', () => {
  const form = formFrom('<form action="/x" method="post" target="_blank"></form>');
  const e = fakeSubmitEvent(form);
  _onSubmit(e);
  assert.equal(e._wasPrevented(), false, 'popup target left to browser');
});

test('onSubmit: ignores submissions with method="dialog"', () => {
  const form = formFrom('<form action="/x" method="dialog"></form>');
  const e = fakeSubmitEvent(form);
  _onSubmit(e);
  assert.equal(e._wasPrevented(), false, 'native dialog dismissal not routed');
});

test('onSubmit: ignores cross-origin actions', () => {
  const form = formFrom('<form action="https://other.example.com/x" method="post"></form>');
  const e = fakeSubmitEvent(form);
  _onSubmit(e);
  assert.equal(e._wasPrevented(), false, 'cross-origin → full browser submit');
});

test('onSubmit: ignores file-download actions (non-HTML extensions)', () => {
  const form = formFrom('<form action="/data.pdf" method="get"></form>');
  const e = fakeSubmitEvent(form);
  _onSubmit(e);
  assert.equal(e._wasPrevented(), false, 'PDF action → browser handles download');
});

test('onSubmit: ignores already-prevented events (server-action RPC stub got first)', () => {
  const form = formFrom('<form action="/x" method="post"></form>');
  const e = fakeSubmitEvent(form);
  e.defaultPrevented = true; // simulate a user @submit handler already running
  _onSubmit(e);
  assert.equal(e._wasPrevented(), false,
    "router does not double-prevent: user handler owns the event");
});

test('onSubmit: ignores submitter with data-no-router (per-button escape)', () => {
  const form = formFrom('<form action="/x" method="post"><button data-no-router>x</button></form>');
  const submitter = form.querySelector('button');
  const e = fakeSubmitEvent(form, submitter);
  _onSubmit(e);
  assert.equal(e._wasPrevented(), false, 'submitter-level opt-out');
});

/* ====================================================================
 * restoreOptimistic: nav-token race guard
 * ==================================================================== */

test('restoreOptimistic: stale token is a no-op (newer nav already settled)', () => {
  // Set up a real marker pair in the document so the function has
  // somewhere to restore into.
  document.body.innerHTML =
    '<!--wj:children:/-->' +
    '<p id="loading">loading</p>' +
    '<!--/wj:children-->';
  const start = [...document.body.childNodes].find(n => n.nodeType === 8 && n.data === 'wj:children:/');
  const end = [...document.body.childNodes].find(n => n.nodeType === 8 && n.data === '/wj:children');

  // Construct stale state: token from a navigation that already passed.
  const staleToken = _navToken();
  _bumpNavToken();          // simulate a newer navigation taking over
  _bumpNavToken();          // ...and another, just to be safe

  const oldChild = document.createElement('p');
  oldChild.id = 'old-content';
  oldChild.textContent = 'old';

  _restoreOptimistic({ slot: { start, end }, oldChildren: [oldChild], token: staleToken });

  // Loading element must STILL be there: restore should have been
  // skipped because token is stale.
  assert.ok(document.getElementById('loading'),
    'newer nav owns the page: stale restore must not revert it');
  assert.equal(document.getElementById('old-content'), null,
    'stale oldChildren must not be inserted');
});

test('restoreOptimistic: current token applies the restore', () => {
  document.body.innerHTML =
    '<!--wj:children:/-->' +
    '<p id="loading2">loading</p>' +
    '<!--/wj:children-->';
  const start = [...document.body.childNodes].find(n => n.nodeType === 8 && n.data === 'wj:children:/');
  const end = [...document.body.childNodes].find(n => n.nodeType === 8 && n.data === '/wj:children');

  const oldChild = document.createElement('p');
  oldChild.id = 'restored';
  oldChild.textContent = 'restored';

  _restoreOptimistic({ slot: { start, end }, oldChildren: [oldChild], token: _navToken() });

  assert.equal(document.getElementById('loading2'), null,
    'loading content was replaced');
  assert.ok(document.getElementById('restored'),
    'oldChildren restored when token is current');
});

/* ====================================================================
 * revalidate: falsy-arg semantics (Phase 3)
 * ==================================================================== */

test("revalidate(''): empty-string url clears the entire cache", () => {
  _snapshotCache.set('/a', 'snap-a');
  _snapshotCache.set('/b', 'snap-b');
  revalidate('');
  assert.equal(_snapshotCache.size, 0,
    "empty string is treated as 'no specific URL': clear everything");
});

test('revalidate(null) / revalidate(undefined): both clear entire cache', () => {
  _snapshotCache.set('/a', 'snap-a');
  revalidate(null);
  assert.equal(_snapshotCache.size, 0);
  _snapshotCache.set('/a', 'snap-a');
  revalidate(undefined);
  assert.equal(_snapshotCache.size, 0);
});

/* ====================================================================
 * addNewHeadElements: importmap mismatch warning (Phase 3)
 * ==================================================================== */

/** Capture console.warn calls into an array. */
function captureWarn(fn) {
  const calls = [];
  const orig = console.warn;
  console.warn = (...args) => calls.push(args.join(' '));
  try { fn(); } finally { console.warn = orig; }
  return calls;
}

test('addNewHeadElements: skips incoming importmap (importmap-mismatch reload handled by applySwap)', () => {
  document.head.innerHTML = '<script type="importmap">{"imports":{"a":"/a.js"}}</script>';
  const newHead = new globalThis.DOMParser().parseFromString(
    '<!doctype html><html><head><script type="importmap">{"imports":{"a":"/v2/a.js"}}</script></head><body></body></html>',
    'text/html'
  ).head;

  const warnings = captureWarn(() => _addNewHead(newHead));
  // No console.warn now. Mismatch triggers a full-page reload at
  // applySwap's entry; if execution reaches here, the maps are
  // identical or there's no current map yet.
  assert.equal(warnings.length, 0, 'addNewHeadElements no longer warns');
  // Importmap not added to current head (immutable; current wins).
  const maps = document.head.querySelectorAll('script[type="importmap"]');
  assert.equal(maps.length, 1, 'only the original importmap remains in head');
});

/* ====================================================================
 * Back-button scroll restoration (the bug: snapshotCurrent on popstate
 * was overwriting the cached snapshot we wanted to read, because
 * `location.href` has already advanced to the destination URL when
 * popstate fires).
 * ==================================================================== */

test('enableClientRouter: sets history.scrollRestoration = "manual"', () => {
  // Start from a known state. enableClientRouter is idempotent: it
  // early-returns if `enabled` is already true (which it is, since the
  // module auto-enables on import). Cycle off-then-on to exercise it.
  const origScrollRestoration = globalThis.history?.scrollRestoration;
  const origHistory = globalThis.history;
  /** @type {{ scrollRestoration: string, pushState: Function, replaceState: Function }} */
  const mockHistory = { scrollRestoration: 'auto', pushState: () => {}, replaceState: () => {} };
  globalThis.history = /** @type any */ (mockHistory);
  try {
    disableClientRouter();
    enableClientRouter();
    assert.equal(mockHistory.scrollRestoration, 'manual',
      'router takes control of scroll restoration so the browser ' +
      'doesn\'t race with our snapshot-based scroll restore');
  } finally {
    globalThis.history = origHistory;
    if (origScrollRestoration !== undefined) {
      globalThis.history.scrollRestoration = origScrollRestoration;
    }
    enableClientRouter(); // re-enable for subsequent tests
  }
});

test('disableClientRouter: restores the previous history.scrollRestoration value', () => {
  const origHistory = globalThis.history;
  /** @type {any} */
  const mockHistory = { scrollRestoration: 'auto', pushState: () => {}, replaceState: () => {} };
  globalThis.history = mockHistory;
  try {
    disableClientRouter();
    enableClientRouter();           // captures 'auto', sets 'manual'
    assert.equal(mockHistory.scrollRestoration, 'manual');
    disableClientRouter();           // should restore 'auto'
    assert.equal(mockHistory.scrollRestoration, 'auto',
      'disable restores the value enable captured, so the browser\'s ' +
      'default scroll-restoration behavior is back in effect');
  } finally {
    globalThis.history = origHistory;
    enableClientRouter();
  }
});

test('currentPageUrl: tracker exists and can be read/written via test helpers', () => {
  const prev = _currentPageUrl();
  _setCurrentPageUrl('http://localhost/sentinel');
  try {
    assert.equal(_currentPageUrl(), 'http://localhost/sentinel');
  } finally {
    _setCurrentPageUrl(prev);
  }
});

test('popstate: snapshotCurrent must NOT overwrite the cached snapshot for the destination URL', async () => {
  // The bug: on popstate the browser updates location.href to the
  // destination BEFORE firing the event. snapshotCurrent(location.href)
  // therefore overwrites the cached snapshot we wanted to read: with
  // the CURRENT (about-to-be-left) DOM under the destination URL key.
  // The fix uses `currentPageUrl` (the page actually being left), not
  // `location.href`, so the destination's cached snapshot survives.
  const origLoc = globalThis.location;
  const origFetch = globalThis.fetch;
  const prevPageUrl = _currentPageUrl();

  // Seed the destination's cached snapshot: what we want preserved.
  const goodSnapshot = {
    html: '<!doctype html><html><head><title>Original A</title></head>' +
          '<body><!--wj:children:/-->original-a-content<!--/wj:children--></body></html>',
    scrollX: 0,
    scrollY: 800,
  };
  _snapshotCache.set('/a', goodSnapshot);

  // Simulate: user is currently on /b (page about to be left), browser
  // popstate has updated location.href to /a (the destination), our
  // popstate handler is about to run.
  globalThis.location = /** @type any */ ({
    href: 'http://localhost/a',
    pathname: '/a',
    origin: 'http://localhost',
    search: '',
    hash: '',
  });
  _setCurrentPageUrl('http://localhost/b');

  // Mock fetch so the background revalidation doesn't actually run.
  globalThis.fetch = async () => new Response('<html></html>', {
    status: 200, headers: { 'content-type': 'text/html' },
  });

  document.body.innerHTML = '<!--wj:children:/-->b-content<!--/wj:children-->';

  try {
    _onPopState({});
    await new Promise((r) => setTimeout(r, 5));

    // The /a snapshot must NOT have been overwritten with the b-content
    // DOM the user was looking at when the popstate fired.
    const after = _snapshotCache.get('/a');
    assert.ok(after, '/a cache entry still exists');
    assert.equal(
      typeof after === 'object' ? after.html : after,
      goodSnapshot.html,
      'destination URL\'s cached snapshot survived the popstate handler ' +
      '- this was the bug: previously the snapshot got overwritten with ' +
      'the page being LEFT, keyed under the destination URL'
    );
  } finally {
    _snapshotCache.delete('/a');
    _snapshotCache.delete('/b');
    _setCurrentPageUrl(prevPageUrl);
    globalThis.location = origLoc;
    globalThis.fetch = origFetch;
  }
});

test('popstate: page being LEFT is snapshotted under its own URL (so forward-nav can restore it)', async () => {
  // Companion to the previous test. When the user pops from /b back to
  // /a, the framework should snapshot /b (with its current scroll) so
  // that if the user then forward-navigates back to /b, the snapshot
  // is there for instant restore. Keyed under /b (the URL being left),
  // NOT /a (location.href after popstate).
  const origLoc = globalThis.location;
  const origFetch = globalThis.fetch;
  const prevPageUrl = _currentPageUrl();

  // Seed BOTH:
  //  - /a snapshot (so cache-hit path runs, exercising the "snapshot
  //    leaving page" step before returning)
  //  - clear /b snapshot so we can verify it was newly written
  _snapshotCache.set('/a', {
    html: '<!doctype html><html><body><!--wj:children:/-->a<!--/wj:children--></body></html>',
    scrollX: 0, scrollY: 0,
  });
  _snapshotCache.delete('/b');

  globalThis.location = /** @type any */ ({
    href: 'http://localhost/a', pathname: '/a', origin: 'http://localhost',
    search: '', hash: '',
  });
  _setCurrentPageUrl('http://localhost/b');

  globalThis.fetch = async () => new Response('<html></html>', {
    status: 200, headers: { 'content-type': 'text/html' },
  });

  document.body.innerHTML = '<!--wj:children:/-->b-content<!--/wj:children-->';

  try {
    _onPopState({});
    await new Promise((r) => setTimeout(r, 5));

    const bSnap = _snapshotCache.get('/b');
    assert.ok(bSnap, '/b was snapshotted (the page the user just left)');
    const html = typeof bSnap === 'object' ? bSnap.html : bSnap;
    assert.match(html, /b-content/,
      "/b's snapshot contains the b-content DOM the user was looking " +
      'at when they hit back: required so a future forward-nav can ' +
      'restore /b instantly');
  } finally {
    _snapshotCache.delete('/a');
    _snapshotCache.delete('/b');
    _setCurrentPageUrl(prevPageUrl);
    globalThis.location = origLoc;
    globalThis.fetch = origFetch;
  }
});

/* ====================================================================
 * Partial-swap nav + component lifecycle (lit-parity integration)
 *
 * The critical client-router invariant. When navigation lands inside a
 * nested layout, the OUTER layout's component instances (and their
 * controllers' hostConnected) are NOT re-fired, because their DOM is
 * preserved verbatim. Only components inside the deepest swapped
 * marker pair go through disconnect / connect.
 *
 * These tests pin that down for components with ReactiveControllers
 * attached. Task / ContextProvider / ContextConsumer share the same
 * dispatch path, so the controller-level assertion is the right level
 * to verify the invariant once.
 * ==================================================================== */

let __nextTrackerN = 0;
function makeTracker(records) {
  const tag = `nav-tracker-${++__nextTrackerN}`;
  class Tracker extends WebComponent {
    constructor() {
      super();
      this.addController({
        hostConnected: () => records.push(`connect:${this.id || '?'}`),
        hostDisconnected: () => records.push(`disconnect:${this.id || '?'}`),
      });
    }
    render() { return html`<span>${this.id || '?'}</span>`; }
  }
  Tracker.register(tag);
  return tag;
}

test('partial-swap: outer-layout component instance survives when inner segment changes', async () => {
  const records = [];
  const tag = makeTracker(records);

  document.body.innerHTML = '';

  // Build the OLD body. Outer tracker sits BEFORE the / marker so it's
  // entirely outside any layout slot. Middle tracker sits inside / but
  // outside /docs. Inner tracker sits inside /docs.
  const outer = document.createElement(tag);
  outer.id = 'outer-tracker';
  document.body.appendChild(outer);

  document.body.appendChild(document.createComment('wj:children:/'));

  const middle = document.createElement(tag);
  middle.id = 'middle-tracker';
  document.body.appendChild(middle);

  document.body.appendChild(document.createComment('wj:children:/docs'));

  const innerOld = document.createElement(tag);
  innerOld.id = 'inner-old';
  document.body.appendChild(innerOld);

  document.body.appendChild(document.createComment('/wj:children'));
  document.body.appendChild(document.createComment('/wj:children'));

  await Promise.resolve();
  await Promise.resolve();

  // Sanity. All three trackers connected once, none disconnected.
  assert.deepEqual(
    records.filter((r) => r.startsWith('connect:')).sort(),
    ['connect:inner-old', 'connect:middle-tracker', 'connect:outer-tracker'],
    'all three trackers connected on initial mount'
  );
  assert.equal(
    records.filter((r) => r.startsWith('disconnect:')).length,
    0,
    'no disconnects before nav'
  );

  records.length = 0;

  // Incoming HTML keeps outer + middle (same id) and swaps inner for a
  // fresh element with a different id.
  const newBody =
    `<${tag} id="outer-tracker"></${tag}>` +
    '<!--wj:children:/-->' +
      `<${tag} id="middle-tracker"></${tag}>` +
      '<!--wj:children:/docs-->' +
        `<${tag} id="inner-new"></${tag}>` +
      '<!--/wj:children-->' +
    '<!--/wj:children-->';

  const { redirect, restore } = installNavigationMocks({
    contentType: 'text/html; charset=utf-8',
    body: `<!doctype html><html><head></head><body>${newBody}</body></html>`,
  });

  try {
    await navigate('http://localhost/docs/new');
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(redirect.href, null,
      'partial-swap should not trigger location.href fallback');

    // Outer tracker. Untouched. Lives outside every layout slot, so
    // never enters reconcileSiblings.
    assert.equal(
      records.filter((r) => r === 'connect:outer-tracker').length, 0,
      'outer tracker must NOT re-connect (it was outside the swap range)'
    );
    assert.equal(
      records.filter((r) => r === 'disconnect:outer-tracker').length, 0,
      'outer tracker must NOT disconnect'
    );

    // Middle tracker. Inside / but outside /docs. Deepest shared path
    // is /docs, so the swap range is bounded by the /docs markers and
    // middle is never reconciled.
    assert.equal(
      records.filter((r) => r === 'connect:middle-tracker').length, 0,
      'middle tracker must NOT re-connect (outside the /docs swap range)'
    );
    assert.equal(
      records.filter((r) => r === 'disconnect:middle-tracker').length, 0,
      'middle tracker must NOT disconnect'
    );

    // Inner. Different ids means no key match in reconcileSiblings, so
    // this is a real swap.
    assert.equal(
      records.filter((r) => r === 'disconnect:inner-old').length, 1,
      'inner-old must disconnect (no key match against inner-new)'
    );
    assert.equal(
      records.filter((r) => r === 'connect:inner-new').length, 1,
      'inner-new must connect after the swap inserts + upgrades it'
    );

    // Node identity assertions catch any future regression where the
    // router wholesale-replaces preserved-range nodes.
    assert.equal(
      document.getElementById('outer-tracker'), outer,
      'outer tracker DOM identity preserved'
    );
    assert.equal(
      document.getElementById('middle-tracker'), middle,
      'middle tracker DOM identity preserved'
    );
  } finally {
    restore();
    document.body.innerHTML = '';
  }
});

test('partial-swap: keyed inner element preserves DOM identity inside the swap range', async () => {
  const records = [];
  const tag = makeTracker(records);

  document.body.innerHTML = '';

  // Single-layout setup. The "kept" element shares its id with the
  // incoming element, the "removed" element does not.
  document.body.appendChild(document.createComment('wj:children:/'));

  const kept = document.createElement(tag);
  kept.id = 'kept';
  document.body.appendChild(kept);

  const removed = document.createElement(tag);
  removed.id = 'removed-old';
  document.body.appendChild(removed);

  document.body.appendChild(document.createComment('/wj:children'));

  await Promise.resolve();
  await Promise.resolve();

  records.length = 0;

  const newBody =
    '<!--wj:children:/-->' +
      `<${tag} id="kept"></${tag}>` +
      `<${tag} id="added"></${tag}>` +
    '<!--/wj:children-->';

  const { restore } = installNavigationMocks({
    contentType: 'text/html; charset=utf-8',
    body: `<!doctype html><html><head></head><body>${newBody}</body></html>`,
  });

  try {
    await navigate('http://localhost/swap');
    await Promise.resolve();
    await Promise.resolve();

    // id-keyed reuse means the same DOM Node ref must survive. This is
    // the load-bearing assertion. (Lifecycle counts for in-parent
    // re-insertion are implementation-defined across DOM hosts; per
    // the DOM spec, real browsers do not fire disconnect/connect when
    // a connected node is re-inserted under the same parent. Test
    // identity here, leave lifecycle assertions to test/browser/.)
    assert.equal(document.getElementById('kept'), kept,
      'kept DOM identity preserved across partial-swap');

    // Removed: gone, fires disconnect.
    assert.equal(
      records.filter((r) => r === 'disconnect:removed-old').length, 1,
      'removed-old must disconnect'
    );

    // Added: brand-new id, fires connect.
    assert.equal(
      records.filter((r) => r === 'connect:added').length, 1,
      'added must connect'
    );
  } finally {
    restore();
    document.body.innerHTML = '';
  }
});

/* ====================================================================
 * Intent prefetch (#152)
 * ==================================================================== */

/**
 * Build a detached anchor with the given href + attributes. eligibility
 * checks read .href (absolute) and attributes, so we set href via the
 * attribute and rely on linkedom resolving it against location.
 */
function mkAnchor(href, attrs = {}) {
  const a = document.createElement('a');
  a.setAttribute('href', href);
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
  return a;
}

/** Run `fn` with a stubbed matchMedia answering `map[query]`, then restore. */
function withMatchMedia(map, fn) {
  const orig = globalThis.matchMedia;
  globalThis.matchMedia = /** @type any */ ((q) => ({ matches: !!map[q], media: q }));
  try {
    return fn();
  } finally {
    if (orig === undefined) delete globalThis.matchMedia;
    else globalThis.matchMedia = orig;
  }
}

/** Install a fake same-origin location + a recording fetch. */
function withPrefetchEnv(run, { fetchImpl, navigator: nav } = {}) {
  const origLoc = globalThis.location;
  const origFetch = globalThis.fetch;
  const origNav = globalThis.navigator;
  const calls = [];
  globalThis.location = /** @type any */ ({
    origin: 'http://localhost',
    href: 'http://localhost/',
    pathname: '/',
    search: '',
  });
  globalThis.fetch = fetchImpl || (async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response('<!doctype html><body><p>ok</p></body>', {
      status: 200,
      headers: { 'content-type': 'text/html', 'x-webjs-build': 'b1' },
    });
  });
  // globalThis.navigator is a getter-only accessor in modern Node, so a
  // plain assignment throws. Redefine the property to override it.
  let navOverridden = false;
  if (nav !== undefined) {
    Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
    navOverridden = true;
  }
  return Promise.resolve(run(calls)).finally(() => {
    globalThis.location = origLoc;
    globalThis.fetch = origFetch;
    if (navOverridden) {
      Object.defineProperty(globalThis, 'navigator', { value: origNav, configurable: true, writable: true });
    }
    _resetPrefetch();
  });
}

test('eligibleAnchorHref: accepts a same-origin in-app link', async () => {
  await withPrefetchEnv(() => {
    const href = _eligibleAnchorHref(mkAnchor('http://localhost/about'));
    assert.equal(href, 'http://localhost/about');
  });
});

test('eligibleAnchorHref: rejects cross-origin, download, target, non-html, data-no-router', async () => {
  await withPrefetchEnv(() => {
    assert.equal(_eligibleAnchorHref(mkAnchor('https://other.test/x')), null, 'cross-origin');
    assert.equal(_eligibleAnchorHref(mkAnchor('http://localhost/f.pdf')), null, 'non-html ext');
    assert.equal(_eligibleAnchorHref(mkAnchor('http://localhost/x', { download: '' })), null, 'download');
    assert.equal(_eligibleAnchorHref(mkAnchor('http://localhost/x', { target: '_blank' })), null, 'target');
    assert.equal(_eligibleAnchorHref(mkAnchor('http://localhost/x', { 'data-no-router': '' })), null, 'data-no-router');
  });
});

test('eligibleAnchorHref: rejects a pure same-page hash jump', async () => {
  await withPrefetchEnv(() => {
    // location is /, so /#foo is a same-page hash and must not prefetch.
    assert.equal(_eligibleAnchorHref(mkAnchor('http://localhost/#foo')), null);
  });
});

test('prefetchSuppressed: rel=external, rel=no-prefetch, data-no-prefetch', async () => {
  await withPrefetchEnv(() => {
    assert.equal(_prefetchSuppressed(mkAnchor('/a', { rel: 'external' })), true);
    assert.equal(_prefetchSuppressed(mkAnchor('/a', { rel: 'no-prefetch' })), true);
    assert.equal(_prefetchSuppressed(mkAnchor('/a', { rel: 'nofollow noopener no-prefetch' })), true);
    assert.equal(_prefetchSuppressed(mkAnchor('/a', { 'data-no-prefetch': '' })), true);
    assert.equal(_prefetchSuppressed(mkAnchor('/a', { rel: 'prefetch' })), false);
    assert.equal(_prefetchSuppressed(mkAnchor('/a')), false);
  });
});

test('prefetchMode: data-prefetch attribute resolves to a strategy (intent default)', async () => {
  await withPrefetchEnv(() => {
    // Absent or unrecognised: the fast default.
    assert.equal(_prefetchMode(mkAnchor('/a')), 'intent');
    assert.equal(_prefetchMode(mkAnchor('/a', { 'data-prefetch': 'bogus' })), 'intent');
    assert.equal(_prefetchMode(mkAnchor('/a', { 'data-prefetch': 'intent' })), 'intent');
    // Next-style aliases + explicit strategy names.
    assert.equal(_prefetchMode(mkAnchor('/a', { 'data-prefetch': 'render' })), 'render');
    assert.equal(_prefetchMode(mkAnchor('/a', { 'data-prefetch': 'true' })), 'render');
    assert.equal(_prefetchMode(mkAnchor('/a', { 'data-prefetch': 'viewport' })), 'viewport');
    assert.equal(_prefetchMode(mkAnchor('/a', { 'data-prefetch': 'auto' })), 'viewport');
    assert.equal(_prefetchMode(mkAnchor('/a', { 'data-prefetch': 'none' })), 'none');
    assert.equal(_prefetchMode(mkAnchor('/a', { 'data-prefetch': 'false' })), 'none');
    assert.equal(_prefetchMode(mkAnchor('/a', { 'data-prefetch': 'VIEWPORT' })), 'viewport', 'case-insensitive');
  });
});

test('prefetchMode: suppression wins over data-prefetch', async () => {
  await withPrefetchEnv(() => {
    // Even an explicit eager request is overridden by an opt-out.
    assert.equal(_prefetchMode(mkAnchor('/a', { 'data-prefetch': 'viewport', 'data-no-prefetch': '' })), 'none');
    assert.equal(_prefetchMode(mkAnchor('/a', { 'data-prefetch': 'render', rel: 'external' })), 'none');
  });
});

test('prefetchMode: the default is device-adaptive (intent on pointer, viewport on touch)', async () => {
  await withPrefetchEnv(() => {
    // A hover-capable fine pointer (mouse / trackpad): intent is the default.
    withMatchMedia({ '(hover: hover) and (pointer: fine)': true }, () => {
      assert.equal(_prefetchHasHoverPointer(), true);
      assert.equal(_prefetchMode(mkAnchor('/a')), 'intent', 'pointer default is intent');
      assert.equal(_prefetchMode(mkAnchor('/a', { 'data-prefetch': 'bogus' })), 'intent');
    });
    // Touch (no hover, coarse pointer): viewport becomes the default.
    withMatchMedia({ '(hover: hover) and (pointer: fine)': false }, () => {
      assert.equal(_prefetchHasHoverPointer(), false);
      assert.equal(_prefetchMode(mkAnchor('/a')), 'viewport', 'touch default is viewport');
      assert.equal(_prefetchMode(mkAnchor('/a', { 'data-prefetch': 'bogus' })), 'viewport');
    });
    // A per-link data-prefetch ALWAYS overrides the adaptive default, even on touch.
    withMatchMedia({ '(hover: hover) and (pointer: fine)': false }, () => {
      assert.equal(_prefetchMode(mkAnchor('/a', { 'data-prefetch': 'intent' })), 'intent', 'explicit intent wins on touch');
      assert.equal(_prefetchMode(mkAnchor('/a', { 'data-prefetch': 'none' })), 'none');
      assert.equal(_prefetchMode(mkAnchor('/a', { 'data-prefetch': 'render' })), 'render');
    });
  });
});

test('prefetchHasHoverPointer: assumes a pointer when matchMedia is unavailable', async () => {
  await withPrefetchEnv(() => {
    const orig = globalThis.matchMedia;
    // @ts-ignore deliberately remove matchMedia to exercise the fallback.
    delete globalThis.matchMedia;
    try {
      // No matchMedia (non-browser / partial DOM): keep the historical intent
      // default rather than silently switching to viewport.
      assert.equal(_prefetchHasHoverPointer(), true);
      assert.equal(_prefetchMode(mkAnchor('/a')), 'intent');
    } finally {
      if (orig !== undefined) globalThis.matchMedia = orig;
    }
  });
});

test('prefetch: warms the cache with the server fragment', async () => {
  await withPrefetchEnv(async (calls) => {
    _prefetch('http://localhost/about');
    // allow the fetch promise chain to settle
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(calls.length, 1, 'one fetch issued');
    assert.equal(calls[0].init.headers['x-webjs-prefetch'], '1', 'tagged as prefetch');
    const entry = _prefetchPeek('http://localhost/about');
    assert.ok(entry, 'cache entry exists');
    assert.match(entry.html, /ok/);
    assert.equal(entry.build, 'b1');
  });
});

test('prefetch: dispatches webjs:prefetch when the fragment lands in the cache', async () => {
  await withPrefetchEnv(async () => {
    const seen = [];
    const onPrefetch = (e) => seen.push(e.detail);
    document.addEventListener('webjs:prefetch', onPrefetch);
    try {
      // No event before the fetch resolves: the request being in flight is
      // not the same as the fragment being cached.
      _prefetch('http://localhost/about');
      assert.equal(seen.length, 0, 'no event while the prefetch is still in flight');
      await new Promise((r) => setTimeout(r, 0));
      // Exactly one event, fired the instant the entry became consumable,
      // and it agrees with what _prefetchPeek now returns.
      assert.equal(seen.length, 1, 'one webjs:prefetch event after the fragment is stored');
      assert.equal(seen[0].url, 'http://localhost/about');
      assert.equal(seen[0].from, 'prefetch', 'detail tags the source so a shared listener can split it from webjs:navigate');
      assert.ok(_prefetchPeek('http://localhost/about'), 'event coincides with a consumable cache entry');
    } finally {
      document.removeEventListener('webjs:prefetch', onPrefetch);
    }
  });
});

test('prefetch: a non-html or error response caches nothing and fires no event', async () => {
  // Counterfactual: the event is bound to a real cache store, not merely
  // to the request going out, so a 404 (which prefetchStore never runs for)
  // must stay silent.
  await withPrefetchEnv(async () => {
    const seen = [];
    const onPrefetch = (e) => seen.push(e.detail);
    document.addEventListener('webjs:prefetch', onPrefetch);
    try {
      _prefetch('http://localhost/missing');
      await new Promise((r) => setTimeout(r, 0));
      assert.equal(seen.length, 0, 'no event when nothing was cached');
      assert.equal(_prefetchPeek('http://localhost/missing'), null, 'and no cache entry');
    } finally {
      document.removeEventListener('webjs:prefetch', onPrefetch);
    }
  }, {
    fetchImpl: async () => new Response('nope', { status: 404, headers: { 'content-type': 'text/plain' } }),
  });
});

test('prefetch: dedupes concurrent requests for the same href', async () => {
  let resolve;
  const gate = new Promise((r) => { resolve = r; });
  let n = 0;
  await withPrefetchEnv(async () => {
    _prefetch('http://localhost/dup');
    _prefetch('http://localhost/dup');
    assert.equal(_prefetchInflightSize(), 1, 'second call deduped while in flight');
    resolve(); // release the gate
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(n, 1, 'fetch ran once');
  }, {
    fetchImpl: async () => {
      n++;
      await gate;
      return new Response('<body>x</body>', { status: 200, headers: { 'content-type': 'text/html' } });
    },
  });
});

test('prefetch: a cached entry is not re-fetched', async () => {
  await withPrefetchEnv(async (calls) => {
    _prefetch('http://localhost/cached');
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(calls.length, 1);
    _prefetch('http://localhost/cached');
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(calls.length, 1, 'second prefetch skipped, entry already cached');
  });
});

test('prefetch: skips non-HTML and error responses', async () => {
  await withPrefetchEnv(async () => {
    _prefetch('http://localhost/json');
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(_prefetchPeek('http://localhost/json'), null, 'non-HTML not cached');
  }, {
    fetchImpl: async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
  });
});

test('prefetch: respects Save-Data (no fetch)', async () => {
  await withPrefetchEnv(async (calls) => {
    assert.equal(_prefetchSaysSaveData(), true, 'saveData detected');
    _prefetch('http://localhost/saver');
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(calls.length, 0, 'no fetch under Save-Data');
  }, { navigator: { connection: { saveData: true } } });
});

test('prefetch: respects a 2g effectiveType (no fetch)', async () => {
  await withPrefetchEnv(async (calls) => {
    assert.equal(_prefetchSaysSaveData(), true, 'slow-2g detected as a throttled link');
    _prefetch('http://localhost/slow');
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(calls.length, 0, 'no fetch on a 2g link');
  }, { navigator: { connection: { effectiveType: 'slow-2g' } } });
});

test('prefetch: a fast effectiveType does NOT suppress (4g still warms)', async () => {
  // Counterfactual for the 2g gate: only the 2g tiers are throttled, so a 4g
  // link must still prefetch (otherwise the gate would kill all speculation).
  await withPrefetchEnv(async (calls) => {
    assert.equal(_prefetchSaysSaveData(), false, '4g is not a throttled link');
    _prefetch('http://localhost/fast');
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(calls.length, 1, 'fetch issued on 4g');
  }, { navigator: { connection: { effectiveType: '4g' } } });
});

test('prefetchTake: consumes a cached entry exactly once', async () => {
  await withPrefetchEnv(async () => {
    _prefetch('http://localhost/take');
    await new Promise((r) => setTimeout(r, 0));
    const first = _prefetchTake('http://localhost/take');
    assert.ok(first, 'first take hits');
    assert.equal(_prefetchTake('http://localhost/take'), null, 'second take is a miss (single-use)');
  });
});

test('prefetch: requests past the concurrency cap queue and drain (not dropped)', async () => {
  // Hold every fetch open until released, so the first PREFETCH_CONCURRENCY
  // stay in flight and the rest must queue. On release, the queue should
  // drain and ALL urls should eventually have been fetched.
  const releases = [];
  let n = 0;
  await withPrefetchEnv(async () => {
    const urls = ['/a', '/b', '/c', '/d', '/e'].map((p) => `http://localhost${p}`);
    urls.forEach((u) => _prefetch(u));
    // Only the cap (3) are in flight; the other 2 are queued, none dropped.
    assert.equal(_prefetchInflightSize(), 3, 'cap in flight');
    assert.equal(n, 3, 'only cap fetched so far');
    // Release all in-flight; the queue drains into the freed slots.
    for (const r of releases.splice(0)) r();
    await new Promise((r) => setTimeout(r, 0));
    for (const r of releases.splice(0)) r();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(n, 5, 'all five eventually fetched (queue drained, nothing dropped)');
  }, {
    fetchImpl: async () => {
      n++;
      await new Promise((res) => releases.push(res));
      return new Response('<body>x</body>', { status: 200, headers: { 'content-type': 'text/html' } });
    },
  });
});

test('navigate: consumes a warm prefetch instead of hitting the network', async () => {
  // Warm the cache for /warm, then navigate to it. The nav must read the
  // prefetched fragment via prefetchTake and NOT issue a second fetch.
  const origLoc = globalThis.location;
  const origFetch = globalThis.fetch;
  const origHistory = globalThis.history;
  const origScrollTo = globalThis.scrollTo;
  let prefetchCalls = 0;
  let navCalls = 0;
  globalThis.location = /** @type any */ ({
    origin: 'http://localhost', href: 'http://localhost/', pathname: '/', search: '',
    assign() {}, replace() {},
  });
  Object.defineProperty(globalThis.location, 'href', {
    configurable: true, get() { return 'http://localhost/'; }, set() {},
  });
  globalThis.history = /** @type any */ ({ pushState() {}, replaceState() {} });
  globalThis.scrollTo = /** @type any */ (() => {});
  globalThis.fetch = async (url, init) => {
    const isPrefetch = init && init.headers && init.headers['x-webjs-prefetch'];
    if (isPrefetch) prefetchCalls++; else navCalls++;
    return new Response('<!doctype html><body><p>warm</p></body>', {
      status: 200, headers: { 'content-type': 'text/html', 'x-webjs-build': 'b1' },
    });
  };
  try {
    _resetPrefetch();
    _prefetch('http://localhost/warm');
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(prefetchCalls, 1, 'prefetch warmed the cache');
    assert.ok(_prefetchPeek('http://localhost/warm'), 'entry cached');
    await navigate('http://localhost/warm');
    assert.equal(navCalls, 0, 'navigation served from prefetch cache, no network fetch');
    assert.equal(_prefetchPeek('http://localhost/warm'), null, 'entry consumed by the nav');
  } finally {
    globalThis.location = origLoc;
    globalThis.fetch = origFetch;
    globalThis.history = origHistory;
    globalThis.scrollTo = origScrollTo;
    _resetPrefetch();
  }
});

test('revalidate evicts the prefetch cache, not just the snapshot cache', async () => {
  await withPrefetchEnv(async () => {
    _prefetch('http://localhost/items');
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(_prefetchPeek('http://localhost/items'), 'prefetched');
    revalidate('http://localhost/items');
    assert.equal(_prefetchPeek('http://localhost/items'), null, 'revalidate(url) dropped the prefetch entry');
    // And the clear-all form.
    _prefetch('http://localhost/items');
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(_prefetchPeek('http://localhost/items'), 're-prefetched');
    revalidate();
    assert.equal(_prefetchPeek('http://localhost/items'), null, 'revalidate() cleared the prefetch cache');
  });
});

/* ====================================================================
 * View Transitions opt-in gate + permanent-element regraft (#250)
 * ==================================================================== */

test('viewTransitionsEnabled: off by default, on only for content="same-origin"', () => {
  // No meta: off.
  for (const m of document.head.querySelectorAll('meta[name="view-transition"]')) m.remove();
  assert.equal(_viewTransitionsEnabled(), false, 'default off without the meta');

  const meta = document.createElement('meta');
  meta.setAttribute('name', 'view-transition');
  document.head.appendChild(meta);

  meta.setAttribute('content', 'same-origin');
  assert.equal(_viewTransitionsEnabled(), true, 'same-origin opts in');

  meta.setAttribute('content', 'SAME-ORIGIN');
  assert.equal(_viewTransitionsEnabled(), true, 'case-insensitive');

  meta.setAttribute('content', 'true');
  assert.equal(_viewTransitionsEnabled(), false, 'an unrecognized value stays off');

  meta.setAttribute('content', '');
  assert.equal(_viewTransitionsEnabled(), false, 'empty content stays off');

  meta.remove();
});

test('runWithTransition: synchronous fallback when the API is unavailable', () => {
  const orig = document.startViewTransition;
  delete document.startViewTransition;
  document.startViewTransition = undefined;
  try {
    let ran = false, after = false;
    _runWithTransition(() => { ran = true; }, () => { after = true; });
    assert.ok(ran, 'thunk ran synchronously');
    assert.ok(after, 'afterFinished ran synchronously in the fallback');
  } finally {
    if (orig) document.startViewTransition = orig; else delete document.startViewTransition;
  }
});

test('runWithTransition: calls startViewTransition only when opted in AND supported', () => {
  const origSVT = document.startViewTransition;
  // Ensure opt-in meta is present.
  for (const m of document.head.querySelectorAll('meta[name="view-transition"]')) m.remove();
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'view-transition');
  meta.setAttribute('content', 'same-origin');
  document.head.appendChild(meta);

  const calls = [];
  document.startViewTransition = (cb) => { calls.push(cb); cb(); return { finished: Promise.resolve() }; };
  try {
    let ran = false;
    _runWithTransition(() => { ran = true; });
    assert.equal(calls.length, 1, 'startViewTransition invoked under opt-in + support');
    assert.ok(ran, 'the swap thunk ran (callback invoked)');

    // Opt OUT: same API present, but meta absent -> NOT called.
    meta.remove();
    calls.length = 0;
    let ran2 = false;
    _runWithTransition(() => { ran2 = true; });
    assert.equal(calls.length, 0, 'not called when not opted in');
    assert.ok(ran2, 'swap still ran synchronously');
  } finally {
    if (origSVT) document.startViewTransition = origSVT; else delete document.startViewTransition;
    meta.remove();
  }
});

test('regraftPermanentElements: moves the live permanent node into the incoming tree (both-exist)', () => {
  const current = bodyFrom('<div id="p" data-webjs-permanent>LIVE</div><span>x</span>');
  const incoming = bodyFrom('<div id="p" data-webjs-permanent>PLACEHOLDER</div><h1>new</h1>');
  const liveNode = current.querySelector('#p');
  liveNode.__probe = {};
  const placeholder = incoming.querySelector('#p');

  _regraftPermanentElements(current, incoming);

  // The live node is now in the incoming tree, replacing the placeholder.
  assert.equal(incoming.querySelector('#p'), liveNode, 'incoming #p is now the live node');
  assert.equal(incoming.querySelector('#p').__probe, liveNode.__probe, 'identity (JS state) preserved');
  assert.equal(incoming.querySelector('#p').textContent, 'LIVE', 'live content kept, not the placeholder');
  assert.ok(!incoming.contains(placeholder), 'the imported placeholder was replaced');
});

test('regraftPermanentElements: leaves a permanent node absent from incoming (no force-persist)', () => {
  const current = bodyFrom('<div id="gone" data-webjs-permanent>HERE</div>');
  const incoming = bodyFrom('<h1>new</h1>');
  const liveNode = current.querySelector('#gone');

  _regraftPermanentElements(current, incoming);

  assert.equal(incoming.querySelector('#gone'), null, 'incoming unchanged (no #gone synthesized)');
  assert.equal(current.querySelector('#gone'), liveNode, 'live node not moved (will be removed by the swap)');
});

test('regraftPermanentElements: only moves when the CURRENT node is actually permanent', () => {
  // Current #w is NOT permanent; incoming #w IS marked. The current node must
  // NOT be moved (the selector only matches permanent current nodes).
  const current = bodyFrom('<div id="w">PLAIN</div>');
  const incoming = bodyFrom('<div id="w" data-webjs-permanent>INCOMING</div>');
  const incomingNode = incoming.querySelector('#w');

  _regraftPermanentElements(current, incoming);

  assert.equal(incoming.querySelector('#w'), incomingNode, 'incoming node untouched');
  assert.equal(incoming.querySelector('#w').textContent, 'INCOMING', 'non-permanent current node not regrafted');
});

/* ====================================================================
 * #899: a detected cross-deploy build mismatch evicts the client caches
 * ==================================================================== */

test('applySwap evicts snapshot + prefetch caches on a cross-deploy build mismatch', () => {
  // The current page booted on the OLD deploy; its importmap tag carries the
  // old build id. A response arriving with a DIFFERENT id means a deploy
  // landed, so every URL-keyed snapshot/prefetch is stale pre-deploy HTML.
  const savedLocation = globalThis.location;
  const savedHead = globalThis.document.head.innerHTML;
  try {
    globalThis.document.head.innerHTML =
      '<script type="importmap" data-webjs-build="OLD">{}</script>';
    let assigned = null;
    globalThis.location = /** @type any */ ({
      get href() { return 'http://x/current'; },
      set href(v) { assigned = v; },
    });
    globalThis.sessionStorage.clear();

    // Seed both caches with pre-deploy entries.
    _snapshotCache.set('http://x/a', { html: 'A', at: 1 });
    _prefetchCache.set('http://x/b', { html: 'B', build: 'OLD', at: 1 });
    assert.equal(_snapshotCache.size, 1);
    assert.equal(_prefetchCache.size, 1);

    // A foreground nav whose response advertises a NEW build id.
    const incoming = new globalThis.DOMParser().parseFromString(
      '<!doctype html><html><head></head><body></body></html>', 'text/html');
    _applySwap(incoming, null, false, 'http://x/next', 'NEW');

    assert.equal(assigned, 'http://x/next', 'a cross-deploy mismatch hard-reloads the target');
    assert.equal(_snapshotCache.size, 0, 'the snapshot cache is evicted (no stale pre-deploy HTML)');
    assert.equal(_prefetchCache.size, 0, 'the prefetch cache is evicted');
  } finally {
    globalThis.location = savedLocation;
    globalThis.document.head.innerHTML = savedHead;
    _snapshotCache.clear();
    _prefetchCache.clear();
  }
});

test('applySwap does NOT evict caches when the build id is unchanged (same deploy)', () => {
  const savedLocation = globalThis.location;
  const savedHead = globalThis.document.head.innerHTML;
  try {
    globalThis.document.head.innerHTML =
      '<script type="importmap" data-webjs-build="SAME">{}</script>';
    let assigned = null;
    globalThis.location = /** @type any */ ({
      get href() { return 'http://x/current'; },
      set href(v) { assigned = v; },
    });
    globalThis.sessionStorage.clear();
    _snapshotCache.set('http://x/a', { html: 'A', at: 1 });

    const incoming = new globalThis.DOMParser().parseFromString(
      '<!doctype html><html><head><script type="importmap" data-webjs-build="SAME">{}</script></head><body></body></html>', 'text/html');
    _applySwap(incoming, null, false, 'http://x/next', 'SAME');

    assert.equal(assigned, null, 'same build id means no hard reload');
    assert.equal(_snapshotCache.size, 1, 'the cache is preserved within one deploy');
  } finally {
    globalThis.location = savedLocation;
    globalThis.document.head.innerHTML = savedHead;
    _snapshotCache.clear();
    _prefetchCache.clear();
  }
});

test('applySwap on an APP-SOURCE mismatch evicts caches but does NOT hard reload (#899 two-tier)', () => {
  // Build id is unchanged (no vendor/core change) but the app-source id differs:
  // an app/SSR deploy changed the output while the running page's browser code
  // is fine. The right response is a soft cache-evict, not a jarring reload.
  const savedLocation = globalThis.location;
  const savedHead = globalThis.document.head.innerHTML;
  try {
    globalThis.document.head.innerHTML =
      '<script type="importmap" data-webjs-build="SAME" data-webjs-src="SRC_OLD">{}</script>';
    let assigned = null;
    globalThis.location = /** @type any */ ({ get href() { return 'http://x/current'; }, set href(v) { assigned = v; } });
    globalThis.sessionStorage.clear();
    _snapshotCache.set('http://x/a', { html: 'A', at: 1 });
    _prefetchCache.set('http://x/b', { html: 'B', build: 'SAME', src: 'SRC_OLD', at: 1 });

    // Incoming: SAME build, NEW src. Empty head so the tracked-signature check
    // is skipped and only the id comparison decides.
    const incoming = new globalThis.DOMParser().parseFromString(
      '<!doctype html><html><head></head><body></body></html>', 'text/html');
    _applySwap(incoming, null, false, 'http://x/next', 'SAME', 'SRC_NEW');

    assert.equal(assigned, null, 'an app-source change does NOT hard reload');
    assert.equal(_snapshotCache.size, 0, 'stale snapshots are evicted so the next nav re-fetches fresh');
    assert.equal(_prefetchCache.size, 0, 'stale prefetches are evicted');
  } finally {
    globalThis.location = savedLocation;
    globalThis.document.head.innerHTML = savedHead;
    _snapshotCache.clear();
    _prefetchCache.clear();
  }
});

test('applySwap does NOT evict when the app-source id is unchanged (no churn)', () => {
  const savedLocation = globalThis.location;
  const savedHead = globalThis.document.head.innerHTML;
  try {
    globalThis.document.head.innerHTML =
      '<script type="importmap" data-webjs-build="SAME" data-webjs-src="SRC_SAME">{}</script>';
    let assigned = null;
    globalThis.location = /** @type any */ ({ get href() { return 'http://x/current'; }, set href(v) { assigned = v; } });
    globalThis.sessionStorage.clear();
    _snapshotCache.set('http://x/a', { html: 'A', at: 1 });

    const incoming = new globalThis.DOMParser().parseFromString(
      '<!doctype html><html><head></head><body></body></html>', 'text/html');
    _applySwap(incoming, null, false, 'http://x/next', 'SAME', 'SRC_SAME');

    assert.equal(assigned, null, 'no build change, no reload');
    assert.equal(_snapshotCache.size, 1, 'same app-source id means the cache is preserved');
  } finally {
    globalThis.location = savedLocation;
    globalThis.document.head.innerHTML = savedHead;
    _snapshotCache.clear();
    _prefetchCache.clear();
  }
});

test('applySwap: a dropped incoming close marker still scoped-swaps and keeps the navbar node (#994)', () => {
  const savedBody = globalThis.document.body.innerHTML;
  const savedHead = globalThis.document.head.innerHTML;
  const savedLocation = globalThis.location;
  try {
    globalThis.document.head.innerHTML = '';
    globalThis.location = /** @type any */ ({ get href() { return 'http://x/current'; }, set href(_v) {} });

    // Live page: the outer layout owns a persistent navbar that sits BEFORE the
    // children marker, then the children region. Give the navbar a stable
    // identity we can assert survives.
    globalThis.document.body.innerHTML =
      '<nav id="site-top">navbar</nav>' +
      '<!--wj:children:/-->' +
      '<main id="old">old page</main>' +
      '<!--/wj:children-->';
    const liveNav = globalThis.document.getElementById('site-top');

    // The incoming partial-nav fragment lost its trailing `<!--/wj:children-->`
    // (the browser parser drop). Parsed as a body it has an orphaned open marker.
    const incoming = new globalThis.DOMParser().parseFromString(
      '<!doctype html><html><head></head><body>' +
      '<!--wj:children:/-->' +
      '<main id="new">new page</main>' +
      '</body></html>', 'text/html');

    _applySwap(incoming, null, false, 'http://x/blog');

    assert.equal(globalThis.document.getElementById('site-top'), liveNav,
      'the navbar node retains identity across the soft nav (not wiped by a full-body swap)');
    assert.ok(globalThis.document.getElementById('new'), 'the children slot swapped to the new page');
    assert.ok(!globalThis.document.getElementById('old'), 'the old children content was replaced');
  } finally {
    globalThis.location = savedLocation;
    globalThis.document.head.innerHTML = savedHead;
    globalThis.document.body.innerHTML = savedBody;
  }
});

test('applySwap: a LIVE-side dropped close does not sweep trailing outer-layout content into the swap (#994)', () => {
  // The reviewer-flagged content-loss case: the marker's siblings include a
  // FOOTER after the (dropped) close within the SAME parent (an unwrapped
  // layout). The live side is orphaned; the incoming side is well-formed, so its
  // trailing-sibling count bounds the recovered range and the live footer is
  // preserved (not swept), while the navbar (before the open marker) also stays.
  const savedBody = globalThis.document.body.innerHTML;
  const savedHead = globalThis.document.head.innerHTML;
  const savedLocation = globalThis.location;
  try {
    globalThis.document.head.innerHTML = '';
    globalThis.location = /** @type any */ ({ get href() { return 'http://x/current'; }, set href(_v) {} });

    // Unwrapped layout: nav, open, children, [close dropped], footer, all direct
    // body children. Stamp the navbar and footer to assert identity survives.
    globalThis.document.body.innerHTML =
      '<nav id="nav2">navbar</nav>' +
      '<!--wj:children:/-->' +
      '<main id="old3">old</main>' +
      '<footer id="ft2">footer</footer>';
    const liveNav = globalThis.document.getElementById('nav2');
    const liveFooter = globalThis.document.getElementById('ft2');

    // Well-formed incoming full page: nav, open, children, close, footer.
    const incoming = new globalThis.DOMParser().parseFromString(
      '<!doctype html><html><head></head><body>' +
      '<nav id="nav2">navbar</nav>' +
      '<!--wj:children:/-->' +
      '<main id="new3">new</main>' +
      '<!--/wj:children-->' +
      '<footer id="ft2">footer</footer>' +
      '</body></html>', 'text/html');

    _applySwap(incoming, null, false, 'http://x/blog');

    assert.equal(globalThis.document.getElementById('nav2'), liveNav, 'navbar identity preserved');
    assert.equal(globalThis.document.getElementById('ft2'), liveFooter,
      'the trailing footer node was NOT swept by the recovered range (identity preserved)');
    assert.ok(globalThis.document.getElementById('new3'), 'the children slot swapped');
    assert.ok(!globalThis.document.getElementById('old3'), 'old children replaced');
  } finally {
    globalThis.location = savedLocation;
    globalThis.document.head.innerHTML = savedHead;
    globalThis.document.body.innerHTML = savedBody;
  }
});

test('applySwap: an INCOMING-side dropped close does not duplicate trailing outer-layout content (#994)', () => {
  // The symmetric case: the INCOMING side is orphaned with a trailing footer in
  // the marker's parent. Bounding it against the well-formed LIVE side's
  // trailing-sibling count keeps the incoming footer OUT of the children region,
  // so the page does not end up with two footers.
  const savedBody = globalThis.document.body.innerHTML;
  const savedHead = globalThis.document.head.innerHTML;
  const savedLocation = globalThis.location;
  try {
    globalThis.document.head.innerHTML = '';
    globalThis.location = /** @type any */ ({ get href() { return 'http://x/current'; }, set href(_v) {} });

    // Well-formed live page: nav, open, children, close, footer.
    globalThis.document.body.innerHTML =
      '<nav id="nav4">navbar</nav>' +
      '<!--wj:children:/-->' +
      '<main id="old5">old</main>' +
      '<!--/wj:children-->' +
      '<footer id="ft4">footer</footer>';
    const liveFooter = globalThis.document.getElementById('ft4');

    // Incoming full page whose close marker was dropped (orphaned), footer after.
    const incoming = new globalThis.DOMParser().parseFromString(
      '<!doctype html><html><head></head><body>' +
      '<nav id="nav4">navbar</nav>' +
      '<!--wj:children:/-->' +
      '<main id="new5">new</main>' +
      '<footer id="ft4">footer</footer>' +
      '</body></html>', 'text/html');

    _applySwap(incoming, null, false, 'http://x/blog');

    assert.equal(globalThis.document.querySelectorAll('#ft4').length, 1,
      'exactly one footer (the incoming footer was not duplicated into the children region)');
    assert.equal(globalThis.document.getElementById('ft4'), liveFooter, 'the live footer is the one kept');
    assert.ok(globalThis.document.getElementById('new5'), 'the children slot swapped');
    assert.ok(!globalThis.document.getElementById('old5'), 'old children replaced');
  } finally {
    globalThis.location = savedLocation;
    globalThis.document.head.innerHTML = savedHead;
    globalThis.document.body.innerHTML = savedBody;
  }
});

test('applySwap: a degenerate trailing-count mismatch sweeps to parent end, never blanks or duplicates (#994)', () => {
  // Exercise the exact boundary cut===0 (tail === the orphan's node count), where
  // `nodes[cut]` is `orphanStart.nextSibling`, an EMPTY exclusive range. The
  // `cut <= 0 -> null` fallback must sweep the whole children region instead, so
  // the children are neither duplicated (empty live range removes nothing) nor
  // blanked. Any non-null return here (the old `orphanStart.nextSibling`, or a
  // bare `nodes[cut]`) reintroduces the empty-range bug and fails this test.
  const savedBody = globalThis.document.body.innerHTML;
  const savedHead = globalThis.document.head.innerHTML;
  const savedLocation = globalThis.location;
  try {
    globalThis.document.head.innerHTML = '';
    globalThis.location = /** @type any */ ({ get href() { return 'http://x/current'; }, set href(_v) {} });

    // Live orphan with TWO child nodes (close dropped, no trailing content).
    globalThis.document.body.innerHTML =
      '<nav id="nav6">navbar</nav>' +
      '<!--wj:children:/-->' +
      '<main id="old6a">a</main><main id="old6b">b</main>';

    // Well-formed incoming with TWO trailing siblings after the close, so
    // tail === 2 === the orphan's node count, i.e. cut === 0.
    const incoming = new globalThis.DOMParser().parseFromString(
      '<!doctype html><html><head></head><body>' +
      '<nav id="nav6">navbar</nav>' +
      '<!--wj:children:/-->' +
      '<main id="new6">new</main>' +
      '<!--/wj:children-->' +
      '<footer id="a6">a</footer><aside id="b6">b</aside>' +
      '</body></html>', 'text/html');

    _applySwap(incoming, null, false, 'http://x/blog');

    assert.ok(globalThis.document.getElementById('new6'), 'the new children were applied');
    assert.ok(!globalThis.document.getElementById('old6a'), 'old child a replaced (not duplicated)');
    assert.ok(!globalThis.document.getElementById('old6b'), 'old child b replaced (not duplicated)');
    assert.equal(globalThis.document.querySelectorAll('#new6').length, 1, 'no duplication of the children');
    assert.equal(globalThis.document.getElementById('nav6').textContent, 'navbar', 'navbar intact');
  } finally {
    globalThis.location = savedLocation;
    globalThis.document.head.innerHTML = savedHead;
    globalThis.document.body.innerHTML = savedBody;
  }
});

test('a prefetch that reveals a NEW build id evicts stale pre-deploy caches (#899)', async () => {
  const origFetch = globalThis.fetch;
  const savedHead = globalThis.document.head.innerHTML;
  const savedLoc = globalThis.location;
  globalThis.location = /** @type any */ ({ href: 'http://localhost/', origin: 'http://localhost' });
  try {
    // The page booted on the OLD deploy.
    globalThis.document.head.innerHTML =
      '<script type="importmap" data-webjs-build="OLD">{}</script>';
    // Pre-deploy snapshot + prefetch entries linger in the caches.
    _snapshotCache.set('http://localhost/a', { html: 'A', at: 1 });
    _prefetchCache.set('http://localhost/b', { html: 'B', build: 'OLD', at: 1 });

    // A prefetch fetch now returns the server's NEW build id (a deploy landed).
    globalThis.fetch = async () => new Response('<!doctype html><html><head></head><body>fresh</body></html>', {
      status: 200, headers: { 'content-type': 'text/html', 'x-webjs-build': 'NEW' },
    });

    const done = new Promise((r) => document.addEventListener('webjs:prefetch', r, { once: true }));
    _prefetch('http://localhost/c');
    await done;

    // The old snapshot + the stale pre-deploy prefetch are gone; only the fresh
    // (NEW-build) prefetch of /c remains, so clicking /b re-fetches fresh.
    assert.equal(_snapshotCache.size, 0, 'stale snapshots evicted on a deploy revealed by prefetch');
    assert.equal(_prefetchCache.has('http://localhost/b'), false, 'stale pre-deploy prefetch evicted');
    // Only the fresh (NEW-build) prefetch of /c survives, stored after the evict.
    assert.equal(_prefetchCache.size, 1, 'the stale entries are gone, the fresh one remains');
    const fresh = [..._prefetchCache.values()][0];
    assert.equal(fresh.build, 'NEW', 'the fresh prefetch carries the new build id');
  } finally {
    globalThis.fetch = origFetch;
    globalThis.location = savedLoc;
    globalThis.document.head.innerHTML = savedHead;
    _snapshotCache.clear();
    _prefetchCache.clear();
  }
});

test('a prefetch with the SAME build id does NOT evict (no deploy, no churn)', async () => {
  const origFetch = globalThis.fetch;
  const savedHead = globalThis.document.head.innerHTML;
  const savedLoc = globalThis.location;
  globalThis.location = /** @type any */ ({ href: 'http://localhost/', origin: 'http://localhost' });
  try {
    globalThis.document.head.innerHTML =
      '<script type="importmap" data-webjs-build="SAME">{}</script>';
    _snapshotCache.set('http://localhost/a', { html: 'A', at: 1 });
    globalThis.fetch = async () => new Response('<!doctype html><html><head></head><body>x</body></html>', {
      status: 200, headers: { 'content-type': 'text/html', 'x-webjs-build': 'SAME' },
    });
    const done = new Promise((r) => document.addEventListener('webjs:prefetch', r, { once: true }));
    _prefetch('http://localhost/c');
    await done;
    assert.equal(_snapshotCache.size, 1, 'no eviction within one deploy');
  } finally {
    globalThis.fetch = origFetch;
    globalThis.location = savedLoc;
    globalThis.document.head.innerHTML = savedHead;
    _snapshotCache.clear();
    _prefetchCache.clear();
  }
});

test('a prefetch that reveals a NEW app-source id evicts stale caches, no build change (#899)', async () => {
  const origFetch = globalThis.fetch;
  const savedHead = globalThis.document.head.innerHTML;
  const savedLoc = globalThis.location;
  globalThis.location = /** @type any */ ({ href: 'http://localhost/', origin: 'http://localhost' });
  try {
    // Page booted on the OLD app-source deploy (build id unchanged).
    globalThis.document.head.innerHTML =
      '<script type="importmap" data-webjs-build="SAME" data-webjs-src="SRC_OLD">{}</script>';
    _snapshotCache.set('http://localhost/a', { html: 'A', at: 1 });
    _prefetchCache.set('http://localhost/b', { html: 'B', build: 'SAME', src: 'SRC_OLD', at: 1 });

    // A prefetch fetch returns the SAME build but a NEW app-source id.
    globalThis.fetch = async () => new Response('<!doctype html><html><head></head><body>fresh</body></html>', {
      status: 200, headers: { 'content-type': 'text/html', 'x-webjs-build': 'SAME', 'x-webjs-src': 'SRC_NEW' },
    });

    const done = new Promise((r) => document.addEventListener('webjs:prefetch', r, { once: true }));
    _prefetch('http://localhost/c');
    await done;

    assert.equal(_snapshotCache.size, 0, 'a src-only deploy revealed by prefetch evicts stale snapshots');
    assert.equal(_prefetchCache.has('http://localhost/b'), false, 'the stale pre-deploy prefetch is evicted');
    assert.equal(_prefetchCache.size, 1, 'only the fresh prefetch of /c remains');
    const fresh = [..._prefetchCache.values()][0];
    assert.equal(fresh.src, 'SRC_NEW', 'the fresh prefetch entry carries the new app-source id');
  } finally {
    globalThis.fetch = origFetch;
    globalThis.location = savedLoc;
    globalThis.document.head.innerHTML = savedHead;
    _snapshotCache.clear();
    _prefetchCache.clear();
  }
});
