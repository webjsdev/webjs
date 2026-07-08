/**
 * Cross-runtime proof that the forbidden() / unauthorized() control-flow
 * sentinels (#848) behave identically on Node and Bun. They ride the SSR catch
 * path (runtime-sensitive), and are tagged with `Symbol.for(...)` so a
 * cross-realm throw still matches. Both runtimes must agree:
 *
 *   node test/bun/nav-sentinels.mjs
 *   bun  test/bun/nav-sentinels.mjs
 *
 * Run from the repo root.
 */
import assert from 'node:assert/strict';
import {
  forbidden, unauthorized, notFound, redirect,
  isForbidden, isUnauthorized, isNotFound, isRedirect,
} from '../../packages/core/index.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

let f, u;
try { forbidden(); assert.fail('forbidden did not throw'); } catch (e) { f = e; }
try { unauthorized(); assert.fail('unauthorized did not throw'); } catch (e) { u = e; }

// Each sentinel is recognized as itself and NOT as any of the others.
assert.ok(isForbidden(f) && !isUnauthorized(f) && !isNotFound(f) && !isRedirect(f));
assert.ok(isUnauthorized(u) && !isForbidden(u) && !isNotFound(u) && !isRedirect(u));

// Symbol.for cross-realm identity: a hand-tagged error matches on both runtimes.
const tagged = new Error('x');
tagged.__webjs = Symbol.for('webjs.forbidden');
assert.ok(isForbidden(tagged));

// A plain error is never a control-flow sentinel.
assert.equal(isForbidden(new Error('boom')), false);
assert.equal(isUnauthorized(null), false);

console.log(`OK  forbidden()/unauthorized() sentinels behave identically on ${runtime}`);
