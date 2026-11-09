import { mergeVerdicts } from '../dev-classify.js';

/**
 * The edits a `bun --hot` registry reset has yet to apply (#1575, #1689).
 *
 * Under `bun --hot` an edit to a module some other module imports cannot be
 * rebuilt straight away: the module registry has to be reset first, or the next
 * request would still import the stale module. So the watcher POKES the re-run
 * sentinel, keeps the batch here, and the re-run rebuilds with it. If the
 * re-run does not arrive within `fallbackMs`, the fallback rebuilds anyway, so
 * an edit is never lost to a sentinel `bun --hot` did not see.
 *
 * The race this owns: a large edit can make the re-run arrive AFTER the
 * fallback. The fallback rebuilt and notified against the PRE-reset registry,
 * so the browser applied the edit against stale modules, and the late re-run
 * found nothing pending and rebuilt silently, so the tab never learned the
 * fresh modules were there. The fallback's batch is therefore kept as `fired`,
 * and a re-run with nothing pending rebuilds and notifies again with it.
 *
 * `fired` lives only `firedMs` (twice the fallback by default) past the
 * fallback. A re-run that late is not the one the batch was waiting for: the
 * reset was genuinely lost, and replaying the batch into a later, unrelated
 * edit would merge its old verdict in (an old `reload` turning a page morph
 * into a full reload) and bump its files' versions a second time, dropping
 * server module state for a chain nobody touched.
 *
 * @param {{
 *   setTimeout?: (fn: () => void, ms: number) => unknown,
 *   clearTimeout?: (t: unknown) => void,
 *   fallbackMs?: number,
 *   firedMs?: number,
 * }} [opts]
 */
export function createPokeState(opts = {}) {
  const set = opts.setTimeout || ((fn, ms) => setTimeout(fn, ms));
  const clear = opts.clearTimeout || ((t) => clearTimeout(/** @type {any} */ (t)));
  const fallbackMs = opts.fallbackMs ?? 1500;
  const firedMs = opts.firedMs ?? fallbackMs * 2;
  /** @type {import('../dev-classify.js').ReloadVerdict | null} */
  let verdict = null;
  /** @type {Set<string>} */
  let changed = new Set();
  /** @type {{ verdict: import('../dev-classify.js').ReloadVerdict | null, changed: string[] } | null} */
  let fired = null;
  /** @type {unknown} */
  let timer = null;
  /** @type {unknown} */
  let firedTimer = null;
  const dropFired = () => {
    clear(firedTimer);
    firedTimer = null;
    fired = null;
  };

  return {
    /**
     * Keep a batch for the coming re-run and (re)arm the fallback.
     * @param {import('../dev-classify.js').ReloadVerdict | null | undefined} v
     * @param {Iterable<string>} files
     * @param {(verdict: import('../dev-classify.js').ReloadVerdict | null, changed: string[]) => void} onFallback
     */
    poke: function (v, files, onFallback) {
      verdict = mergeVerdicts(verdict, v || null);
      for (const f of files) changed.add(f);
      // A fresh poke inside the fired batch's window supersedes it: the
      // coming re-run carries both, so the browser hears once, at the end.
      if (fired) {
        verdict = mergeVerdicts(fired.verdict, verdict);
        for (const f of fired.changed) changed.add(f);
        dropFired();
      }
      clear(timer);
      timer = set(() => {
        timer = null;
        const batch = { verdict, changed: [...changed] };
        verdict = null;
        changed = new Set();
        dropFired();
        fired = batch;
        firedTimer = set(dropFired, firedMs);
        onFallback(batch.verdict, batch.changed);
      }, fallbackMs);
    },

    /**
     * What a registry-reset re-run should rebuild with: the pending batch when
     * there is one, else the batch the fallback already applied against the old
     * registry (notify again so the tab picks up the fresh modules), else
     * nothing, a silent re-derive.
     * @returns {{ verdict: import('../dev-classify.js').ReloadVerdict | null, changed: string[], notify: boolean }}
     */
    takeForRerun: function () {
      clear(timer);
      timer = null;
      if (verdict || changed.size) {
        const out = { verdict, changed: [...changed], notify: !!verdict };
        verdict = null;
        changed = new Set();
        dropFired();
        return out;
      }
      if (fired) {
        const out = { verdict: fired.verdict, changed: fired.changed, notify: !!fired.verdict };
        dropFired();
        return out;
      }
      return { verdict: null, changed: [], notify: false };
    },
  };
}
