/**
 * Signals, reactive scalar values that re-render dependents when they
 * change.
 *
 * The shape mirrors the TC39 Signals proposal (Stage 1). When the
 * proposal lands in browsers this module becomes a one-line re-export.
 *
 *   import { signal, computed, effect } from '@webjsdev/core';
 *
 *   const count = signal(0);
 *   const doubled = computed(() => count.get() * 2);
 *   count.set(count.get() + 1);
 *
 * Inside a WebComponent render(), any signal read is tracked
 * automatically. The component re-renders when any read signal changes.
 * For fine-grained reactivity (only one template hole updates), use the
 * `watch()` directive from `@webjsdev/core/directives`.
 *
 * Cross-request safety note (SSR): a module-scope signal lives for the
 * lifetime of the Node process, so `let count = signal(0)` at the top
 * of a server module would leak state between requests. Keep
 * module-scope signals in browser-only modules. For request-scoped
 * server state, use per-instance signals or the request context
 * primitives in `@webjsdev/server`.
 *
 * Algorithm: push-pull hybrid (matches signal-polyfill).
 *
 *   - Each producer (State or Computed) carries a `version`. A State
 *     bumps its version on a real `set()` (where the new value is NOT
 *     `.equal` to the old). A Computed bumps its version after recompute
 *     only when the recomputed output is not equal to the prior.
 *
 *   - A consumer (Computed or Watcher) records, per producer it reads,
 *     the version it saw at read time. On the next read, the consumer
 *     polls each producer: if the stored version still matches, that
 *     producer hasn't actually changed and recomputation can be skipped.
 *
 *   - On `set()`, a producer pushes a dirty mark down to live consumers
 *     (consumers that need notification because they're watched). Push
 *     marks the consumer dirty cheaply; the version check on read is
 *     what determines whether a recompute happens. This is what makes
 *     diamond dependencies glitch-free and memoizes the common case
 *     where a computed's output doesn't actually change.
 */

/* ============================================================
 * Graph primitives
 * ============================================================ */

/**
 * The currently-active consumer (Computed or Watcher) whose dependency
 * set is being recorded. `null` at top-level / outside any reactive
 * context. Reads of producers while this is non-null register an edge.
 * @type {ReactiveNode | null}
 */
let activeConsumer = null;

/** Are we currently inside a Watcher notify callback? Reads + writes throw. */
let inNotificationPhase = false;

/**
 * Global epoch counter. Bumped on every `State.set` that produces a
 * value change. Lets clean consumers skip producer polling entirely
 * when no source has changed since their last read.
 */
let epoch = 0;

/**
 * Batched set: pending watcher notifications, drained at the outermost
 * batch close. Inside a batch, computed reads see the new values
 * immediately; only Watcher notify firing is deferred.
 * @type {Set<ReactiveNode> | null}
 */
let batchPending = null;
let batchDepth = 0;

/**
 * @typedef {Object} ReactiveNode
 * @property {number} version
 * @property {number} lastCleanEpoch
 * @property {boolean} dirty
 * @property {ReactiveNode[]} producers
 * @property {number[]} producerLastReadVersions
 * @property {Set<ReactiveNode>=} liveConsumers
 * @property {boolean} consumerAllowSignalWrites
 * @property {boolean} consumerIsAlwaysLive
 * @property {(this: ReactiveNode) => boolean} producerMustRecompute
 * @property {(this: ReactiveNode) => void} producerRecomputeValue
 * @property {(this: ReactiveNode) => void} consumerMarkedDirty
 * @property {any} wrapper
 * @property {(this: any) => void=} watched
 * @property {(this: any) => void=} unwatched
 */

/** Default equality check, identical to TC39 spec default. */
const defaultEquals = (a, b) => Object.is(a, b);

const NOOP = () => {};
const FALSE_FN = () => false;

/**
 * Add `consumer` as a live consumer of `node`. If `node` transitions
 * from 0 to 1+ live consumers AND is itself a consumer (a Computed),
 * recursively register `node` as a live consumer of its own producers.
 * This is how source `set()` calls reach watchers across computed
 * chains: the push side of the graph propagates upward only when
 * something downstream is actually live.
 */
