/**
 * SSR half of bare-await async render (#469).
 *
 * On the server an async (promise-returning) render() is awaited, so the
 * resolved DATA is baked into the first paint with no fallback markup. A
 * render that throws is isolated PER COMPONENT: the failing element renders a
 * component-scoped error state (renderError() if defined, else a dev-visible
 * box / a silent empty element in prod) while its siblings render normally,
 * and the error never bubbles to the route error.js.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WebComponent } from '../../src/component.js';
import { html } from '../../src/html.js';
import { renderToString } from '../../src/render-server.js';

/** Run `fn` with console.error swallowed (the boundary logs every throw). */
async function quiet(fn) {
  const orig = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = orig;
  }
}

test('async render() bakes resolved data into the first paint, no fallback', async () => {
  class UserProfile extends WebComponent {
    static properties = { uid: { type: String } };
    constructor() { super(); this.uid = ''; }
    renderFallback() { return html`<div class="skeleton">loading</div>`; }
    async render() {
      const name = await Promise.resolve(`User ${this.uid}`);
      return html`<h3>${name}</h3>`;
    }
  }
  UserProfile.register('user-profile-ssr');

  const out = await renderToString(html`<user-profile-ssr uid="42"></user-profile-ssr>`);
  assert.match(out, /User 42/, 'the resolved data is in the SSR HTML');
  assert.doesNotMatch(out, /skeleton/, 'renderFallback() is NOT emitted on first paint');
  assert.doesNotMatch(out, /webjs-boundary/, 'an unwrapped async component does not emit a streaming boundary');
});

test('a throwing async render renders renderError() output, isolated from siblings', async () => {
  class GoodCard extends WebComponent {
    async render() { return html`<p class="good">ok</p>`; }
  }
  GoodCard.register('good-card-ssr');

  class BadCard extends WebComponent {
    async render() { throw new Error('boom from getData'); }
    renderError(error) { return html`<p class="bad">failed: ${error.message}</p>`; }
  }
  BadCard.register('bad-card-ssr');

  const out = await quiet(() =>
    renderToString(html`<good-card-ssr></good-card-ssr><bad-card-ssr></bad-card-ssr><good-card-ssr></good-card-ssr>`),
  );
  // Sibling good cards still render.
  assert.equal((out.match(/class="good"/g) || []).length, 2, 'both sibling good cards rendered');
  // The bad card renders its component-scoped error UI.
  assert.match(out, /failed: boom from getData/, 'the failing component shows its renderError() output');
});

test('a throwing async render with no renderError() shows a dev error box', async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    class NoBoundary extends WebComponent {
      async render() { throw new Error('kaboom'); }
    }
    NoBoundary.register('no-boundary-dev');
    const out = await quiet(() => renderToString(html`<no-boundary-dev></no-boundary-dev>`));
    assert.match(out, /failed to render/, 'the dev default error box is shown');
    assert.match(out, /kaboom/, 'the dev box surfaces the message');
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test('in prod a throwing async render with no renderError() renders an empty element (no leak)', async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    class NoBoundaryProd extends WebComponent {
      async render() { throw new Error('secret internal detail'); }
    }
    NoBoundaryProd.register('no-boundary-prod');
    const out = await quiet(() => renderToString(html`<no-boundary-prod></no-boundary-prod>`));
    assert.doesNotMatch(out, /secret internal detail/, 'the error message never reaches the client in prod');
    assert.match(out, /<no-boundary-prod><!--webjs-hydrate--><\/no-boundary-prod>/, 'an empty, isolated element is emitted');
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test('a sync render() throw is isolated the same way (not just async)', async () => {
  class SyncBad extends WebComponent {
    render() { throw new Error('sync boom'); }
    renderError(error) { return html`<span class="syncerr">${error.message}</span>`; }
  }
  SyncBad.register('sync-bad-ssr');
  const out = await quiet(() => renderToString(html`<sync-bad-ssr></sync-bad-ssr>`));
  assert.match(out, /sync boom/, 'a sync render throw also renders renderError()');
});
