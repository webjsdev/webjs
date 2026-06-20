/**
 * Cross-runtime WIRING test for the Bun-shell server timeout (#663). The pure
 * ms->seconds mapping is unit-tested in packages/server/test/body-limit/
 * bun-idle-timeout.test.js (which the Bun matrix re-runs under bun); THIS script
 * proves the other half on the real Bun shell: that startBunListener actually
 * feeds bunIdleTimeout(timeouts) into Bun.serve's `idleTimeout`. The node:http
 * side (requestTimeout/headersTimeout/keepAliveTimeout) is a separate shell,
 * covered by packages/server/test/body-limit/server-timeouts.test.js.
 *
 *   bun test/bun/timeouts.mjs   # the only shell with a Bun.serve to assert
 *
 * It stubs Bun.serve to capture the options (no real socket), so it is a Bun-
 * only assertion; on node it is a no-op skip (the node shell has no Bun.serve).
 */
import assert from 'node:assert/strict';

if (!process.versions.bun) {
  console.log('SKIP (node): the Bun.serve idleTimeout wiring only exists on the Bun shell');
  process.exit(0);
}

const { startBunListener } = await import('../../packages/server/src/listener-bun.js');

const quiet = { info() {}, warn() {}, error() {}, debug() {} };
const minimalCtx = (timeouts) => ({
  app: { handle: async () => new Response(''), warmup() {} },
  dev: false,
  compress: false,
  logger: quiet,
  hub: { closeAll() {} },
  port: 0,
  basePathStr: '',
  timeouts,
  watcherAbort: null,
});

// Capture the options handed to Bun.serve without opening a real socket.
const realServe = Bun.serve.bind(Bun);
let captured = null;
Bun.serve = (opts) => {
  captured = opts;
  return { port: 0, stop() {}, reload() {} };
};

try {
  // 1. A configured requestTimeout reaches Bun.serve as the mapped idleTimeout.
  const a = startBunListener(minimalCtx({ requestTimeout: 45_000 }));
  assert.equal(captured.idleTimeout, 45, 'requestTimeout 45000ms must map to idleTimeout 45s');
  assert.equal(captured.development, false, 'Bun dev error page stays off (webjs owns its overlay)');
  await a.close();

  // 2. The disable sentinel (0) passes through.
  const b = startBunListener(minimalCtx({ requestTimeout: 0 }));
  assert.equal(captured.idleTimeout, 0, 'requestTimeout 0 disables the idle timeout');
  await b.close();

  // 3. The default (no timeouts configured) is the 30s floor.
  const c = startBunListener(minimalCtx(undefined));
  assert.equal(captured.idleTimeout, 30, 'no requestTimeout falls back to the 30s default');
  await c.close();
} finally {
  Bun.serve = realServe;
  // startBunListener registers a process SIGINT/SIGTERM handler per call that
  // its close() does not remove; drop them so the 3 calls leave no listeners
  // behind (this short-lived script installs none of its own).
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');
}

console.log(`OK  webjs Bun.serve idleTimeout wiring passed on bun ${process.versions.bun} (#663)`);
