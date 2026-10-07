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
import { startReloadWorker, RELOAD_QUIET_IN_PLACE_MS, frameInPlace, RELOAD_QUIET_MS, RELOAD_MAX_HOLD_MS, RECONNECT_BASE_MS, RECONNECT_MAX_MS, parseVerdict, parseHello, pageIsStale } from '../../../src/dev-reload-worker.js';

import { assert } from '../../../../../test/browser-assert.js';

class FakeEventSource {
  constructor(url) {
    this.url = url; this._l = {}; this.closed = false;
    FakeEventSource.last = this;
    FakeEventSource.opened = (FakeEventSource.opened || 0) + 1;
  }
  addEventListener(type, cb) { (this._l[type] || (this._l[type] = [])).push(cb); }
  fire(type, data) { (this._l[type] || []).forEach((cb) => cb({ data })); }
  close() { this.closed = true; }
}

function fakePort() {
  const received = [];
  return { received, port: { start() {}, postMessage(m) { received.push(m); } } };
}

/**
 * A fake clock handed to the relay as its `scope` (#1397). The relay reads
 * `setTimeout` / `clearTimeout` off the scope precisely so a test can drive the
 * reload debounce deterministically and keep its assertions synchronous, with
 * no real waiting for a 2 to 5 second window.
 */
function fakeClock() {
  let now = 0;
  let id = 0;
  const jobs = new Map();
  const scope = {
    setTimeout(fn, ms) { jobs.set(++id, { at: now + ms, fn }); return id; },
    clearTimeout(t) { jobs.delete(t); },
  };
  return {
    scope,
    // Fire due jobs strictly in time order, re-scanning after each one. The
    // re-scan is what makes this faithful: the emitter CANCELS its sibling
    // timer as it fires, so a snapshot taken up front would run a job that no
    // longer exists and report two reloads where the relay emits one.
    tick(ms) {
      const target = now + ms;
      for (;;) {
        let nextId = null;
        let nextAt = Infinity;
        for (const [t, j] of jobs) {
          if (j.at <= target && j.at < nextAt) { nextAt = j.at; nextId = t; }
        }
        if (nextId === null) break;
        now = nextAt;
        const j = jobs.get(nextId);
        jobs.delete(nextId);
        j.fn();
      }
      now = target;
    },
  };
}

suite('dev reload SharedWorker relay (#887)', () => {
  test('fans a reload out to every connected tab (one connection, many tabs)', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    const b = fakePort();
    scope.onconnect({ ports: [a.port] });
    scope.onconnect({ ports: [b.port] });
    FakeEventSource.last.fire('reload');
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'reload' }], 'tab A reloaded');
    assert.deepEqual(b.received, [{ type: 'reload', verdict: 'reload' }], 'tab B reloaded from the same worker');
  });

  test('relays an error frame to every connected tab', () => {
    const { scope } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    FakeEventSource.last.fire('webjs-error', 'FRAME_JSON');
    assert.deepEqual(a.received, [{ type: 'webjs-error', data: 'FRAME_JSON' }]);
  });

  test('caches the error and replays it to a tab that connects later', () => {
    const { scope } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    // The stream opens with the first tab (#1507), so the error arrives while
    // one tab is open and a second tab joins after it.
    scope.onconnect({ ports: [fakePort().port] });
    FakeEventSource.last.fire('webjs-error', 'FRAME_JSON');
    const late = fakePort();
    scope.onconnect({ ports: [late.port] });
    assert.deepEqual(late.received, [{ type: 'webjs-error', data: 'FRAME_JSON' }], 'a late tab still shows the overlay');
  });

  test('clears the cached error on reload so a later tab does not see a stale overlay', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    FakeEventSource.last.fire('webjs-error', 'FRAME_JSON');
    FakeEventSource.last.fire('reload'); // the fix landed
    tick(RELOAD_QUIET_MS);
    const late = fakePort();
    scope.onconnect({ ports: [late.port] });
    assert.equal(late.received.length, 0, 'no stale error replayed after a reload');
  });

  test('connects the single EventSource at the given events URL', () => {
    const { scope } = fakeClock();
    const relay = startReloadWorker(scope, FakeEventSource, '/base/__webjs/events');
    scope.onconnect({ ports: [fakePort().port] });
    assert.equal(relay.es.url, '/base/__webjs/events', 'the one connection uses the base-path-aware URL');
  });

  // #893: a `node --watch` restart drops the connection; if the in-process
  // reload frame was killed with the old process, no reload was delivered, so
  // the edit would need a manual refresh. The `hello` frame carries a
  // per-process boot id, so a CHANGED id on reconnect is the reload signal.
  test('a reconnect to a NEW process (changed boot id) fans a reload', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    FakeEventSource.last.fire('hello', 'BOOT_A'); // initial connect: baseline only
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [], 'the first hello does not reload');
    FakeEventSource.last.fire('hello', 'BOOT_B'); // reconnected to a fresh process
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'reload' }], 'a new boot id reloads the tab');
  });

  test('a transient reconnect to the SAME process (same boot id) never reloads', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    FakeEventSource.last.fire('hello', 'BOOT_A'); // first connect
    FakeEventSource.last.fire('hello', 'BOOT_A'); // sleep/wake or blip: same process
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [], 'a same-process reconnect is not an edit (no state loss)');
  });
});

