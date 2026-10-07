// startServer({ appDir, port: 0 }) boots the whole app in-process on a free
// port (the entry `webjs start` uses) and resolves to { server, close }. To
// assert on responses without a socket, use the handle() harness instead
// (modules/server-actions/actions/greet.test.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '@webjsdev/server';

const appDir = process.cwd();

test('startServer boots the app in-process on an ephemeral port', async () => {
  const { server, close } = await startServer({ appDir, dev: true, port: 0 });
  try {
    assert.ok(server.address(), 'the server is listening');
  } finally {
    await close();
  }
});
