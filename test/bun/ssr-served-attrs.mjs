/**
 * Cross-runtime proof that the server serves a custom element's attributes as
 * the element left them after the server pass (the lit-ssr `renderAttributes`
 * shape): changed ones with their new value, removed ones dropped, added ones
 * appended, untouched ones byte for byte. Run under both:
 *
 *   node test/bun/ssr-served-attrs.mjs
 *   bun  test/bun/ssr-served-attrs.mjs
 *
 * The rewrite re-reads the opening tag with a regex and splices it by
 * position, which is string-slicing work a runtime difference would show as
 * bytes. A plain assert script (not `*.test.mjs`), exits non-zero on failure.
 */
import assert from 'node:assert/strict';
import { renderToString } from '../../packages/core/src/render-server.js';
import { html } from '../../packages/core/src/html.js';
import { WebComponent } from '../../packages/core/src/component.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

class Moves extends WebComponent {
  render() {
    const authored = this.getAttribute('class');
    this.removeAttribute('class');
    this.removeAttribute('data-gone');
    this.setAttribute('data-state', 'open');
    this.setAttribute('style', 'display: contents');
    return html`<div class=${`box ${authored ?? ''}`}></div>`;
  }
}
Moves.register('bun-served-moves');

class Still extends WebComponent {
  render() { return html`<b>s</b>`; }
}
Still.register('bun-served-still');

const moved = await renderToString(html`<bun-served-moves class="max-w-sm border" data-gone="x" data-state="closed" title='t &amp; u'></bun-served-moves>`);
assert.equal(
  moved,
  `<bun-served-moves data-state="open" title='t &amp; u' style="display: contents" data-wj-host><!--webjs-hydrate--><div class="box max-w-sm border"></div></bun-served-moves>`,
  `[${runtime}] changed, removed and added attributes are served as the element left them`,
);
const still = await renderToString(html`<bun-served-still class="a" title='q &lt; r' hidden></bun-served-still>`);
assert.equal(still, `<bun-served-still class="a" title='q &lt; r' hidden data-wj-host><!--webjs-hydrate--><b>s</b></bun-served-still>`, `[${runtime}] untouched attributes keep their source text`);
console.log(`[${runtime}] served host attributes OK`);
