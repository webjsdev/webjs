/**
 * Browser tests for the <cursor-glow> element covering the mouse-follow
 * behavior and its progressive-enhancement guards.
 *
 * The host is the glow layer; the move handler writes --cg-x / --cg-y /
 * --cg-on onto it (no re-render). Touch and pen pointers are ignored so the
 * halo never drags under a finger.
 */
import '../../../components/cursor-glow.ts';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const move = (x, y, pointerType = 'mouse') =>
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerType, bubbles: true }));

suite('cursor-glow', () => {
  let el;
  setup(async () => {
    el = document.createElement('cursor-glow');
    document.body.appendChild(el);
    await el.updateComplete;
  });
  teardown(() => el.remove());

  test('starts transparent (no --cg-on until the mouse moves)', () => {
    assert.equal(el.style.getPropertyValue('--cg-on'), '', 'glow is off before any pointer movement');
  });

  test('a mouse move positions and turns on the glow', async () => {
    move(240, 120);
    await nextFrame();
    assert.equal(el.style.getPropertyValue('--cg-x'), '240px');
    assert.equal(el.style.getPropertyValue('--cg-y'), '120px');
    assert.equal(el.style.getPropertyValue('--cg-on'), '1');
  });

  test('touch and pen pointers are ignored', async () => {
    move(240, 120);
    await nextFrame();
    move(700, 500, 'touch');
    await nextFrame();
    move(680, 480, 'pen');
    await nextFrame();
    assert.equal(el.style.getPropertyValue('--cg-x'), '240px', 'still at the last mouse position');
    assert.equal(el.style.getPropertyValue('--cg-y'), '120px');
  });

  test('disconnecting stops tracking the pointer', async () => {
    move(100, 100);
    await nextFrame();
    el.remove();
    move(900, 900);
    await nextFrame();
    assert.equal(el.style.getPropertyValue('--cg-x'), '100px', 'no updates after disconnect');
  });
});
