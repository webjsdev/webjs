/**
 * @license
 * Portions derived from Lit (`@lit/task`), Copyright Google LLC, BSD-3-Clause.
 * https://github.com/lit/lit/blob/main/packages/task/LICENSE
 */

/**
 * Task: a ReactiveController for async work inside a component, with the same
 * API and the same behaviour as Lit's `@lit/task`, so a component written
 * from Lit memory runs unchanged under the WebJs import path.
 *
 * ## When to use
 *
 * Use Task for genuinely CLIENT-only async data: search-as-you-type, a
 * lazily loaded panel, a fetch driven by browser state. Data that is known at
 * request time and belongs in the first paint goes through `async render()` or
 * an async page function instead: a Task never runs at SSR, so its INITIAL
 * state is what the server renders.
 *
 * ## Quick example
 *
 * ```js
 * import { WebComponent, html } from '@webjsdev/core';
 * import { Task } from '@webjsdev/core/task';
 *
 * class UserSearch extends WebComponent({ query: String }) {
 *   _search = new Task(this, {
 *     // ONE argument: the array `args()` returned. Destructure it.
 *     task: async ([query], { signal }) => {
 *       const res = await fetch(`/api/users?q=${query}`, { signal });
 *       if (!res.ok) throw new Error('Search failed');
 *       return res.json();
 *     },
 *     args: () => [this.query],
 *   });
 *
 *   render() {
 *     return this._search.render({
 *       initial:  ()      => html`<p>Type to search</p>`,
 *       pending:  ()      => html`<p>Searching</p>`,
 *       complete: (users) => html`<ul>${users.map((u) => html`<li>${u.name}</li>`)}</ul>`,
 *       error:    (err)   => html`<p class="error">${err.message}</p>`,
 *     });
 *   }
 * }
 * UserSearch.register('user-search');
 * ```
 *
 * The positional form `new Task(this, taskFn, argsFn)` is accepted too.
 *
 * @module
 */

/**
 * The four states a Task can be in.
 *
 * @readonly
 * @enum {number}
 */
export const TaskStatus = /** @type {const} */ ({
  INITIAL: 0,
  PENDING: 1,
  COMPLETE: 2,
  ERROR: 3,
});

/**
 * Returned (or resolved) from a task function to put the task back into the
 * INITIAL state instead of COMPLETE, the way Lit's `initialState` does. Use it
 * when the current args mean "nothing to do yet" (an empty search box).
 */
export const initialState = Symbol('webjs.task.initialState');

/**
 * Whether the task function may run in this environment. The SSR walk runs
 * controllers' `hostUpdate` during its pre-render pass, and a Task must never
 * fire its function (typically a fetch) server-side: SSR ships the INITIAL
 * state, and the browser runs the task once the element connects. Read live,
 * not cached, so the gate reflects the current environment.
 * @returns {boolean}
 */
function inBrowser() {
  return typeof window !== 'undefined';
}

/**
 * Lit's default `argsEqual`: the two arrays are the same array, or have the
 * same length and every element is `Object.is` equal (Lit's `notEqual`
 * negated), so `NaN` equals `NaN` and `0` differs from `-0`.
 *
 * @param {ReadonlyArray<unknown>} oldArgs
 * @param {ReadonlyArray<unknown>} newArgs
 * @returns {boolean}
 */
export const shallowArrayEquals = (oldArgs, newArgs) =>
  oldArgs === newArgs ||
  (oldArgs.length === newArgs.length && oldArgs.every((v, i) => Object.is(v, newArgs[i])));

/**
 * Structural equality for the value shapes args usually carry: primitives,
 * arrays, plain objects, `Map`, `Set`, `RegExp`, and objects with a custom
 * `valueOf` / `toString` (a `Date`, a `URL`). A port of `@lit/task`'s
 * `deepEquals`, including its rule that two objects with different
 * constructors are never equal.
 *
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export const deepEquals = (a, b) => {
  if (Object.is(a, b)) return true;
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const x = /** @type {any} */ (a);
    const y = /** @type {any} */ (b);
    if (x.constructor !== y.constructor) return false;
    if (Array.isArray(x)) {
      if (x.length !== y.length) return false;
      return x.every((v, i) => deepEquals(v, y[i]));
    }
    if (x.valueOf !== Object.prototype.valueOf) return x.valueOf() === y.valueOf();
    if (x.toString !== Object.prototype.toString) return x.toString() === y.toString();
    if (x instanceof Map && y instanceof Map) {
      if (x.size !== y.size) return false;
      for (const [k, v] of x.entries()) {
        if (deepEquals(v, y.get(k)) === false || (v === undefined && y.has(k) === false)) {
          return false;
        }
      }
      return true;
    }
    if (x instanceof Set && y instanceof Set) {
      if (x.size !== y.size) return false;
      for (const k of x.keys()) {
        if (y.has(k) === false) return false;
      }
      return true;
    }
    if (x instanceof RegExp) {
      return x.source === y.source && x.flags === y.flags;
    }
    const keys = Object.keys(x);
    if (keys.length !== Object.keys(y).length) return false;
    for (const key of keys) {
      if (!Object.hasOwn(y, key) || !deepEquals(x[key], y[key])) return false;
    }
    return true;
  }
  return false;
};

