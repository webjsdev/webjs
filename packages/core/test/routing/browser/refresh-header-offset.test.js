/**
 * A fixed header's content offset survives a full-body swap (#1660).
 *
 * A `refreshPage('shell')` (and the other full-body tiers) replaces every body
 * child, the header included. The header offset pattern WebJs used to teach
 * measured the header from a `<head>` script with a `ResizeObserver`: the
 * observer fires for the detached old node, reads a height of 0, and writes
 * `--header-h: 0px`, so the content slides under the navbar. The head script
 * never re-runs, so nothing measures again.
 *
 * The fix is to size the header BY the token rather than measure it. Both
 * patterns run against the same fixture here: the measured one is the
 * counterfactual that proves the fixture reproduces the bug, the token one is
 * the pattern every layout now uses.
 */
import {
  enableClientRouter, disableClientRouter, refreshPage,
  _setCurrentPageUrl,
} from '../../../src/router-client.js';

import { assert } from '../../../../../test/browser-assert.js';
import { installNavGuard } from '../../../../../test/browser-nav-guard.js';

const KEY = '/header-offset-1660';
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
async function settle() {
  for (let i = 0; i < 4; i++) { await frame(); await new Promise((r) => setTimeout(r, 0)); }
}

/**
 * The page body. `sized` puts the header's height on the token (the fix);
 * otherwise the header gets its height from its padding, the shape a measuring
 * script was written for.
 */
function bodyHtml({ sized, label }) {
  const cls = sized ? 'wj1660-hdr wj1660-sized' : 'wj1660-hdr wj1660-padded';
  return `<header id="wj1660-header" class="${cls}">${label}</header>`
    + `<!--wj:children:/:${KEY}-->`
    + `<main id="wj1660-main">content</main>`
    + `<!--/wj:children:/-->`;
}

const docHtml = (parts) => `<!doctype html><html><head></head><body>${bodyHtml(parts)}</body></html>`;

/** The old scaffold snippet, verbatim apart from the function wrapper. */
function legacyMeasure() {
  const hdr = document.querySelector('header');
  if (!hdr || getComputedStyle(hdr).position !== 'fixed') return;
  const apply = () => document.documentElement.style.setProperty('--header-h', hdr.offsetHeight + 'px');
  apply();
  new ResizeObserver(apply).observe(hdr);
}

suite('Client router: a fixed header offset survives a full-body swap (#1660)', () => {
  let navGuard, style, origFetch, respond;

  setup(() => {
    navGuard = installNavGuard();
    enableClientRouter();
    style = document.createElement('style');
    style.textContent = ':root { --header-h: 40px; }'
      + ' body { margin: 0; padding-top: var(--header-h); }'
      + ' .wj1660-hdr { position: fixed; top: 0; left: 0; right: 0; margin: 0; box-sizing: border-box; }'
      + ' .wj1660-sized { height: var(--header-h); }'
      + ' .wj1660-padded { padding: 12px 0; line-height: 16px; font-size: 16px; }'
      + ' #wj1660-main { display: block; height: 50px; }';
    document.head.appendChild(style);
    _setCurrentPageUrl(location.href);
    origFetch = window.fetch;
    window.fetch = () => Promise.resolve(new Response(respond(), {
      status: 200, headers: { 'content-type': 'text/html' },
    }));
  });

  teardown(() => {
    window.fetch = origFetch;
    document.querySelectorAll('#wj1660-header, #wj1660-main').forEach((el) => el.remove());
    for (const n of [...document.body.childNodes]) {
      if (n.nodeType === 8 && /^\/?wj:children:/.test(n.data)) n.remove();
    }
    document.documentElement.style.removeProperty('--header-h');
    style.remove();
    _setCurrentPageUrl(null);
    navGuard.remove();
    disableClientRouter();
  });

  function mount(parts) {
    const host = document.createElement('div');
    host.innerHTML = bodyHtml(parts);
    document.body.append(...host.childNodes);
  }

  const offset = () => getComputedStyle(document.body).paddingTop;
  const headerBottom = () => document.getElementById('wj1660-header').getBoundingClientRect().bottom;
  const mainTop = () => document.getElementById('wj1660-main').getBoundingClientRect().top;

  test('counterfactual: a measured header offset collapses to 0 after a shell refresh', async () => {
    mount({ sized: false, label: 'A' });
    legacyMeasure();
    await settle();
    assert.equal(offset(), '40px', 'the measured offset is right before the swap');

    respond = () => docHtml({ sized: false, label: 'B' });
    assert.equal(await refreshPage('shell'), true, 'the shell refresh applied');
    await settle();

    assert.equal(document.getElementById('wj1660-header').textContent, 'B', 'the header was replaced');
    assert.equal(offset(), '0px', 'the observer read the detached header and zeroed the offset');
    assert.ok(mainTop() < headerBottom(), 'the content now sits under the header');
  });

  test('a header sized by the token keeps the content below it after a shell refresh', async () => {
    mount({ sized: true, label: 'A' });
    await settle();
    assert.equal(offset(), '40px');
    assert.equal(mainTop(), headerBottom(), 'the content starts at the header bottom');

    respond = () => docHtml({ sized: true, label: 'B' });
    assert.equal(await refreshPage('shell'), true, 'the shell refresh applied');
    await settle();

    assert.equal(document.getElementById('wj1660-header').textContent, 'B', 'the header was replaced');
    assert.equal(offset(), '40px', 'the offset is unchanged');
    assert.equal(document.getElementById('wj1660-header').getBoundingClientRect().height, 40,
      'the new header is the token height');
    assert.equal(mainTop(), headerBottom(), 'the content still starts at the header bottom');
  });
});
