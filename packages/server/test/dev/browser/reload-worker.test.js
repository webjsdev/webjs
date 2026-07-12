/**
 * Real-browser tests for the dev live-reload SharedWorker relay (#887).
 *
 * `dev-reload-worker.js` is the BROWSER half of the shared live-reload
 * connection: the exact source the served worker inlines (`reloadWorkerJs` reads
 * this file, strips `export`, and appends the `startReloadWorker(...)` call), so
 * driving it here tests the code that ships. The headline acceptance ("one
 * shared connection fans every reload / error out to every tab, and a
 * late-joining tab still gets the current error") is browser-observable, so it
 * runs in a real browser. The relay is driven with a fake EventSource + fake
 * MessagePorts so it needs no live SSE server.
 */
import { startReloadWorker } from '../../../src/dev-reload-worker.js';

import { assert } from '../../../../../test/browser-assert.js';

class FakeEventSource {
  constructor(url) { this.url = url; this._l = {}; FakeEventSource.last = this; }
  addEventListener(type, cb) { (this._l[type] || (this._l[type] = [])).push(cb); }
  fire(type, data) { (this._l[type] || []).forEach((cb) => cb({ data })); }
}

function fakePort() {
  const received = [];
  return { received, port: { start() {}, postMessage(m) { received.push(m); } } };
}

suite('dev reload SharedWorker relay (#887)', () => {
  test('fans a reload out to every connected tab (one connection, many tabs)', () => {
    const scope = {};
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    const b = fakePort();
    scope.onconnect({ ports: [a.port] });
    scope.onconnect({ ports: [b.port] });
    FakeEventSource.last.fire('reload');
    assert.deepEqual(a.received, [{ type: 'reload' }], 'tab A reloaded');
    assert.deepEqual(b.received, [{ type: 'reload' }], 'tab B reloaded from the same worker');
  });

  test('relays an error frame to every connected tab', () => {
    const scope = {};
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    FakeEventSource.last.fire('webjs-error', 'FRAME_JSON');
    assert.deepEqual(a.received, [{ type: 'webjs-error', data: 'FRAME_JSON' }]);
  });

  test('caches the error and replays it to a tab that connects later', () => {
    const scope = {};
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    FakeEventSource.last.fire('webjs-error', 'FRAME_JSON'); // error before the tab opens
    const late = fakePort();
    scope.onconnect({ ports: [late.port] });
    assert.deepEqual(late.received, [{ type: 'webjs-error', data: 'FRAME_JSON' }], 'a late tab still shows the overlay');
  });

  test('clears the cached error on reload so a later tab does not see a stale overlay', () => {
    const scope = {};
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    FakeEventSource.last.fire('webjs-error', 'FRAME_JSON');
    FakeEventSource.last.fire('reload'); // the fix landed
    const late = fakePort();
    scope.onconnect({ ports: [late.port] });
    assert.equal(late.received.length, 0, 'no stale error replayed after a reload');
  });

  test('connects the single EventSource at the given events URL', () => {
    const scope = {};
    const { es } = startReloadWorker(scope, FakeEventSource, '/base/__webjs/events');
    assert.equal(es.url, '/base/__webjs/events', 'the one connection uses the base-path-aware URL');
  });

  // #893: a `node --watch` restart drops the connection; if the in-process
  // reload frame was killed with the old process, no reload was delivered, so
  // the edit would need a manual refresh. The `hello` frame carries a
  // per-process boot id, so a CHANGED id on reconnect is the reload signal.
  test('a reconnect to a NEW process (changed boot id) fans a reload', () => {
    const scope = {};
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    FakeEventSource.last.fire('hello', 'BOOT_A'); // initial connect: baseline only
    assert.deepEqual(a.received, [], 'the first hello does not reload');
    FakeEventSource.last.fire('hello', 'BOOT_B'); // reconnected to a fresh process
    assert.deepEqual(a.received, [{ type: 'reload' }], 'a new boot id reloads the tab');
  });

  test('a transient reconnect to the SAME process (same boot id) never reloads', () => {
    const scope = {};
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    FakeEventSource.last.fire('hello', 'BOOT_A'); // first connect
    FakeEventSource.last.fire('hello', 'BOOT_A'); // sleep/wake or blip: same process
    assert.deepEqual(a.received, [], 'a same-process reconnect is not an edit (no state loss)');
  });
});
