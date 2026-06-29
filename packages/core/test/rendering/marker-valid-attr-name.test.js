/**
 * Regression test for #730: the hydration MARKER is interpolated into
 * part-sentinel ATTRIBUTE names (`data-${MARKER}${i}`) and applied via
 * `Element.setAttribute` in `discoverSlots`. `setAttribute` enforces the XML
 * qualified-name rule. The original marker `'w$'` produced `data-w$0`, whose
 * `$` is NOT a valid name character: Chromium and desktop WebKit tolerate it,
 * but iOS WebKit's `setAttribute` throws `InvalidCharacterError`, which crashed
 * `createInstance` for EVERY slot template on iOS (so no `@click` ever bound).
 *
 * The engines available in CI are all lenient, so a browser test cannot catch
 * this. We assert the invariant directly: the sentinel attribute name the
 * marker yields must satisfy the XML Name production that strict `setAttribute`
 * implementations enforce.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARKER } from '../../src/html.js';

// XML Name production (ASCII subset), the rule Element.setAttribute() applies.
const VALID_XML_NAME = /^[A-Za-z_:][A-Za-z0-9_:.\-]*$/;

test('MARKER yields valid part-sentinel attribute names (#730)', () => {
  // Must contain no character invalid in an attribute name. `$` was the bug.
  assert.ok(
    /^[a-z][a-z0-9-]*$/.test(MARKER),
    `MARKER must match [a-z][a-z0-9-]* (got ${JSON.stringify(MARKER)}); a $ or other invalid char makes iOS setAttribute throw`
  );
  // Every sentinel `data-${MARKER}${i}` discoverSlots applies must be valid.
  for (const i of [0, 1, 9, 12, 100]) {
    const attr = `data-${MARKER}${i}`;
    assert.ok(VALID_XML_NAME.test(attr), `sentinel "${attr}" must be a valid XML qualified name`);
  }
});

test('counterfactual: the old "w$" marker is rejected by the rule (#730)', () => {
  // Proves the test actually fires: data-w$0 (the historic crash) is invalid.
  assert.equal(VALID_XML_NAME.test('data-w$0'), false);
  assert.equal(/^[a-z][a-z0-9-]*$/.test('w$'), false);
});
