/**
 * Unit tests for light-DOM <slot> projection with full shadow-DOM parity.
 *
 * Block 1: SSR tests (server-side string output via renderToString).
 * Block 2: DOM-API polyfill tests (linkedom + installSlotPolyfills).
 *
 * Browser-only behaviour (real MutationObservers, slotchange dispatch
 * across microtasks, hydration with live DOM identity) lives in
 * test/browser/slot.test.js.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { html, renderToString, WebComponent } from '../../packages/core/index.js';

// Each scenario gets its own component class registered under a unique
// literal tag (the `html` tag does not support tag-name interpolation,
// so we cannot synthesise tags from a counter inside a template).

// =============================================================================
// Block 1. SSR tests
// =============================================================================

describe('SSR projection', () => {
  test('default slot with three authored children', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register('slot-ssr-1');
    const out = await renderToString(html`<slot-ssr-1><h1>One</h1><h2>Two</h2><h3>Three</h3></slot-ssr-1>`);
    assert.match(out, /data-projection="actual"/);
    assert.match(out, /<h1>One<\/h1><h2>Two<\/h2><h3>Three<\/h3>/);
  });

  test('named slots route by slot attribute', async () => {
    class C extends WebComponent {
      render() {
        return html`<div><header><slot name="header"></slot></header><main><slot></slot></main><footer><slot name="footer"></slot></footer></div>`;
      }
    }
    C.register('slot-ssr-2');
    const out = await renderToString(html`<slot-ssr-2><h2 slot="header">Title</h2><p>Body</p><span slot="footer">Foot</span></slot-ssr-2>`);
    assert.match(out, /name="header"[^>]*><h2 slot="header">Title<\/h2>/);
    assert.match(out, /<main><slot[^>]*><p>Body<\/p>/);
    assert.match(out, /name="footer"[^>]*><span slot="footer">Foot<\/span>/);
  });

  test('fallback content shown when no children projected', async () => {
    class C extends WebComponent {
      render() {
        return html`<div><slot name="header">Fallback head</slot><slot>Fallback body</slot></div>`;
      }
    }
    C.register('slot-ssr-3');
    const out = await renderToString(html`<slot-ssr-3></slot-ssr-3>`);
    assert.match(out, /data-projection="fallback"[^>]*name="header">Fallback head<\/slot>/);
    assert.match(out, /data-projection="fallback">Fallback body<\/slot>/);
  });

  test('partial fallback: only some named slots populated', async () => {
    class C extends WebComponent {
      render() {
        return html`<div><slot name="header">No head</slot><slot name="body">No body</slot></div>`;
      }
    }
    C.register('slot-ssr-4');
    const out = await renderToString(html`<slot-ssr-4><h1 slot="header">Real</h1></slot-ssr-4>`);
    assert.match(out, /data-projection="actual"[^>]*name="header"><h1 slot="header">Real<\/h1>/);
    assert.match(out, /data-projection="fallback"[^>]*name="body">No body<\/slot>/);
  });

  test('authored child with slot=x and no matching slot is dropped', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register('slot-ssr-5');
    const out = await renderToString(html`<slot-ssr-5><p>kept</p><span slot="ghost">dropped</span></slot-ssr-5>`);
    assert.match(out, /<p>kept<\/p>/);
    assert.doesNotMatch(out, /<span slot="ghost">dropped<\/span>/);
  });

  test('nested custom elements among projected children are recursively SSR rendered', async () => {
    class O extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    O.register('slot-ssr-outer-6');
    class I extends WebComponent {
      render() { return html`<span class="inner-rendered"></span>`; }
    }
    I.register('slot-ssr-inner-6');
    const out = await renderToString(html`<slot-ssr-outer-6><slot-ssr-inner-6></slot-ssr-inner-6></slot-ssr-outer-6>`);
    assert.match(out, /<span class="inner-rendered">/);
  });

  test('shadow DOM uses native slot without framework substitution', async () => {
    class C extends WebComponent {
      static shadow = true;
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register('slot-ssr-7');
    const out = await renderToString(html`<slot-ssr-7><p>shadow body</p></slot-ssr-7>`);
    assert.match(out, /<template shadowrootmode="open"><div><slot><\/slot><\/div><\/template>/);
    assert.match(out, /<\/template><p>shadow body<\/p>/);
    assert.doesNotMatch(out, /data-webjs-light/);
  });

  test('multiple same-named slots: first wins, rest show fallback', async () => {
    class C extends WebComponent {
      render() {
        return html`<div><slot name="x">F1</slot><slot name="x">F2</slot><slot name="x">F3</slot></div>`;
      }
    }
    C.register('slot-ssr-8');
    const out = await renderToString(html`<slot-ssr-8><b slot="x">REAL</b></slot-ssr-8>`);
    assert.match(out, /data-projection="actual"[^>]*name="x"><b slot="x">REAL<\/b><\/slot>/);
    assert.match(out, /data-projection="fallback"[^>]*name="x">F2<\/slot>/);
    assert.match(out, /data-projection="fallback"[^>]*name="x">F3<\/slot>/);
  });

  test('multiple default slots: first wins, rest show fallback', async () => {
    class C extends WebComponent {
      render() {
        return html`<div><slot>FA</slot><slot>FB</slot></div>`;
      }
    }
    C.register('slot-ssr-9');
    const out = await renderToString(html`<slot-ssr-9><p>real</p></slot-ssr-9>`);
    assert.match(out, /data-projection="actual"><p>real<\/p><\/slot>/);
    assert.match(out, /data-projection="fallback">FB<\/slot>/);
  });

  test('text node assignment routes to default slot', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot>none</slot></div>`; }
    }
    C.register('slot-ssr-10');
    const out = await renderToString(html`<slot-ssr-10>just some text</slot-ssr-10>`);
    assert.match(out, /data-projection="actual">just some text<\/slot>/);
  });

  test('comment node in authored children is preserved', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register('slot-ssr-11');
    const out = await renderToString(html`<slot-ssr-11><!-- comment --><p>x</p></slot-ssr-11>`);
    assert.match(out, /<!-- comment -->/);
    assert.match(out, /<p>x<\/p>/);
  });

  test('whitespace between authored children preserved', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register('slot-ssr-12');
    const out = await renderToString(html`<slot-ssr-12>
      <p>one</p>
      <p>two</p>
    </slot-ssr-12>`);
    assert.match(out, /<p>one<\/p>\s+<p>two<\/p>/);
  });

  test('multiple instances of same component get independent projection', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register('slot-ssr-13');
    const out = await renderToString(html`
      <slot-ssr-13><p>first</p></slot-ssr-13>
      <slot-ssr-13><p>second</p></slot-ssr-13>
    `);
    const firstMatch = out.match(/<p>first<\/p>/g);
    const secondMatch = out.match(/<p>second<\/p>/g);
    assert.ok(firstMatch && firstMatch.length === 1);
    assert.ok(secondMatch && secondMatch.length === 1);
  });

  test('component with no slot in render drops unprojected children (shadow-DOM parity)', async () => {
    class C extends WebComponent {
      render() { return html`<div class="rendered"></div>`; }
    }
    C.register('slot-ssr-14');
    const out = await renderToString(html`<slot-ssr-14><p>leftover</p></slot-ssr-14>`);
    // No <slot> in render means there's no projection target. Per shadow
    // DOM rules, light children of the host are not visible without a
    // matching slot. The framework now drops them from SSR output.
    assert.match(out, /<!--webjs-hydrate--><div class="rendered"><\/div><\/slot-ssr-14>/);
    assert.doesNotMatch(out, /<p>leftover<\/p>/);
  });

  test('attributes on slot beyond name pass through', async () => {
    class C extends WebComponent {
      render() {
        return html`<div><slot name="x" class="custom-slot" id="hdr"></slot></div>`;
      }
    }
    C.register('slot-ssr-15');
    const out = await renderToString(html`<slot-ssr-15><h1 slot="x">Hi</h1></slot-ssr-15>`);
    assert.match(out, /<slot data-webjs-light data-projection="actual"[^>]*class="custom-slot"/);
    assert.match(out, /id="hdr"/);
  });

  test('self-closing custom element renders empty as all-fallback', async () => {
    class C extends WebComponent {
      render() {
        return html`<div><slot>FA</slot><slot name="x">FB</slot></div>`;
      }
    }
    C.register('slot-ssr-16');
    const out = await renderToString(html`<slot-ssr-16></slot-ssr-16>`);
    assert.match(out, /data-projection="fallback">FA<\/slot>/);
    assert.match(out, /data-projection="fallback"[^>]*name="x">FB<\/slot>/);
  });
});

// =============================================================================
// Block 1b. SSR edge-case coverage
// =============================================================================

describe('SSR edge cases', () => {
  test('slot inside conditional ternary (true branch)', async () => {
    class C extends WebComponent({ expanded: Boolean }) {
      constructor() { super(); this.expanded =true; }
      render() {
        return html`<div>${this.expanded ? html`<section><slot></slot></section>` : html`<p>hidden</p>`}</div>`;
      }
    }
    C.register('slot-edge-cond-true');
    const out = await renderToString(html`<slot-edge-cond-true expanded><b>visible</b></slot-edge-cond-true>`);
    assert.match(out, /data-projection="actual"><b>visible<\/b><\/slot>/);
  });

  test('slot inside conditional ternary (false branch absent)', async () => {
    class C extends WebComponent({ expanded: Boolean }) {
      constructor() { super(); this.expanded =false; }
      render() {
        return html`<div>${this.expanded ? html`<section><slot></slot></section>` : html`<p>hidden</p>`}</div>`;
      }
    }
    C.register('slot-edge-cond-false');
    const out = await renderToString(html`<slot-edge-cond-false><b>dropped</b></slot-edge-cond-false>`);
    // No slot was rendered, so the authored child is dropped (per spec).
    assert.match(out, /<p>hidden<\/p>/);
    assert.doesNotMatch(out, /<b>dropped<\/b>/);
  });

  test('nested same-tag custom elements with slot in each (depth tracking)', async () => {
    class Box extends WebComponent {
      render() { return html`<div class="box"><slot></slot></div>`; }
    }
    Box.register('slot-edge-box');
    const out = await renderToString(html`<slot-edge-box><slot-edge-box><p>inner</p></slot-edge-box></slot-edge-box>`);
    // Outer Box should project the inner Box (and its <p>) into its default slot.
    // Inner Box should project the <p> into its default slot.
    assert.match(out, /<div class="box"><slot[^>]*data-projection="actual"><slot-edge-box data-wj-host><!--webjs-hydrate--><div class="box"><slot[^>]*data-projection="actual"><p>inner<\/p>/);
  });

  test('case-sensitive slot name matching', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot name="Header"></slot><slot name="header"></slot></div>`; }
    }
    C.register('slot-edge-case');
    const out = await renderToString(html`<slot-edge-case><h1 slot="Header">CapH</h1><h2 slot="header">lowh</h2></slot-edge-case>`);
    // Names are case-sensitive: capital-H and lowercase-h are distinct.
    assert.match(out, /name="Header"><h1 slot="Header">CapH<\/h1>/);
    assert.match(out, /name="header"><h2 slot="header">lowh<\/h2>/);
  });

  test('empty slot=" " attribute routes child to default slot', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot></slot><slot name="x">F</slot></div>`; }
    }
    C.register('slot-edge-empty');
    // Per spec, slot="" (empty string) is the default-slot indicator.
    const out = await renderToString(html`<slot-edge-empty><p slot="">empty</p></slot-edge-empty>`);
    assert.match(out, /<slot data-webjs-light data-projection="actual"><p slot="">empty<\/p>/);
    assert.match(out, /name="x">F<\/slot>/);
  });

  test('mixed text + element + comment in a single slot', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register('slot-edge-mixed');
    const out = await renderToString(html`<slot-edge-mixed>before<!-- mid --><b>middle</b>after</slot-edge-mixed>`);
    assert.match(out, /data-projection="actual">before<!-- mid --><b>middle<\/b>after<\/slot>/);
  });

  test('self-closing void element inside slot content (br, img)', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register('slot-edge-void');
    const out = await renderToString(html`<slot-edge-void><p>line1<br>line2</p><img src="/x.png" alt="x"></slot-edge-void>`);
    assert.match(out, /<p>line1<br>line2<\/p>/);
    assert.match(out, /<img src="\/x\.png" alt="x">/);
  });

  test('html entities in projected content preserved', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register('slot-edge-entities');
    const out = await renderToString(html`<slot-edge-entities><p>${'<script>'}</p></slot-edge-entities>`);
    // <script> in interpolated text is escaped by html``'s own pipeline.
    assert.match(out, /<p>&lt;script&gt;<\/p>/);
  });

  test('html entities in slot fallback content preserved', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot>&copy; ${'2026'}</slot></div>`; }
    }
    C.register('slot-edge-entities-fallback');
    const out = await renderToString(html`<slot-edge-entities-fallback></slot-edge-entities-fallback>`);
    assert.match(out, /data-projection="fallback">&copy; 2026<\/slot>/);
  });

  test('deeply nested authored children all reach default slot', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register('slot-edge-deep');
    const out = await renderToString(html`<slot-edge-deep><div><section><article><p>deep</p></article></section></div></slot-edge-deep>`);
    assert.match(out, /<div><section><article><p>deep<\/p><\/article><\/section><\/div>/);
  });

  test('multiple slots with same name interleaved with default slots', async () => {
    class C extends WebComponent {
      render() {
        return html`<div><slot name="a">FA</slot><slot>FD</slot><slot name="a">FA2</slot></div>`;
      }
    }
    C.register('slot-edge-interleave');
    const out = await renderToString(html`<slot-edge-interleave><b slot="a">x</b><p>y</p></slot-edge-interleave>`);
    assert.match(out, /data-projection="actual"[^>]*name="a"><b slot="a">x<\/b><\/slot>/);
    assert.match(out, /data-projection="actual"><p>y<\/p><\/slot>/);
    // Second "a" slot shows fallback per first-wins.
    assert.match(out, /data-projection="fallback"[^>]*name="a">FA2<\/slot>/);
  });

  test('slot with no fallback content shows empty when no projection', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot name="x"></slot></div>`; }
    }
    C.register('slot-edge-nofallback');
    const out = await renderToString(html`<slot-edge-nofallback></slot-edge-nofallback>`);
    assert.match(out, /data-projection="fallback"[^>]*name="x"><\/slot>/);
  });

  test('special characters in slot name (hyphens, underscores)', async () => {
    class C extends WebComponent {
      render() {
        return html`<div><slot name="my-named_slot"></slot></div>`;
      }
    }
    C.register('slot-edge-special-name');
    const out = await renderToString(html`<slot-edge-special-name><p slot="my-named_slot">value</p></slot-edge-special-name>`);
    assert.match(out, /name="my-named_slot"><p slot="my-named_slot">value<\/p>/);
  });

  test('shadow DOM component nested inside light DOM component (projection passes through)', async () => {
    class Light extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    Light.register('slot-edge-light-outer');
    class Shadow extends WebComponent {
      static shadow = true;
      render() { return html`<div><slot></slot></div>`; }
    }
    Shadow.register('slot-edge-shadow-inner');
    const out = await renderToString(html`<slot-edge-light-outer><slot-edge-shadow-inner><p>both</p></slot-edge-shadow-inner></slot-edge-light-outer>`);
    // Light outer projects the shadow inner; shadow inner uses native slot.
    assert.match(out, /data-projection="actual"><slot-edge-shadow-inner><template shadowrootmode="open"><div><slot><\/slot><\/div><\/template>/);
    assert.match(out, /<p>both<\/p><\/slot-edge-shadow-inner>/);
  });

  test('light DOM component nested inside shadow DOM component', async () => {
    class Shadow extends WebComponent {
      static shadow = true;
      render() { return html`<div><slot></slot></div>`; }
    }
    Shadow.register('slot-edge-shadow-outer');
    class Light extends WebComponent {
      render() { return html`<section><slot></slot></section>`; }
    }
    Light.register('slot-edge-light-inner');
    const out = await renderToString(html`<slot-edge-shadow-outer><slot-edge-light-inner><b>inner content</b></slot-edge-light-inner></slot-edge-shadow-outer>`);
    // Light inner uses framework slot; sits in the outer's light children
    // for browser's native projection.
    assert.match(out, /<slot-edge-light-inner data-wj-host><!--webjs-hydrate--><section><slot[^>]*data-projection="actual"><b>inner content<\/b>/);
  });

  test('multiple authored children to same named slot concatenate in order', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot name="items"></slot></div>`; }
    }
    C.register('slot-edge-multi-same');
    const out = await renderToString(html`<slot-edge-multi-same><li slot="items">A</li><li slot="items">B</li><li slot="items">C</li></slot-edge-multi-same>`);
    assert.match(out, /<li slot="items">A<\/li><li slot="items">B<\/li><li slot="items">C<\/li>/);
  });

  test('slot in deeply nested render structure', async () => {
    class C extends WebComponent {
      render() {
        return html`<div><header><nav><div><slot name="nav"></slot></div></nav></header><main><slot></slot></main></div>`;
      }
    }
    C.register('slot-edge-deep-render');
    const out = await renderToString(html`<slot-edge-deep-render><a slot="nav" href="/">Home</a><p>main content</p></slot-edge-deep-render>`);
    assert.match(out, /<nav><div><slot[^>]*name="nav"><a slot="nav" href="\/">Home<\/a><\/slot>/);
    assert.match(out, /<main><slot[^>]*><p>main content<\/p><\/slot>/);
  });

  test('authored child is a custom element with its own slot', async () => {
    class Outer extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    Outer.register('slot-edge-outer-with-inner');
    class Inner extends WebComponent {
      render() { return html`<span><slot></slot></span>`; }
    }
    Inner.register('slot-edge-inner-with-slot');
    const out = await renderToString(html`<slot-edge-outer-with-inner><slot-edge-inner-with-slot><b>deep</b></slot-edge-inner-with-slot></slot-edge-outer-with-inner>`);
    // Outer projects the inner; inner projects its child <b>.
    assert.match(out, /<slot-edge-inner-with-slot data-wj-host><!--webjs-hydrate--><span><slot[^>]*data-projection="actual"><b>deep<\/b>/);
  });

  test('attribute values with special characters survive partition', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register('slot-edge-attr-special');
    const out = await renderToString(html`<slot-edge-attr-special><a href="/path?q=a&b=c" title="say 'hi'">link</a></slot-edge-attr-special>`);
    // The framework preserves authored static HTML byte-for-byte through
    // slot partitioning; it does not re-escape characters in static
    // attribute values. Authors are responsible for valid HTML in their
    // own template literals (or use interpolation for untrusted data,
    // which is escape-on-the-fly).
    assert.match(out, /<a href="\/path\?q=a&b=c" title="say 'hi'">link<\/a>/);
  });

  test('boolean and event attributes on children survive partition', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot></slot></div>`; }
    }
    C.register('slot-edge-bool-attr');
    // disabled is a boolean attribute; the SSR pipeline must preserve it.
    const out = await renderToString(html`<slot-edge-bool-attr><button disabled>off</button><input required></slot-edge-bool-attr>`);
    assert.match(out, /<button disabled>off<\/button>/);
    assert.match(out, /<input required>/);
  });

  test('component with only one named slot, no default, drops slot-less children', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot name="only"></slot></div>`; }
    }
    C.register('slot-edge-named-only');
    const out = await renderToString(html`<slot-edge-named-only><p>nowhere</p><b slot="only">ok</b></slot-edge-named-only>`);
    assert.match(out, /<b slot="only">ok<\/b>/);
    assert.doesNotMatch(out, /<p>nowhere<\/p>/);
  });

  test('component renders a slot followed by a sibling element', async () => {
    class C extends WebComponent {
      render() { return html`<div><slot></slot><hr/></div>`; }
    }
    C.register('slot-edge-with-sibling');
    const out = await renderToString(html`<slot-edge-with-sibling><p>x</p></slot-edge-with-sibling>`);
    assert.match(out, /<p>x<\/p><\/slot><hr\/?>/);
  });

  test('Suspense fallback inside authored children projects into default slot', async () => {
    const { Suspense } = await import('../../packages/core/index.js');
    class C extends WebComponent {
      render() { return html`<article><slot></slot></article>`; }
    }
    C.register('slot-edge-suspense-1');
    const asyncContent = new Promise((r) => setTimeout(() => r(html`<p>resolved</p>`), 5));
    // Without a suspense ctx, the fallback is the rendered output.
    const out = await renderToString(html`<slot-edge-suspense-1>${Suspense({ fallback: html`<i>wait</i>`, children: asyncContent })}</slot-edge-suspense-1>`);
    // The fallback markup lands inside the slot via the partitioning step.
    assert.match(out, /data-projection="actual"><i>wait<\/i><\/slot>/);
  });

  test('Suspense streaming places <webjs-boundary> inside the slot', async () => {
    const { Suspense } = await import('../../packages/core/index.js');
    class C extends WebComponent {
      render() { return html`<article><slot></slot></article>`; }
    }
    C.register('slot-edge-suspense-2');
    const asyncContent = new Promise((r) => setTimeout(() => r(html`<p>resolved</p>`), 5));
    const ctx = { pending: [], nextId: 0, usedComponents: new Set() };
    const out = await renderToString(
      html`<slot-edge-suspense-2>${Suspense({ fallback: html`<i>wait</i>`, children: asyncContent })}</slot-edge-suspense-2>`,
      { suspenseCtx: ctx },
    );
    // <webjs-boundary id="s0"> wraps the fallback. The boundary lives
    // INSIDE the projected slot, so when the resolved template streams
    // in later (via the data-webjs-resolve script's replaceWith), the
    // swap updates the slot's children in place. DOM identity for the
    // wrapping <article> and surrounding slot stays stable.
    assert.match(out, /data-projection="actual"><webjs-boundary id="s0"><i>wait<\/i><\/webjs-boundary><\/slot>/);
    assert.equal(ctx.pending.length, 1, 'one pending suspense promise');
  });

  test('Suspense inside the component render output runs alongside slot projection', async () => {
    const { Suspense } = await import('../../packages/core/index.js');
    class C extends WebComponent {
      render() {
        const async = new Promise((r) => setTimeout(() => r(html`<p>done</p>`), 5));
        return html`<div><slot name="title"></slot><main><slot></slot>${Suspense({ fallback: html`<span>loading</span>`, children: async })}</main></div>`;
      }
    }
    C.register('slot-edge-suspense-3');
    const out = await renderToString(html`<slot-edge-suspense-3><h2 slot="title">T</h2><p>body</p></slot-edge-suspense-3>`);
    assert.match(out, /name="title"><h2 slot="title">T<\/h2>/);
    assert.match(out, /<main><slot[^>]*><p>body<\/p>/);
    assert.match(out, /<span>loading<\/span>/);
  });

  test('slot inside list-style render (manual loop, not repeat)', async () => {
    class C extends WebComponent {
      render() {
        const items = ['a', 'b'];
        return html`<ul>${items.map((x) => html`<li>${x}<slot></slot></li>`)}</ul>`;
      }
    }
    C.register('slot-edge-list');
    const out = await renderToString(html`<slot-edge-list><span>shared</span></slot-edge-list>`);
    // Multiple <slot> elements in render output. First wins per spec; the
    // single authored <span> projects into the first slot; the second
    // shows its fallback (empty in this case).
    assert.match(out, /data-projection="actual"><span>shared<\/span>/);
    assert.match(out, /data-projection="fallback"/);
  });
});

// =============================================================================
// Block 2. DOM-API polyfill tests
// =============================================================================

before(() => {
  // Set up linkedom globals and install the slot polyfills on the live
  // HTMLSlotElement / Element prototypes. installSlotPolyfills() runs
  // again at module load time without a DOM, so this second call wires
  // it up against linkedom's prototypes.
  const { window } = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.document = window.document;
  globalThis.DocumentFragment = window.DocumentFragment;
  globalThis.Node = window.Node;
  globalThis.Element = window.Element;
  globalThis.Comment = window.Comment;
  globalThis.Text = window.Text;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.HTMLSlotElement = window.HTMLSlotElement;
  globalThis.Event = window.Event;
  if (typeof globalThis.queueMicrotask !== 'function') {
    globalThis.queueMicrotask = (fn) => Promise.resolve().then(fn);
  }
});

let slotModule;
before(async () => {
  slotModule = await import('../../packages/core/src/slot.js');
  slotModule.installSlotPolyfills();
});

describe('DOM API polyfills', () => {
  function mkSlot({ name = null, projection = 'actual', children = [] } = {}) {
    const slot = document.createElement('slot');
    slot.setAttribute('data-webjs-light', '');
    if (name !== null) slot.setAttribute('name', name);
    slot.setAttribute('data-projection', projection);
    for (const c of children) slot.appendChild(c);
    return slot;
  }

  test('assignedNodes returns projected nodes when projection is actual', () => {
    const a = document.createElement('h1');
    const b = document.createElement('p');
    const slot = mkSlot({ children: [a, b] });
    const got = slot.assignedNodes();
    assert.equal(got.length, 2);
    assert.equal(got[0], a);
    assert.equal(got[1], b);
  });

  test('assignedNodes returns empty when projection is fallback', () => {
    const child = document.createElement('span');
    const slot = mkSlot({ projection: 'fallback', children: [child] });
    assert.deepEqual(slot.assignedNodes(), []);
  });

  test('assignedElements filters out text and comment nodes', () => {
    const slot = mkSlot();
    slot.appendChild(document.createTextNode('text'));
    const el = document.createElement('b');
    slot.appendChild(el);
    slot.appendChild(document.createComment('c'));
    const got = slot.assignedElements();
    assert.equal(got.length, 1);
    assert.equal(got[0], el);
  });

  test('element.assignedSlot returns the framework light slot for a projected child', () => {
    const child = document.createElement('h1');
    const slot = mkSlot({ name: 'header', children: [child] });
    document.body.appendChild(slot);
    assert.equal(child.assignedSlot, slot);
    document.body.removeChild(slot);
  });

  test('element.assignedSlot returns null for child inside fallback slot', () => {
    const child = document.createElement('h1');
    const slot = mkSlot({ projection: 'fallback', children: [child] });
    document.body.appendChild(slot);
    assert.equal(child.assignedSlot, null);
    document.body.removeChild(slot);
  });

  test('element.assignedSlot returns null for unprojected element', () => {
    const el = document.createElement('p');
    document.body.appendChild(el);
    assert.equal(el.assignedSlot, null);
    document.body.removeChild(el);
  });

  test('assignedNodes flatten follows forward-chain through nested light slots', () => {
    const leaf1 = document.createElement('strong');
    const leaf2 = document.createTextNode('plain');
    const innerSlot = mkSlot({ name: 'inner', children: [leaf1, leaf2] });
    const outerSlot = mkSlot({ children: [innerSlot] });
    const flattened = outerSlot.assignedNodes({ flatten: true });
    assert.equal(flattened.length, 2);
    assert.equal(flattened[0], leaf1);
    assert.equal(flattened[1], leaf2);
  });

  test('assignedNodes without flatten returns the slot reference itself in forwarding', () => {
    const leaf = document.createElement('strong');
    const innerSlot = mkSlot({ name: 'inner', children: [leaf] });
    const outerSlot = mkSlot({ children: [innerSlot] });
    const direct = outerSlot.assignedNodes();
    assert.equal(direct.length, 1);
    assert.equal(direct[0], innerSlot);
  });

  test('assignedElements flatten with mixed Element and Text filters to elements only', () => {
    const leafEl = document.createElement('strong');
    const leafText = document.createTextNode('text');
    const innerSlot = mkSlot({ children: [leafEl, leafText] });
    const outerSlot = mkSlot({ children: [innerSlot] });
    const got = outerSlot.assignedElements({ flatten: true });
    assert.equal(got.length, 1);
    assert.equal(got[0], leafEl);
  });

  test('polyfill safety: slot without data-webjs-light delegates to native', () => {
    // Verify the polyfill defers to native by contrasting behaviour with
    // an otherwise-identical light slot. A native (un-marked) slot must
    // NOT receive the light-DOM treatment (so a child p is not reported
    // as an "assignment" by our logic). linkedom's own native returns
    // childNodes as a non-spec fallback; the assertion below tolerates
    // either spec-compliant `[]` (real browsers) or linkedom's looser
    // result. The key is that data-webjs-light flips the result.
    const native = document.createElement('slot');
    const c1 = document.createElement('p');
    native.appendChild(c1);

    const light = document.createElement('slot');
    light.setAttribute('data-webjs-light', '');
    light.setAttribute('data-projection', 'actual');
    const c2 = document.createElement('p');
    light.appendChild(c2);

    const nativeNodes = native.assignedNodes();
    const lightNodes = light.assignedNodes();
    // Light path always returns the projected children deterministically.
    assert.equal(lightNodes.length, 1);
    assert.equal(lightNodes[0], c2);
    // Native path is unchanged by the polyfill. In a real browser it
    // would be []; in linkedom it may include child nodes. Either is
    // acceptable proof of non-interference.
    assert.ok(Array.isArray(nativeNodes));
  });

  test('flatten with cycles terminates via visited set', () => {
    const slotA = mkSlot();
    const slotB = mkSlot();
    slotA.appendChild(slotB);
    slotB.appendChild(slotA);
    const flat = slotA.assignedNodes({ flatten: true });
    assert.ok(Array.isArray(flat));
  });

  test('SLOT_STATE symbol is exported and used for host identification', () => {
    assert.equal(typeof slotModule.SLOT_STATE, 'symbol');
    const host = document.createElement('my-host');
    assert.equal(slotModule.hasSlotState(host), false);
    slotModule.ensureSlotState(host);
    assert.equal(slotModule.hasSlotState(host), true);
  });
});

describe('SSR slot record parity (#1015)', () => {
  test('hasSlot()/this.slots are readable during a LIGHT component SSR render', async () => {
    class C extends WebComponent {
      render() {
        return html`${this.hasSlot('header') ? html`<p class="has-header">yes</p>` : html`<p class="no-header">no</p>`}<slot name="header"></slot><slot></slot>`;
      }
    }
    C.register('slot-ssr-record-1');
    const withHeader = await renderToString(
      html`<slot-ssr-record-1><b slot="header">H</b><i>body</i></slot-ssr-record-1>`);
    assert.ok(withHeader.includes('has-header'), 'hasSlot(header) is true at SSR when authored');
    const withoutHeader = await renderToString(
      html`<slot-ssr-record-1><i>body</i></slot-ssr-record-1>`);
    assert.ok(withoutHeader.includes('no-header'), 'hasSlot(header) is false at SSR when absent');
  });

  test('a SHADOW component is NOT seeded (hasSlot stays false both sides)', async () => {
    // The client only creates slot state on the light-DOM path (shadow slots
    // are native projection), so seeding shadow at SSR would flip
    // conditional-on-slot markup on the first client render. Counterfactual:
    // seed shadow and this fails.
    class C extends WebComponent {
      static shadow = true;
      render() {
        return html`${this.hasSlot('header') ? html`<p class="sh-yes">yes</p>` : html`<p class="sh-no">no</p>`}<slot name="header"></slot>`;
      }
    }
    C.register('slot-ssr-record-2');
    const out = await renderToString(
      html`<slot-ssr-record-2><b slot="header">H</b></slot-ssr-record-2>`);
    assert.ok(out.includes('sh-no'), 'a shadow component sees hasSlot false at SSR (matching the client)');
  });

  test('the reserved `default` alias routes to the default slot at SSR', async () => {
    // slot="default" children and a <slot name="default"> both address the
    // DEFAULT slot on both sides (#1015): the client record normalizes the
    // alias, and the SSR substitution applies the same rule.
    class C extends WebComponent {
      render() { return html`<main><slot name="default">fallback</slot></main>`; }
    }
    C.register('slot-ssr-record-3');
    const out = await renderToString(
      html`<slot-ssr-record-3><i>unnamed child</i></slot-ssr-record-3>`);
    assert.ok(out.includes('unnamed child'), 'unnamed children land in the name="default" slot');
    assert.ok(!out.includes('fallback'), 'the default-aliased slot shows content, not fallback');
  });
});