// #1397: an agent saves several files a second or two apart, and EACH save
// produces TWO reload signals (the in-process `reload` frame, then a changed
// boot id when the browser reconnects to the restarted process). Acting on
// every one reloads into a server that is about to be killed again, which is
// how the page ends up unstyled. Both signals route through one debounced
// emitter instead.
suite('dev reload coalescing (#1397)', () => {
  test('a burst of signals inside the quiet window fans exactly ONE reload', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    const es = FakeEventSource.last;
    es.fire('hello', 'BOOT_A'); // baseline, no signal
    // The measured shape of one agent burst: an in-process frame, then a
    // reconnect with a new boot id, twice over. The gaps are inside the quiet
    // window and the whole burst plus its window is inside the cap, so this is
    // the case the debounce is meant to collapse completely.
    const gap = 700;
    es.fire('reload');
    tick(gap);
    es.fire('hello', 'BOOT_B');
    tick(gap);
    es.fire('reload');
    tick(gap);
    es.fire('hello', 'BOOT_C');
    assert.deepEqual(a.received, [], 'nothing fires while the edits are still landing');
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'reload' }], 'four signals coalesce into one reload');
  });

  test('a single signal in a quiet session reloads after exactly the quiet window', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    FakeEventSource.last.fire('reload');
    tick(RELOAD_QUIET_MS - 1);
    assert.deepEqual(a.received, [], 'not yet, the window has not elapsed');
    tick(1);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'reload' }], 'and never later than the window');
  });

  test('a sustained burst still reloads at the cap, measured from the first signal', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    const es = FakeEventSource.last;
    const step = RELOAD_QUIET_MS - 100; // close enough that the quiet timer never expires
    es.fire('reload'); // t = 0, the first signal of the batch
    let elapsed = 0;
    while (elapsed + step < RELOAD_MAX_HOLD_MS) {
      tick(step);
      elapsed += step;
      es.fire('reload');
      assert.deepEqual(a.received, [], 'the quiet window keeps being pushed out by the burst');
    }
    tick(RELOAD_MAX_HOLD_MS - elapsed);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'reload' }], 'the cap fires at RELOAD_MAX_HOLD_MS from the FIRST signal');
  });

  // COUNTERFACTUAL: re-arm the cap timer on every signal and the cap slides out
  // with the burst, so the last two assertions here both see nothing.
  test('the cap timer is not re-armed within a batch', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    const es = FakeEventSource.last;
    const step = RELOAD_QUIET_MS - 100;
    es.fire('reload'); // t = 0, the first signal of the batch
    tick(step);
    es.fire('reload'); // mid-batch: must not push the cap out
    tick(step);
    es.fire('reload'); // mid-batch again
    tick(RELOAD_MAX_HOLD_MS - 2 * step - 1);
    assert.deepEqual(a.received, [], 'the cap has not fired one tick early');
    tick(1);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'reload' }], 'the cap still measures from the first signal');
  });

  test('a signal after a cap fire starts a NEW batch', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    const es = FakeEventSource.last;
    const step = RELOAD_QUIET_MS - 100;
    // Sustain a burst until the cap fires, so batch one ends on the CAP rather
    // than on a quiet window (which is the case this test is about).
    es.fire('reload');
    tick(step);
    es.fire('reload');
    tick(step);
    es.fire('reload');
    tick(RELOAD_MAX_HOLD_MS - 2 * step);
    assert.equal(a.received.length, 1, 'batch one emitted at the cap');
    es.fire('reload');
    tick(RELOAD_QUIET_MS - 1);
    assert.equal(a.received.length, 1, 'batch two waits a full quiet window, it does not inherit the old timers');
    tick(1);
    assert.equal(a.received.length, 2, 'batch two emitted on its own window');
  });

  test('an error frame is never debounced', () => {
    const { scope } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    FakeEventSource.last.fire('webjs-error', 'FRAME_JSON');
    // No tick: an overlay has to appear at once, and it is not a reload.
    assert.deepEqual(a.received, [{ type: 'webjs-error', data: 'FRAME_JSON' }]);
  });

  test('a reload signal clears the cached error immediately, before the debounced emit', () => {
    const { scope } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    FakeEventSource.last.fire('webjs-error', 'FRAME_JSON');
    FakeEventSource.last.fire('reload'); // the rebuild fixed it; the reload is still pending
    const late = fakePort();
    scope.onconnect({ ports: [late.port] }); // connects DURING the pending window
    assert.equal(late.received.length, 0, 'no overlay for an error the rebuild already fixed');
  });
});

