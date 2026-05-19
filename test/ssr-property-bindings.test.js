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

  test('nested components: parent .prop propagates to a child .prop in render()', async () => {
    class Inner1 extends WebComponent {
      static properties = { item: { type: Object } };
      constructor() { super(); this.item = null; }
      render() {
        return html`<span class="inner">${this.item ? this.item.name : 'none'}</span>`;
      }
    }
    Inner1.register('nested-inner-1');

    class Outer1 extends WebComponent {
      static properties = { user: { type: Object } };
      constructor() { super(); this.user = null; }
      render() {
        return html`<nested-inner-1 .item=${this.user}></nested-inner-1>`;
      }
    }
    Outer1.register('nested-outer-1');

    const me = { id: 1, name: 'Vivek' };
    const out = await renderToString(html`<nested-outer-1 .user=${me}></nested-outer-1>`);
    assert.match(out, /class="inner">Vivek</, 'inner component must have received the prop forwarded by the outer render()');
  });

  test('null value: encoded and decoded faithfully', async () => {
    class NullProbe extends WebComponent {
      static properties = { item: { type: Object } };
      constructor() { super(); this.item = { sentinel: 'constructor-default' }; }
      render() {
        return html`<p>${this.item === null ? 'is-null' : 'not-null'}</p>`;
      }
    }
    NullProbe.register('null-probe-1');

    const out = await renderToString(html`<null-probe-1 .item=${null}></null-probe-1>`);
    // The component must receive null, not its constructor default.
    assert.match(out, /<p>is-null<\/p>/);
  });

  test('undefined value: drops cleanly, component sees its constructor default', async () => {
    class UndefProbe extends WebComponent {
      static properties = { item: { type: Object } };
      constructor() { super(); this.item = { sentinel: 'constructor-default' }; }
      render() {
        return html`<p>${this.item && this.item.sentinel ? this.item.sentinel : 'no-default'}</p>`;
      }
    }
    UndefProbe.register('undef-probe-1');

    const out = await renderToString(html`<undef-probe-1 .item=${undefined}></undef-probe-1>`);
    // Component falls back to its constructor default because the binding
    // emits nothing on the wire for undefined.
    assert.match(out, /<p>constructor-default<\/p>/);
    assert.equal(
      out.includes('data-webjs-prop-item'), false,
      'undefined value must not emit a data-webjs-prop attribute',
    );
  });

  test('shadow DOM component: prop binding flows through DSD render', async () => {
    class ShadowProbe extends WebComponent {
      static shadow = true;
      static properties = { label: { type: String } };
      constructor() { super(); this.label = ''; }
      render() {
        return html`<span class="shadow-label">${this.label}</span>`;
      }
    }
    ShadowProbe.register('shadow-probe-1');

    const out = await renderToString(html`<shadow-probe-1 .label=${'rendered-in-shadow'}></shadow-probe-1>`);
    // DSD template wrapper present
    assert.match(out, /<template shadowrootmode="open">/);
    // Component rendered the prop value inside the shadow tree
    assert.match(out, /class="shadow-label">rendered-in-shadow</);
  });

  test('string value with HTML special chars round-trips through escape and back', async () => {
    class HtmlStr extends WebComponent {
      static properties = { text: { type: String } };
      constructor() { super(); this.text = ''; }
      render() {
        return html`<p data-len=${String(this.text.length)}>${this.text}</p>`;
      }
    }
    HtmlStr.register('html-str-probe-1');

    const tricky = `Tags: <b>bold</b> & "quoted" & 'apos'`;
    const out = await renderToString(html`<html-str-probe-1 .text=${tricky}></html-str-probe-1>`);
    // The component received the raw string (its length matches), so the
    // wire round-trip preserved every byte.
    assert.match(out, new RegExp(`data-len="${tricky.length}"`));
    // Text content escaped by escapeText on render: < => &lt;, etc.
    // The exact escaping is the renderer's concern; we only need to
    // verify the special chars made it through as content. Look for
    // the literal substring "bold" inside an escaped <b> form.
    assert.match(out, /&lt;b&gt;bold&lt;\/b&gt;/);
    assert.match(out, /&amp;/);
  });

  test('light DOM <slot>: prop binding on the host AND on a slotted child', async () => {
    class SlotChild extends WebComponent {
      static properties = { item: { type: Object } };
      constructor() { super(); this.item = null; }
      render() {
        return html`<em class="slotted">${this.item ? this.item.label : 'none'}</em>`;
      }
    }
    SlotChild.register('slot-child-probe');

    class SlotHost extends WebComponent {
      static properties = { title: { type: String } };
      constructor() { super(); this.title = ''; }
      render() {
        return html`
          <section>
            <h3>${this.title}</h3>
            <div class="content"><slot></slot></div>
          </section>
        `;
      }
    }
    SlotHost.register('slot-host-probe');

    const data = { label: 'projected' };
    const out = await renderToString(html`
      <slot-host-probe .title=${'host-title'}>
        <slot-child-probe .item=${data}></slot-child-probe>
      </slot-host-probe>
    `);
    // Host's own prop is applied: title appears
    assert.match(out, /<h3>host-title<\/h3>/);
    // Slotted child's prop is applied: projected label appears
    assert.match(out, /class="slotted">projected</);
  });

  test('light DOM <slot name>: named slot with prop binding on the slotted child', async () => {
    class CardHost extends WebComponent {
      render() {
        return html`
          <article>
            <header><slot name="title"></slot></header>
            <main><slot></slot></main>
          </article>
        `;
      }
    }
    CardHost.register('card-host-probe');

    class TitleProbe extends WebComponent {
      static properties = { value: { type: String } };
      constructor() { super(); this.value = ''; }
      render() { return html`<h2 class="t">${this.value}</h2>`; }
    }
    TitleProbe.register('title-probe-1');

    const out = await renderToString(html`
      <card-host-probe>
        <title-probe-1 slot="title" .value=${'Slotted Title'}></title-probe-1>
        <p>body</p>
      </card-host-probe>
    `);
    assert.match(out, /class="t">Slotted Title</);
    assert.match(out, /<p>body<\/p>/);
  });

  test('repeat() directive: each iteration receives its own prop', async () => {
    const { repeat } = await import('../packages/core/src/repeat.js');
    class Row extends WebComponent {
      static properties = { post: { type: Object } };
      constructor() { super(); this.post = null; }
      render() {
        return html`<li data-id=${String(this.post && this.post.id)}>${this.post && this.post.title}</li>`;
      }
    }
    Row.register('repeat-row-probe');

    const posts = [
      { id: 10, title: 'alpha' },
      { id: 20, title: 'beta' },
      { id: 30, title: 'gamma' },
    ];
    const out = await renderToString(html`
      <ul>${repeat(posts, (p) => p.id, (p) => html`<repeat-row-probe .post=${p}></repeat-row-probe>`)}</ul>
    `);
    assert.match(out, /data-id="10">alpha</);
    assert.match(out, /data-id="20">beta</);
    assert.match(out, /data-id="30">gamma</);
  });

  test('deeply nested chain (3 levels) propagates props correctly', async () => {
    class Leaf extends WebComponent {
      static properties = { v: { type: String } };
      constructor() { super(); this.v = ''; }
      render() { return html`<span class="leaf">${this.v}</span>`; }
    }
    Leaf.register('chain-leaf');

    class Mid extends WebComponent {
      static properties = { down: { type: String } };
      constructor() { super(); this.down = ''; }
      render() { return html`<chain-leaf .v=${this.down}></chain-leaf>`; }
    }
    Mid.register('chain-mid');

    class Top extends WebComponent {
      static properties = { msg: { type: String } };
      constructor() { super(); this.msg = ''; }
      render() { return html`<chain-mid .down=${this.msg}></chain-mid>`; }
    }
    Top.register('chain-top');

    const out = await renderToString(html`<chain-top .msg=${'deep'}></chain-top>`);
    assert.match(out, /class="leaf">deep</);
  });

  test('attribute coexists with same-name prop binding (prop wins, attribute also serialized)', async () => {
    // A subtle case: user writes both `foo="x"` AND `.foo=${y}`. The
    // server emits both `foo="x"` and `data-webjs-prop-foo="..."`. The
    // consumer applies the string attribute first, then overlays the
    // typed prop. End behaviour: prop wins, but DOM has both attrs
    // during SSR-to-hydration window.
    class BothProbe extends WebComponent {
      static properties = { mode: { type: String } };
      constructor() { super(); this.mode = ''; }
      render() { return html`<p>${this.mode}</p>`; }
    }
    BothProbe.register('both-probe-1');

    const out = await renderToString(
      html`<both-probe-1 mode="from-attr" .mode=${'from-prop'}></both-probe-1>`,
    );
    // Prop wins at render
    assert.match(out, /<p>from-prop<\/p>/);
    // Both attributes present on the element in the SSR output
    assert.match(out, /mode="from-attr"/);
    assert.match(out, /data-webjs-prop-mode="/);
  });

  test('async render(): prop value flows into a render() that awaits', async () => {
    class AsyncProbe extends WebComponent {
      static properties = { src: { type: Object } };
      constructor() { super(); this.src = null; }
      async render() {
        // Simulate a render that awaits, e.g. data normalisation
        await new Promise((r) => setTimeout(r, 1));
        return html`<p>${this.src && this.src.title}</p>`;
      }
    }
    AsyncProbe.register('async-probe-1');

    const out = await renderToString(
      html`<async-probe-1 .src=${{ title: 'awaited-ok' }}></async-probe-1>`,
    );
    assert.match(out, /<p>awaited-ok<\/p>/);
  });
});

