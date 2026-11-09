/**
 * @license
 * Portions derived from Lit (`@lit/context`), Copyright Google LLC, BSD-3-Clause.
 * https://github.com/lit/lit/blob/main/packages/context/LICENSE
 */

/**
 * Context Protocol: cross-component data sharing without prop drilling.
 *
 * A port of Lit's `@lit/context`, which implements the Web Components
 * Community Group Context Protocol, so any web component (not only a WebJs
 * one) can take part, and a component written from Lit memory behaves the
 * same under the `@webjsdev/core/context` import.
 *
 * ## When to use
 *
 * Share data (theme, auth state, locale, config) with deeply nested
 * components without passing it through every level. Prefer it over a
 * module-level signal when the value is SCOPED to a subtree, so different
 * subtrees can hold different values for the same context.
 *
 * ## Quick example
 *
 * ```js
 * import { WebComponent, html } from '@webjsdev/core';
 * import { createContext, ContextProvider, ContextConsumer } from '@webjsdev/core/context';
 *
 * // The KEY is the identity: the same string (or the same Symbol) in two
 * // modules is the same context.
 * export const themeContext = createContext('theme');
 *
 * class MyApp extends WebComponent {
 *   _theme = new ContextProvider(this, { context: themeContext, initialValue: 'light' });
 *   render() {
 *     return html`
 *       <button @click=${() => this._theme.setValue(this._theme.value === 'light' ? 'dark' : 'light')}>
 *         Toggle
 *       </button>
 *       <slot></slot>
 *     `;
 *   }
 * }
 * MyApp.register('my-app');
 *
 * class ThemedCard extends WebComponent {
 *   _theme = new ContextConsumer(this, { context: themeContext, subscribe: true });
 *   render() {
 *     return html`<div class=${this._theme.value}>Card content</div>`;
 *   }
 * }
 * ThemedCard.register('themed-card');
 * ```
 *
 * @module
 */

// ---------------------------------------------------------------------------
// createContext
// ---------------------------------------------------------------------------

/**
 * Create a context key. It returns `key` itself, typed with the value type,
 * exactly as Lit does: the key IS the identity, so `createContext('theme')`
 * in two modules produces the same context. Use a `Symbol('theme')` exported
 * from one module when the context must not collide with any other.
 *
 * @template ValueType
 * @template [K=unknown]
 * @param {K} key
 * @returns {K}
 */