function producerAddLiveConsumer(node, consumer) {
  if (!node.liveConsumers) node.liveConsumers = new Set();
  const wasEmpty = node.liveConsumers.size === 0;
  node.liveConsumers.add(consumer);
  if (wasEmpty) {
    if (node.producers && node.producers.length > 0) {
      for (const p of node.producers) producerAddLiveConsumer(p, node);
    }
    if (node.watched) {
      try { node.watched.call(node.wrapper); } catch (e) { console.error(e); }
    }
  }
}

/** Inverse of producerAddLiveConsumer. Cascades teardown upward. */
function producerRemoveLiveConsumer(node, consumer) {
  if (!node.liveConsumers) return;
  node.liveConsumers.delete(consumer);
  if (node.liveConsumers.size === 0) {
    if (node.producers && node.producers.length > 0) {
      for (const p of node.producers) producerRemoveLiveConsumer(p, node);
    }
    if (node.unwatched) {
      try { node.unwatched.call(node.wrapper); } catch (e) { console.error(e); }
    }
  }
}

/**
 * Called whenever a producer is read (during a Computed body or a
 * Watcher's tracked region). Records the edge.
 * @param {ReactiveNode} node
 */
function producerAccessed(node) {
  if (inNotificationPhase) {
    throw new Error('Signal read during notification phase');
  }
  if (activeConsumer === null) return;

  const consumer = activeConsumer;
  const idx = consumer.nextProducerIndex++;

  if (idx < consumer.producers.length && consumer.producers[idx] !== node) {
    // The producer at this slot from the previous evaluation isn't the
    // same as the one being read now. Drop the stale live edge.
    if (consumerIsLive(consumer)) {
      producerRemoveLiveConsumer(consumer.producers[idx], consumer);
    }
  }

  if (consumer.producers[idx] !== node) {
    consumer.producers[idx] = node;
    if (consumerIsLive(consumer)) {
      producerAddLiveConsumer(node, consumer);
    }
  }
  consumer.producerLastReadVersions[idx] = node.version;
}

/** True if `node` has any live consumer (watched or under a live computed). */
function consumerIsLive(node) {
  return node.consumerIsAlwaysLive || (node.liveConsumers && node.liveConsumers.size > 0);
}

/**
 * Walk live consumers, mark them dirty, cascade. This is the push side
 * of push-pull: it does NOT pre-emptively recompute computeds, only
 * marks them so the next read knows to check.
 * @param {ReactiveNode} node
 */
function producerNotifyConsumers(node) {
  if (!node.liveConsumers || node.liveConsumers.size === 0) return;
  const prev = inNotificationPhase;
  inNotificationPhase = true;
  try {
    for (const consumer of node.liveConsumers) {
      if (!consumer.dirty) {
        consumerMarkDirty(consumer);
      }
    }
  } finally {
    inNotificationPhase = prev;
  }
}

/** Mark a consumer dirty, cascade dirty to its own live consumers, fire its callback. */
function consumerMarkDirty(node) {
  node.dirty = true;
  producerNotifyConsumers(node);
  node.consumerMarkedDirty.call(node.wrapper || node);
}

/**
 * Refresh `node.version` to reflect the current state of its inputs.
 * For a Computed, this re-runs the computation if any input version
 * has changed since the last evaluation. Memoizes via the `equal` check:
 * if recomputed output equals prior, `version` is not bumped.
 * @param {ReactiveNode} node
 */
function producerUpdateValueVersion(node) {
  if (!node.dirty && node.lastCleanEpoch === epoch) return;
  if (!node.producerMustRecompute() && !consumerPollProducersForChange(node)) {
    node.dirty = false;
    node.lastCleanEpoch = epoch;
    return;
  }
  node.producerRecomputeValue();
  node.dirty = false;
  node.lastCleanEpoch = epoch;
}

