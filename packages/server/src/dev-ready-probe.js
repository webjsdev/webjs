/**
 * The dev reload client's readiness probe, the BROWSER half (#893, #1689).
 * Browser-safe and import-free: `reloadClientJs` (`dev/helpers.js`) inlines it
 * after an `export` strip, so the unit test drives the exact code that ships.
 *
 * Every reload signal waits for `/__webjs/version` to answer before it is
 * applied, so a tab never reloads INTO a server that is still restarting and
 * paints a half-rendered page. The probe used to give up after 100 tries (about
 * 10 seconds) and reload anyway, which turned any restart slower than that (a
 * cold `dev.before` step, a laptop waking up) into the browser's own error page
 * and a dead tab. It now waits for as long as it takes, Next's posture: 100ms
 * between tries for the first 2 seconds, then 1s for 10 seconds, then every 5s,
 * and it says once that it is waiting. It never reloads by itself.
 *
 * One loop runs at a time. A reload signal that arrives while a probe is
 * already waiting joins it instead of starting a second one, so a burst of
 * edits during a restart does not multiply the requests.
 */

/**
 * @param {(url: string, init: object) => Promise<{ ok: boolean }>} fetchFn
 * @param {string} url  the readiness endpoint
 * @param {{ setTimeout: (fn: () => void, ms: number) => unknown }} [timers]
 * @param {(msg: string) => void} [log]
 * @returns {(cb: () => void) => void} `whenReady(cb)` runs `cb` once the server answers
 */
export function createReadyProbe(fetchFn, url, timers, log) {
  const t = timers || { setTimeout: function (fn, ms) { return setTimeout(fn, ms); } };
  const say = log || function (msg) { console.info(msg); };
  /** @type {Array<() => void> | null} */
  let waiting = null;

  /** @param {number} failures */
  function delayAfter(failures) {
    if (failures <= 20) return 100;
    if (failures <= 30) return 1000;
    return 5000;
  }

  function settle() {
    const cbs = waiting || [];
    waiting = null;
    for (const cb of cbs) {
      try { cb(); } catch (e) { console.error('[webjs] dev reload handler threw', e); }
    }
  }

  /** @param {number} failures */
  function attempt(failures) {
    let p;
    try { p = fetchFn(url, { cache: 'no-store' }); } catch (_) { p = Promise.reject(_); }
    Promise.resolve(p).then(function (r) {
      if (r && r.ok) settle(); else again(failures + 1);
    }, function () { again(failures + 1); });
  }

  /** @param {number} failures */
  function again(failures) {
    // Once per loop, when the fast tries run out (about 2 seconds in).
    if (failures === 20) say('[webjs] waiting for the dev server...');
    t.setTimeout(function () { attempt(failures); }, delayAfter(failures));
  }

  return function whenReady(cb) {
    if (waiting) { waiting.push(cb); return; }
    waiting = [cb];
    attempt(0);
  };
}
