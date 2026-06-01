/**
 * SSR-vs-client render parity guard (issue #184), real browser via WTR.
 *
 * A component's SSR'd HTML must match its first CLIENT render, or hydration
 * diverges (wrong DOM, lost state, console errors). This renders a corpus of
 * components two ways for the SAME inputs:
 *   - server: renderToString(template) (the SSR path, browser-loadable, the
 *     same function fixture() uses)
 *   - client: a FRESH client render (mount the bare element, let the browser
 *     upgrade it and run connectedCallback -> render()), with NO SSR DOM to
 *     adopt, so any server-vs-client divergence actually shows
 * and asserts the rendered content is structurally identical after
 * normalising hydration-only artifacts (the <!--webjs-hydrate--> marker, the
 * data-webjs-prop-* hydration attributes, and incidental whitespace).
 *
 * The counterfactual (a component whose render() is non-deterministic across
 * the two calls) must FAIL the parity check, proving the guard has teeth.
 */
import { html } from '../../../src/html.js';
import { css } from '../../../src/css.js';
import { WebComponent } from '../../../src/component.js';
import { signal } from '../../../src/signal.js';
import { renderToString } from '../../../src/render-server.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
  notEqual: (a, b, msg) => { if (a === b) throw new Error(msg || `Expected values to differ, both were ${JSON.stringify(a)}`); },
};

/**
 * Strip the artifacts that legitimately differ between the SSR string and the
 * live client DOM (none of which is a render divergence) and collapse
 * whitespace, leaving only the rendered template structure to compare:
 *   - the `<!--webjs-hydrate-->` light-DOM hydration marker (SSR only);
 *   - the client renderer's fine-grained part markers `<!--w$s/e/0/1...-->`
 *     (client only) that mark the instance and dynamic interpolation points;
 *   - `data-webjs-prop-*` hydration attributes (SSR only, stripped on connect);
 *   - a shadow component's `<style>` block, which SSR inlines into the DSD
 *     but the client delivers via adoptedStyleSheets (same styling, different
 *     transport, not part of render()'s output).
 */
