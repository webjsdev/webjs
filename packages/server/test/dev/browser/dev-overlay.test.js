/**
 * Real-browser tests for the dev error overlay renderer (#264).
 *
 * `dev-overlay.js` is the BROWSER half of the dev error overlay: the exact
 * source the dev reload client inlines (`reloadClientJs` reads this file,
 * strips `export`, and embeds it), so driving it here tests the code that
 * ships. The headline acceptance ("the dev reload client renders an overlay on
 * a webjs-error event") is browser-observable, so it MUST run in a real browser.
 *
 * The security property is the most important assertion: the overlay is built
 * with textContent only, so a hostile error message can never inject markup.
 */
import { renderDevOverlay, dismissDevOverlay } from '../../../src/dev-overlay.js';

import { assert } from '../../../../../test/browser-assert.js';

suite('dev error overlay renderer (#264)', () => {
  function teardown() {
    dismissDevOverlay();
    document.querySelectorAll('[data-webjs-error-overlay]').forEach((e) => e.remove());
  }

  test('renders an overlay carrying the message, file:line, code frame, hint, and stack', () => {
    renderDevOverlay({
      kind: 'ts-strip',
      message: 'enum is not erasable',
      file: '/app/components/bad.ts',
      line: 2,
      column: 1,
      codeFrame: '> 2 | enum Color { Red }',
      hint: 'use erasable equivalents',
      stack: 'Error: enum\n    at strip (/app/components/bad.ts:2:1)',
    });
    const overlay = document.querySelector('[data-webjs-error-overlay]');
    assert.ok(overlay, 'an overlay element is in the DOM');
    const text = overlay.textContent;
    assert.ok(text.includes('enum is not erasable'), 'the message renders');
    assert.ok(text.includes('/app/components/bad.ts:2:1'), 'the file:line:column renders');
    assert.ok(text.includes('enum Color { Red }'), 'the code frame renders');
    assert.ok(text.includes('use erasable equivalents'), 'the hint renders (in the UI, not only a console comment)');
    assert.ok(text.includes('TypeScript error'), 'the kind label renders for a ts-strip');
    assert.ok(overlay.querySelector('pre'), 'the code frame is in a <pre>');
    assert.ok(overlay.querySelector('details'), 'the stack is in a collapsible <details>');
    assert.ok(text.includes('Stack trace'), 'the stack section renders');
    teardown();
  });

  test('SECURITY: a script-laden message is rendered as inert text, never injected', () => {
    renderDevOverlay({
      kind: 'render',
      message: '<script>window.__pwned = true;</script><img src=x onerror=alert(1)>',
      file: null,
      codeFrame: '<script>also.this()</script>',
    });
    const overlay = document.querySelector('[data-webjs-error-overlay]');
    assert.ok(overlay, 'overlay present');
    // The hostile markup is present as TEXT...
    assert.ok(overlay.textContent.includes('<script>window.__pwned'), 'the message shows as literal text');
    // ...but NO script/img element was ever created inside the overlay.
    assert.equal(overlay.querySelector('script'), null, 'no <script> element injected');
    assert.equal(overlay.querySelector('img'), null, 'no <img> element injected');
    assert.equal(window.__pwned, undefined, 'the inline script never executed');
    teardown();
  });

  test('a second render replaces the first (one overlay at a time), dismiss removes it', () => {
    renderDevOverlay({ kind: 'render', message: 'first' });
    renderDevOverlay({ kind: 'render', message: 'second' });
    assert.equal(document.querySelectorAll('[data-webjs-error-overlay]').length, 1, 'exactly one overlay');
    assert.ok(document.querySelector('[data-webjs-error-overlay]').textContent.includes('second'), 'the latest frame wins');
    dismissDevOverlay();
    assert.equal(document.querySelector('[data-webjs-error-overlay]'), null, 'dismiss removes the overlay');
    teardown();
  });

  test('the Dismiss button removes the overlay', () => {
    renderDevOverlay({ kind: 'rebuild', message: 'boom' });
    const overlay = document.querySelector('[data-webjs-error-overlay]');
    overlay.querySelector('button').click();
    assert.equal(document.querySelector('[data-webjs-error-overlay]'), null, 'clicking Dismiss removes it');
    teardown();
  });
});
