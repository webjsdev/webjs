/**
 * Cross-runtime proof that Lit's `static properties` spelling (#1686) renders
 * the same on Node and Bun. The declared-props map is read on the SSR path
 * (attribute application, reflection, the observed-attribute list), which
 * AGENTS.md counts as runtime-sensitive. Run from the repo root:
 *
 *   node test/bun/static-properties.mjs
 *   bun  test/bun/static-properties.mjs
 *
 * Asserts, on whichever runtime executes it: a `static properties` component
 * reads its attributes as the declared types, a `reflect: true` prop is served
 * on the host, a subclass's own props merge with its parent's, and a factory
 * class can add a `static properties` block.
 */
import assert from 'node:assert/strict';

import { WebComponent, html } from '../../packages/core/index.js';
import { renderToString } from '../../packages/core/src/render-server.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

class LitStyle extends WebComponent {
  static properties = { count: { type: Number, reflect: true }, label: { type: String } };
  constructor() { super(); this.count = 0; }
  render() { return html`<p>${this.label}:${this.count + 1}</p>`; }
}
LitStyle.register('bun-static-props');

class LitSub extends LitStyle {
  static properties = { suffix: { type: String } };
  render() { return html`<p>${this.label}:${this.count}${this.suffix}</p>`; }
}
LitSub.register('bun-static-sub');

class Mixed extends WebComponent({ x: Number }) {
  static properties = { y: { type: String } };
  render() { return html`<i>${this.x + 1}|${this.y}</i>`; }
}
Mixed.register('bun-static-mixed');

const out = (await renderToString(html`
  <bun-static-props count="4" label="n"></bun-static-props>
  <bun-static-sub count="2" label="m" suffix="!"></bun-static-sub>
  <bun-static-mixed x="1" y="z"></bun-static-mixed>
`)).replace(/<!--[^>]*-->/g, '');

assert.match(out, /<p>n:5<\/p>/, `a static properties Number attribute was not coerced on ${runtime}`);
assert.match(out, /<bun-static-props count="4"/, `the reflected attribute was not served on ${runtime}`);
assert.match(out, /<p>m:2!<\/p>/, `a subclass did not merge its parent's props on ${runtime}`);
assert.match(out, /<i>2\|z<\/i>/, `a factory class lost its static properties block on ${runtime}`);
assert.deepEqual(LitSub.observedAttributes, ['count', 'label', 'suffix']);

console.log(`static properties render and merge on ${runtime}`);