// #1398: the reload frame now carries the server's classification of the
// change, and the relay is where a coalesced batch resolves to ONE verdict.
// The rule is STRONGEST-wins, never last-wins: a burst mixing a page edit and a
// component edit is a component edit, and morphing it would leave the old
// component class running against fresh markup.
suite('dev reload verdicts (#1398)', () => {
  test('a page verdict rides the fanout to every tab', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    FakeEventSource.last.fire('reload', '{"v":"page","by":"app/page.ts","why":"page-module"}');
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'page' }], 'the tab is told it can morph');
  });

  test('a batch mixing a page edit and a component edit collapses to reload', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    const es = FakeEventSource.last;
    es.fire('reload', '{"v":"page"}');
    tick(500);
    es.fire('reload', '{"v":"reload"}');
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'reload' }], 'exactly one fanout, at the strongest verdict');
  });

  // COUNTERFACTUAL for a last-write-wins relay, which passes the test above and
  // fails this one. Same two signals, opposite order.
  test('the strongest verdict wins regardless of arrival order', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    const es = FakeEventSource.last;
    es.fire('reload', '{"v":"reload"}');
    tick(500);
    es.fire('reload', '{"v":"page"}');
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'reload' }], 'a later page verdict cannot weaken the batch');
  });

  test('shell outranks page and is outranked by reload', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    const es = FakeEventSource.last;
    es.fire('reload', '{"v":"page"}');
    es.fire('reload', '{"v":"shell"}');
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'shell' }], 'a layout edit in the batch wins over a page edit');
  });

  // A restart carries no filename, so nothing survives it to classify. A burst
  // can hold a page edit whose in-process frame was delivered next to a
  // component edit whose frame died with the old process, and the changed boot
  // id is that component edit's ONLY trace. So it is a `reload` contribution,
  // never a "no verdict" that a lighter one already in the batch can override.
  test('a changed boot id forces a full reload even with a page verdict in the batch', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    const es = FakeEventSource.last;
    es.fire('hello', 'BOOT_A');            // baseline
    es.fire('reload', '{"v":"page"}');
    tick(500);
    es.fire('hello', 'BOOT_B');            // the process was replaced
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'reload' }]);
  });

  test('a new batch after an emit starts fresh at the weakest verdict', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    const es = FakeEventSource.last;
    es.fire('reload', '{"v":"reload"}');
    tick(RELOAD_QUIET_MS);
    es.fire('reload', '{"v":"page"}');
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [
      { type: 'reload', verdict: 'reload' },
      { type: 'reload', verdict: 'page' },
    ], 'the previous batch\'s verdict does not leak into the next one');
  });

  // The wire-skew guard. A tab running against a restarted server, or any
  // payload the relay cannot read, must resolve to the behaviour that predates
  // this feature.
  test('parseVerdict resolves anything it cannot read to reload', () => {
    assert.equal(parseVerdict('now'), 'reload', 'the legacy bare payload');
    assert.equal(parseVerdict(''), 'reload');
    assert.equal(parseVerdict(undefined), 'reload');
    assert.equal(parseVerdict('null'), 'reload');
    assert.equal(parseVerdict('{}'), 'reload', 'an object with no v');
    assert.equal(parseVerdict('{"v":"bogus"}'), 'reload', 'a v outside the three literals');
    assert.equal(parseVerdict('{"v":'), 'reload', 'malformed JSON');
    assert.equal(parseVerdict('"page"'), 'reload', 'a bare string is not an object');
    assert.equal(parseVerdict('{"v":"page"}'), 'page', 'and a good one still parses');
    assert.equal(parseVerdict('{"v":"shell"}'), 'shell');
  });
});

