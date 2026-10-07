/**
 * A recursive directory watcher that keeps hearing a file after it is
 * replaced (#1529).
 *
 * KEEP IN SYNC: `packages/cli/lib/watch-recursive.js` and
 * `packages/server/src/dev/watch-recursive.js` are byte-identical copies (the
 * CLI does not import server internals); `packages/cli/test/dev-supervisor/
 * watch-recursive.test.js` fails when they drift.
 *
 * Node 24's `fs.watch(dir, { recursive: true })` on Linux is implemented in JS
 * (`internal/fs/recursive_watch`) with one inotify watch per FILE plus a map of
 * the files it knows. `sed -i`, an editor's save through a temp file, and every
 * atomic write REPLACE the file (a new inode renamed over the old name). The
 * per-file watch dies with the old inode, and the new file is never watched
 * again because its name is already in the map, so every later edit to that
 * file is silent: no dev restart, no live reload. Node 26 fixed it, but WebJs
 * supports Node 24.
 *
 * A plain `fs.watch` on a DIRECTORY reports a replaced child by name on every
 * Node version, so on Linux under Node this watches each directory
 * non-recursively (one inotify watch per directory, fewer than one per file),
 * adds a watcher when a subdirectory appears, and drops one when it goes away.
 * Everywhere else the native recursive watcher is used unchanged: macOS and
 * Windows have a kernel-level recursive watch, and Bun's `bun --hot` reloads
 * edits itself.
 *
 * @module watch-recursive
 */
import { watch, readdirSync, realpathSync, statSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { join, sep } from 'node:path';

/**
 * Whether this runtime needs the per-directory walker rather than the native
 * recursive watcher.
 *
 * @param {{ platform?: string, isBun?: boolean }} [env]
 * @returns {boolean}
 */
export function needsDirWalker({ platform = process.platform, isBun = !!process.versions.bun } = {}) {
  return platform === 'linux' && !isBun;
}

/**
 * Watch `dir` and everything under it. The listener gets `(eventType,
 * filename)` with `filename` relative to `dir`, like the native recursive
 * watcher. The returned watcher emits `'error'` for any watch or scan failure
 * (never throws for one) and has `close()`.
 *
 * @param {string} dir
 * @param {(eventType: string, filename: string | null) => void} listener
 * @param {{
 *   ignore?: (relPath: string) => boolean,
 *   watchFn?: typeof watch,
 *   walker?: boolean,
 * }} [opts]  `ignore` skips a subdirectory (never walked, never watched) and
 *   its events; `watchFn` is injectable for tests; `walker` forces the mode.
 * @returns {import('node:events').EventEmitter & { close: () => void }}
 */
export function watchRecursive(dir, listener, { ignore = () => false, watchFn = watch, walker = needsDirWalker() } = {}) {
  if (!walker) return /** @type {any} */ (watchFn(dir, { recursive: true }, listener));

  const out = /** @type {EventEmitter & { close: () => void }} */ (new EventEmitter());
  /** @type {Map<string, import('node:fs').FSWatcher>} rel dir -> watcher */
  const watchers = new Map();
  /** @type {Map<string, string>} real path -> rel dir (a symlink loop guard) */
  const reals = new Map();
  let closed = false;
  // Errors from the initial walk happen before the caller can attach an
  // 'error' listener, so they are held and emitted on the next tick.
  /** @type {unknown[] | null} */
  let early = [];

  const fail = (err) => {
    if (closed) return;
    if (early) early.push(err);
    else if (out.listenerCount('error') > 0) out.emit('error', err);
  };
  const abs = (rel) => (rel ? join(dir, rel) : dir);
  const isDir = (rel) => {
    try { return statSync(abs(rel)).isDirectory(); } catch { return false; }
  };
  const within = (rel, root) => root === '' || rel === root || rel.startsWith(root + sep);

  const drop = (root) => {
    for (const [rel, w] of [...watchers]) {
      if (!within(rel, root)) continue;
      try { w.close(); } catch {}
      watchers.delete(rel);
    }
    for (const [real, rel] of [...reals]) if (within(rel, root)) reals.delete(real);
  };

  const add = (rel) => {
    if (closed || watchers.has(rel) || (rel && ignore(rel))) return;
    let real;
    try { real = realpathSync(abs(rel)); } catch (err) { if (!rel) fail(err); return; }
    if (reals.has(real)) return;
    /** @type {import('node:fs').FSWatcher} */
    let w;
    try {
      w = watchFn(abs(rel), (type, name) => onEvent(rel, type, name));
    } catch (err) {
      fail(err);
      return;
    }
    w.on('error', (err) => {
      // A directory removed while watched errors on some kernels; that is the
      // removal, already reported through the parent, not a failure.
      const gone = !isDir(rel);
      drop(rel);
      if (!gone) fail(err);
    });
    watchers.set(rel, w);
    reals.set(real, rel);
    let entries = [];
    try { entries = readdirSync(abs(rel), { withFileTypes: true }); } catch (err) { fail(err); }
    for (const e of entries) {
      const child = rel ? join(rel, e.name) : e.name;
      if (e.isDirectory() || (e.isSymbolicLink() && isDir(child))) add(child);
    }
  };

  const onEvent = (rel, type, name) => {
    if (closed) return;
    if (name == null) { listener(type, rel || null); return; }
    const child = rel ? join(rel, String(name)) : String(name);
    if (ignore(child)) return;
    // A subdirectory appeared (created, or renamed into place) or went away.
    if (isDir(child)) add(child);
    else if (watchers.has(child)) drop(child);
    listener(type, child);
  };

  out.close = () => {
    closed = true;
    drop('');
  };
  add('');
  process.nextTick(() => {
    const held = early || [];
    early = null;
    for (const err of held) fail(err);
  });
  return out;
}
