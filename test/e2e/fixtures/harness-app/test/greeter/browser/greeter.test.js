// Runs in real Chromium via web-test-runner. Loads a real .ts component that
// imports AND CALLS a 'use server' action; only works if the harness transforms
// + serves it (TS strip, .server.ts -> RPC stub, @webjsdev/core via importmap)
// AND routes the action POST through the middleware to the handler. (#806)
import { assert } from '../../../../../../browser-assert.js';

function waitFor(fn, ms = 5000) {
  return new Promise((res, rej) => {
    const t0 = Date.now();
    (function loop() {
      let v; try { v = fn(); } catch { v = false; }
      if (v) return res(v);
      if (Date.now() - t0 > ms) return rej(new Error('timed out'));
      setTimeout(loop, 50);
    })();
  });
}

suite('browser-test harness (#806)', () => {
  test('a real component loads AND fires a use-server action RPC round-trip', async () => {
    await import('../../../components/greeter.ts');
    const el = document.createElement('greeter-el');
    document.body.appendChild(el);
    await customElements.whenDefined('greeter-el');
    const Ctor = customElements.get('greeter-el');
    assert.ok(Ctor && el instanceof Ctor, 'the component module loaded through the harness and upgraded');

    // Fire the action: the button click calls greet('world'), which POSTs to
    // /__webjs/action/... through the harness middleware and comes back.
    await waitFor(() => el.querySelector('button'));
    el.querySelector('button').click();
    const span = await waitFor(() => {
      const s = el.querySelector('#out');
      return s && s.textContent.includes('greeted world') ? s : null;
    });
    assert.ok(span, 'the greet() action RPC round-tripped through the harness (POST body forwarded)');
    el.remove();
  });
});
