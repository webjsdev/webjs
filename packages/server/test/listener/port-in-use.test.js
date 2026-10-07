/**
 * Unit tests for the taken-port helpers (#1527): the /proc parsing that names
 * the holder, the message, the error shape, and the WEBJS_REUSE_PORT opt-in.
 * The end-to-end proof on both runtimes is test/bun/port-in-use.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import {
  listenInodes,
  findPortHolder,
  portInUseMessage,
  portInUseError,
  reusePortRequested,
  isAddrInUse,
} from '../../src/port-in-use.js';

const TCP = `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 00000000:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 111 1 0000000000000000 100 0 0 10 0
   1: 0100007F:1F90 0100007F:D2F0 01 00000000:00000000 00:00000000 00000000  1000        0 222 1 0000000000000000 20 4 30 10 -1
   2: 00000000:1F91 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 333 1 0000000000000000 100 0 0 10 0
`;
const TCP6 = `  sl  local_address                         remote_address                        st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 00000000000000000000000000000000:1F90 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 444 1 0000000000000000 100 0 0 10 0
`;

test('listenInodes keeps only LISTEN rows on the port, v4 and v6', () => {
  assert.deepEqual(listenInodes(TCP, 8080), ['111'], 'the ESTABLISHED row on 8080 and the 8081 listener are skipped');
  assert.deepEqual(listenInodes(TCP6, 8080), ['444']);
  assert.deepEqual(listenInodes(TCP, 9999), []);
});

test('findPortHolder walks /proc fds to the listening process and reads its command', () => {
  const files = {
    '/proc/net/tcp': TCP,
    '/proc/net/tcp6': TCP6,
    '/proc/77/cmdline': 'bun\0--hot\0node_modules/.bin/webjs\0dev\0',
  };
  const dirs = { '/proc': ['self', '1', '77', '99'], '/proc/1/fd': ['0'], '/proc/77/fd': ['0', '48'], '/proc/99/fd': ['3'] };
  const links = { '/proc/1/fd/0': '/dev/null', '/proc/77/fd/0': '/dev/null', '/proc/77/fd/48': 'socket:[444]', '/proc/99/fd/3': 'socket:[999]' };
  const io = {
    readFile: (p) => { if (!(p in files)) throw new Error('ENOENT'); return files[p]; },
    readDir: (p) => { if (!(p in dirs)) throw new Error('EACCES'); return dirs[p]; },
    readLink: (p) => { if (!(p in links)) throw new Error('EACCES'); return links[p]; },
    selfPid: 99,
  };
  assert.deepEqual(findPortHolder(8080, io), { pid: 77, command: 'bun --hot node_modules/.bin/webjs dev' });
  assert.equal(findPortHolder(9999, io), null, 'nothing listens there');
  assert.equal(findPortHolder(8080, { ...io, readFile: () => { throw new Error('no /proc'); } }), null, 'no /proc: null, never a throw');
});

test('findPortHolder finds a real listener in this process tree on Linux', { skip: process.platform !== 'linux' }, async () => {
  const srv = createServer();
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = /** @type {any} */ (srv.address()).port;
  try {
    assert.equal(findPortHolder(port, { selfPid: -1 })?.pid, process.pid);
  } finally {
    srv.close();
  }
});

test('portInUseMessage names the holder, or says another process', () => {
  assert.equal(
    portInUseMessage(8080, { pid: 12, command: 'bun webjs dev' }),
    'port 8080 is already in use by PID 12 (bun webjs dev). Stop that server, or start this one on another port (PORT=<n> or --port <n>).',
  );
  assert.match(portInUseMessage(8080, null), /^port 8080 is already in use by another process\./);
});

test('portInUseError carries code, port and the cause', () => {
  const cause = new Error('listen EADDRINUSE');
  const err = portInUseError(1, cause);
  assert.equal(err.code, 'EADDRINUSE');
  assert.equal(err.port, 1);
  assert.equal(err.cause, cause);
  assert.match(err.message, /^port 1 is already in use/);
});

test('isAddrInUse matches Node and Bun bind failures only', () => {
  assert.ok(isAddrInUse(Object.assign(new Error('x'), { code: 'EADDRINUSE' })));
  assert.ok(isAddrInUse(new Error('Failed to start server. Is port 8080 in use?')));
  assert.ok(!isAddrInUse(new Error('EACCES: permission denied')));
  assert.ok(!isAddrInUse(null));
});

test('reusePortRequested is an explicit opt-in', () => {
  assert.equal(reusePortRequested({}), false);
  assert.equal(reusePortRequested({ WEBJS_REUSE_PORT: '0' }), false);
  assert.equal(reusePortRequested({ WEBJS_REUSE_PORT: '1' }), true);
  assert.equal(reusePortRequested({ WEBJS_REUSE_PORT: 'true' }), true);
});
