/**
 * Lit's `static shadowRootOptions` reaches the server-rendered Declarative
 * Shadow DOM template as the attributes the HTML parser maps onto
 * `attachShadow()`, and the server element shim refuses `attachShadow()` with
 * the `static shadow = true` fix.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html, WebComponent } from '../../index.js';
import { renderToString } from '../../src/render-server.js';
import { dsdOpenTag } from '../../src/render-server/expand.js';

let n = 0;
const tag = () => `ssr-sro-${++n}`;

test('no options renders the plain open template', () => {
  class E extends WebComponent { static shadow = true; }
  assert.equal(dsdOpenTag(E), '<template shadowrootmode="open">');
});

test('every option is written as its template attribute', () => {
  class E extends WebComponent {
    static shadow = true;
    static shadowRootOptions = { mode: 'closed', delegatesFocus: true, clonable: true, serializable: true };
  }
  assert.equal(
    dsdOpenTag(E),
    '<template shadowrootmode="closed" shadowrootdelegatesfocus shadowrootclonable shadowrootserializable>',
  );
});

test('a shadow component renders its options into the served HTML', async () => {
  const t = tag();
  class E extends WebComponent {
    static shadow = true;
    static shadowRootOptions = { mode: 'open', delegatesFocus: true };
    render() { return html`<input>`; }
  }
  E.register(t);
  const out = await renderToString(html([`<${t}></${t}>`]));
  assert.match(out, new RegExp(`<${t}><template shadowrootmode="open" shadowrootdelegatesfocus><input></template></${t}>`));
});

test('the error state of a throwing shadow component carries the same options', async () => {
  const t = tag();
  class E extends WebComponent {
    static shadow = true;
    static shadowRootOptions = { mode: 'open', delegatesFocus: true };
    render() { throw new Error('boom'); }
  }
  E.register(t);
  const err = console.error;
  console.error = () => {};
  try {
    const out = await renderToString(html([`<${t}></${t}>`]));
    assert.match(out, /<template shadowrootmode="open" shadowrootdelegatesfocus>/);
  } finally {
    console.error = err;
  }
});

test('attachShadow() at SSR throws naming static shadow = true', async () => {
  const t = tag();
  class E extends WebComponent {
    constructor() { super(); this.attachShadow({ mode: 'open' }); }
  }
  E.register(t);
  assert.throws(() => new E(), /static shadow = true/);
  assert.equal(new (class extends WebComponent {})().shadowRoot, null);
});

test('renderRoot is undefined at SSR', () => {
  class E extends WebComponent {}
  assert.equal(new E().renderRoot, undefined);
});
