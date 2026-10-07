/**
 * The dev embed bridge, BROWSER half (#1498).
 *
 * A tool that previews a WebJs app inside an iframe (an AI app builder, a docs
 * playground, an editor pane) learns what the framed page is doing from this
 * bridge, and can drive it. It is a browser-safe module with no imports, so it
 * is both unit-tested in a real browser AND inlined into every dev document by
 * `embedScriptTag` (`dev-embed.js` reads this file's source, strips the
 * `export` keyword, and wraps it in a nonce-carrying inline `<script>`). One
 * source, so the test drives the exact code that ships.
 *
 * Dev-only and opt-in: the server emits it only under `webjs dev` with
 * `WEBJS_EMBED_ORIGINS` set, and never under `webjs start`.
 *
 * Wire protocol. Every message the page sends is `{ source: 'webjs-embed',
 * type, ...fields }`, posted to `window.parent` with an EXACT target origin
 * from the allow list (never `'*'`), so a parent on any other origin never
 * receives a byte of it. The host sends `{ source: 'webjs-embed-host', type,
 * ...fields }`, honoured only when it comes from `window.parent` on an allowed
 * origin.
 *
 * Security: the highlight box is built with `createElement` + inline style
 * only, never `innerHTML`, and host input is validated (a navigate path must
 * be a same-origin local path) before it touches the page.
 */

/**
 * Install the bridge. Idempotent per window: a second call is a no-op, so an
 * inlined copy in a re-rendered document cannot double-wrap `fetch`.
 *
 * @param {string[]} origins the allowed parent origins (already normalized)
 * @param {{ win?: Window, parent?: { postMessage: (msg: unknown, origin: string) => void } }} [opts]
 *   test seams: the window to instrument, and a stand-in for `window.parent`
 * @returns {{ uninstall: () => void } | null} null when not framed or nothing allowed
 */
