/**
 * Regression: adoptSSRAssignments must only adopt the host's OWN light slots.
 *
 * A nested component's actual slot that PRECEDES the outer host's same-named
 * slot in document order used to win the first-wins `has(name)` check, so the
 * outer host adopted the INNER component's children (and its first apply would
 * physically steal them). adoptSSRAssignments now applies the same isOwnSlot
 * filter that applySlotAssignments and the router use.
 *
 * Runs in a REAL browser via WTR + Playwright.
 */
import { adoptSSRAssignments, slotsView } from '../../../src/slot.js';

import { assert } from '../../../../../test/browser-assert.js';

suite('adoptSSRAssignments: own-slot filter', () => {
  test('a nested actual slot preceding the outer same-named slot does not poison the outer record', () => {
    const host = document.createElement('outer-card');
    document.body.appendChild(host);

    // SSR shape: a nested component's actual slot (name="label") comes FIRST in
    // document order, then the outer host's OWN actual slot (name="label").
    host.innerHTML =
      '<inner-widget>' +
      '<slot data-webjs-light data-projection="actual" name="label">' +
      '<span id="inner-child">inner</span>' +
      '</slot>' +
      '</inner-widget>' +
      '<slot data-webjs-light data-projection="actual" name="label">' +
      '<span id="outer-child">outer</span>' +
      '</slot>';

    adoptSSRAssignments(host);

    const label = slotsView(host).label || [];
    const ids = label.filter((n) => n.nodeType === 1).map((n) => n.id);

    // The outer host must have adopted its OWN slot's child, never the nested
    // component's. Without the isOwnSlot filter this is ['inner-child'].
    assert.deepEqual(ids, ['outer-child'], 'outer record adopts only its own slot');
    assert.ok(!ids.includes('inner-child'), 'must not steal the nested component child');

    host.remove();
  });
});
