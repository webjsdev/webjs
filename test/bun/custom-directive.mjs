/**
 * Cross-runtime proof that a custom directive (`@webjsdev/core/directive`,
 * `@webjsdev/core/async-directive`, lit's authoring API) renders identically
 * at SSR under WHICHEVER runtime executes this file:
 *
 *   node test/bun/custom-directive.mjs
 *   bun  test/bun/custom-directive.mjs
 *
 * The directive resolution sits in the SSR walker's hole dispatch (child,
 * attribute, interpolated-attribute piece, boolean), which is on the hot path
 * and runtime-sensitive. The subpaths are source modules while the root
 * `@webjsdev/core` is the BUILT bundle under Bun, so this also proves the
 * brand check works across the two loaded copies. Rebuild dist first.
 */
import assert from 'node:assert/strict';
import { html } from '@webjsdev/core';
import { renderToString } from '@webjsdev/core/server';
import { directive, Directive, PartType } from '@webjsdev/core/directive';
import { AsyncDirective } from '@webjsdev/core/async-directive';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

const types = [];
class Upper extends Directive {
  constructor(info) { super(info); types.push(info.type); }
  render(v) { return String(v).toUpperCase(); }
}
const upper = directive(Upper);
class Later extends AsyncDirective {
  render(v) { this.setValue('ignored'); return html`<i>${v}</i>`; }
}
const later = directive(Later);

const out = strip(await renderToString(
  html`<p title=${upper('t')} class="a ${upper('b')}" ?hidden=${upper('h')}>${upper('x')}${later('y')}</p>`,
));
assert.equal(out, '<p title="T" class="a B" hidden="">X<i>y</i></p>', `${runtime}: custom directive SSR`);
assert.deepEqual(types, [PartType.ATTRIBUTE, PartType.ATTRIBUTE, PartType.BOOLEAN_ATTRIBUTE, PartType.CHILD], `${runtime}: part types`);

console.log(`custom-directive: OK on ${runtime}`);
