/**
 * End-to-end tests for SSR property bindings.
 *
 * The server emits `data-webjs-prop-<kebab>=\"<wire-encoded>\"` for
 * each `.prop=\${val}` hole, the SSR walker reads it and applies to
 * the component instance before `render()`, and the client renderer
 * applies + strips on `connectedCallback`. These tests exercise the
 * full round-trip plus rich-type handling.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { html, renderToString, WebComponent } from '../packages/core/index.js';

// Each test owns a uniquely-tagged component so registrations do not
// collide across tests. The html tag does not support interpolation
// of the tag name, so we declare the tags as string literals.

describe('SSR: property bindings round-trip via data-webjs-prop-* attributes', () => {

  test('plain object value is decoded and visible to render()', async () => {
    class UserBadge extends WebComponent {
      static properties = { user: { type: Object } };
      constructor() { super(); this.user = null; }
      render() {
        return this.user
          ? html`<span class="badge">${this.user.name}</span>`
          : html`<span class="badge">anon</span>`;
      }
    }
    UserBadge.register('user-badge-1');

    const me = { id: 42, name: 'Vivek' };
    const out = await renderToString(html`<user-badge-1 .user=${me}></user-badge-1>`);
    assert.match(out, /class="badge"/);
    assert.match(out, />Vivek</);
    // Original attribute name must not appear on the element. The
    // side-channel attribute holds the wire-encoded value.
    assert.equal(out.includes('.user='), false);
    assert.match(out, /data-webjs-prop-user="/);
  });

  test('array of objects survives, render() iterates them', async () => {
    class PostList1 extends WebComponent {
      static properties = { posts: { type: Array } };
      constructor() { super(); this.posts = []; }
      render() {
        return html`<ul>${this.posts.map((p) => html`<li>${p.title}</li>`)}</ul>`;
      }
    }
    PostList1.register('post-list-1');

    const posts = [
      { id: 1, title: 'first post' },
      { id: 2, title: 'second post' },
    ];
    const out = await renderToString(html`<post-list-1 .posts=${posts}></post-list-1>`);
    assert.match(out, /<li>first post<\/li>/);
    assert.match(out, /<li>second post<\/li>/);
  });

  test('rich types (Date, Map, Set, BigInt) round-trip via the wire serializer', async () => {
    class RichProbe extends WebComponent {
      static properties = {
        when: { type: Object },
        flags: { type: Object },
        tags: { type: Object },
        big: { type: Object },
      };
      constructor() {
        super();
        this.when = null;
        this.flags = null;
        this.tags = null;
        this.big = null;
      }
      render() {
        const parts = [];
        if (this.when instanceof Date) parts.push(`date:${this.when.getUTCFullYear()}`);
        if (this.flags instanceof Map) parts.push(`map:${this.flags.get('on')}`);
        if (this.tags instanceof Set) parts.push(`set:${[...this.tags].sort().join(',')}`);
        if (typeof this.big === 'bigint') parts.push(`big:${this.big}`);
        return html`<p>${parts.join('|')}</p>`;
      }
    }
    RichProbe.register('rich-probe-1');

    const when = new Date('2025-06-15T00:00:00Z');
    const flags = new Map([['on', 'yes']]);
    const tags = new Set(['a', 'b']);
    const big = BigInt('9007199254740993');
    const out = await renderToString(
      html`<rich-probe-1 .when=${when} .flags=${flags} .tags=${tags} .big=${big}></rich-probe-1>`,
    );
    assert.match(out, /date:2025/);
    assert.match(out, /map:yes/);
    assert.match(out, /set:a,b/);
    assert.match(out, /big:9007199254740993/);
  });

  test('property binding wins when the same name is also passed as a string attribute', async () => {
    class PriorityProbe extends WebComponent {
      static properties = { mode: { type: String } };
      constructor() { super(); this.mode = ''; }
      render() { return html`<p>${this.mode}</p>`; }
    }
    PriorityProbe.register('priority-probe-1');

    // Attribute says 'string-form', property hole says 'property-form'.
    // The property must win because it preserves the live JS reference.
    const out = await renderToString(
      html`<priority-probe-1 mode="string-form" .mode=${'property-form'}></priority-probe-1>`,
    );
    assert.match(out, /<p>property-form<\/p>/);
  });

  test('unserializable value (function) drops with a warning, does not crash SSR', async () => {
    class CallbackProbe extends WebComponent {
      static properties = { onTick: { type: Object } };
      constructor() { super(); this.onTick = null; }
      render() {
        return html`<p>${typeof this.onTick}</p>`;
      }
    }
    CallbackProbe.register('callback-probe-1');

    const fn = () => 'tick';
    // Capture and silence the expected warning.
    const orig = console.warn;
    /** @type {unknown[]} */
    const warns = [];
    console.warn = (msg) => warns.push(msg);
    let out;
    try {
      out = await renderToString(html`<callback-probe-1 .onTick=${fn}></callback-probe-1>`);
    } finally {
      console.warn = orig;
    }
    // Component still rendered, with `onTick` undefined (so typeof === 'undefined')
    assert.match(out, /<p>(undefined|object)<\/p>/);
    // No data-webjs-prop-onTick on the element (the hole was dropped).
    assert.equal(out.includes('data-webjs-prop-on-tick'), false);
    // The warning fired.
    assert.equal(warns.length, 1);
    assert.match(String(warns[0]), /unserializable/);
  });

  test('event handlers (@click) still drop at SSR', async () => {
    class ClickProbe extends WebComponent {
      render() { return html`<p>x</p>`; }
    }
    ClickProbe.register('click-probe-1');

    const out = await renderToString(
      html`<click-probe-1 @click=${() => {}}></click-probe-1>`,
    );
    // No data-webjs-prop-click leak; no @click attribute either
    assert.equal(out.includes('@click'), false);
    assert.equal(out.includes('data-webjs-prop-click'), false);
  });
});

// Client-side hydration tests live in test/client-property-bindings.test.js
// because they require linkedom globals to be installed before
// WebComponent is imported. Mixing both in this file produces an
// HTMLElement reference that doesn't match the active environment.
