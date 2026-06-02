/**
 * Broadcast fan-out property test (issue #210, subsystem hardening).
 *
 * INVARIANT: a message broadcast to a topic (path) reaches every CURRENT
 * open subscriber of that topic and no subscriber of another topic; a
 * subscriber that closes auto-deregisters and stops receiving; the `except`
 * client is skipped. The existing broadcast.test.js checks 2-client cases;
 * this asserts the fan-out + isolation property across N subscribers and
 * multiple topics.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { registerClient, broadcast, clientCount } from '../../src/broadcast.js';

/** Minimal mock WebSocket: records sent frames, can emit a close. */
function mockWs() {
  const handlers = {};
  return {
    readyState: 1, // OPEN
    sent: [],
    send(d) { this.sent.push(d); },
    on(ev, fn) { handlers[ev] = fn; },
    _close() { this.readyState = 3; handlers.close?.(); },
  };
}

test('a broadcast reaches every subscriber of the topic and no other topic', async () => {
  const topicA = Array.from({ length: 6 }, () => mockWs());
  const topicB = Array.from({ length: 3 }, () => mockWs());
  topicA.forEach((ws) => registerClient('/a', ws));
  topicB.forEach((ws) => registerClient('/b', ws));
  assert.equal(clientCount('/a'), 6);
  assert.equal(clientCount('/b'), 3);

  broadcast('/a', 'hello-a');
  for (const ws of topicA) assert.deepEqual(ws.sent, ['hello-a'], 'every /a subscriber receives the message');
  for (const ws of topicB) assert.deepEqual(ws.sent, [], 'no /b subscriber receives a /a broadcast');
});

test('a closed subscriber auto-deregisters and stops receiving', async () => {
  const a = mockWs(), b = mockWs();
  registerClient('/t', a);
  registerClient('/t', b);
  assert.equal(clientCount('/t'), 2);
  a._close();
  assert.equal(clientCount('/t'), 1, 'closing auto-deregisters');
  broadcast('/t', 'after-close');
  assert.deepEqual(a.sent, [], 'a closed subscriber receives nothing');
  assert.deepEqual(b.sent, ['after-close'], 'the remaining subscriber still receives');
});

test('the `except` client is skipped', async () => {
  const sender = mockWs(), other = mockWs();
  registerClient('/c', sender);
  registerClient('/c', other);
  broadcast('/c', 'echo', { except: sender });
  assert.deepEqual(sender.sent, [], 'the except client is skipped');
  assert.deepEqual(other.sent, ['echo'], 'others still receive');
});

test('a non-open subscriber is skipped, and broadcasting to an empty topic is safe', async () => {
  const open = mockWs(), connecting = mockWs();
  connecting.readyState = 0; // CONNECTING
  registerClient('/d', open);
  registerClient('/d', connecting);
  broadcast('/d', 'x');
  assert.deepEqual(open.sent, ['x']);
  assert.deepEqual(connecting.sent, [], 'a non-open socket is not sent to');
  assert.doesNotThrow(() => broadcast('/never-registered', 'y'), 'broadcasting to an empty topic must not throw');
});