/** Walk producers, recursively refresh each, check if any version moved. */
function consumerPollProducersForChange(node) {
  for (let i = 0; i < node.producers.length; i++) {
    const producer = node.producers[i];
    const seenVersion = node.producerLastReadVersions[i];
    if (seenVersion !== producer.version) return true;
    producerUpdateValueVersion(producer);
    if (seenVersion !== producer.version) return true;
  }
  return false;
}

/** Begin a tracked region: this node's producers will be recorded. */
function consumerBeforeComputation(node) {
  if (node) node.nextProducerIndex = 0;
  const prev = activeConsumer;
  activeConsumer = node;
  return prev;
}

/** End a tracked region: prune stale edges, restore previous consumer. */
function consumerAfterComputation(node, prev) {
  activeConsumer = prev;
  if (!node) return;
  if (consumerIsLive(node)) {
    for (let i = node.nextProducerIndex; i < node.producers.length; i++) {
      producerRemoveLiveConsumer(node.producers[i], node);
    }
  }
  while (node.producers.length > node.nextProducerIndex) {
    node.producers.pop();
    node.producerLastReadVersions.pop();
  }
}

/* ============================================================
 * State signal
 * ============================================================ */

class SignalState {
  /**
   * @param {unknown} initial
   * @param {{equals?: (a:unknown,b:unknown)=>boolean, [k:symbol]: any}=} options
   */
  constructor(initial, options) {
    this.__value = initial;
    this.version = 0;
    this.lastCleanEpoch = epoch;
    this.dirty = false;
    this.producers = [];
    this.producerLastReadVersions = [];
    this.liveConsumers = undefined;
    this.consumerAllowSignalWrites = true;
    this.consumerIsAlwaysLive = false;
    this.producerMustRecompute = FALSE_FN;
    this.producerRecomputeValue = NOOP;
    this.consumerMarkedDirty = NOOP;
    this.wrapper = this;
    this.__isSignal = true;
    this.__equal = options?.equals || defaultEquals;
    this.watched = options?.[WATCHED];
    this.unwatched = options?.[UNWATCHED];
  }

  get() {
    producerAccessed(this);
    return this.__value;
  }

  peek() { return this.__value; }

  set(v) {
    if (inNotificationPhase) {
      throw new Error('Signal write during notification phase');
    }
    if (this.__equal.call(this, this.__value, v)) return;
    this.__value = v;
    this.version++;
    epoch++;
    if (batchPending !== null) {
      // Collect watchers whose notify is deferred; computeds still see
      // the new value via versioning.
      collectBatched(this);
    } else {
      producerNotifyConsumers(this);
    }
  }
}

/**
 * During a batch, walk the live-consumer tree once and stash watchers
 * for deferred firing. Computeds get their dirty flag set the same way;
 * only the Watcher notify fires later.
 */
function collectBatched(node) {
  const prev = inNotificationPhase;
  inNotificationPhase = true;
  try {
    if (!node.liveConsumers) return;
    for (const consumer of node.liveConsumers) {
      if (consumer.dirty) continue;
      consumer.dirty = true;
      if (consumer.__isWatcher) {
        batchPending.add(consumer);
      } else {
        collectBatched(consumer);
      }
    }
  } finally {
    inNotificationPhase = prev;
  }
}

/* ============================================================
 * Computed signal
 * ============================================================ */

const UNSET = Symbol('unset');
const COMPUTING = Symbol('computing');
const ERRORED = Symbol('errored');

