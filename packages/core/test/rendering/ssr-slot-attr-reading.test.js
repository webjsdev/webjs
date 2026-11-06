/**
 * The server reads a child's `slot` attribute, and a `<slot>`'s `name`, as
 * ATTRIBUTES, never by searching the attribute text (#1666).
 *
 * The search it replaced (`/\bslot\s*=/`) matched the tail of `data-slot`,
 * because `\b` sits between the hyphen and the `s`. Every shadcn-shaped part
 * carries `data-slot`, so a kit trigger wrapping `<button data-slot="button">`
 * had its button routed to a named slot `button` its template does not have,
 * and the server dropped it: the trigger rendered empty until the browser
 * re-rendered it, and with JavaScript off it never appeared. A value that
 * merely mentions `slot=` had the same effect.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html, renderToString, WebComponent } from '../../index.js';

class SlotAttrHost extends WebComponent {
  render() {
    return html`<div class="frame"><slot></slot></div>`;
  }
}
SlotAttrHost.register('slot-attr-host');

class SlotAttrNamed extends WebComponent {
  render() {
    return html`<header><slot name="title"></slot></header><main><slot data-name="ignored"></slot></main>`;
  }
}
SlotAttrNamed.register('slot-attr-named');

test('a child carrying data-slot stays in the default slot', async () => {
  const out = await renderToString(html`<slot-attr-host><button data-slot="button" type="button">Open</button></slot-attr-host>`);
  assert.match(out, /<slot[^>]*data-projection="actual"[^>]*>\s*<button data-slot="button" type="button">Open<\/button>/, 'the button is projected into the default slot');
});

test('a quoted value that mentions slot= does not name a slot', async () => {
  const out = await renderToString(html`<slot-attr-host><span title="a slot=b">x</span></slot-attr-host>`);
  assert.match(out, /<span title="a slot=b">x<\/span>/, 'the span is projected');
});

test('a real slot attribute still routes to its named slot, alongside data-slot', async () => {
  const out = await renderToString(html`<slot-attr-named><h2 data-slot="card-title" slot="title">T</h2><p>Body</p></slot-attr-named>`);
  assert.match(out, /<header><slot[^>]*name="title"[^>]*><h2 data-slot="card-title" slot="title">T<\/h2><\/slot><\/header>/, 'the h2 lands in the title slot');
  assert.match(out, /<main><slot[^>]*data-projection="actual"[^>]*>\s*<p>Body<\/p>/, 'the paragraph lands in the default slot');
});

test('a slot element whose only name-like attribute is data-name is the default slot, and keeps it', async () => {
  const out = await renderToString(html`<slot-attr-named><p>Body</p></slot-attr-named>`);
  const main = out.slice(out.indexOf('<main>'), out.indexOf('</main>'));
  assert.match(main, /data-projection="actual"/, 'the default slot receives the child');
  assert.match(main, /data-name="ignored"/, 'and its data-name attribute is kept whole');
  assert.doesNotMatch(main, /\sname="/, 'with no name attribute invented');
});
