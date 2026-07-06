// Runs in real Chromium via web-test-runner. Imports a real .ts component that
// imports a 'use server' action; only works if the harness transforms + serves
// it (TS strip, .server.ts -> RPC stub, @webjsdev/core via importmap). (#806)
const assert = { ok: (v, m) => { if (!v) throw new Error(m || 'expected truthy'); } };

suite('browser-test harness (#806)', () => {
  test('a real component importing a use-server action loads + upgrades in the browser', async () => {
    await import('../../../components/greeter.ts');
    const el = document.createElement('greeter-el');
    document.body.appendChild(el);
    await customElements.whenDefined('greeter-el');
    const Ctor = customElements.get('greeter-el');
    assert.ok(Ctor && el instanceof Ctor, 'the component module loaded through the harness and upgraded the element');
    // The action import resolved to a callable RPC stub (not a crash-at-load stub).
    assert.ok(el.textContent.includes('function'), 'the greet() action import is a callable stub');
    el.remove();
  });
});
