/**
 * A layout's own stylesheet leaves with the layout (#1669).
 *
 * The server hoists a nested layout's or page's leading stylesheet into
 * <head> tagged `data-wj-style-owner="<segment>"`. When a soft navigation
 * REPLACES that segment's range and the incoming page does not carry the same
 * file, the router switches the sheet off (disabled, marked
 * `data-wj-style-off`) rather than removing it, so a back / forward restore
 * can switch it on again synchronously. Untagged sheets, a morph, and a
 * reduced head are never grounds for switching anything off (#936).
 *
 * Sheets are `blob:` URLs, loaded before each test so `link.sheet` exists.
 */
import { _applySwap } from '../../../src/router-client.js';
import { OFF_ATTR, OWNER_ATTR, primeLiveStylesheetKeys, switchOffDepartedStylesheets } from '../../../src/router-client/owned-styles.js';
import { addNewHeadElements } from '../../../src/router-client/head-merge.js';
import { PRELOAD_ATTR } from '../../../src/router-client/stylesheets.js';
import { assert } from '../../../../../test/browser-assert.js';

const TEST_ATTR = 'data-owned-styles-test';

const cssUrl = (css) => URL.createObjectURL(new Blob([css], { type: 'text/css' }));

/** Append a loaded stylesheet link to the live head. */
function addLiveSheet(href, owner, extra = {}) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute(TEST_ATTR, '');
  if (owner) link.setAttribute(OWNER_ATTR, owner);
  for (const [k, v] of Object.entries(extra)) link.setAttribute(k, v);
  const loaded = new Promise((r) => { link.onload = r; link.onerror = r; });
  document.head.appendChild(link);
  return loaded.then(() => link);
}

/** The body: a static root boundary around a page boundary keyed by `page`. */
const bodyHtml = (page, label) =>
  `<!--wj:children:/:/--><div id="wj-owned-probe">${label}</div>`
  + `<!--wj:children:/p:/p/${page}--><p>${label}</p><!--/wj:children:/p-->`
  + `<!--/wj:children:/-->`;

/** A parsed incoming page with `headLinks` in its head. */
function incoming(page, label, headLinks = '') {
  return new DOMParser().parseFromString(
    `<!doctype html><html><head>${headLinks}</head><body>${bodyHtml(page, label)}</body></html>`,
    'text/html',
  );
}

const ownedLink = (href, owner, attrs = '') => `<link rel="stylesheet" href="${href}" ${OWNER_ATTR}="${owner}" ${attrs}>`;
const probeWidth = () => getComputedStyle(document.getElementById('wj-owned-probe')).width;
const headLinksTo = (href) => [...document.head.querySelectorAll('link')].filter((l) => l.getAttribute('href') === href || l.href === href);

