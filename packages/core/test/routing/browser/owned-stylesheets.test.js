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
import { OFF_ATTR, OWNER_ATTR } from '../../../src/router-client/owned-styles.js';
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

  test('a morph switches nothing off', async () => {
    const href = sheet('#wj-owned-probe { width: 114px; display: block; }');
    const link = await addLiveSheet(href, '/p');
    // Same route-keys on both sides, page boundary the leaf: the morph tier.
    _applySwap(incoming('a', 'after'), null, true, null);
    assert.equal(link.hasAttribute(OFF_ATTR), false);
    assert.equal(probeWidth(), '114px');
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
