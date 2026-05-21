/**
 * Signals, reactive scalar values that re-render dependents when they
 * change.
 *
 * The shape mirrors the TC39 Signals proposal (Stage 1) so when the
 * proposal lands in browsers this module becomes a one-line re-export.
 *
 *   const count = signal(0);
 *   const doubled = computed(() => count.get() * 2);
 *   count.set(count.get() + 1);
 *
 * Inside a WebComponent render(), any signal read is tracked
 * automatically. The component re-renders when any read signal changes.
 * For fine-grained reactivity (only one template hole updates), use the
 * `watch()` directive from `@webjskit/core/directives`.
 *
 * Cross-request safety note (SSR): a module-scope signal lives for the
 * lifetime of the Node process, so `let count = signal(0)` at the top of
 * a server module would leak state between requests. Keep module-scope
 * signals in browser-only modules. For request-scoped server state, use
 * per-instance signals or the request context primitives in
 * `@webjskit/server`.
 */

/**
 * Currently-active subscriber stack. Whenever a Signal/Computed get()
 * call runs and the stack is non-empty, the top entry records this
 * signal as a dependency. A later set() walks the dependents and marks
 * them dirty.
 * @type {Subscriber[]}
 */
const activeStack = [];

/**
 * A subscriber is anything that wants to be notified when a signal it
 * read changes. Watchers and Computed signals are both subscribers.
 * @typedef {{
 *   __notify: () => void,
 *   __deps: Set<SignalState | SignalComputed>,
 * }} Subscriber
 */

/**
 * Generation counter. Each signal write bumps it. Computed signals
 * remember the generation at their last evaluation; reads are cache
 * hits until the generation moves past them.
 */
let generation = 0;

/**
 * Suppress notifications while a batch is open. A set() call inside
 * a batch collects dependents in the batch pending set; the set is
 * drained when the outermost batch closes.
 *
 * Without batching, two set() calls in the same task produce two
 * subscriber notifications. The component still coalesces re-renders
 * into one microtask (because `requestUpdate` is itself coalesced),
 * but computed signals can briefly observe a torn intermediate state.
 * Batching lets callers force a quiescent write block.
 *
 * @type {Set<Subscriber> | null}
 */
let batchPending = null;
let batchDepth = 0;

/**
 * Open a batch. All set() calls inside `fn` defer subscriber
 * notification until the outermost batch closes. Inside the batch,
 * subsequent get() calls see the new values immediately; subscribers
 * just don't fire until the end.
 *
 * @param {() => void} fn
 */
export function batch(fn) {
  batchDepth++;
  if (batchPending === null) batchPending = new Set();
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      const pending = batchPending;
      batchPending = null;
      for (const sub of pending) sub.__notify();
    }
  }
}

/**
 * Internal dispatch of a write notification, honoring the active batch.
 * Snapshots the subscriber set before iterating so a subscriber that
 * re-tracks itself mid-callback (e.g. an effect calling observe(fn)
 * inside its own notify) does not re-fire in the same loop.
 * @param {Iterable<Subscriber>} subs
 */
function notify(subs) {
  if (batchPending !== null) {
    for (const sub of subs) batchPending.add(sub);
    return;
  }
  const snap = [];
  for (const sub of subs) snap.push(sub);
  for (const sub of snap) sub.__notify();
}

/**
 * Tracking subscription, recording that `sub` depends on `sig`.
 * @param {SignalState | SignalComputed} sig
 * @param {Subscriber} sub
 */
function track(sig, sub) {
  if (!sig.__subs) sig.__subs = new Set();
  sig.__subs.add(sub);
  sub.__deps.add(sig);
}

/**
 * Tear down all subscriptions held by `sub`. Called when a watcher is
 * disposed or when a computed re-evaluates (and old deps drop out).
 * @param {Subscriber} sub
 */
function untrackAll(sub) {
  for (const sig of sub.__deps) {
    sig.__subs?.delete(sub);
  }
  sub.__deps.clear();
}

/**
 * State signal, a writable reactive scalar.
 */
class SignalState {
  /** @param {unknown} initial */
  constructor(initial) {
    this.__value = initial;
    /** @type {Set<Subscriber> | undefined} */
    this.__subs = undefined;
    /** Marker for the `isSignal()` predicate. */
    this.__isSignal = true;
  }

  /**
   * Read the current value AND register a dependency on the active
   * subscriber (if any). Most reads inside render() or a computed()
   * body go through here.
   */
  get() {
    const sub = activeStack[activeStack.length - 1];
    if (sub) track(this, sub);
    return this.__value;
  }

  /**
   * Read the current value WITHOUT registering a dependency. Use this
   * when you want to inspect a signal from a reactive context without
   * subscribing.
   */
  peek() { return this.__value; }