/**
 * `argsEqual` that compares each argument with {@link deepEquals}, Lit's
 * `deepArrayEquals`. Pass it when `args()` builds fresh objects every update
 * and identity comparison would re-run the task on every render.
 *
 * @param {ReadonlyArray<unknown>} oldArgs
 * @param {ReadonlyArray<unknown>} newArgs
 * @returns {boolean}
 */
export const deepArrayEquals = (oldArgs, newArgs) =>
  oldArgs === newArgs ||
  (oldArgs.length === newArgs.length && oldArgs.every((v, i) => deepEquals(v, newArgs[i])));

/**
 * A ReactiveController that runs an async function, tracks its status
 * (INITIAL, PENDING, COMPLETE, ERROR), and requests a host update on every
 * transition.
 *
 * Behaviour, matching `@lit/task`:
 * - The task function is called as `task(args, { signal })`, where `args` is
 *   the ARRAY `args()` returned (not spread), so destructure it:
 *   `async ([id], { signal }) => ...`.
 * - `autoRun: true` (default) re-runs in `hostUpdate()` whenever `args()`
 *   differs from the previous args under `argsEqual`. `'afterUpdate'` does the
 *   same from `hostUpdated()`, after the host's DOM is committed. `false` runs
 *   only on `run()`. `autoRun` is a public field and can be flipped later.
 * - A task with no `args` function never auto-runs; call `run()`.
 * - `initialValue` starts the task COMPLETE with that value, and records the
 *   current args so it only runs once they change.
 * - A newer run supersedes an older one: the older run's signal is aborted
 *   and its result is dropped.
 * - `abort(reason)` aborts the in-flight run. The task function's rejection
 *   (an `AbortError` from `fetch`) then lands as the ERROR state, as in Lit.
 * - `taskComplete` is a promise for the current run's result.
 * - Disconnecting the host does NOT abort the run (Lit does not either), so a
 *   moved element keeps its result. Abort it yourself in
 *   `disconnectedCallback` if the work must stop.
 * - Never runs at SSR (WebJs specific): the server renders the INITIAL state.
 *
 * @template {ReadonlyArray<unknown>} [T=ReadonlyArray<unknown>]
 * @template [R=unknown]
 */
export class Task {
  /**
   * @param {any} host The controller host (a WebComponent).
   * @param {any} task A task config object `{ task, args, autoRun,
   *   argsEqual, initialValue, onComplete, onError }`, or the task function
   *   itself when `args` is passed positionally.
   * @param {() => T} [args] The args function, positional form only.
   */
  constructor(host, task, args) {
    /** @private */
    this._host = host;
    host.addController(this);
    const config = typeof task === 'object' && task !== null ? task : { task, args };
    if (typeof config.task !== 'function') {
      throw new TypeError(
        '[webjs] new Task(host, { task, args }) needs a task function. ' +
        'Pass a config object or new Task(host, taskFn, argsFn).',
      );
    }
    /** @private @type {(args: T, options: { signal: AbortSignal }) => any} */
    this._task = config.task;
    /** @private @type {(() => T) | undefined} */
    this._argsFn = config.args;
    /** @private @type {(oldArgs: T, newArgs: T) => boolean} */
    this._argsEqual = config.argsEqual ?? shallowArrayEquals;
    /** @private */
    this._onComplete = config.onComplete;
    /** @private */
    this._onError = config.onError;
    /** @type {boolean | 'afterUpdate'} */
    this.autoRun = config.autoRun ?? true;
    /** @private @type {number} */
    this._status = TaskStatus.INITIAL;
    /** @private @type {R | undefined} */
    this._value = undefined;
    /** @private @type {unknown} */
    this._error = undefined;
    /** @private @type {T | undefined} */
    this._previousArgs = undefined;
    /** @private */
    this._callId = 0;
    /** @private @type {AbortController | undefined} */
    this._abortController = undefined;
    /** @private @type {Promise<R> | undefined} */
    this._taskComplete = undefined;
    /** @private @type {((value: R) => void) | undefined} */
    this._resolveTaskComplete = undefined;
    /** @private @type {((error: unknown) => void) | undefined} */
    this._rejectTaskComplete = undefined;
    if ('initialValue' in config) {
      this._value = config.initialValue;
      this._status = TaskStatus.COMPLETE;
      this._previousArgs = this._getArgs();
    }
  }