function normalize(htmlStr) {
  return String(htmlStr)
    .replace(/<!--webjs-hydrate-->/g, '')
    .replace(/<!--\/?w\$[^>]*-->/g, '')
    .replace(/\s+data-webjs-prop-[a-z0-9-]+="[^"]*"/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
    // Boolean/empty attributes serialise as bare `attr` in the SSR string but
    // `attr=""` in the live DOM. Same attribute, different serialisation.
    .replace(/=""/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pull the shadow-root inner HTML out of an SSR'd DSD template. */
function ssrShadowInner(ssr) {
  const m = ssr.match(/<template shadowrootmode="open">([\s\S]*?)<\/template>/);
  return m ? m[1] : null;
}

/** Pull a light component's inner HTML out of its SSR'd outer markup. */
function ssrLightInner(ssr, tag) {
  const m = ssr.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*)</${tag}>`));
  return m ? m[1] : ssr;
}

let host;
function freshContainer() {
  if (host) host.remove();
  host = document.createElement('div');
  document.body.appendChild(host);
  return host;
}

/** Mount an element fresh on the client and wait for its first render. */
async function clientMount(el) {
  const c = freshContainer();
  c.appendChild(el);
  if (el.updateComplete) await el.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  return el;
}

suite('SSR vs client render parity (#184)', () => {

  test('light-DOM component: SSR inner equals first client render', async () => {
    class P1 extends WebComponent {
      render() { return html`<p class="greet">hello <strong>world</strong></p>`; }
    }
    P1.register('parity-light-simple');
    const ssr = normalize(ssrLightInner(await renderToString(html`<parity-light-simple></parity-light-simple>`), 'parity-light-simple'));
    const el = await clientMount(document.createElement('parity-light-simple'));
    const client = normalize(el.innerHTML);
    assert.equal(client, ssr, `light parity mismatch\nSSR:    ${ssr}\nCLIENT: ${client}`);
    assert.ok(ssr.length > 0, 'non-empty render');
  });

  test('light-DOM with attribute-backed prop: parity reflects the prop', async () => {
    class P2 extends WebComponent {
      static properties = { label: { type: String } };
      constructor() { super(); this.label = ''; }
      render() { return html`<span>label is ${this.label}</span>`; }
    }
    P2.register('parity-light-prop');
    const ssr = normalize(ssrLightInner(await renderToString(html`<parity-light-prop label="alpha"></parity-light-prop>`), 'parity-light-prop'));
    const el = document.createElement('parity-light-prop');
    el.setAttribute('label', 'alpha');
    await clientMount(el);
    const client = normalize(el.innerHTML);
    assert.equal(client, ssr, `prop parity mismatch\nSSR:    ${ssr}\nCLIENT: ${client}`);
    assert.ok(ssr.includes('alpha'), 'prop value rendered');
  });

  test('shadow-DOM component with styles: SSR DSD equals client shadowRoot', async () => {
    class P3 extends WebComponent {
      static shadow = true;
      static styles = css`p { color: red; }`;
      render() { return html`<p>shadowed</p>`; }
    }
    P3.register('parity-shadow');
    const ssr = normalize(ssrShadowInner(await renderToString(html`<parity-shadow></parity-shadow>`)));
    const el = await clientMount(document.createElement('parity-shadow'));
    const client = normalize(el.shadowRoot.innerHTML);
    assert.equal(client, ssr, `shadow parity mismatch\nSSR:    ${ssr}\nCLIENT: ${client}`);
    assert.ok(ssr.includes('shadowed'), 'shadow content rendered');
  });

  test('light-DOM with a slot: projected content matches server and client', async () => {
    class P4 extends WebComponent {
      render() { return html`<div class="wrap"><slot></slot></div>`; }
    }
    P4.register('parity-slot');
    const ssr = normalize(ssrLightInner(await renderToString(html`<parity-slot><b>kid</b></parity-slot>`), 'parity-slot'));
    const el = document.createElement('parity-slot');
    el.innerHTML = '<b>kid</b>';
    await clientMount(el);
    await new Promise((r) => setTimeout(r, 0));
    const client = normalize(el.innerHTML);
    assert.equal(client, ssr, `slot parity mismatch\nSSR:    ${ssr}\nCLIENT: ${client}`);
    assert.ok(ssr.includes('kid'), 'projected child present');
  });

  test('.prop round-trip: rich value renders identically server and client', async () => {
    class P5 extends WebComponent {
      static properties = { data: { type: Object } };
      constructor() { super(); this.data = null; }
      render() { return html`<ul>${(this.data?.items || []).map((i) => html`<li>${i}</li>`)}</ul>`; }
    }
    P5.register('parity-prop-rich');
    const value = { items: ['a', 'b', 'c'] };
    // SSR encodes the rich .prop to a data-webjs-prop-* wire attribute.
    const ssrFull = await renderToString(html`<parity-prop-rich .data=${value}></parity-prop-rich>`);
    assert.ok(/data-webjs-prop-data=/.test(ssrFull), 'SSR must encode the rich prop to the wire attribute');
    const ssr = normalize(ssrLightInner(ssrFull, 'parity-prop-rich'));
    // Hydrate the client FROM the SSR markup so connectedCallback decodes the
    // wire attribute back into the live property (the actual round-trip),
    // rather than assigning .data directly and skipping the serializer.
    const c = freshContainer();
    c.innerHTML = ssrFull;
    const el = c.firstElementChild;
    if (el.updateComplete) await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    const client = normalize(el.innerHTML);
    assert.equal(client, ssr, `rich-prop parity mismatch\nSSR:    ${ssr}\nCLIENT: ${client}`);
    assert.ok(ssr.includes('<li>a</li>'), 'rich prop rendered');
    assert.ok(el.data && el.data.items && el.data.items[0] === 'a',
      'client must decode the wire prop attribute back into the live .data property');
  });

  test('signal-backed component: SSR equals first client render', async () => {
    const count = signal(7);
    class P6 extends WebComponent {
      render() { return html`<output>${count.get()}</output>`; }
    }
    P6.register('parity-signal');
    const ssr = normalize(ssrLightInner(await renderToString(html`<parity-signal></parity-signal>`), 'parity-signal'));
    const el = await clientMount(document.createElement('parity-signal'));
    const client = normalize(el.innerHTML);
    assert.equal(client, ssr, `signal parity mismatch\nSSR:    ${ssr}\nCLIENT: ${client}`);
    assert.ok(ssr.includes('7'), 'signal value rendered');
  });

  test('counterfactual: a non-deterministic render FAILS the parity check', async () => {
    // render() returns a different value on each call. The SSR call and the
    // fresh client render therefore diverge, which is exactly the
    // hydration-mismatch bug this guard exists to catch. Assert the parity
    // comparison detects the difference.
    let n = 0;
    class P7 extends WebComponent {
      render() { return html`<p>${++n}</p>`; }
    }
    P7.register('parity-nondeterministic');
    const ssr = normalize(ssrLightInner(await renderToString(html`<parity-nondeterministic></parity-nondeterministic>`), 'parity-nondeterministic'));
    const el = await clientMount(document.createElement('parity-nondeterministic'));
    const client = normalize(el.innerHTML);
    assert.notEqual(client, ssr, 'a non-deterministic render must produce a detectable SSR/client divergence');
  });
});
