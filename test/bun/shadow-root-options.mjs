/**
 * Cross-runtime proof that Lit's `static shadowRootOptions` renders the same
 * Declarative Shadow DOM template attributes under WHICHEVER runtime executes
 * this file, and that the server element shim refuses `attachShadow()` with
 * the `static shadow = true` fix. Run under both:
 *
 *   node test/bun/shadow-root-options.mjs
 *   bun  test/bun/shadow-root-options.mjs
 *
 * A plain assert script (not `*.test.mjs`), exits non-zero on failure. Run
 * from the repo root so the bare `@webjsdev/core` specifier resolves to the
 * workspace package.
 */
import assert from 'node:assert/strict';
import { html, WebComponent } from '@webjsdev/core';
import { renderToString } from '@webjsdev/core/server';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

class BunOptions extends WebComponent {
  static shadow = true;
  static shadowRootOptions = { mode: 'open', delegatesFocus: true, clonable: true };
  render() { return html`<button><slot></slot></button>`; }
}
BunOptions.register('bun-sro-options');

class BunPlain extends WebComponent {
  static shadow = true;
  render() { return html`<p>hi</p>`; }
}
BunPlain.register('bun-sro-plain');

const withOptions = await renderToString(html`<bun-sro-options>Go</bun-sro-options>`);
assert.equal(
  withOptions,
  '<bun-sro-options><template shadowrootmode="open" shadowrootdelegatesfocus shadowrootclonable><button><slot></slot></button></template>Go</bun-sro-options>',
  `[${runtime}] options become DSD template attributes`,
);

const plain = await renderToString(html`<bun-sro-plain></bun-sro-plain>`);
assert.match(plain, /<bun-sro-plain><template shadowrootmode="open"><p>hi<\/p><\/template>/, `[${runtime}] no options, plain open template`);

assert.throws(
  () => new (class extends WebComponent { constructor() { super(); this.attachShadow({ mode: 'open' }); } })(),
  /static shadow = true/,
  `[${runtime}] attachShadow at SSR names the fix`,
);
assert.equal(new BunPlain().renderRoot, undefined, `[${runtime}] renderRoot is undefined at SSR`);
