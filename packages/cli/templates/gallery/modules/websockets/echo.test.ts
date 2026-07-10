// Example node test for booting a server and wiring WebSockets (from
// @webjsdev/server). startServer({ appDir, port }) boots the app in-process and
// returns { server, close } (the same entry `webjs start` uses; port 0 picks a
// free port). attachWebSocket(server, () => table, opts) upgrades a raw
// node:http server to serve the WS() exports in the route table, the wiring
// startServer does for you and the way you test a WS endpoint against a bare
// server. See the testing docs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { startServer, attachWebSocket, buildRouteTable } from '@webjsdev/server';

const appDir = process.cwd();
const silent = { info() {}, warn() {}, error() {} };

test('startServer boots the app in-process on an ephemeral port', async () => {
  const { server, close } = await startServer({ appDir, dev: true, port: 0, logger: silent });
  try {
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object', 'the server is listening');
  } finally {
    await close();
  }
});

test('attachWebSocket wires a raw server to the WS route table', async () => {
  const table = await buildRouteTable(appDir);
  const server = createServer((_req, res) => res.end());
  attachWebSocket(server, () => table, { dev: false, logger: silent });
  await new Promise((r) => server.listen(0, r));
  try {
    // A `ws` client would now connect to ws://localhost:<port>/features/websockets/echo
    // and exchange messages with the WS() export in that route.ts.
    assert.ok(server.address(), 'the WS-enabled server is listening');
  } finally {
    await new Promise((r) => server.close(r));
  }
});
