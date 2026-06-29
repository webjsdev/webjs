/**
 * Regression test for #745: the global `toast()` must reach a mounted
 * <ui-sonner> even when the sonner module is loaded under two different URLs
 * (the app registers the element from the version-hashed `sonner.ts?v=<hash>`,
 * while a caller may `import('/components/ui/sonner.ts')` bare). Those are
 * distinct module instances, so the toast bus MUST live on `globalThis`, not in
 * module scope. Before the fix the bus was a module-scope const, so a toast()
 * published from one instance silently went to a no-op bus and never rendered.
 *
 * This asserts `toast()` routes through `globalThis.__webjsSonnerBus` (which a
 * mounted <ui-sonner> writes its `_add` into via firstUpdated). It does not need
 * a DOM: standing in for the element by writing the bus directly is exactly the
 * cross-module-instance contract the fix guarantees.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { toast } from '../packages/registry/components/sonner.ts';

afterEach(() => {
  delete /** @type {any} */ (globalThis).__webjsSonnerBus;
});

test('global toast() routes through the globalThis bus (#745)', () => {
  const got = [];
  /** @type {any} */ (globalThis).__webjsSonnerBus = { add: (t) => got.push(t), remove() {} };

  const id = toast.success('hi', { description: 'saved' });

  assert.equal(got.length, 1, 'toast() must route to the globalThis bus, not module scope');
  assert.equal(got[0].message, 'hi');
  assert.equal(got[0].type, 'success');
  assert.equal(got[0].description, 'saved');
  assert.equal(got[0].id, id);
});

test('toast.dismiss() routes removal through the same globalThis bus (#745)', () => {
  const removed = [];
  /** @type {any} */ (globalThis).__webjsSonnerBus = { add() {}, remove: (id) => removed.push(id) };

  toast.dismiss(42);

  assert.deepEqual(removed, [42]);
});
