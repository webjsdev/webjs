import { watch, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { watchRecursive } from './watch-recursive.js';

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
 * @param {string} root  absolute directory to watch
 * @param {{
 *   ignore: (relPath: string) => boolean,
 *   onEvent: (relPath: string) => void,
 *   onError: (err: NodeJS.ErrnoException) => void,
 * }} opts  `relPath` is relative to `root`, with OS separators.
 * @returns {() => void} closes every watcher
 */
export function watchTree(root, { ignore, onEvent, onError }) {
  /** @type {Map<string, import('node:fs').FSWatcher>} */
  const dirs = new Map();
  let closed = false;

  const guard = (/** @type {import('node:fs').FSWatcher} */ w) => {
    w.on('error', (err) => onError(/** @type {NodeJS.ErrnoException} */ (err)));
    return w;
  };

  const isDir = (name) => {
    try { return statSync(join(root, name)).isDirectory(); } catch { return false; }
  };

  const watchDir = (name) => {
    if (closed || dirs.has(name) || ignore(name)) return;
    try {
      // `watchRecursive` (#1529): on Linux under Node a per-directory walker,
      // since Node 24's recursive watcher goes deaf to a file once it is
      // replaced (`sed -i`, an editor's atomic save).
      const w = guard(watchRecursive(join(root, name), (_type, filename) => {
        const rel = filename ? join(name, String(filename)) : name;
        if (!ignore(rel)) onEvent(rel);
      }, { ignore: (rel) => ignore(join(name, rel)) }));
      dirs.set(name, w);
    } catch (err) {
      onError(/** @type {NodeJS.ErrnoException} */ (err));
    }
  };

  /** @type {import('node:fs').FSWatcher | null} */
  let top = null;
  try {
    top = guard(watch(root, (_type, filename) => {
      if (!filename) return;
      const name = String(filename);
      if (ignore(name)) return;
      // A top-level entry changed: start or stop following it as a directory.
      if (isDir(name)) watchDir(name);
      else if (dirs.has(name)) { try { dirs.get(name)?.close(); } catch {} dirs.delete(name); }
      onEvent(name);
    }));
  } catch (err) {
    onError(/** @type {NodeJS.ErrnoException} */ (err));
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
