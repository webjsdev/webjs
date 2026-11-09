/**
 * Async directive authoring, lit's `lit/async-directive.js` under a WebJs
 * path: `@webjsdev/core/async-directive`.
 *
 * Portions derived from Lit, Copyright Google LLC, BSD-3-Clause.
 *
 * An `AsyncDirective` can push a value into its part outside a render with
 * `setValue()`, and is told when the component that rendered it leaves the
 * document (`disconnected()`) and comes back (`reconnected()`), so it can drop
 * and re-establish a subscription.
 *
 * ```js
 * import { AsyncDirective, directive } from '@webjsdev/core/async-directive';
 *
 * class Ticker extends AsyncDirective {
 *   render(ms) {
 *     this.#start(ms);
 *     return 0;
 *   }
 *   #start(ms) {
 *     clearInterval(this.id);
 *     let n = 0;
 *     this.id = setInterval(() => this.setValue(++n), ms);
 *   }
 *   disconnected() { clearInterval(this.id); }
 *   reconnected() { this.#start(1000); }
 * }
 * export const ticker = directive(Ticker);
 * ```
 *
 * Connection follows the HOST component (the one whose template holds the
 * part), plus the part's own lifetime: a directive whose part is torn down, or
 * replaced by a different directive class, is disconnected for good. On the
 * server `setValue()` does nothing and only `render()` runs.
 *
 * @module async-directive
 */

import { Directive } from './directive.js';

export { directive, Directive, PartType } from './directive.js';

export class AsyncDirective extends Directive {
  /** @param {{ type: number, name?: string, tagName?: string, strings?: readonly string[] }} partInfo */
  constructor(partInfo) {
    super(partInfo);
    /**
     * Whether the directive's host is in the document. `true` until the
     * renderer reports otherwise.
     * @type {boolean}
     */
    this.isConnected = true;
    /**
     * Installed by the client renderer: commits a value to this directive's
     * part. Absent at SSR, where `setValue()` is a no-op.
     * @type {((value: unknown) => void) | undefined}
     */
    this._$webjsCommit = undefined;
  }

  /**
   * Commit `value` to the part outside a render, as if the directive had
   * returned it. A no-op on the server. As in lit, stop calling it once
   * `disconnected()` runs.
   * @param {unknown} value
   */
  setValue(value) {
    if (this._$webjsCommit) this._$webjsCommit(value);
  }

  /**
   * Called by the renderer when the connection state changes; dispatches to
   * `disconnected()` / `reconnected()` once per transition.
   * @param {boolean} connected
   */
  _$webjsSetConnected(connected) {
    if (connected === this.isConnected) return;
    this.isConnected = connected;
    if (connected) this.reconnected();
    else this.disconnected();
  }

  /** The host left the document, or the part was torn down. Release resources. */
  disconnected() {}

  /** The host came back. Re-establish what `disconnected()` released. */
  reconnected() {}
}
