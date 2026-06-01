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

test('an HTMLElement method in render yields an actionable, member-naming SSR error', async () => {
  class UsesSetAttr extends WebComponent {
    render() { this.setAttribute('x', '1'); return html`<p></p>`; }
  }
  UsesSetAttr.register('ssr-uses-setattr');
  const out = await captureErrors(() => renderToString(html`<ssr-uses-setattr></ssr-uses-setattr>`));
  assert.match(out, /`setAttribute`/, 'names the offending HTMLElement method');
  assert.match(out, /HTMLElement method/, 'explains it is an HTMLElement method');
  assert.match(out, /connectedCallback/, 'points at the fix');
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
