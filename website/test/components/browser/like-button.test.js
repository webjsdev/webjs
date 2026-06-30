/**
 * Browser tests for <like-button>, the live progressive-enhancement demo
 * rendered in the "What the browser receives" section.
 *
 * It hydrates a `count` reactive property from the count attribute (so the
 * SSR'd "♥ N" reads with JavaScript off) and increments on click. The count
 * property is NOT reflected, so the attribute stays put while the rendered
 * text moves (the counterfactual: a reflecting prop would also rewrite the
 * attribute).
 */
import '#components/like-button.ts';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

const mount = async (count) => {
  const el = document.createElement('like-button');
  if (count != null) el.setAttribute('count', String(count));
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
};

suite('like-button', () => {
  test('renders the heart and the count from the count attribute', async () => {
    const el = await mount(3);
    const btn = el.querySelector('button');
    assert.ok(btn, 'a button is rendered (light DOM, no shadow root)');
    assert.equal(btn.textContent.trim(), '♥ 3', 'the SSR-equivalent render shows the count from the attribute');
    el.remove();
  });

  test('clicking increments the rendered count', async () => {
    const el = await mount(3);
    el.querySelector('button').click();
    await el.updateComplete;
    assert.equal(el.querySelector('button').textContent.trim(), '♥ 4', 'one click increments to 4');
    el.querySelector('button').click();
    await el.updateComplete;
    assert.equal(el.querySelector('button').textContent.trim(), '♥ 5', 'a second click increments to 5');
    el.remove();
  });

  test('the count property moves while the attribute stays (no reflect)', async () => {
    const el = await mount(3);
    el.querySelector('button').click();
    await el.updateComplete;
    assert.equal(el.count, 4, 'the reactive property advanced to 4');
    assert.equal(el.getAttribute('count'), '3', 'the count attribute is unchanged (the prop does not reflect)');
    el.remove();
  });

  test('an arbitrary count attribute drives the render', async () => {
    const el = await mount(9);
    assert.equal(el.querySelector('button').textContent.trim(), '♥ 9', 'the count attribute, not a hardcoded value, drives the text');
    el.remove();
  });
});