  /**
   * Replace the value. Skips notification when the new value is
   * `Object.is`-equal to the prior, mirroring lit reactive-property
   * change detection.
   * @param {unknown} v
   */
  set(v) {
    if (Object.is(this.__value, v)) return;
    this.__value = v;
    generation++;
    if (this.__subs && this.__subs.size > 0) notify(this.__subs);
  }
}

/**
 * Computed signal, a derived value evaluated lazily and cached between
 * dependency changes. Behaves as both a signal (downstream subscribers
 * can read + track) and a subscriber (its `__notify` invalidates the
 * cache so the next read recomputes).
 */
class SignalComputed {
  /** @param {() => unknown} fn */
  constructor(fn) {
    this.__fn = fn;
    this.__value = /** @type any */ (undefined);
    this.__dirty = true;
    /** @type {Set<Subscriber> | undefined} */
    this.__subs = undefined;
    /** @type {Set<SignalState | SignalComputed>} */
    this.__deps = new Set();
    this.__isSignal = true;
  }

  /** Track + return the cached value, recomputing if dirty. */
  get() {
    const sub = activeStack[activeStack.length - 1];
    if (sub) track(this, sub);
    if (this.__dirty) {
      untrackAll(this);
      activeStack.push(this);
      try {
        this.__value = this.__fn();
      } finally {
        activeStack.pop();
      }
      this.__dirty = false;
    }
    return this.__value;
  }

  peek() {
    if (this.__dirty) {
      untrackAll(this);
      activeStack.push(this);
      try { this.__value = this.__fn(); } finally { activeStack.pop(); }
      this.__dirty = false;
    }
    return this.__value;
  }

  __notify() {
    if (this.__dirty) return;
    this.__dirty = true;
    if (this.__subs && this.__subs.size > 0) notify(this.__subs);
  }
}

/**
 * Watcher, the lit-labs/signals shape. A non-reactive subscriber that
 * runs a callback whenever any tracked signal changes. Used by the
 * WebComponent integration and by `effect()`.
 */
class SignalWatcher {
  /** @param {() => void} cb */
  constructor(cb) {
    this.__cb = cb;
    /** @type {Set<SignalState | SignalComputed>} */
    this.__deps = new Set();
    this.__disposed = false;
  }

  /**
   * Run `fn` while tracking reads against this watcher. Used to wrap
   * render() and the computed() callback.
   * @param {() => unknown} fn
   */
  observe(fn) {
    if (this.__disposed) return fn();
    untrackAll(this);
    activeStack.push(this);
    try { return fn(); } finally { activeStack.pop(); }
  }

  __notify() {
    if (this.__disposed) return;
    this.__cb();
  }

  /** Stop observing. Releases all dependency subscriptions. */
  dispose() {
    if (this.__disposed) return;
    this.__disposed = true;
    untrackAll(this);
  }
}

/**
 * Run `fn` without tracking the signals it reads. Reads inside `fn`
 * see the current values but no dependency edge is recorded against
 * the currently-active subscriber. Used by the `watch` directive so
 * its signal read does not also subscribe the host component to a
 * full re-render.
 *
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
function untrack(fn) {
  activeStack.push(/** @type any */ (null));
  try { return fn(); } finally { activeStack.pop(); }
}

/**
 * TC39-shaped public surface, `Signal.State`, `Signal.Computed`,
 * `Signal.subtle.Watcher`, `Signal.subtle.untrack`. The proposal puts
 * the watcher and untrack under `subtle` because most consumers should
 * use higher-level wrappers (the component integration, `effect`, the
 * `watch` directive) rather than driving them directly.
 */
export const Signal = {
  State: SignalState,
  Computed: SignalComputed,
  subtle: {
    Watcher: SignalWatcher,
    untrack,
  },
};

/**
 * Convenience constructor for a writable signal.
 * @param {unknown} initial
 * @returns {SignalState}
 */
export function signal(initial) { return new SignalState(initial); }

/**
 * Convenience constructor for a computed signal.
 * @param {() => unknown} fn
 * @returns {SignalComputed}
 */
export function computed(fn) { return new SignalComputed(fn); }

/**
 * Predicate. Use to discriminate a signal from a plain value in
 * directive code.
 * @param {unknown} v
 * @returns {boolean}
 */
export function isSignal(v) {
  return !!(v && typeof v === 'object' && /** @type any */ (v).__isSignal === true);
}

/**
 * Run `fn` once, then re-run it whenever any signal it read changes.
 * Returns a dispose function.
 *
 * Effects are useful for browser-only side effects such as DOM
 * mutations, timers, or fetch calls. Avoid in render paths; the
 * component's built-in SignalWatcher already covers re-render.
 *
 * @param {() => void} fn
 * @returns {() => void}
 */
export function effect(fn) {
  const w = new SignalWatcher(() => { w.observe(fn); });
  w.observe(fn);
  return () => w.dispose();
}
