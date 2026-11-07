/**
 * The frame lookup survives an element a swap has detached (#1667).
 *
 * The hover-intent prefetch resolves its frame when its dwell timer fires,
 * and a soft navigation during the dwell can detach the hovered link. A
 * detached element's root node is the top of its own subtree, and when that
 * is an `<a>`, its `host` is the URL's host STRING: the walk took it for a
 * shadow host, set `cur` to the string, and the next `closest()` threw
 * "closest is not a function", a page error on the ui-chrome-swap e2e.
 */
import { activeFrameId as _activeFrameId } from '../../../src/router-client/frames.js';
import { closestAnchor as _closestAnchor } from '../../../src/router-client/anchors.js';
import { assert } from '../../../../../test/browser-assert.js';

suite('Client router: the frame lookup on a detached element (#1667)', () => {
  test('an element inside a detached <a> resolves no frame instead of throwing', () => {
    const a = document.createElement('a');
    a.href = 'http://localhost:5003/ui';
    const span = document.createElement('span');
    a.append(span);
    assert.equal(_activeFrameId(span), null);
    assert.equal(_activeFrameId(a), null);
  });

  test('a real shadow boundary is still crossed', () => {
    const frame = document.createElement('webjs-frame');
    frame.id = 'wj-detached-frame';
    const host = document.createElement('div');
    frame.append(host);
    document.body.append(frame);
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('a');
    inner.href = '/x';
    shadow.append(inner);
    try {
      assert.equal(_activeFrameId(inner), 'wj-detached-frame');
      assert.equal(_closestAnchor(inner), inner);
    } finally {
      frame.remove();
    }
  });
});
