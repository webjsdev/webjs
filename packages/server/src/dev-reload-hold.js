/**
 * The dev live-reload HOLD (#1532), shared source.
 *
 * A tool that frames a WebJs app (an AI app builder) pauses live reload while
 * its agent is mid-build, so the preview does not flicker through every
 * intermediate save, and releases it when the build is done. The embed bridge
 * (`dev-embed-client.js`) owns the switch, the `__webjsEmbedHold` page global,
 * set from the host's `{ type: 'hold', enabled }` command. The reload client
 * routes every reload signal through this module: while held it merges every
 * verdict it sees, and on release it applies that one reload, or nothing when
 * nothing changed.
 *
 * Import-free and inlined verbatim (`export` stripped) into the served reload
 * client by `reloadClientJs` in `dev/helpers.js`, the same shared-source rule as
 * `dev-styles.js`, so the unit test drives the code that ships.
 */

/**
 * Verdict strength, strongest first. Restated rather than imported from
 * `dev-reload-worker.js` because this file is inlined on its own.
 */
var HOLD_STRENGTH = ['reload', 'shell', 'page', 'component', 'css'];

/**
 * Read one held signal into the verdict object shape. A bare string (a relay
 * older than #1689 posts the name alone) becomes `{ v }`, and anything that
 * is not a known verdict is a full `reload`, the fail-safe every other reload
 * path uses.
 *
 * @param {unknown} raw
 * @returns {{ v: string, by: string, why: string, modules: string[], css: boolean }}
 */
function readHeldVerdict(raw) {
  var o = typeof raw === 'string' ? { v: raw } : raw;
  if (!o || typeof o !== 'object' || HOLD_STRENGTH.indexOf(/** @type {any} */ (o).v) === -1) {
    return { v: 'reload', by: '', why: 'unreadable-frame', modules: [], css: false };
  }
  var a = /** @type {any} */ (o);
  return {
    v: a.v,
    by: typeof a.by === 'string' ? a.by : '',
    why: typeof a.why === 'string' ? a.why : '',
    modules: Array.isArray(a.modules) ? a.modules.slice() : [],
    css: a.css === true,
  };
}

/**
 * Merge an incoming verdict into the one held so far: the stronger `v` wins
 * with its `by` / `why` (the held one on a tie), `modules` unions and `css`
 * ORs, the same rule as the server's `mergeVerdicts`.
 *
 * @param {{ v: string, by: string, why: string, modules: string[], css: boolean } | null} a  held so far (null = none)
 * @param {unknown} b  the incoming verdict, an object or a legacy string
 * @returns {{ v: string, by: string, why: string, modules: string[], css: boolean }}
 */
export function mergeHeldVerdict(a, b) {
  var next = readHeldVerdict(b);
  if (a === null) return next;
  var top = HOLD_STRENGTH.indexOf(a.v) <= HOLD_STRENGTH.indexOf(next.v) ? a : next;
  var modules = a.modules.slice();
  for (var i = 0; i < next.modules.length; i++) {
    if (modules.indexOf(next.modules[i]) === -1) modules.push(next.modules[i]);
  }
  modules.sort();
  return { v: top.v, by: top.by, why: top.why, modules: modules, css: a.css || next.css };
}

/**
 * Build the hold gate for one page.
 *
 * @param {(verdict: { v: string, by: string, why: string, modules: string[], css: boolean }) => void} apply
 *   applies a reload (the client's own apply)
 * @param {() => boolean} isHeld  whether the host currently holds reloads
 * @returns {{ offer: (verdict: unknown) => boolean, release: () => void, pending: () => ({ v: string, by: string, why: string, modules: string[], css: boolean } | null) }}
 *   `offer` returns true when it kept the signal (held), false when the caller
 *   should apply it now; `release` applies the one pending reload once the hold
 *   is off.
 */
export function createReloadHold(apply, isHeld) {
  /** @type {{ v: string, by: string, why: string, modules: string[], css: boolean } | null} */
  var held = null;
  return {
    offer: function (verdict) {
      if (!isHeld()) return false;
      held = mergeHeldVerdict(held, verdict);
      return true;
    },
    release: function () {
      if (isHeld() || held === null) return;
      var v = held;
      held = null;
      apply(v);
    },
    pending: function () { return held; },
  };
}