// #1507: the stream is open only while some tab is visible, it is silent
// between events, and it comes back with backoff only when it really drops,
// so a host that sleeps on network quiet can sleep while a dev tab is open in
// the background, and a server that is gone is probed less and less often.
suite('dev reload stream pauses when hidden and reconnects with backoff (#1507)', () => {
  /** Send a tab-to-relay message the way the served client does. */
  function say(p, msg) { p.port.onmessage({ data: msg }); }

  test('no connection until a tab connects', () => {
    const { scope } = fakeClock();
    const relay = startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    assert.equal(relay.es, null, 'nothing is opened for nobody');
    scope.onconnect({ ports: [fakePort().port] });
    assert.ok(relay.es, 'the first tab opens the stream');
  });

  test('the stream closes when the last visible tab hides and reopens when one shows', () => {
    const { scope } = fakeClock();
    const relay = startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort(); const b = fakePort();
    scope.onconnect({ ports: [a.port] });
    scope.onconnect({ ports: [b.port] });
    const first = relay.es;
    say(a, { type: 'visibility', visible: false });
    assert.equal(relay.es, first, 'one visible tab keeps it open');
    say(b, { type: 'visibility', visible: false });
    assert.equal(relay.es, null, 'every tab hidden: no request in flight');
    assert.equal(first.closed, true, 'the EventSource is closed, not just ignored');
    say(b, { type: 'visibility', visible: true });
    assert.ok(relay.es && relay.es !== first, 'a visible tab reopens a fresh stream');
  });

  test('a closed tab (bye) stops counting as visible', () => {
    const { scope } = fakeClock();
    const relay = startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    say(a, { type: 'bye' });
    assert.equal(relay.es, null);
    assert.equal(relay.ports.size, 0, 'the port is forgotten');
  });

  test('an edit made while paused reloads on return (the hello seq moved)', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    FakeEventSource.last.fire('hello', JSON.stringify({ boot: 'B', seq: 3 }));
    say(a, { type: 'visibility', visible: false });
    say(a, { type: 'visibility', visible: true });
    FakeEventSource.last.fire('hello', JSON.stringify({ boot: 'B', seq: 4 }));
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'reload' }]);
  });

  test('no edit while paused: returning does not reload, even after reloads it did see', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    FakeEventSource.last.fire('hello', JSON.stringify({ boot: 'B', seq: 0 }));
    FakeEventSource.last.fire('reload', JSON.stringify({ v: 'page', seq: 1 }));
    tick(RELOAD_QUIET_MS);
    assert.equal(a.received.length, 1, 'the live reload went through');
    say(a, { type: 'visibility', visible: false });
    say(a, { type: 'visibility', visible: true });
    FakeEventSource.last.fire('hello', JSON.stringify({ boot: 'B', seq: 1 }));
    tick(RELOAD_QUIET_MS);
    assert.equal(a.received.length, 1, 'the seq it already saw is not a new edit');
  });

  test('a dropped stream reconnects with doubling backoff, reset by the next hello', () => {
    const { scope, tick } = fakeClock();
    const relay = startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    scope.onconnect({ ports: [fakePort().port] });
    const opened = () => FakeEventSource.opened;
    const start = opened();
    relay.es.fire('error');
    assert.equal(relay.es, null, 'the dropped stream is closed, so the browser never retries on its own');
    tick(RECONNECT_BASE_MS - 1);
    assert.equal(opened(), start, 'not before the backoff');
    tick(1);
    assert.equal(opened(), start + 1, 'first retry after the base wait');
    relay.es.fire('error');
    tick(RECONNECT_BASE_MS * 2 - 1);
    assert.equal(opened(), start + 1);
    tick(1);
    assert.equal(opened(), start + 2, 'the wait doubles');
    for (let i = 0; i < 12; i++) { relay.es.fire('error'); tick(RECONNECT_MAX_MS); }
    const before = opened();
    relay.es.fire('error');
    tick(RECONNECT_MAX_MS);
    assert.equal(opened(), before + 1, 'the wait is capped');
    relay.es.fire('hello', JSON.stringify({ boot: 'X', seq: 0 }));
    relay.es.fire('error');
    tick(RECONNECT_BASE_MS);
    assert.equal(opened(), before + 2, 'a hello resets the backoff');
  });

  test('a stream that drops while every tab is hidden is not retried until one shows', () => {
    const { scope, tick } = fakeClock();
    const relay = startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    relay.es.fire('error');
    say(a, { type: 'visibility', visible: false });
    const n = FakeEventSource.opened;
    tick(RECONNECT_MAX_MS * 2);
    assert.equal(FakeEventSource.opened, n, 'no retry for a hidden page');
    say(a, { type: 'visibility', visible: true });
    assert.equal(FakeEventSource.opened, n + 1, 'showing the tab reconnects at once');
  });

  // Idle close (webjs.dev.reloadIdle): a host that counts an OPEN request as
  // activity (a pilots sandbox does, for the request's whole life) never
  // sleeps while the stream is open, however quiet it is.
  test('with idleMs, a stream with no events and no interaction closes, and interaction reopens it', () => {
    const { scope, tick } = fakeClock();
    const relay = startReloadWorker(scope, FakeEventSource, '/__webjs/events', { idleMs: 20000 });
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    relay.es.fire('hello', JSON.stringify({ boot: 'B', seq: 0 }));
    tick(15000);
    say(a, { type: 'activity' });
    tick(15000);
    assert.ok(relay.es, 'activity pushed the idle deadline out');
    relay.es.fire('reload', JSON.stringify({ v: 'page', seq: 1 }));
    tick(19999);
    assert.ok(relay.es, 'an edit counts as activity too');
    tick(RELOAD_MAX_HOLD_MS);
    assert.equal(relay.es, null, 'quiet for idleMs: closed, nothing in flight');
    say(a, { type: 'activity' });
    assert.ok(relay.es, 'the next interaction reopens it');
  });

  test('an edit made while idle-closed reloads once the stream reopens', () => {
    const { scope, tick } = fakeClock();
    const relay = startReloadWorker(scope, FakeEventSource, '/__webjs/events', { idleMs: 20000 });
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    relay.es.fire('hello', JSON.stringify({ boot: 'B', seq: 2 }));
    tick(20000);
    assert.equal(relay.es, null);
    say(a, { type: 'activity' });
    relay.es.fire('hello', JSON.stringify({ boot: 'B', seq: 3 }));
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'reload' }]);
  });

  test('without idleMs the stream never closes on its own', () => {
    const { scope, tick } = fakeClock();
    const relay = startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    scope.onconnect({ ports: [fakePort().port] });
    tick(10 * 60 * 1000);
    assert.ok(relay.es, 'local dev keeps live reload with no interaction');
  });

  test('activity from a hidden tab does not reopen the stream', () => {
    const { scope } = fakeClock();
    const relay = startReloadWorker(scope, FakeEventSource, '/__webjs/events', { idleMs: 20000 });
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    say(a, { type: 'visibility', visible: false });
    say(a, { type: 'activity' });
    assert.equal(relay.es, null);
  });

  // #1516: every reconnect re-checks each tab against the state its PAGE was
  // rendered at, so a reload frame that no stream carried is not lost.
  test('a dropped stream with an edit in between, whose reload frame was lost, reloads on the reconnect', () => {
    const { scope, tick } = fakeClock();
    const relay = startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    say(a, { type: 'page', boot: 'B', seq: 3 });
    relay.es.fire('hello', JSON.stringify({ boot: 'B', seq: 3 }));
    // The host suspends, then wakes and closes the held stream. The edit that
    // woke it emitted reload seq 4 into the old stream, which nobody read.
    relay.es.fire('error');
    tick(RECONNECT_BASE_MS);
    assert.ok(relay.es, 'reconnected');
    relay.es.fire('hello', JSON.stringify({ boot: 'B', seq: 4 }));
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'reload' }]);
  });

  test('a fresh relay reloads a page rendered before an edit (no previous hello to compare)', () => {
    const { scope, tick } = fakeClock();
    const relay = startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    say(a, { type: 'page', boot: 'B', seq: 3 });
    relay.es.fire('hello', JSON.stringify({ boot: 'B', seq: 4 }));
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'reload' }]);
  });

  test('a fresh relay reloads a page rendered by a previous server process', () => {
    const { scope, tick } = fakeClock();
    const relay = startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    say(a, { type: 'page', boot: 'OLD', seq: 9 });
    relay.es.fire('hello', JSON.stringify({ boot: 'NEW', seq: 0 }));
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'reload' }]);
  });

  test('a tab that connects after a reload was fanned out still reloads, and only that tab', () => {
    const { scope, tick } = fakeClock();
    const relay = startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    say(a, { type: 'page', boot: 'B', seq: 3 });
    relay.es.fire('hello', JSON.stringify({ boot: 'B', seq: 3 }));
    relay.es.fire('reload', JSON.stringify({ v: 'reload', seq: 4 }));
    tick(RELOAD_QUIET_MS);
    assert.equal(a.received.length, 1, 'tab A got the live reload');
    // Tab B's page was rendered at seq 3, before the edit, and connects now.
    const b = fakePort();
    scope.onconnect({ ports: [b.port] });
    say(b, { type: 'page', boot: 'B', seq: 3 });
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(b.received, [{ type: 'reload', verdict: 'reload' }], 'tab B caught up');
    assert.equal(a.received.length, 1, 'tab A, already current, is not reloaded again');
  });

  test('an up-to-date page never reloads on a reconnect', () => {
    const { scope, tick } = fakeClock();
    const relay = startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    say(a, { type: 'page', boot: 'B', seq: 4 });
    relay.es.fire('hello', JSON.stringify({ boot: 'B', seq: 4 }));
    relay.es.fire('error');
    tick(RECONNECT_BASE_MS);
    relay.es.fire('hello', JSON.stringify({ boot: 'B', seq: 4 }));
    tick(RELOAD_QUIET_MS);
    assert.equal(a.received.length, 0);
  });

  test('a page the relay already reloaded is current at the next reconnect', () => {
    const { scope, tick } = fakeClock();
    const relay = startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    say(a, { type: 'page', boot: 'B', seq: 1 });
    relay.es.fire('hello', JSON.stringify({ boot: 'B', seq: 1 }));
    // A light (page) reload is applied in place, so the tab keeps its port and
    // never re-reports; the relay records it as current.
    relay.es.fire('reload', JSON.stringify({ v: 'page', seq: 2 }));
    tick(RELOAD_QUIET_MS);
    relay.es.fire('error');
    tick(RECONNECT_BASE_MS);
    relay.es.fire('hello', JSON.stringify({ boot: 'B', seq: 2 }));
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'page' }], 'one reload, not a second one on the reconnect');
  });

  test('with idleMs, a page behind the server reloads once when the idle-closed stream reopens', () => {
    const { scope, tick } = fakeClock();
    const relay = startReloadWorker(scope, FakeEventSource, '/__webjs/events', { idleMs: 20000 });
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    say(a, { type: 'page', boot: 'B', seq: 2 });
    relay.es.fire('hello', JSON.stringify({ boot: 'B', seq: 2 }));
    tick(20000);
    assert.equal(relay.es, null, 'idle-closed');
    say(a, { type: 'activity' });
    relay.es.fire('hello', JSON.stringify({ boot: 'B', seq: 3 }));
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'reload' }], 'exactly one reload');
  });

  test('pageIsStale compares boot, then seq, and never guesses without a seq', () => {
    assert.equal(pageIsStale({ boot: 'B', seq: 3 }, 'B', 3), false);
    assert.equal(pageIsStale({ boot: 'B', seq: 3 }, 'B', 4), true);
    assert.equal(pageIsStale({ boot: 'A', seq: 3 }, 'B', 3), true);
    assert.equal(pageIsStale({ boot: 'B', seq: null }, 'B', 4), false);
    assert.equal(pageIsStale({ boot: 'B', seq: 3 }, null, null), false, 'nothing known yet');
    assert.equal(pageIsStale(undefined, 'B', 3), false);
  });

  test('parseHello reads the JSON hello and the bare boot id an older server sends', () => {
    assert.deepEqual(parseHello('{"boot":"b1","seq":4}'), { boot: 'b1', seq: 4 });
    assert.deepEqual(parseHello('b1'), { boot: 'b1', seq: null });
  });
});