export function installEmbedBridge(origins, opts) {
  var win = (opts && opts.win) || window;
  var parent = (opts && opts.parent) || (win.parent !== win ? win.parent : null);
  if (!parent || !origins || !origins.length) return null;
  if (win.__webjsEmbedInstalled) return null;
  win.__webjsEmbedInstalled = true;
  var doc = win.document;
  var cleanups = [];
  // Once the host has spoken from an allowed origin we know its exact origin
  // and post only there. Until then, post once per allowed origin: the browser
  // delivers a message only when the target origin matches the parent's real
  // origin, so at most one copy lands and a non-listed parent gets nothing.
  var known = null;
  var ancestors = win.location && win.location.ancestorOrigins;
  if (ancestors && ancestors.length && origins.indexOf(ancestors[0]) !== -1) known = ancestors[0];

  function post(type, fields) {
    var msg = { source: 'webjs-embed', type: type };
    if (fields) for (var k in fields) msg[k] = fields[k];
    var targets = known ? [known] : origins;
    for (var i = 0; i < targets.length; i++) {
      try { parent.postMessage(msg, targets[i]); } catch (_) { /* a non-cloneable field: drop it */ }
    }
  }

  function here() {
    return win.location.pathname + win.location.search + win.location.hash;
  }

  // A url as a same-origin path when it is one (so the host sees `/api/x`, not
  // the dev server's host and port), else the absolute url unchanged.
  function toPath(u) {
    try {
      var url = new URL(String(u), win.location.href);
      return url.origin === win.location.origin ? url.pathname + url.search : url.href;
    } catch (_) { return String(u); }
  }

  function clip(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n) + '...' : s;
  }

  function describe(v) {
    if (v instanceof Error) return v.message;
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v); } catch (_) { return String(v); }
  }

  function listen(target, name, fn, capture) {
    target.addEventListener(name, fn, capture);
    cleanups.push(function () { target.removeEventListener(name, fn, capture); });
  }

  // ready: once the document has parsed.
  function sendReady() { post('ready', { path: here(), title: doc.title }); }
  if (doc.readyState === 'loading') listen(doc, 'DOMContentLoaded', sendReady);
  else sendReady();

  // navigate: every client-router navigation, and history traversal.
  function sendNavigate() { post('navigate', { path: here(), title: doc.title }); }
  listen(doc, 'webjs:navigate', sendNavigate);
  listen(win, 'popstate', sendNavigate);

  // console: error + warn, rate limited to 20 per second. What the limit drops
  // is counted and reported on the next message that gets through, so a loop
  // that logs forever cannot flood the host and the host still knows.
  var windowStart = 0;
  var inWindow = 0;
  var dropped = 0;
  var con = win.console;
  ['error', 'warn'].forEach(function (level) {
    var orig = con[level];
    con[level] = function () {
      var now = Date.now();
      if (now - windowStart > 1000) { windowStart = now; inWindow = 0; }
      if (++inWindow <= 20) {
        var parts = [];
        for (var i = 0; i < arguments.length; i++) parts.push(describe(arguments[i]));
        var fields = { level: level, message: clip(parts.join(' '), 2000) };
        if (dropped) { fields.dropped = dropped; dropped = 0; }
        post('console', fields);
      } else {
        dropped++;
      }
      return orig.apply(this, arguments);
    };
    cleanups.push(function () { con[level] = orig; });
  });

  // error: uncaught exceptions and unhandled promise rejections. A resource
  // load failure also fires `error` on window in the capture phase but is not
  // an ErrorEvent, so the `message` guard skips it.
  listen(win, 'error', function (e) {
    if (!e || typeof e.message !== 'string' || !e.message) return;
    post('error', {
      message: clip(e.message, 2000),
      stack: e.error && e.error.stack ? clip(e.error.stack, 8000) : null,
      file: e.filename ? toPath(e.filename) : null,
      line: e.lineno || null,
      column: e.colno || null,
    });
  });
  listen(win, 'unhandledrejection', function (e) {
    var r = e && e.reason;
    post('error', {
      message: clip('Unhandled rejection: ' + describe(r), 2000),
      stack: r && r.stack ? clip(r.stack, 8000) : null,
      file: null,
      line: null,
      column: null,
    });
  });

  // network: fetch and XHR answering >= 500, or failing outright. The dev
  // server's own probes are skipped: `/__webjs/version` is polled on purpose
  // while a restarting server refuses connections, which is not an app fault.
  function ignored(path) {
    return path.indexOf('/__webjs/version') !== -1 || path.indexOf('/__webjs/events') !== -1;
  }
  function sendNetwork(method, url, status, error) {
    var path = toPath(url);
    if (ignored(path)) return;
    var fields = { method: String(method || 'GET').toUpperCase(), url: path, status: status };
    if (error) fields.error = clip(error, 500);
    post('network', fields);
  }
  var origFetch = win.fetch;
  if (typeof origFetch === 'function') {
    win.fetch = function (input, init) {
      var method = (init && init.method) || (input && typeof input === 'object' && input.method) || 'GET';
      var url = input && typeof input === 'object' && 'url' in input ? input.url : input;
      return origFetch.apply(this, arguments).then(function (res) {
        if (res && res.status >= 500) sendNetwork(method, url, res.status, null);
        return res;
      }, function (err) {
        // An abort is the caller's own decision (a superseded navigation, a
        // cancelled prefetch), not a failure.
        if (!(err && err.name === 'AbortError')) sendNetwork(method, url, 0, describe(err));
        throw err;
      });
    };
    cleanups.push(function () { win.fetch = origFetch; });
  }
  var XHR = win.XMLHttpRequest;
  if (XHR && XHR.prototype) {
    var origOpen = XHR.prototype.open;
    var origSend = XHR.prototype.send;
    XHR.prototype.open = function (method, url) {
      this.__webjsEmbed = { method: method, url: url };
      return origOpen.apply(this, arguments);
    };
    XHR.prototype.send = function () {
      var xhr = this;
      var info = xhr.__webjsEmbed;
      if (info) {
        xhr.addEventListener('load', function () {
          if (xhr.status >= 500) sendNetwork(info.method, info.url, xhr.status, null);
        });
        xhr.addEventListener('error', function () { sendNetwork(info.method, info.url, 0, 'Network error'); });
      }
      return origSend.apply(this, arguments);
    };
    cleanups.push(function () { XHR.prototype.open = origOpen; XHR.prototype.send = origSend; });
  }

  // server-error: the dev error overlay went up. `renderDevOverlay` is the one
  // gate deciding a frame belongs on this page (#1047), and it dispatches
  // `webjs:dev-overlay` exactly when it renders, so this relays what the
  // developer would see, no more.
  listen(doc, 'webjs:dev-overlay', function (e) {
    var f = (e && e.detail) || {};
    post('server-error', {
      kind: f.kind || 'render',
      message: clip(f.message || '', 2000),
      file: f.file || null,
      line: f.line || null,
      path: here(),
    });
  });

  // Inspect mode: hover highlights the element under the pointer and a click
  // is captured (never reaching the app) and reported as `select`, carrying
  // the nearest `data-webjs-src` (set by `WEBJS_SOURCE_LOCATIONS=1`, #1499).
  var box = null;
  var inspecting = false;
  // The element the event is really about, through any shadow root.
  function targetOf(e) {
    var p = e.composedPath ? e.composedPath() : null;
    var t = p && p.length ? p[0] : e.target;
    return t && t.nodeType === 1 ? t : null;
  }
  // `closest('[data-webjs-src]')` that also climbs out of shadow roots, and
  // only takes a `file:line` value: the importmap script carries an unrelated
  // `data-webjs-src` (the app-source deploy id).
  function sourceOf(el) {
    for (var n = el; n; n = n.parentNode || n.host) {
      if (n.nodeType === 1 && /:\d+$/.test(n.getAttribute('data-webjs-src') || '')) return n;
    }
    return null;
  }
  function rectOf(el) {
    var r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
  }
  function onOver(e) {
    var el = targetOf(e);
    if (!el || !box) return;
    var r = rectOf(sourceOf(el) || el);
    box.style.transform = 'translate(' + r.x + 'px,' + r.y + 'px)';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';
    box.style.display = 'block';
  }
  function swallow(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }
  var hostClick = false;
  function onClick(e) {
    // The host's own `navigate` clicks an anchor; that click must pass.
    if (hostClick) return;
    var el = targetOf(e);
    if (!el) return;
    swallow(e);
    var src = sourceOf(el);
    var picked = src || el;
    post('select', {
      src: src ? src.getAttribute('data-webjs-src') : null,
      tag: picked.localName,
      text: (picked.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      rect: rectOf(picked),
      // Modifier keys (#1532), so a host can multi-select (shift/cmd-click).
      shiftKey: !!e.shiftKey,
      metaKey: !!e.metaKey,
      altKey: !!e.altKey,
      ctrlKey: !!e.ctrlKey,
    });
  }
  function setInspect(on) {
    if (on === inspecting) return;
    inspecting = on;
    var verbs = ['pointerdown', 'mousedown', 'pointerup', 'mouseup'];
    if (on) {
      box = doc.createElement('div');
      box.setAttribute('data-webjs-embed-highlight', '');
      box.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;display:none;' +
        'box-sizing:border-box;border:2px solid #22d3ee;background:rgba(34,211,238,.12);border-radius:2px';
      (doc.body || doc.documentElement).appendChild(box);
      doc.addEventListener('pointerover', onOver, true);
      doc.addEventListener('click', onClick, true);
      for (var i = 0; i < verbs.length; i++) doc.addEventListener(verbs[i], swallow, true);
    } else {
      if (box) box.remove();
      box = null;
      doc.removeEventListener('pointerover', onOver, true);
      doc.removeEventListener('click', onClick, true);
      for (var j = 0; j < verbs.length; j++) doc.removeEventListener(verbs[j], swallow, true);
    }
  }
  cleanups.push(function () { setInspect(false); });

  // Reload hold (#1532). While the host holds, the reload client keeps every
  // live-reload signal instead of applying it (dev-reload-hold.js), and the
  // release applies the one strongest reload, or none. The switch is a page
  // global because the reload client is a separate script, and it is kept in
  // sessionStorage so a new document in this tab (a full navigation or a host
  // `reload` mid-build) starts held too.
  var HOLD_KEY = 'webjs-embed-hold';
  function store() {
    try { return win.sessionStorage || null; } catch (_) { return null; }
  }
  function setHold(on) {
    win.__webjsEmbedHold = on;
    var s = store();
    try { if (s) { if (on) s.setItem(HOLD_KEY, '1'); else s.removeItem(HOLD_KEY); } } catch (_) { /* storage blocked */ }
    if (!on && typeof win.__webjsDevReleaseHold === 'function') {
      try { win.__webjsDevReleaseHold(); } catch (_) { /* no reload client */ }
    }
    post('hold', { enabled: on });
  }
  try { if (store() && store().getItem(HOLD_KEY) === '1') win.__webjsEmbedHold = true; } catch (_) { /* storage blocked */ }
  cleanups.push(function () { win.__webjsEmbedHold = false; });

  // Scroll restore across a reload (#1532). A full dev reload, or the host's
  // `reload`, would otherwise land at the top. The position is saved per path
  // on pagehide and put back when the next document is a RELOAD of the same
  // path: at once, after parsing, and after load (late images move layout),
  // unless the user scrolls first.
  var SCROLL_KEY = 'webjs-embed-scroll';
  listen(win, 'pagehide', function () {
    var s = store();
    try { if (s) s.setItem(SCROLL_KEY, JSON.stringify({ path: here(), x: win.scrollX, y: win.scrollY })); } catch (_) { /* storage blocked */ }
  });
  (function restoreScroll() {
    var s = store();
    var saved = null;
    try {
      if (s) { saved = JSON.parse(s.getItem(SCROLL_KEY) || 'null'); s.removeItem(SCROLL_KEY); }
    } catch (_) { saved = null; }
    if (!saved || saved.path !== here() || typeof saved.y !== 'number') return;
    var nav = null;
    try { nav = win.performance.getEntriesByType('navigation')[0]; } catch (_) { /* no timing api */ }
    if (!nav || nav.type !== 'reload') return;
    var userMoved = false;
    function moved() { userMoved = true; }
    function put() { if (!userMoved) win.scrollTo(saved.x || 0, saved.y); }
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (t) { listen(win, t, moved, true); });
    put();
    if (doc.readyState === 'loading') listen(doc, 'DOMContentLoaded', put);
    if (doc.readyState !== 'complete') listen(win, 'load', put);
  })();

  // Host commands. Only from the parent window, only from an allowed origin.
  listen(win, 'message', function (e) {
    if (!e || e.source !== parent || origins.indexOf(e.origin) === -1) return;
    var d = e.data;
    if (!d || typeof d !== 'object' || d.source !== 'webjs-embed-host') return;
    known = e.origin;
    // A host command is activity: it reopens a live-reload stream the dev
    // server closed for idleness (webjs.dev.reloadIdle, #1507), and an edit
    // made meanwhile then reloads the page.
    if (typeof win.__webjsDevActivity === 'function') { try { win.__webjsDevActivity(); } catch (_) { /* no reload client */ } }
    if (d.type === 'reload') {
      win.location.reload();
    } else if (d.type === 'navigate') {
      // A local path only: one leading slash, not `//host` or `/\host`, which
      // a browser would resolve to another origin.
      var p = d.path;
      if (typeof p !== 'string' || p.charAt(0) !== '/' || p.charAt(1) === '/' || p.charAt(1) === '\\') return;
      // Click a detached-from-layout anchor so the client router takes it as
      // the soft navigation a user click would be; with no router (an app that
      // opted out, or a page shipping no component) the browser follows the
      // link as a normal full navigation. Either way the router's own rules
      // apply, so nothing here has to know whether it is installed.
      var a = doc.createElement('a');
      a.href = p;
      a.style.display = 'none';
      (doc.body || doc.documentElement).appendChild(a);
      hostClick = true;
      try { a.click(); } finally { hostClick = false; }
      a.remove();
    } else if (d.type === 'inspect') {
      setInspect(d.enabled === true);
    } else if (d.type === 'hold') {
      setHold(d.enabled === true);
    }
    // { type: 'resume' } needs nothing beyond the activity call above.
  });

  return {
    uninstall: function () {
      for (var i = cleanups.length - 1; i >= 0; i--) cleanups[i]();
      cleanups = [];
      win.__webjsEmbedInstalled = false;
    },
  };
}
