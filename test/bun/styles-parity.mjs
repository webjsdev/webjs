/**
 * Cross-runtime proof that Lit's `css` contract and `static styles` shapes
 * render the same server-side under WHICHEVER runtime executes this file:
 * composition of nested results and numbers, the loud refusal of a string
 * hole, `unsafeCSS`, nested-array flattening with last-duplicate-wins, and
 * the once-per-class dev error for light-DOM `static styles`. Run under both:
 *
 *   node test/bun/styles-parity.mjs
 *   bun  test/bun/styles-parity.mjs
 *
 * A plain assert script (not `*.test.mjs`), exits non-zero on failure. Run
 * from the repo root so the bare `@webjsdev/core` specifier resolves to the
 * workspace package.
 */
import assert from 'node:assert/strict';
import { html, css, unsafeCSS, WebComponent } from '@webjsdev/core';
import { renderToString } from '@webjsdev/core/server';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

const base = css`p{margin:0}`;
assert.equal(css`a{color:${css`red`};width:${2}px}`.cssText, 'a{color:red;width:2px}', `[${runtime}] composition`);
assert.throws(() => css`a{color:${'red'}}`, /unsafeCSS/, `[${runtime}] a string hole throws`);
assert.equal(css`a{color:${unsafeCSS('blue')}}`.text, 'a{color:blue}', `[${runtime}] unsafeCSS`);

class BunStyled extends WebComponent {
  static shadow = true;
  static styles = [base, [css`b{x:1}`, [base]]];
  render() { return html`<p>hi</p>`; }
}
BunStyled.register('bun-styles-parity');

const out = await renderToString(html`<bun-styles-parity></bun-styles-parity>`);
assert.equal(
  out,
  '<bun-styles-parity><template shadowrootmode="open"><style>b{x:1}\np{margin:0}</style><p>hi</p></template></bun-styles-parity>',
  `[${runtime}] nested styles flatten, last duplicate wins`,
);

class BunLightStyled extends WebComponent {
  static styles = css`p{color:red}`;
  render() { return html`<p>light</p>`; }
}
BunLightStyled.register('bun-styles-light');

const errors = [];
const orig = console.error;
console.error = (...args) => { errors.push(String(args[0])); };
try {
  await renderToString(html`<bun-styles-light></bun-styles-light><bun-styles-light></bun-styles-light>`, { dev: true });
} finally {
  console.error = orig;
}
assert.equal(errors.filter((e) => e.includes('static shadow = true')).length, 1, `[${runtime}] light-DOM styles reported once`);