export function createContext(key) {
  return key;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * Fired by a consumer to ask for a value. It bubbles and is composed, so it
 * crosses shadow roots on its way to the nearest provider.
 */
export class ContextRequestEvent extends Event {
  /**
   * @param {unknown} context The context key.
   * @param {Element} contextTarget The element asking (the consumer's host).
   * @param {(value: any, unsubscribe?: () => void) => void} callback
   *   Called by the provider with the value. A subscribing request also gets
   *   an `unsubscribe` function, and is called again on every change.
   * @param {boolean} [subscribe=false] Whether to keep receiving changes.
   */
  constructor(context, contextTarget, callback, subscribe) {
    super('context-request', { bubbles: true, composed: true });
    /** @readonly */
    this.context = context;
    /** @readonly */
    this.contextTarget = contextTarget;
    /** @readonly */
    this.callback = callback;
    /** @readonly */
    this.subscribe = subscribe ?? false;
  }
}

/**
 * Fired by a provider when it connects, so a provider ABOVE it can hand over
 * the subscriptions that now belong to the nearer provider, and so a
 * `ContextRoot` can replay requests that arrived before any provider existed.
 */
export class ContextProviderEvent extends Event {
  /**
   * @param {unknown} context The context key.
   * @param {Element} contextTarget The provider's host.
   */
  constructor(context, contextTarget) {
    super('context-provider', { bubbles: true, composed: true });
    /** @readonly */
    this.context = context;
    /** @readonly */
    this.contextTarget = contextTarget;
  }
}

// ---------------------------------------------------------------------------
// ValueNotifier (the provider's value + subscriber list)
// ---------------------------------------------------------------------------

/**
 * Holds a value and the callbacks subscribed to it. The base of
 * {@link ContextProvider}, as in Lit.
 * @template T
 */
export class ValueNotifier {
  /** @param {T} [defaultValue] */
  constructor(defaultValue) {
    /**
     * Subscribed callbacks, each with its disposer and the consumer host it
     * came from (used to re-dispatch when a nearer provider appears).
     * @type {Map<Function, { disposer: () => void, consumerHost: Element }>}
     */
    this.subscriptions = new Map();
    /** @type {T} */
    this._value = /** @type {T} */ (undefined);
    if (defaultValue !== undefined) this.value = defaultValue;
  }

  /** @returns {T} */
  get value() {
    return this._value;
  }

  /** @param {T} v */
  set value(v) {
    this.setValue(v);
  }

  /**
   * Set the value and, when it changed (or `force` is true), call every
   * subscriber with it.
   * @param {T} v
   * @param {boolean} [force=false]
   */
  setValue(v, force = false) {
    const update = force || !Object.is(v, this._value);
    this._value = v;
    if (update) this.updateObservers();
  }

  /** Call every subscriber with the current value. */
  updateObservers = () => {
    for (const [callback, { disposer }] of this.subscriptions) {
      callback(this._value, disposer);
    }
  };

  /**
   * Answer a request: call `callback` with the value, and keep it for later
   * changes when `subscribe` is true.
   * @param {(value: T, unsubscribe?: () => void) => void} callback
   * @param {Element} consumerHost
   * @param {boolean} [subscribe]
   */
  addCallback(callback, consumerHost, subscribe) {
    if (!subscribe) {
      callback(this.value);
      return;
    }
    if (!this.subscriptions.has(callback)) {
      this.subscriptions.set(callback, {
        disposer: () => {
          this.subscriptions.delete(callback);
        },
        consumerHost,
      });
    }
    const { disposer } = /** @type {{ disposer: () => void }} */ (this.subscriptions.get(callback));
    callback(this.value, disposer);
  }

  /** Drop every subscriber. */
  clearCallbacks() {
    this.subscriptions.clear();
  }
}

// ---------------------------------------------------------------------------
// ContextProvider
// ---------------------------------------------------------------------------

/**
 * A ReactiveController that provides a value to descendants. It listens on
 * its host from construction, answers matching `context-request` events from
 * descendants (never its own host's), and on connect fires
 * `context-provider` so an outer provider of the same context hands over the
 * subscribers that are now nearer to this one.
 *
 * `new ContextProvider(host, { context, initialValue })` or
 * `new ContextProvider(host, context, initialValue)`.
 *
 * @template T
 * @extends {ValueNotifier<T>}
 */
export class ContextProvider extends ValueNotifier {
  /**
   * @param {any} host The host element (a WebComponent or any element).
   * @param {any} contextOrOptions `{ context, initialValue }`, or the context.
   * @param {T} [initialValue] The value, positional form only.
   */
  constructor(host, contextOrOptions, initialValue) {
    const isOptions = contextOrOptions != null && contextOrOptions.context !== undefined;
    super(isOptions ? contextOrOptions.initialValue : initialValue);
    /** @protected */
    this.host = host;
    /** @private */
    this.context = isOptions ? contextOrOptions.context : contextOrOptions;
    this.attachListeners();
    this.host.addController?.(this);
  }

  /** @param {Event} e */
  onContextRequest = (e) => {
    const ev = /** @type {ContextRequestEvent} */ (e);
    if (ev.context !== this.context) return;
    const consumerHost = ev.contextTarget ?? ev.composedPath()[0];
    // A host never provides to itself: a component that both provides and
    // consumes a context reads it from an ancestor.
    if (consumerHost === this.host) return;
    ev.stopPropagation();
    this.addCallback(ev.callback, consumerHost, ev.subscribe);
  };

  /**
   * A nearer provider of the same context connected below this one: re-send
   * every subscriber's request from its consumer, so the nearest provider
   * answers it. The consumer drops this provider's subscription when the new
   * one calls back with a different disposer.
   * @param {Event} e
   */
  onProviderRequest = (e) => {
    const ev = /** @type {ContextProviderEvent} */ (e);
    if (ev.context !== this.context) return;
    const childProviderHost = ev.contextTarget ?? ev.composedPath()[0];
    if (childProviderHost === this.host) return;
    const seen = new Set();
    for (const [callback, { consumerHost }] of this.subscriptions) {
      if (seen.has(callback)) continue;
      seen.add(callback);
      consumerHost.dispatchEvent(
        new ContextRequestEvent(this.context, consumerHost, /** @type {any} */ (callback), true),
      );
    }
    ev.stopPropagation();
  };

  /** @private */
  attachListeners() {
    this.host.addEventListener('context-request', this.onContextRequest);
    this.host.addEventListener('context-provider', this.onProviderRequest);
  }

  /** ReactiveController hook: announce this provider to the tree above. */
  hostConnected() {
    this.host.dispatchEvent(new ContextProviderEvent(this.context, this.host));
  }
}

// ---------------------------------------------------------------------------
// ContextConsumer
// ---------------------------------------------------------------------------

/**
 * A ReactiveController that reads a context value from the nearest provider
 * above its host. It requests the value on connect and re-renders the host
 * on delivery. With `subscribe: true` it keeps receiving changes; the
 * default, as in Lit, is a one-time read per connection.
 *
 * `new ContextConsumer(host, { context, callback, subscribe })` or
 * `new ContextConsumer(host, context, callback, subscribe)`.
 *
 * @template T
 */
export class ContextConsumer {
  /**
   * @param {any} host The host element.
   * @param {any} contextOrOptions `{ context, callback, subscribe }`, or the context.
   * @param {(value: T, dispose?: () => void) => void} [callback] Positional form only.
   * @param {boolean} [subscribe] Positional form only.
   */
  constructor(host, contextOrOptions, callback, subscribe) {
    /** @protected */
    this.host = host;
    /** @private */
    this.provided = false;
    /** @type {T | undefined} */
    this.value = undefined;
    /** @private @type {(() => void) | undefined} */
    this.unsubscribe = undefined;
    if (contextOrOptions != null && contextOrOptions.context !== undefined) {
      /** @private */
      this.context = contextOrOptions.context;
      /** @private */
      this.callback = contextOrOptions.callback;
      /** @private */
      this.subscribe = contextOrOptions.subscribe ?? false;
    } else {
      this.context = contextOrOptions;
      this.callback = callback;
      this.subscribe = subscribe ?? false;
    }
    this.host.addController(this);
  }

  /** ReactiveController hook: request the value. */
  hostConnected() {
    this.dispatchRequest();
  }

  /** ReactiveController hook: stop receiving changes. */
  hostDisconnected() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  /** @private */
  dispatchRequest() {
    this.host.dispatchEvent(
      new ContextRequestEvent(this.context, this.host, this._callback, this.subscribe),
    );
  }

  /**
   * One stable callback per consumer, so a provider recognises a repeat
   * request and a hand-over between providers.
   * @private
   * @param {T} value
   * @param {() => void} [unsubscribe]
   */
  _callback = (value, unsubscribe) => {
    if (this.unsubscribe) {
      // A different disposer means a different (nearer) provider answered:
      // leave the old one.
      if (this.unsubscribe !== unsubscribe) {
        this.provided = false;
        this.unsubscribe();
      }
      if (!this.subscribe) this.unsubscribe();
    }
    this.value = value;
    this.host.requestUpdate();
    if (!this.provided || this.subscribe) {
      this.provided = true;
      if (this.callback) this.callback(value, unsubscribe);
    }
    this.unsubscribe = unsubscribe;
  };
}

// ---------------------------------------------------------------------------
// ContextRoot
// ---------------------------------------------------------------------------

/**
 * Buffers SUBSCRIBING requests that reach it unanswered (no provider above
 * the consumer yet, typically because the provider's element upgrades
 * later), and replays them when a provider for that context connects.
 * Attach one near the root, before components upgrade:
 *
 * ```js
 * new ContextRoot().attach(document.body);
 * ```
 */
export class ContextRoot {
  constructor() {
    /**
     * @private
     * @type {Map<unknown, { callbacks: WeakMap<Element, WeakSet<Function>>, requests: Array<{ elementRef: WeakRef<Element>, callbackRef: WeakRef<Function> }> }>}
     */
    this.pendingContextRequests = new Map();
  }

  /** @param {Element} element */
  attach(element) {
    element.addEventListener('context-request', this.onContextRequest);
    element.addEventListener('context-provider', this.onContextProvider);
  }

  /** @param {Element} element */
  detach(element) {
    element.removeEventListener('context-request', this.onContextRequest);
    element.removeEventListener('context-provider', this.onContextProvider);
  }

  /** @private @param {Event} e */
  onContextProvider = (e) => {
    const event = /** @type {ContextProviderEvent} */ (e);
    const pending = this.pendingContextRequests.get(event.context);
    if (pending === undefined) return;
    this.pendingContextRequests.delete(event.context);
    for (const { elementRef, callbackRef } of pending.requests) {
      const element = elementRef.deref();
      const callback = callbackRef.deref();
      if (element === undefined || callback === undefined) continue;
      element.dispatchEvent(
        new ContextRequestEvent(event.context, element, /** @type {any} */ (callback), true),
      );
    }
  };

  /** @private @param {Event} e */
  onContextRequest = (e) => {
    const event = /** @type {ContextRequestEvent} */ (e);
    // Only a subscribing request can be answered later.
    if (event.subscribe !== true) return;
    const element = event.contextTarget ?? /** @type {Element} */ (event.composedPath()[0]);
    const callback = event.callback;
    let pending = this.pendingContextRequests.get(event.context);
    if (pending === undefined) {
      this.pendingContextRequests.set(event.context, (pending = { callbacks: new WeakMap(), requests: [] }));
    }
    let callbacks = pending.callbacks.get(element);
    if (callbacks === undefined) {
      pending.callbacks.set(element, (callbacks = new WeakSet()));
    }
    if (callbacks.has(callback)) return;
    callbacks.add(callback);
    pending.requests.push({ elementRef: new WeakRef(element), callbackRef: new WeakRef(callback) });
  };
}
