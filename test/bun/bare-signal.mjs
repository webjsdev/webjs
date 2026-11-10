/**
 * Cross-runtime proof that a bare `${signal}` in a template hole renders its
 * current value at SSR (child, attribute, boolean and interpolated-attribute
 * holes) under WHICHEVER runtime executes this file:
 *
 *   node test/bun/bare-signal.mjs
 *   bun  test/bun/bare-signal.mjs
 *
 * The unwrap sits in the SSR walker's hole dispatch, on the hot path. Under
 * Bun `@webjsdev/core` and `@webjsdev/core/signals` resolve to BUILT bundles,
 * so this also proves the signal brand check holds across them. Rebuild dist
 * first.
 */
import assert from 'node:assert/strict';
import { html } from '@webjsdev/core';
import { renderToString } from '@webjsdev/core/server';
import { signal, computed, SignalWatcher, watch } from '@webjsdev/core/signals';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/ +/g, ' ');

assert.equal(typeof SignalWatcher, 'function', `${runtime}: SignalWatcher on /signals`);
assert.equal(typeof watch, 'function', `${runtime}: watch on /signals`);

const name = signal('Ada');
const n = computed(() => name.get().length);
const on = signal(true);
const out = strip(await renderToString(html`<p title=${name} class="x ${n}" ?open=${on}>${name}${watch(n)}</p>`));
assert.equal(out, '<p title="Ada" class="x 3" open="">Ada3</p>', `${runtime}: bare signal SSR`);

console.log(`bare-signal: OK on ${runtime}`);