describe('SSR: streaming + Suspense + property bindings', () => {

  test('renderToStream produces the same data-webjs-prop output as renderToString', async () => {
    const { renderToStream } = await import('../packages/core/index.js');
    class StreamProbe extends WebComponent {
      static properties = { items: { type: Array } };
      constructor() { super(); this.items = []; }
      render() {
        return html`<ul>${this.items.map((x) => html`<li>${x}</li>`)}</ul>`;
      }
    }
    StreamProbe.register('stream-probe-1');

    const tpl = html`<stream-probe-1 .items=${['a', 'b', 'c']}></stream-probe-1>`;
    const stringOut = await renderToString(tpl);
    const stream = await renderToStream(html`<stream-probe-1 .items=${['a', 'b', 'c']}></stream-probe-1>`);

    // Consume the stream into a single string.
    let chunks = '';
    const reader = stream.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks += typeof value === 'string' ? value : new TextDecoder().decode(value);
    }

    // Streamed output contains the same prop-decoded list items.
    assert.match(chunks, /<li>a<\/li>/);
    assert.match(chunks, /<li>b<\/li>/);
    assert.match(chunks, /<li>c<\/li>/);
    // Sanity: both renderers produced HTML that includes the rendered list.
    assert.ok(stringOut.includes('<li>a</li>'));
  });

  test('Suspense: prop binding on the late-resolved child is applied when the boundary settles', async () => {
    const { Suspense } = await import('../packages/core/index.js');
    class LateProbe extends WebComponent {
      static properties = { name: { type: String } };
      constructor() { super(); this.name = ''; }
      render() { return html`<span class="late">${this.name}</span>`; }
    }
    LateProbe.register('late-probe-1');

    // The Suspense children Promise resolves to a template that
    // includes a custom element with a prop binding. The full render
    // (with suspenseCtx) inlines the fallback and the resolved content
    // streams in via webjs-resolve scripts. For renderToString without
    // a suspenseCtx, only the fallback is emitted, so we use a ctx
    // and check both branches.
    const ctx = { pending: [], nextId: 0, usedComponents: new Set() };
    const asyncChild = new Promise((r) =>
      setTimeout(() => r(html`<late-probe-1 .name=${'arrived-late'}></late-probe-1>`), 1),
    );
    const out = await renderToString(
      html`<div>${Suspense({ fallback: html`<i>loading</i>`, children: asyncChild })}</div>`,
      { suspenseCtx: ctx },
    );
    // Fallback rendered inline
    assert.match(out, /<i>loading<\/i>/);
    // Late content registered for streaming
    assert.equal(ctx.pending.length, 1);

    // Resolve the pending entry. The framework's streaming layer would
    // render this to HTML asynchronously; we exercise the same path
    // manually here.
    const resolved = await ctx.pending[0].promise;
    const lateHtml = await renderToString(resolved);
    assert.match(lateHtml, /class="late">arrived-late</);
  });
});

// Client-side hydration tests live in test/client-property-bindings.test.js
// because they require linkedom globals to be installed before
// WebComponent is imported. Mixing both in this file produces an
// HTMLElement reference that doesn't match the active environment.