class SignalComputed {
  /**
   * @param {() => unknown} fn
   * @param {{equals?: (a:unknown,b:unknown)=>boolean, [k:symbol]: any}=} options
   */
  constructor(fn, options) {
    this.__fn = fn;
    this.__value = UNSET;
    this.__error = null;
    this.version = 0;
    this.lastCleanEpoch = -1;
    this.dirty = true;
    this.producers = [];
    this.producerLastReadVersions = [];
    this.nextProducerIndex = 0;
    this.liveConsumers = undefined;
    this.consumerAllowSignalWrites = false;
    this.consumerIsAlwaysLive = false;
    this.wrapper = this;
    this.__isSignal = true;
    this.__isComputed = true;
    this.__equal = options?.equals || defaultEquals;
    this.watched = options?.[WATCHED];
    this.unwatched = options?.[UNWATCHED];

    const self = this;
    this.producerMustRecompute = function() {
      return self.__value === UNSET || self.__value === COMPUTING;
    };
    this.producerRecomputeValue = function() {
      if (self.__value === COMPUTING) {
        throw new Error('Detected cycle in computations.');
      }
      const oldValue = self.__value;
      self.__value = COMPUTING;
      const prev = consumerBeforeComputation(self);
      let newValue;
      let isError = false;
      try {
        newValue = self.__fn.call(self.wrapper);
      } catch (err) {
        newValue = ERRORED;
        self.__error = err;
        isError = true;
      } finally {
        consumerAfterComputation(self, prev);
      }
      const oldOk = oldValue !== UNSET && oldValue !== ERRORED;
      if (!isError && oldOk && self.__equal.call(self.wrapper, oldValue, newValue)) {
        // Output unchanged. Restore prior value, don't bump version,
        // so downstream consumers can short-circuit on the version check.
        self.__value = oldValue;
        return;
      }
      self.__value = newValue;
      self.version++;
    };
    this.consumerMarkedDirty = NOOP;
  }

  get() {
    producerUpdateValueVersion(this);
    producerAccessed(this);
    if (this.__value === ERRORED) throw this.__error;
    return this.__value;
  }

  peek() {
    producerUpdateValueVersion(this);
    if (this.__value === ERRORED) throw this.__error;
    return this.__value;
  }
}

/* ============================================================
 * Watcher
 * ============================================================ */

class SignalWatcher {
  /** @param {() => void} notifyCb */
  constructor(notifyCb) {
    this.__notify = notifyCb;
    this.version = 0;
    this.lastCleanEpoch = epoch;
    this.dirty = false;
    this.producers = [];
    this.producerLastReadVersions = [];
    this.nextProducerIndex = 0;
    this.liveConsumers = undefined;
    this.consumerAllowSignalWrites = false;
    this.consumerIsAlwaysLive = true;
    this.producerMustRecompute = FALSE_FN;
    this.producerRecomputeValue = NOOP;
    this.wrapper = this;
    this.__isWatcher = true;
    const self = this;
    this.consumerMarkedDirty = function() { self.__fire(); };
  }

  /** Fire the user's notify cb once; dirty stays until `watch()` re-arms. */
  __fire() {
    if (this.__notify) this.__notify.call(this);
  }

  /**
   * Spec API: register signals to watch. Without args, re-arms (clears
   * the dirty mark so the next change will fire notify again).
   * @param {...(SignalState|SignalComputed)} signals
   */
  watch(...signals) {
    if (signals.length === 0) {
      // Re-arm.
      this.dirty = false;
      return;
    }
    const prev = consumerBeforeComputation(this);
    try {
      for (const sig of signals) {
        producerAccessed(sig);
        if (sig.__isComputed) {
          producerUpdateValueVersion(sig);
        }
      }
    } finally {
      consumerAfterComputation(this, prev);
    }
    this.dirty = false;
  }

  /**
   * Spec API: stop watching the given signals.
   * @param {...(SignalState|SignalComputed)} signals
   */
  unwatch(...signals) {
    for (let i = this.producers.length - 1; i >= 0; i--) {
      if (signals.includes(this.producers[i])) {
        producerRemoveLiveConsumer(this.producers[i], this);
        this.producers.splice(i, 1);
        this.producerLastReadVersions.splice(i, 1);
        this.nextProducerIndex = Math.min(this.nextProducerIndex, this.producers.length);
      }
    }
  }

  /** Spec API: list watched Computeds that are currently dirty. */
  getPending() {
    return this.producers.filter((p) => p.__isComputed && p.dirty);
  }

  /**
   * Convenience extension (not in TC39 spec). Runs `fn` with this
   * watcher as the active consumer, so any signal `fn` reads is added
   * to the watcher's producer set automatically. Re-arms on every call.
   *
   * Used by the WebComponent integration and the `watch()` directive
   * because the natural webjs pattern is "watch everything this render
   * touches" rather than enumerating signals up front.
   *
   * @param {() => unknown} fn
   * @returns {unknown}
   */
  observe(fn) {
    const prev = consumerBeforeComputation(this);
    let result;
    try {
      result = fn();
    } finally {
      consumerAfterComputation(this, prev);
    }
    this.dirty = false;
    return result;
  }