  /**
   * A promise for the current run's result. It resolves with the value when
   * the run completes and rejects with the error when it fails. When no run
   * is pending it settles with the current value (or rejects with the current
   * error) straight away.
   * @returns {Promise<R>}
   */
  get taskComplete() {
    if (this._taskComplete) return this._taskComplete;
    if (this._status === TaskStatus.PENDING) {
      this._taskComplete = new Promise((resolve, reject) => {
        this._resolveTaskComplete = resolve;
        this._rejectTaskComplete = reject;
      });
    } else if (this._status === TaskStatus.ERROR) {
      this._taskComplete = Promise.reject(this._error);
    } else {
      this._taskComplete = Promise.resolve(/** @type {R} */ (this._value));
    }
    return this._taskComplete;
  }

  /** @returns {number} One of the `TaskStatus` values. */
  get status() {
    return this._status;
  }

  /** @returns {R | undefined} The last completed value. */
  get value() {
    return this._value;
  }

  /** @returns {unknown} The last error, when the status is ERROR. */
  get error() {
    return this._error;
  }

  /** ReactiveController hook: auto-run before the host renders. */
  hostUpdate() {
    if (this.autoRun === true) this._performTask();
  }

  /** ReactiveController hook: auto-run after the host rendered (`'afterUpdate'`). */
  hostUpdated() {
    if (this.autoRun === 'afterUpdate') this._performTask();
  }

  /**
   * @private
   * @returns {T | undefined}
   */
  _getArgs() {
    if (this._argsFn === undefined) return undefined;
    const args = this._argsFn();
    if (!Array.isArray(args)) {
      throw new Error('[webjs] The Task args function must return an array.');
    }
    return args;
  }

  /** @private */
  async _performTask() {
    // Never at SSR: the server renders the INITIAL state, and the args are
    // left unrecorded so the browser's first update runs the task.
    if (!inBrowser()) return;
    const args = this._getArgs();
    const prev = this._previousArgs;
    this._previousArgs = args;
    if (args !== prev && args !== undefined && (prev === undefined || !this._argsEqual(prev, args))) {
      await this.run(args);
    }
  }

  /**
   * Run the task now, with `args` or else the current `args()`. A pending
   * run is aborted and superseded. Resolves when this run settles; never
   * rejects (a failure lands in `error` and `taskComplete`).
   *
   * @param {T} [args]
   * @returns {Promise<void>}
   */
  async run(args) {
    args ??= this._getArgs();
    this._previousArgs = args;
    if (this._status === TaskStatus.PENDING) {
      this._abortController?.abort();
    } else {
      // A settled `taskComplete` belongs to the previous run.
      this._taskComplete = undefined;
      this._resolveTaskComplete = undefined;
      this._rejectTaskComplete = undefined;
    }
    this._status = TaskStatus.PENDING;
    /** @type {any} */
    let result;
    /** @type {unknown} */
    let error;
    // Report the pending state. From `hostUpdated` the host is mid-cycle, so
    // the request waits a microtask, as Lit does.
    if (this.autoRun === 'afterUpdate') {
      queueMicrotask(() => this._host.requestUpdate());
    } else {
      this._host.requestUpdate();
    }
    const key = ++this._callId;
    this._abortController = new AbortController();
    let errored = false;
    try {
      result = await this._task(/** @type {T} */ (args), { signal: this._abortController.signal });
    } catch (e) {
      errored = true;
      error = e;
    }
    // Only the most recent run reports.
    if (this._callId === key) {
      if (result === initialState) {
        this._status = TaskStatus.INITIAL;
      } else {
        if (errored === false) {
          try {
            this._onComplete?.(result);
          } catch {
            // An onComplete throw must not wedge the task, as in Lit.
          }
          this._status = TaskStatus.COMPLETE;
          this._resolveTaskComplete?.(result);
        } else {
          try {
            this._onError?.(error);
          } catch {
            // An onError throw must not wedge the task, as in Lit.
          }
          this._status = TaskStatus.ERROR;
          this._rejectTaskComplete?.(error);
        }
        this._value = result;
        this._error = error;
      }
      this._host.requestUpdate();
    }
  }

  /**
   * Abort the pending run, if any, passing `reason` to its `AbortSignal`.
   * The status is left to the task function: a fetch that rejects on abort
   * lands as ERROR.
   *
   * @param {unknown} [reason]
   */
  abort(reason) {
    if (this._status === TaskStatus.PENDING) {
      this._abortController?.abort(reason);
    }
  }

  /**
   * Render the template for the current status. A missing callback renders
   * nothing.
   *
   * @param {{
   *   initial?: () => unknown,
   *   pending?: () => unknown,
   *   complete?: (value: R) => unknown,
   *   error?: (error: unknown) => unknown,
   * }} renderer
   * @returns {unknown}
   */
  render(renderer) {
    switch (this._status) {
      case TaskStatus.INITIAL:
        return renderer.initial?.();
      case TaskStatus.PENDING:
        return renderer.pending?.();
      case TaskStatus.COMPLETE:
        return renderer.complete?.(/** @type {R} */ (this._value));
      case TaskStatus.ERROR:
        return renderer.error?.(this._error);
      default:
        throw new Error(`[webjs] Unexpected Task status: ${this._status}`);
    }
  }
}