// #1575: a server that reloads in place (Bun's one long-lived dev server)
// marks its frames, and nothing restarts behind them, so the relay need not
// sit out the 2000ms restart window that was most of the save-to-paint time.
suite('dev reload settle for an in-place server (#1575)', () => {
  test('a batch of in-place frames reloads after the short window', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    FakeEventSource.last.fire('reload', JSON.stringify({ v: 'page', seq: 1, inPlace: true }));
    FakeEventSource.last.fire('reload', JSON.stringify({ v: 'page', seq: 2, inPlace: true }));
    tick(RELOAD_QUIET_IN_PLACE_MS - 1);
    assert.deepEqual(a.received, [], 'still folding the burst');
    tick(1);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'page' }], 'one reload, right after the burst');
  });

  test('a restart signal in the batch keeps the full window', () => {
    const { scope, tick } = fakeClock();
    startReloadWorker(scope, FakeEventSource, '/__webjs/events');
    const a = fakePort();
    scope.onconnect({ ports: [a.port] });
    FakeEventSource.last.fire('reload', JSON.stringify({ v: 'page', seq: 1 }));
    FakeEventSource.last.fire('reload', JSON.stringify({ v: 'page', seq: 2, inPlace: true }));
    tick(RELOAD_QUIET_IN_PLACE_MS);
    assert.deepEqual(a.received, [], 'a frame from a restarting server waits');
    tick(RELOAD_QUIET_MS);
    assert.deepEqual(a.received, [{ type: 'reload', verdict: 'page' }]);
    // The next batch starts short again.
    FakeEventSource.last.fire('reload', JSON.stringify({ v: 'page', seq: 3, inPlace: true }));
    tick(RELOAD_QUIET_IN_PLACE_MS);
    assert.equal(a.received.length, 2);
  });

  test('frameInPlace reads only an explicit true', () => {
    assert.equal(frameInPlace('{"v":"page","inPlace":true}'), true);
    assert.equal(frameInPlace('{"v":"page"}'), false);
    assert.equal(frameInPlace('not json'), false);
  });
});