  /** Convenience extension: tear down all subscriptions. */
  dispose() {
    for (const producer of this.producers) {
      producerRemoveLiveConsumer(producer, this);
    }
    this.producers = [];
    this.producerLastReadVersions = [];
    this.__notify = null;
  }
}

/* ============================================================
 * Subtle helpers
 * ============================================================ */

const WATCHED = Symbol('watched');
const UNWATCHED = Symbol('unwatched');

/**
 * Run `fn` with dependency tracking suppressed. Reads inside see
 * current values but are not recorded as edges of the surrounding
 * consumer.
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
function untrack(fn) {
  const prev = activeConsumer;
  activeConsumer = null;
  try { return fn(); } finally { activeConsumer = prev; }
}

/** @param {SignalComputed | SignalWatcher} sink */
function introspectSources(sink) {
  return sink.producers.slice();
}

/** @param {SignalState | SignalComputed} producer */
function introspectSinks(producer) {
  return producer.liveConsumers ? [...producer.liveConsumers] : [];
}

/** @param {SignalState | SignalComputed} producer */
function hasSinks(producer) {
  return !!producer.liveConsumers && producer.liveConsumers.size > 0;
}

/** @param {SignalComputed | SignalWatcher} sink */
function hasSources(sink) {
  return sink.producers.length > 0;
}

/** The innermost active Computed, or null. */
function currentComputed() {
  return activeConsumer && activeConsumer.__isComputed ? activeConsumer : null;
}

/* ============================================================
 * Batch
 * ============================================================ */

/**
 * Open a batch. All `set()` calls inside `fn` defer Watcher notify
 * firing until the outermost batch closes. Inside the batch,
 * subsequent `get()` reads see the new values immediately; only the
 * Watcher notify callback is deferred.
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
      for (const w of pending) w.__fire();
    }
  }
}

/* ============================================================
 * Public surface
 * ============================================================ */

/**
 * TC39-shaped namespace. `Signal.State`, `Signal.Computed`, plus
 * `Signal.subtle.*` for advanced use (Watcher, untrack, introspection,
 * the watched/unwatched symbols).
 */
export const Signal = {
  State: SignalState,
  Computed: SignalComputed,
  subtle: {
    Watcher: SignalWatcher,
    untrack,
    introspectSources,
    introspectSinks,
    hasSinks,
    hasSources,
    currentComputed,
    watched: WATCHED,
    unwatched: UNWATCHED,
  },
};

/**
 * Convenience constructor for a writable signal.
 * @template T
 * @param {T} initial
 * @param {{equals?: (a:T,b:T)=>boolean}=} options
 * @returns {SignalState}
 */
export function signal(initial, options) { return new SignalState(initial, options); }

/**
 * Convenience constructor for a computed signal.
 * @template T
 * @param {() => T} fn
 * @param {{equals?: (a:T,b:T)=>boolean}=} options
 * @returns {SignalComputed}
 */
export function computed(fn, options) { return new SignalComputed(fn, options); }

/**
 * Predicate: discriminate a signal from a plain value.
 * @param {unknown} v
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
 * The spec forbids reads/writes inside a Watcher notify, so effects
 * defer the re-run to a microtask.
 *
 * @param {() => void} fn
 * @returns {() => void}
 */
export function effect(fn) {
  let scheduled = false;
  let disposed = false;
  const computed_ = new SignalComputed(fn);
  const w = new SignalWatcher(() => {
    if (scheduled || disposed) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (disposed) return;
      try { computed_.get(); } catch (e) { console.error(e); }
      w.watch();
    });
  });
  w.watch(computed_);
  try { computed_.get(); } catch (e) { console.error(e); }
  return () => {
    if (disposed) return;
    disposed = true;
    w.dispose();
  };
}
