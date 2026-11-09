import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Poll a directory for changes, the dev watcher's fallback when the OS has no
 * watch left to give (#1689). Linux caps inotify watches per user
 * (`fs.inotify.max_user_watches`, often 8192 on older distributions and lower
 * in containers), and a large repo or a second dev server reaches it: `fs.watch`
 * then fails with ENOSPC (EMFILE for open files), and the directory used to be
 * dropped for the rest of the session, so its edits never reloaded anything.
 * Polling is slower and costs a directory walk per tick, but it never stops.
 *
 * Each tick takes a snapshot `Map<rel, 'mtimeMs:size'>` of every file under
 * `dir` that `ignore` admits (directories are walked, not reported) and diffs it
 * against the previous one, so an added, a changed and a removed file are each
 * reported once. The first snapshot is the baseline and reports nothing. The
 * timer is `unref()`ed, so a forgotten poller never holds the process open.
 *
 * @param {string} dir  absolute directory to poll
 * @param {{
 *   ignore?: (relPath: string) => boolean,
 *   onEvent: (relPath: string) => void,
 *   intervalMs?: number,
 *   recursive?: boolean,
 * }} opts  `relPath` is relative to `dir`, with OS separators. `recursive:
 *   false` reports the direct entries only (directories included), the shape
 *   the root of a watched tree needs.
 * @returns {() => void} stops polling
 */
export function pollTree(dir, { ignore = () => false, onEvent, intervalMs = 1000, recursive = true }) {
  /** @returns {Map<string, string>} */
  const snapshot = () => {
    /** @type {Map<string, string>} */
    const out = new Map();
    /** @param {string} rel */
    const walk = (rel) => {
      let entries;
      try { entries = readdirSync(rel ? join(dir, rel) : dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const child = rel ? join(rel, e.name) : e.name;
        if (ignore(child)) continue;
        let st;
        try { st = statSync(join(dir, child)); } catch { continue; }
        if (st.isDirectory()) {
          if (recursive) walk(child);
          else out.set(child, 'dir');
        } else {
          out.set(child, `${st.mtimeMs}:${st.size}`);
        }
      }
    };
    walk('');
    return out;
  };

  let prev = snapshot();
  const timer = setInterval(() => {
    const next = snapshot();
    for (const [rel, sig] of next) if (prev.get(rel) !== sig) onEvent(rel);
    for (const rel of prev.keys()) if (!next.has(rel)) onEvent(rel);
    prev = next;
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

/**
 * Whether a watch failure means the OS is out of watches (or file
 * descriptors), the two failures polling can stand in for. Any other watch
 * error (EACCES, ENOENT on a vanished path) is about one path and stays a
 * warning.
 * @param {unknown} err
 * @returns {boolean}
 */
export function isWatchLimitError(err) {
  const code = err && typeof err === 'object' ? /** @type {any} */ (err).code : undefined;
  return code === 'ENOSPC' || code === 'EMFILE';
}
