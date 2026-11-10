/**
 * Next.js's navigation helpers are importable from the server package too
 * (#1686): an agent writing a server action imports `notFound` / `forbidden`
 * from `@webjsdev/server`. They must be the very functions `@webjsdev/core`
 * exports, so the sentinel they throw is the one the renderer and the form
 * dispatcher recognise.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as server from '../index.js';
import * as core from '@webjsdev/core';

for (const name of ['notFound', 'forbidden', 'unauthorized', 'redirect', 'permanentRedirect']) {
  test(`${name} from @webjsdev/server is core's ${name}`, () => {
    assert.equal(typeof server[name], 'function');
    assert.equal(server[name], core[name]);
  });
}
