/**
 * Why the dev server reloaded the page, printed AFTER the reload (#1689), the
 * BROWSER half. Browser-safe and import-free: `reloadClientJs` (`dev/helpers.js`)
 * inlines it after an `export` strip, so the unit test drives the exact code
 * that ships.
 *
 * A reload replaces the document, and with it the console of the page that
 * decided to reload, so a reason logged before `location.reload()` is gone by
 * the time anyone looks (Next prints its `REACT_REFRESH_FULL_RELOAD` reason for
 * the same reason). `reloadWithReason` stores `{ why, by }` in
 * `sessionStorage`, which survives a same-tab reload, and the reloaded page's
 * client prints it once with `printPendingReason`:
 * `[webjs] full reload: <why> (<by>)`. Where storage is unavailable (a
 * sandboxed frame, storage disabled) the reason is logged before the reload
 * instead, which is the best that can be done.
 */

const RELOAD_REASON_KEY = 'webjs:dev-reload-reason';

/**
 * @param {{ why?: string, by?: string }} r
 * @returns {string}
 */
function reloadReasonLine(r) {
  return '[webjs] full reload: ' + (r.why || 'reload') + (r.by ? ' (' + r.by + ')' : '');
}

/**
 * Remember why, then reload.
 * @param {{ v?: string, why?: string, by?: string }} verdict
 * @param {{ reload: () => void }} loc
 * @param {Storage | null | undefined} store
 * @param {(msg: string) => void} log
 */
export function reloadWithReason(verdict, loc, store, log) {
  const r = { why: (verdict && (verdict.why || verdict.v)) || 'reload', by: (verdict && verdict.by) || '' };
  let kept = false;
  try {
    if (store) { store.setItem(RELOAD_REASON_KEY, JSON.stringify(r)); kept = true; }
  } catch (_) { /* storage disabled or full: log it now instead */ }
  if (!kept) log(reloadReasonLine(r));
  loc.reload();
}

/**
 * Print the reason a previous page stored before it reloaded, once.
 * @param {Storage | null | undefined} store
 * @param {(msg: string) => void} log
 */
export function printPendingReason(store, log) {
  let raw = null;
  try {
    if (!store) return;
    raw = store.getItem(RELOAD_REASON_KEY);
    if (raw !== null) store.removeItem(RELOAD_REASON_KEY);
  } catch (_) { return; }
  if (!raw) return;
  let r;
  try { r = JSON.parse(raw); } catch (_) { return; }
  if (r && typeof r === 'object') log(reloadReasonLine(r));
}
