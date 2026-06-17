import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ChatMessage } from '#/modules/chat/types.ts';
import { broadcast, clients } from '#/modules/chat/utils/clients.ts';

/**
 * The chat module pieces are very small:
 *   - types.ts: the wire format
 *   - utils/clients.ts: shared client Set + broadcast()
 *
 * The WebSocket handler itself is in app/api/chat/route.ts and is exercised
 * end-to-end by the browser tests. Here we just lock in the unit-level
 * invariants of the broadcast helper.
 */

class FakeSocket {
  readyState = 1; // OPEN
  sent: string[] = [];
  send(payload: string) { this.sent.push(payload); }
}

test('broadcast: sends to every open client', () => {
  clients.clear();
  const a = new FakeSocket();
  const b = new FakeSocket();
  clients.add(a as any);
  clients.add(b as any);

  const msg: ChatMessage = { kind: 'say', text: 'hi', at: 1 };
  broadcast(msg);

  assert.equal(a.sent.length, 1);
  assert.equal(b.sent.length, 1);
  assert.deepEqual(JSON.parse(a.sent[0]), msg);
  clients.clear();
});

test('broadcast: skips the excluded sender', () => {
  clients.clear();
  const sender = new FakeSocket();
  const other = new FakeSocket();
  clients.add(sender as any);
  clients.add(other as any);

  broadcast({ kind: 'say', text: 'hello', at: 2 } satisfies ChatMessage, sender as any);

  assert.equal(sender.sent.length, 0, 'sender must not echo to itself');
  assert.equal(other.sent.length, 1);
  clients.clear();
});

test('broadcast: ignores clients whose readyState is not OPEN', () => {
  clients.clear();
  const open = new FakeSocket();
  const closing = new FakeSocket();
  closing.readyState = 2; // CLOSING
  clients.add(open as any);
  clients.add(closing as any);

  broadcast({ kind: 'join', count: 1 } satisfies ChatMessage);

  assert.equal(open.sent.length, 1);
  assert.equal(closing.sent.length, 0);
  clients.clear();
});

test('broadcast: stringifies non-string payloads as JSON; passes string through', () => {
  clients.clear();
  const sock = new FakeSocket();
  clients.add(sock as any);

  broadcast({ kind: 'leave', count: 0 } satisfies ChatMessage);
  broadcast('already-stringified');

  assert.equal(sock.sent.length, 2);
  assert.deepEqual(JSON.parse(sock.sent[0]), { kind: 'leave', count: 0 });
  assert.equal(sock.sent[1], 'already-stringified');
  clients.clear();
});
