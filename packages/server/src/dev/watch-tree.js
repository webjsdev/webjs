import { watch, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { watchRecursive } from './watch-recursive.js';
import { pollTree, isWatchLimitError } from './watch-poll.js';

/**
 * The dev live-reload watcher over one root (#1521).
 *
 * Two problems with the plain `fs.promises.watch(root, { recursive: true })`
 * this replaces, both on Node 24's JS-implemented recursive watcher on Linux
 * (`internal/fs/recursive_watch`), which opens one `fs.watch` per FILE:
 *
 * 1. A per-file failure (EACCES on a `sed -i` temp file another user created
 *    with mode 0600, ENOENT on a file that vanished between the directory event
 *    and the watch call) is emitted as `'error'` on an internal watcher the
 *    promise API never listens to, so it surfaces as an uncaughtException and
 *    the dev server shuts down. The callback form takes an `'error'` listener,
 *    and the watcher keeps delivering events for every other file after it.
 * 2. Watching the app ROOT walks `node_modules` too: about 10k per-file watches
 *    and roughly 275ms of synchronous work on every boot of a scaffolded app,
 *    all for events the ignore filter then drops. So the root is watched
 *    non-recursively and each top-level directory that is not ignored gets its
 *    own recursive watcher.
 *
 * A top-level directory created or removed after start is picked up from the
 * root watcher's events, so `mkdir lib` mid-session is watched like it was
 * there at boot.
 *
 * When the OS runs out of watches (ENOSPC once the inotify limit is reached,
 * EMFILE for file descriptors, #1689), the directory that failed is polled
 * instead (`watch-poll.js`) and `onFallback` is told once per directory, so its
 * edits keep arriving, a second slower, instead of never. A root watcher that
 * fails that way polls the root's direct entries.
 *
 * @param {string} root  absolute directory to watch
 * @param {{
 *   ignore: (relPath: string) => boolean,
 *   onEvent: (relPath: string) => void,
 *   onError: (err: NodeJS.ErrnoException) => void,
 *   onFallback?: (name: string, err: NodeJS.ErrnoException) => void,
 *   watchFn?: typeof watch,
 *   pollMs?: number,
 * }} opts  `relPath` is relative to `root`, with OS separators. `onFallback`
 *   gets the top-level directory name (`''` for the root). `watchFn` and
 *   `pollMs` are test seams.
 * @returns {() => void} closes every watcher
 */
export function watchTree(root, { ignore, onEvent, onError, onFallback, watchFn = watch, pollMs = 1000 }) {
  /** @type {Map<string, { close: () => void, polled?: boolean }>} */
  const dirs = new Map();
  let closed = false;

  const isDir = (name) => {
    try { return statSync(join(root, name)).isDirectory(); } catch { return false; }
  };

  /** Replace a top-level directory's watcher with a poller. */
  const pollDir = (name, /** @type {NodeJS.ErrnoException} */ err) => {
    if (closed || dirs.get(name)?.polled) return;
    try { dirs.get(name)?.close(); } catch {}
    const stop = pollTree(join(root, name), {
      ignore: (rel) => ignore(join(name, rel)),
      onEvent: (rel) => onEvent(join(name, rel)),
      intervalMs: pollMs,
    });
    dirs.set(name, { close: stop, polled: true });
    onFallback?.(name, err);
  };

  const watchDir = (name) => {
    if (closed || dirs.has(name) || ignore(name)) return;
    const failed = (/** @type {NodeJS.ErrnoException} */ err) => {
      if (isWatchLimitError(err)) pollDir(name, err);
      else onError(err);
    };
    try {
      // `watchRecursive` (#1529): on Linux under Node a per-directory walker,
      // since Node 24's recursive watcher goes deaf to a file once it is
      // replaced (`sed -i`, an editor's atomic save).
      const w = watchRecursive(join(root, name), (_type, filename) => {
        const rel = filename ? join(name, String(filename)) : name;
        if (!ignore(rel)) onEvent(rel);
      }, { ignore: (rel) => ignore(join(name, rel)), watchFn });
      w.on('error', (err) => failed(/** @type {NodeJS.ErrnoException} */ (err)));
      dirs.set(name, w);
    } catch (err) {
      failed(/** @type {NodeJS.ErrnoException} */ (err));
    }
  };

  /** A top-level entry changed: start or stop following it as a directory. */
  const onTop = (/** @type {string} */ name) => {
    if (ignore(name)) return;
    if (isDir(name)) watchDir(name);
    else if (dirs.has(name)) { try { dirs.get(name)?.close(); } catch {} dirs.delete(name); }
    onEvent(name);
  };

  /** @type {{ close: () => void } | null} */
  let top = null;
  const pollRoot = (/** @type {NodeJS.ErrnoException} */ err) => {
    if (closed) return;
    try { top?.close(); } catch {}
    top = { close: pollTree(root, { ignore, onEvent: onTop, intervalMs: pollMs, recursive: false }) };
    onFallback?.('', err);
  };
  const rootFailed = (/** @type {NodeJS.ErrnoException} */ err) => {
    if (isWatchLimitError(err)) pollRoot(err);
    else onError(err);
  };
  try {
    const w = watchFn(root, (_type, filename) => { if (filename) onTop(String(filename)); });
    w.on('error', (err) => rootFailed(/** @type {NodeJS.ErrnoException} */ (err)));
    top = w;
  } catch (err) {
    rootFailed(/** @type {NodeJS.ErrnoException} */ (err));
  }

  let entries = [];
  try { entries = readdirSync(root, { withFileTypes: true }); } catch {}
  for (const e of entries) {
    if (e.isDirectory() || (e.isSymbolicLink() && isDir(e.name))) watchDir(e.name);
  }

  return () => {
    closed = true;
    try { top?.close(); } catch {}
    for (const w of dirs.values()) { try { w.close(); } catch {} }
    dirs.clear();
  };
}

/**
 * Whether an error came from a file watcher (#1521). Node marks every
 * `fs.watch` failure with `syscall: 'watch'` (EACCES, EPERM, ENOENT, ELOOP, and
 * ENOSPC when the inotify limit is reached). One unwatchable path is never a
 * reason to stop a dev server, so the dev process handlers log these and keep
 * serving.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
export function isWatchError(err) {
  return !!err && typeof err === 'object' && /** @type {any} */ (err).syscall === 'watch';
}
