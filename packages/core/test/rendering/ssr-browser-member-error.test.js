/**
 * Actionable SSR errors for the isomorphic footgun (issue #186).
 *
 * The SSR pipeline runs a component's constructor and render() on a bare
 * server-side class with no DOM. Touching a browser global or an HTMLElement
 * method there throws. Instead of a raw, hard-to-trace crash, the SSR walker
 * now logs a message that names the offending member and the fix (move it to
 * connectedCallback / a lifecycle hook, which SSR never calls).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WebComponent } from '../../src/component.js';
import { html } from '../../src/html.js';
import { renderToString } from '../../src/render-server.js';

/** Capture console.error output while running `fn`. */
async function captureErrors(fn) {
  const orig = console.error;
  let captured = '';
  console.error = (...a) => { captured += a.map(String).join(' ') + '\n'; };
  try { await fn(); } finally { console.error = orig; }
  return captured;
}

test('a browser global in render yields an actionable, member-naming SSR error', async () => {
  class UsesDocument extends WebComponent {
    render() { return html`<p>${document.title}</p>`; }
  }
  UsesDocument.register('ssr-uses-document');
  const out = await captureErrors(() => renderToString(html`<ssr-uses-document></ssr-uses-document>`));
  assert.match(out, /ssr-uses-document/, 'names the failing component');
  assert.match(out, /`document`/, 'names the offending member');
  assert.match(out, /browser-only global/, 'explains it is browser-only');
  assert.match(out, /connectedCallback/, 'points at the fix');
});

test('a browser-only HTMLElement method in render yields an actionable, member-naming SSR error', async () => {
  // Uses a member with NO server shim. The attribute / event / internals
  // methods are now backed by the server element shim (so reading or
  // reflecting attributes at SSR works); querySelector and friends still have
  // no server stand-in and throw, which is what this hint is for.
  class UsesQuery extends WebComponent {
    render() { this.querySelector('p'); return html`<p></p>`; }
  }
  UsesQuery.register('ssr-uses-query');
  const out = await captureErrors(() => renderToString(html`<ssr-uses-query></ssr-uses-query>`));
  assert.match(out, /`querySelector`/, 'names the offending HTMLElement method');
  assert.match(out, /HTMLElement method/, 'explains it is an HTMLElement method');
  assert.match(out, /connectedCallback/, 'points at the fix');
});

test('attribute, event, and internals methods do NOT crash at SSR (backed by the server shim)', async () => {
  // The counterpart to the rule narrowing: these lit muscle-memory patterns
  // must render cleanly server-side, with no SSR-failure log at all.
  class UsesShimmed extends WebComponent {
    constructor() {
      super();
      this.addEventListener('click', () => {});
      this.attachInternals().setFormValue('v');
    }
    render() {
      const has = this.hasAttribute('role') ? 'y' : 'n';
      this.setAttribute('data-ok', '1');
      return html`<p>${has}${this.getAttribute('data-ok')}</p>`;
    }
  }
  UsesShimmed.register('ssr-uses-shimmed');
  const out = await captureErrors(() => renderToString(html`<ssr-uses-shimmed></ssr-uses-shimmed>`));
  assert.doesNotMatch(out, /SSR failed/, 'no SSR failure logged for shimmed members');
});

test('an unrelated SSR error keeps the plain message (no false member hint)', async () => {
  // A non-browser error (a thrown string-message Error) must NOT be dressed up
  // with the browser-member guidance, so the hint is specific, not noise.
  class ThrowsPlain extends WebComponent {
    render() { throw new Error('something domain-specific broke'); }
  }
  ThrowsPlain.register('ssr-throws-plain');
  const out = await captureErrors(() => renderToString(html`<ssr-throws-plain></ssr-throws-plain>`));
  assert.match(out, /SSR failed for <ssr-throws-plain>/, 'still logs the failure');
  assert.doesNotMatch(out, /browser-only global|HTMLElement method|connectedCallback/, 'no spurious browser-member hint');
});
