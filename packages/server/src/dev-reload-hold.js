/**
 * The dev live-reload HOLD (#1532), shared source.
 *
 * A tool that frames a WebJs app (an AI app builder) pauses live reload while
 * its agent is mid-build, so the preview does not flicker through every
 * intermediate save, and releases it when the build is done. The embed bridge
 * (`dev-embed-client.js`) owns the switch, the `__webjsEmbedHold` page global,
 * set from the host's `{ type: 'hold', enabled }` command. The reload client
 * routes every reload signal through this module: while held it keeps only the
 * STRONGEST verdict seen, and on release it applies that one reload, or nothing
 * when nothing changed.
 *
 * Import-free and inlined verbatim (`export` stripped) into the served reload
 * client by `reloadClientJs` in `dev/helpers.js`, the same shared-source rule as
 * `dev-styles.js`, so the unit test drives the code that ships.
 */

/**
 * Verdict strength, strongest first. Restated rather than imported from
 * `dev-reload-worker.js` because this file is inlined on its own.
 */
var HOLD_STRENGTH = ['reload', 'shell', 'page'];

/**
 * The stronger of two verdicts. Anything that is not a known verdict is a full
 * `reload`, the fail-safe every other reload path uses.
 *
 * @param {string | null} a  the verdict held so far (null = none)
 * @param {unknown} b  the incoming verdict
 * @returns {string}
 */
export function strongerHeldVerdict(a, b) {
  var ib = HOLD_STRENGTH.indexOf(/** @type {string} */ (b));
  if (ib === -1) ib = 0;
  if (a === null) return HOLD_STRENGTH[ib];
  var ia = HOLD_STRENGTH.indexOf(a);
  if (ia === -1) ia = 0;
  return HOLD_STRENGTH[Math.min(ia, ib)];
}

/**
 * Build the hold gate for one page.
 *
 * @param {(verdict: string) => void} apply  applies a reload (the client's own apply)
 * @param {() => boolean} isHeld  whether the host currently holds reloads
 * @returns {{ offer: (verdict: unknown) => boolean, release: () => void, pending: () => string | null }}
 *   `offer` returns true when it kept the signal (held), false when the caller
 *   should apply it now; `release` applies the one pending reload once the hold
 *   is off.
 */
export function createReloadHold(apply, isHeld) {
  /** @type {string | null} */
  var held = null;
  return {
    offer: function (verdict) {
      if (!isHeld()) return false;
      held = strongerHeldVerdict(held, verdict);
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