suite('Client router: owned stylesheets leave with their layout (#1669)', () => {
  let urls;

  setup(() => {
    urls = [];
    const host = document.createElement('div');
    host.innerHTML = bodyHtml('a', 'before');
    document.body.append(...host.childNodes);
  });

  teardown(() => {
    for (const n of [...document.body.childNodes]) {
      if (n.nodeType === 8 && /^\/?wj:children:/.test(n.data)) n.remove();
      else if (n.nodeType === 1 && (n.id === 'wj-owned-probe' || n.tagName === 'P')) n.remove();
    }
    for (const url of urls) {
      headLinksTo(url).forEach((l) => l.remove());
      URL.revokeObjectURL(url);
    }
    document.head.querySelectorAll(`[${TEST_ATTR}], [${OWNER_ATTR}]`).forEach((l) => l.remove());
  });

  const sheet = (css) => { const u = cssUrl(css); urls.push(u); return u; };

  test('a replace switches off an owned sheet the incoming page does not carry', async () => {
    const href = sheet('#wj-owned-probe { width: 111px; display: block; }');
    const link = await addLiveSheet(href, '/');
    assert.equal(probeWidth(), '111px');

    _applySwap(incoming('b', 'after'), null, true, null);

    assert.equal(link.isConnected, true, 'the link stays, so a restore can switch it on again');
    assert.equal(link.hasAttribute(OFF_ATTR), true, 'marked off');
    assert.equal(link.sheet.disabled, true, 'the sheet is disabled');
    assert.notEqual(probeWidth(), '111px', 'its rules no longer apply');
  });

  test('an untagged sheet survives the same replace', async () => {
    const href = sheet('#wj-owned-probe { width: 112px; display: block; }');
    const link = await addLiveSheet(href, null);
    _applySwap(incoming('b', 'after'), null, true, null);
    assert.equal(link.hasAttribute(OFF_ATTR), false);
    assert.equal(link.sheet.disabled, false);
    assert.equal(probeWidth(), '112px');
  });

  test('a sheet the incoming head carries stays on and is not linked twice', async () => {
    const href = sheet('#wj-owned-probe { width: 113px; display: block; }');
    const link = await addLiveSheet(href, '/');
    _applySwap(incoming('b', 'after', ownedLink(href, '/')), null, true, null);
    assert.equal(link.hasAttribute(OFF_ATTR), false);
    assert.equal(link.sheet.disabled, false);
    assert.equal(headLinksTo(href).length, 1, 'one link to the file');
  });

  test('a morph keeps a sheet the re-rendered range still links', async () => {
    const href = sheet('#wj-owned-probe { width: 114px; display: block; }');
    const link = await addLiveSheet(href, '/p');
    // Same route-keys on both sides, page boundary the leaf: the morph tier.
    _applySwap(incoming('a', 'after', ownedLink(href, '/p')), null, true, null);
    assert.equal(link.hasAttribute(OFF_ATTR), false);
    assert.equal(probeWidth(), '114px');
  });

  test('a morph retires a sheet the re-rendered range no longer links (a searchParams change)', async () => {
    const href = sheet('#wj-owned-probe { width: 120px; display: block; }');
    const link = await addLiveSheet(href, '/p');
    _applySwap(incoming('a', 'after'), null, true, null);
    assert.equal(link.hasAttribute(OFF_ATTR), true, 'switched off on the morph');
    assert.equal(link.sheet.disabled, true);
  });

  test('a morph leaves a sheet owned outside its range alone', async () => {
    const href = sheet('#wj-owned-probe { width: 121px; display: block; }');
    const link = await addLiveSheet(href, '/');
    _applySwap(incoming('a', 'after'), null, true, null);
    assert.equal(link.hasAttribute(OFF_ATTR), false, 'the morph is at /p; this sheet belongs to /');
  });

  test('a sheet a held layout and a page under it both link stays the layout\'s', async () => {
    const href = sheet('.wj-owned-shared {}');
    const link = await addLiveSheet(href, '/a');
    // A reduced render re-rendered only the page under /a, which links the
    // same file; the swap replaces /a/p and holds the /a layout.
    const doc = incoming('b', 'after', ownedLink(href, '/a/p'));
    addNewHeadElements(doc.head, { segment: '/a/p' });
    assert.equal(link.getAttribute(OWNER_ATTR), '/a', 'the held layout keeps it');
    // The reverse: a page-owned sheet that the layout turns out to link too.
    const href2 = sheet('.wj-owned-shared-2 {}');
    const link2 = await addLiveSheet(href2, '/a/p');
    addNewHeadElements(incoming('c', 'after', ownedLink(href2, '/a')).head, { segment: '/a/p' });
    assert.equal(link2.getAttribute(OWNER_ATTR), '/a', 'it moves out to the layout');
  });

  test('a sheet whose owner the swap replaces is handed to the incoming owner', async () => {
    // The /ui home page owns rhea; a docs page linking rhea too replaces the
    // home page. Kept on the home page's owner, a later swap of the docs
    // range could never retire it.
    const href = sheet('#wj-owned-probe { width: 124px; display: block; }');
    const link = await addLiveSheet(href, '/');
    _applySwap(incoming('b', 'docs', ownedLink(href, '/p')), null, true, null);
    assert.equal(link.getAttribute(OWNER_ATTR), '/p', 'the replaced owner gave way');
    // A switched-off sheet always takes the owner that switches it back on.
    const href2 = sheet('.wj-owned-reown {}');
    const link2 = await addLiveSheet(href2, '/a');
    switchOffDepartedStylesheets('/a', null);
    addNewHeadElements(incoming('c', 'x', ownedLink(href2, '/a/p')).head, { segment: '/a/p' });
    assert.equal(link2.hasAttribute(OFF_ATTR), false, 'switched back on');
    assert.equal(link2.getAttribute(OWNER_ATTR), '/a/p', 'and owned by the page that brought it back');
  });

  test('a sheet still loading is switched off, not removed, and disabled once it loads', async () => {
    const href = sheet('#wj-owned-probe { width: 122px; display: block; }');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.setAttribute(OWNER_ATTR, '/');
    link.setAttribute(TEST_ATTR, '');
    const loaded = new Promise((r) => { link.onload = r; link.onerror = r; });
    link.href = href;
    document.head.appendChild(link);
    _applySwap(incoming('b', 'after'), null, true, null);
    assert.equal(link.isConnected, true, 'kept, so a restore can switch it on with no reload');
    assert.equal(link.hasAttribute(OFF_ATTR), true);
    await loaded;
    // The router's load listener was added after this test's, so let the
    // rest of the load event's listeners run first.
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(link.sheet.disabled, true, 'disabled once it loaded');
    assert.notEqual(probeWidth(), '122px');
  });

  test('a relative href is keyed against the url it was served at, not the new one', async () => {
    const original = location.href;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.setAttribute(OWNER_ATTR, '/');
    link.setAttribute(TEST_ATTR, '');
    link.setAttribute('href', '__wj-owned-rel.css');
    document.head.appendChild(link);
    primeLiveStylesheetKeys();
    try {
      // The swap records the new history entry before it merges the head.
      history.replaceState(history.state, '', '/__wj-owned-deeper/path/');
      _applySwap(incoming('b', 'after', ownedLink('__wj-owned-rel.css', '/')), null, true, original);
      assert.equal(link.hasAttribute(OFF_ATTR), false, 'the incoming page carries the same file');
      assert.equal(document.head.querySelectorAll('link[href*="__wj-owned-rel.css"]').length, 1, 'and it is not linked twice');
    } finally {
      history.replaceState(history.state, '', original);
    }
  });

  test('a frame swap switches no owned sheet on', async () => {
    const href = sheet('#wj-owned-probe { width: 123px; display: block; }');
    const link = await addLiveSheet(href, '/');
    _applySwap(incoming('b', 'away'), null, true, null);
    assert.equal(link.sheet.disabled, true);
    const doc = incoming('c', 'framed', ownedLink(href, '/') + ownedLink(sheet('.wj-frame-new{}'), '/'));
    addNewHeadElements(doc.head, { frame: true });
    assert.equal(link.sheet.disabled, true, 'still off: the page around the frame decides');
    assert.equal([...document.head.querySelectorAll(`link[${OWNER_ATTR}]`)].filter((l) => !l.hasAttribute(TEST_ATTR)).length, 0, 'and no owned sheet was inserted');
  });

  test('a switched-off sheet comes back on synchronously when a later page carries it', async () => {
    const href = sheet('#wj-owned-probe { width: 116px; display: block; }');
    const link = await addLiveSheet(href, '/');
    _applySwap(incoming('b', 'away'), null, true, null);
    assert.equal(link.sheet.disabled, true);

    _applySwap(incoming('c', 'back', ownedLink(href, '/')), null, true, null);
    assert.equal(link.hasAttribute(OFF_ATTR), false);
    assert.equal(link.sheet.disabled, false);
    assert.equal(probeWidth(), '116px', 'styled in the same task, with no new load');
    assert.equal(headLinksTo(href).length, 1);
  });

  test('a snapshot that recorded a sheet as off does not switch it on', async () => {
    const href = sheet('#wj-owned-probe { width: 117px; display: block; }');
    const link = await addLiveSheet(href, '/');
    _applySwap(incoming('b', 'away'), null, true, null);
    _applySwap(incoming('c', 'restore', ownedLink(href, '/', `${OFF_ATTR}=""`)), null, true, null);
    assert.equal(link.sheet.disabled, true, 'still off');
  });

  test('the dev refresh query does not make a carried sheet look absent', async () => {
    const href = sheet('#wj-owned-probe { width: 118px; display: block; }');
    // The live link carries the dev refresh's cache-buster, the incoming one
    // the bare href. A blob URL takes no query, so compare through the key
    // with a same-origin path instead.
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.setAttribute(OWNER_ATTR, '/');
    link.setAttribute(TEST_ATTR, '');
    link.href = '/__wj-owned-dev.css?__webjs_dev=7';
    document.head.appendChild(link);
    _applySwap(incoming('b', 'after', ownedLink('/__wj-owned-dev.css', '/')), null, true, null);
    assert.equal(link.hasAttribute(OFF_ATTR), false, 'still on');
    assert.equal(document.head.querySelectorAll('link[href^="/__wj-owned-dev.css"]').length, 1, 'not linked twice');
    void href;
  });

  test('an incoming owned sheet lands root to leaf among the owned ones', async () => {
    const root = sheet('.a{}');
    const leaf = sheet('.c{}');
    const mid = sheet('.b{}');
    await addLiveSheet(root, '/');
    await addLiveSheet(leaf, '/p/q');
    // A morph at /p brings a new sheet owned by /p.
    _applySwap(incoming('a', 'after', ownedLink(mid, '/p')), null, true, null);
    const order = [...document.head.querySelectorAll(`link[${OWNER_ATTR}]`)].map((l) => l.getAttribute('href'));
    assert.deepEqual(order.filter((h) => [root, mid, leaf].includes(h)), [root, mid, leaf]);
  });

  test('the router\'s temporary copies are never switched off', async () => {
    const href = sheet('#wj-owned-probe { width: 119px; display: block; }');
    const copy = await addLiveSheet(href, '/', { [PRELOAD_ATTR]: '' });
    _applySwap(incoming('b', 'after'), null, true, null);
    assert.equal(copy.hasAttribute(OFF_ATTR), false);
  });
});
