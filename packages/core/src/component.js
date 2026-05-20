import { render as clientRender } from './render-client.js';
import { isCSS, adoptStyles } from './css.js';
import { register, tagOf } from './registry.js';
import { parse as deserializeProp } from './serialize.js';
import {
  captureAuthoredChildren,
  adoptSSRAssignments,
  attachSlotObservers,
  detachSlotObservers,
  ensureSlotState,
  hasSlotState,
} from './slot.js';

const isBrowser = typeof window !== 'undefined' && typeof HTMLElement !== 'undefined';

/**
 * @typedef {Object} ReactiveController
 * A controller is a reusable piece of lifecycle logic that plugs into a
 * WebComponent host. Controllers let you extract cross-cutting concerns
 * (timers, intersection observers, media queries, form validation, fetch
 * caching) out of the component class and share them across unrelated
 * components.
 *
 * **When to use:** any time two or more components need the same
 * `connectedCallback` / `disconnectedCallback` / pre-render / post-render
 * behaviour. Instead of a mixin or base-class hierarchy, attach a controller.
 *
 * **Why it exists:** mirrors Lit's `ReactiveController` protocol so
 * ecosystem controllers are interoperable.
 *
 * @property {() => void} [hostConnected]
 *   Called when the host element is inserted into the DOM
 *   (`connectedCallback`). Use for subscriptions, observers, timers.
 * @property {() => void} [hostDisconnected]
 *   Called when the host element is removed from the DOM
 *   (`disconnectedCallback`). Use for cleanup: unsubscribe, disconnect
 *   observers, clear timers.
 * @property {() => void} [hostUpdate]
 *   Called just before the host renders (inside `_performRender`, after
 *   `willUpdate` but before `render()`). Use for reading layout or
 *   preparing data that the render depends on.
 * @property {() => void} [hostUpdated]
 *   Called after the host has rendered and the DOM is up to date. Use for
 *   post-render side effects that depend on the new DOM (measuring,
 *   focusing, scrolling).
 */

/**
 * @typedef {Object} PropertyDeclaration
 * Declares how a single reactive property behaves. Used inside
 * `static properties = { propName: { …declaration } }`.
 *
 * @property {Function} [type]
 *   Constructor used for attribute → property coercion.
 *   Supported built-ins: `String`, `Number`, `Boolean`, `Object`, `Array`.
 *   Default: `String`.
 *
 * @property {boolean} [reflect]
 *   When `true`, writing to the property also sets the corresponding
 *   HTML attribute on the element (kebab-cased). Useful when you want
 *   CSS attribute selectors like `my-el[mode="dark"]` to work.
 *
 * @property {boolean} [state]
 *   When `true`, the property is *internal-only*: it is NOT exposed as an
 *   HTML attribute (excluded from `observedAttributes`) and never reflects.
 *   It still triggers a re-render when changed via the generated setter.
 *   Use for private reactive state that shouldn't leak into the DOM.
 *
 * @property {(newValue: unknown, oldValue: unknown) => boolean} [hasChanged]
 *   Custom dirty-check function. Called by the generated setter before
 *   scheduling an update. Return `true` to trigger a re-render, `false`
 *   to skip. Default: strict inequality `(a, b) => a !== b`.
 *
 *   Note: this fires on the FIRST assignment too, with `oldValue` set
 *   to `undefined`. Numeric comparators that subtract against undefined
 *   produce `NaN`, which evaluates to `false`, silently rejecting the
 *   constructor's initial assignment. Treat `oldValue === undefined` as
 *   "always changed" in custom comparators so the initial value lands.
 *
 * @property {{ fromAttribute: (value: string|null, type?: Function) => unknown, toAttribute: (value: unknown, type?: Function) => string|null }} [converter]
 *   Custom serialization/deserialization pair for the HTML attribute.
 *   `fromAttribute` is called in `attributeChangedCallback`;
 *   `toAttribute` is called when reflecting back to the attribute.
 *   If omitted, the built-in type-based coercion is used.
 */

/**
 * Default change detection: strict inequality.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function defaultHasChanged(a, b) {
  return a !== b;
}

/**
 * A minimal base for HTML Custom Elements that mirrors Lit's ergonomics
 * while staying JSDoc-only and no-build.
 *
 * Subclasses declare:
 *  - `static properties`: attribute/property declarations with type info,
 *    reflection, custom converters, and internal-state mode
 *  - `static styles`: CSSResult or array thereof (only meaningful with
 *    `static shadow = true`; light-DOM components inherit global CSS)
 *  - `static shadow`: set `true` to opt in to shadow DOM (default: `false`
 *    → light DOM, so Tailwind / global CSS apply directly)
 *  - `render()`: returns a TemplateResult
 *
 * The tag name is not a static field: pass it to `.register('tag-name')`
 * at the bottom of the file. Tag must contain a hyphen (HTML spec).
 *
 * Lifecycle (lit-aligned, called in order during each update cycle):
 *  1. `shouldUpdate(changedProperties)`. Skip update if false.
 *  2. `willUpdate(changedProperties)`. Safe to set properties; folds into this cycle.
 *  3. controllers' `hostUpdate()`
 *  4. `update(changedProperties)`. Default impl calls `render()` + commits.
 *  5. controllers' `hostUpdated()`
 *  6. `firstUpdated(changedProperties)`: once, on the first render only
 *  7. `updated(changedProperties)`: every render commit
 *  8. `updateComplete` promise resolves
 *
 * `changedProperties` is a `Map<string, unknown>` where each entry maps a
 * property name (or `'state'` for setState patches) to its previous value.
 *
 * Usage:
 * ```js
 * class MyCounter extends WebComponent {
 *   static properties = { count: { type: Number, reflect: true } };
 *   state = { count: 0 };
 *   render() { return html`<button @click=${() => this.setState({ count: this.state.count + 1 })}>${this.state.count}</button>`; }
 * }
 * MyCounter.register('my-counter');
 * ```
 */

// Base class choice: real HTMLElement on the browser, a dummy on the server.
const Base = isBrowser ? HTMLElement : /** @type {any} */ (class {});

export class WebComponent extends Base {
  /** Whether to use shadow DOM. Default: false (light DOM). @type {boolean} */
  static shadow = false;

  /**
   * Hydration strategy for this component.
   *
   * **AI hint:** Set `static hydrate = 'visible'` to defer client-side
   * hydration until the element scrolls into (or near) the viewport. The
   * server-rendered Declarative Shadow DOM content stays visible the whole
   * time: users see the SSR HTML immediately while JavaScript activation
   * is deferred. This is useful for below-the-fold components that don't
   * need interactivity right away.
   *
   * - `undefined` (default): hydrate immediately on `connectedCallback`.
   * - `'visible'`: hydrate when the element enters the viewport
   *   (with a 200 px root margin).
   *
   * @type {'visible' | undefined}
   */
  static hydrate = undefined;

  /**
   * Attribute/property declarations.
   *
   * Each key is a property name; the value is a {@link PropertyDeclaration}.
   *
   * Properties declared here get auto-generated accessors (getter/setter)
   * that trigger re-renders on change, coerce attribute values by type,
   * and optionally reflect back to attributes.
   *
   * Properties with `state: true` are excluded from `observedAttributes`
   * and never reflect: they behave like private reactive state.
   *
   * @type {Record<string, PropertyDeclaration>}
   */
  static properties = {};

  /**
   * Styles to adopt into the shadow root.
   * @type {import('./css.js').CSSResult | import('./css.js').CSSResult[] | null}
   */
  static styles = null;

  /**
   * Register this class as a custom element under `tag`.
   *
   *     class Counter extends WebComponent { … }
   *     Counter.register('my-counter');
   *
   * Delegates to `customElements.define` (or the server-side shim) via the
   * internal registry. The module URL for `<link rel="modulepreload">`
   * hints is derived server-side by scanning the app tree: no need to
   * pass `import.meta.url`.
   *
   * @param {string} tag  Must contain a hyphen (HTML spec).
   */
  static register(tag) {
    register(tag, this);
  }

  /**
   * Returns the list of attribute names the browser should observe.
   * Properties with `state: true` are excluded: they are internal-only
   * and do not correspond to any HTML attribute.
   *
   * @returns {string[]}
   */
  static get observedAttributes() {
    const props = this.properties || {};
    return Object.keys(props)
      .filter((k) => !props[k].state)
      .map(hyphenate);
  }

  constructor() {
    super();
    /** @type {Record<string, unknown>} */
    this.state = {};
    this._renderRoot = null;
    this._scheduled = false;
    this._connected = false;

    /**
     * Set of attached reactive controllers.
     * @type {Set<ReactiveController>}
     */
    this.__controllers = new Set();

    /**
     * Whether the component has completed its first render.
     * Used to gate the one-time `firstUpdated()` call.
     * @type {boolean}
     */
    this.__firstRendered = false;

    /**
     * Map of changed properties accumulated since the last render. Keys are
     * property names (or `'state'` for setState patches); values are the
     * previous value before the change. Passed to `shouldUpdate`, `willUpdate`,
     * `update`, `firstUpdated`, and `updated`. Cleared at the start of each
     * render cycle so accumulations during hooks queue for the next cycle.
     * @type {Map<string, unknown>}
     */
    this._changedProperties = new Map();

    /**
     * Resolver for the currently-pending updateComplete promise. `null` when
     * no update is pending.
     * @type {((value: boolean) => void) | null}
     * @private
     */
    this._updateResolve = null;

    /**
     * Promise that resolves after the next render commit. Resolves to `true`
     * when there are no further pending updates, `false` otherwise.
     * @type {Promise<boolean>}
     * @private
     */
    this._updatePromise = Promise.resolve(true);

    /**
     * Set while the component is inside the update phase (between
     * `shouldUpdate` and `updated`). Property assignments during this window
     * fold into the CURRENT `changedProperties` Map without scheduling a
     * new microtask render. Assignments during `updated()` (after the flag
     * clears) queue a fresh cycle.
     * @type {boolean}
     * @private
     */
    this._isUpdating = false;

    // Install reactive property accessors for `static properties` declarations.
    this._initializeProperties();
  }

  /**
   * For every key in `static properties`, create a getter/setter pair on
   * the instance that coerces values, runs `hasChanged`, schedules updates,
   * and optionally reflects to the HTML attribute.
   *
   * This is called once from the constructor. The backing store is a plain
   * object (`this.__propValues`) so accessors don't collide with the
   * prototype.
   * @private
   */
  _initializeProperties() {
    const Ctor = /** @type {any} */ (this.constructor);
    const props = Ctor.properties;
    if (!props || typeof props !== 'object') return;

    /** @type {Record<string, unknown>} */
    this.__propValues = {};

    for (const [propName, decl] of Object.entries(props)) {
      const d = typeof decl === 'object' ? decl : { type: decl };
      // Capture any value set before the accessor was installed (e.g. via
      // attribute or property assignment before `super()` returns).
      const initial = /** @type {any} */ (this)[propName];

      Object.defineProperty(this, propName, {
        configurable: true,
        enumerable: true,
        get: () => this.__propValues[propName],
        set: (newVal) => {
          const oldVal = this.__propValues[propName];
          const changed = (d.hasChanged || defaultHasChanged)(newVal, oldVal);
          if (!changed) return;
          this.__propValues[propName] = newVal;

          // Reflect to attribute if requested (and not internal state).
          if (d.reflect && !d.state && this._connected) {
            this._reflectAttribute(propName, newVal, d);
          }

          // requestUpdate records the (name, oldValue) entry AND schedules
          // a render. When called during the update phase (willUpdate /
          // hostUpdate / update / hostUpdated), the scheduler short-circuits
          // and the entry folds into the current cycle's changedProperties.
          this.requestUpdate(propName, oldVal);
        },
      });

      if (initial !== undefined) {
        this.__propValues[propName] = initial;
      }
    }
  }

  /**
   * Write a property value back to its corresponding HTML attribute.
   * Uses a custom `converter.toAttribute` if provided, otherwise the
   * built-in type-based serialization.
   *
   * @param {string} propName
   * @param {unknown} value
   * @param {PropertyDeclaration} decl
   * @private
   */
  _reflectAttribute(propName, value, decl) {
    const attrName = hyphenate(propName);
    // Guard against re-entrant loops: attributeChangedCallback fires when
    // we call setAttribute, which would call the setter again.
    if (this.__reflectingAttribute) return;
    this.__reflectingAttribute = true;
    try {
      if (decl.converter && decl.converter.toAttribute) {
        const serialized = decl.converter.toAttribute(value, decl.type);
        if (serialized == null) this.removeAttribute(attrName);
        else this.setAttribute(attrName, serialized);
      } else if (decl.type === Boolean) {
        if (value) this.setAttribute(attrName, '');
        else this.removeAttribute(attrName);
      } else if (value == null) {
        this.removeAttribute(attrName);
      } else if (decl.type === Object || decl.type === Array) {
        this.setAttribute(attrName, JSON.stringify(value));
      } else {
        this.setAttribute(attrName, String(value));
      }
    } finally {
      this.__reflectingAttribute = false;
    }
  }

  connectedCallback() {
    if (!isBrowser) return;

    // Apply any `data-webjs-prop-*` attributes emitted by SSR. The server
    // emits these for `.prop=${val}` bindings in parent templates so
    // rich-typed values (Array, Object, Date, Map, Set, BigInt, cycles)
    // round-trip through the rendered HTML. Once applied, the attributes
    // are stripped so the settled DOM matches what the user would expect
    // from the JS source: no framework artifacts left on the element.
    // One-time per element. Subsequent reconnections do nothing.
    if (!this.__webjsPropsHydrated) {
      this.__webjsPropsHydrated = true;
      this._hydratePropAttrs();
    }

    const Ctor = /** @type any */ (this.constructor);

    // Selective hydration: defer activation until the element scrolls into
    // (or near) the viewport. The DSD content from SSR stays visible the
    // whole time: the user sees the server-rendered HTML.
    if (
      Ctor.hydrate === 'visible' &&
      typeof IntersectionObserver !== 'undefined' &&
      !this.__hydrationActivated
    ) {
      this.__hydrationActivated = false;
      this.__hydrationObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              this.__hydrationObserver.unobserve(this);
              this.__hydrationObserver.disconnect();
              this.__hydrationObserver = null;
              this.__hydrationActivated = true;
              this._activate();
              return;
            }
          }
        },
        { rootMargin: '200px' }
      );
      this.__hydrationObserver.observe(this);
      return;
    }

    this._activate();
  }

  /**
   * Internal activation method that performs the actual connectedCallback
   * work: setting up the render root, adopting styles, notifying
   * controllers, and performing the first render.
   *
   * Called directly from `connectedCallback()` for normal components, or
   * deferred via IntersectionObserver when `static hydrate = 'visible'`.
   *
   * @private
   */
  /**
   * Read `data-webjs-prop-*` attributes (emitted by SSR for `.prop=${val}`
   * bindings in parent templates), decode each via the wire serializer,
   * assign the decoded value to the corresponding camelCase property on
   * this instance, and remove the attribute from the DOM. After this
   * runs, inspecting the element shows the same attributes the developer
   * would expect from the JS source.
   *
   * @private
   */
  _hydratePropAttrs() {
    /** @type {string[]} */
    const names = [];
    const attrs = this.attributes;
    for (let i = 0; i < attrs.length; i++) {
      const n = attrs[i].name;
      if (n.startsWith('data-webjs-prop-')) names.push(n);
    }
    for (const fullName of names) {
      const raw = this.getAttribute(fullName);
      this.removeAttribute(fullName);
      if (raw == null) continue;
      const propName = camelCase(fullName.slice('data-webjs-prop-'.length));
      try {
        /** @type any */ (this)[propName] = deserializeProp(raw);
      } catch (err) {
        console.warn(
          `[webjs] failed to decode ${fullName} on <${this.tagName.toLowerCase()}>: ${err && err.message}`
        );
      }
    }
  }

  _activate() {
    this._connected = true;
    const Ctor = /** @type any */ (this.constructor);
    if (Ctor.shadow === true) {
      const hadSSRShadow = !!this.shadowRoot;
      if (!this.shadowRoot) {
        /** @type any */ (this).attachShadow({ mode: 'open' });
      }
      this._renderRoot = this.shadowRoot;
      const styles = Ctor.styles;
      const list = Array.isArray(styles) ? styles : isCSS(styles) ? [styles] : [];
      if (list.length) {
        // If the shadow root came from Declarative Shadow DOM (SSR), it
        // contains an inline <style> tag. Remove it before switching to
        // adoptedStyleSheets to avoid duplicate styles.
        if (hadSSRShadow) {
          const ssrStyle = this.shadowRoot.querySelector('style');
          if (ssrStyle) ssrStyle.remove();
        }
        adoptStyles(this._renderRoot, list);
      }
    } else {
      this._renderRoot = this;
      // Light DOM: static styles is not supported (no shadow root for
      // adoptedStyleSheets). Warn if the developer set both.
      if (Ctor.styles) {
        console.warn(
          `[webjs] <${tagOf(Ctor) || this.tagName?.toLowerCase()}> has static shadow = false AND static styles. ` +
          `static styles only works with shadow DOM (adoptedStyleSheets). ` +
          `For light DOM, use global CSS or <style> in render().`
        );
      }
      // Light-DOM slot lifecycle phase one. Three sub-paths:
      //
      // a. Reconnection. Slot state already exists from a prior mount.
      //    The host still carries the rendered template DOM (plus
      //    projected children) from before the disconnect. Skip
      //    capture (would wrongly hoover up rendered nodes) and skip
      //    SSR adoption. clientRender will see the existing INSTANCE
      //    and updateInstance instead of recreating; the DOM stays.
      //
      // b. SSR hydration (first mount, <!--webjs-hydrate--> marker
      //    present). Children are already projected into
      //    <slot data-webjs-light data-projection="actual"> elements
      //    by injectDSD. Adopt those assignments BEFORE _performRender
      //    so we retain references to the SSR'd nodes; the renderer's
      //    createInstance().replaceChildren() will detach them, but
      //    projection re-attaches by moving the same Node refs into
      //    the freshly-cloned slot. DOM identity preserved through the
      //    hydration round-trip.
      //
      // c. First mount, no SSR. Move authored children into the
      //    assignment table before _performRender wipes the host.
      if (hasSlotState(this)) {
        // (a) Reconnection. State already populated; nothing to do here.
      } else if (this.__isHydrating()) {
        ensureSlotState(this);
        adoptSSRAssignments(this);
      } else {
        captureAuthoredChildren(this);
      }
    }

    // Notify all controllers that the host is connected.
    for (const c of this.__controllers) {
      if (c.hostConnected) c.hostConnected();
    }

    // First render is deferred to a microtask, matching lit's
    // performUpdate scheduling. The user's connectedCallback override
    // body runs synchronously to completion BEFORE the first render,
    // so subclass setup that needs to inspect attributes / state / etc.
    // observes consistent timing whether SSR-hydrating or first mount.
    // Render-root setup (shadow attachment, light-DOM SSR adoption,
    // controller hostConnected, _connected=true) all stay synchronous
    // above; only the template commit + post-commit slot observers
    // defer. Authoring contract: post-render DOM setup goes in
    // firstUpdated(), NOT connectedCallback().
    //
    // The scheduling matches `_scheduleUpdate`'s wrapper so lifecycle
    // throws are surfaced as console errors instead of bricking the
    // element.
    if (this._updateResolve === null) {
      this._updatePromise = new Promise((resolve) => {
        this._updateResolve = resolve;
      });
    }
    this._scheduled = true;
    queueMicrotask(() => {
      this._scheduled = false;
      try {
        this._performRender();
      } catch (err) {
        console.error(`[webjs] lifecycle hook threw during initial render:`, err);
      }
      // Light-DOM slot lifecycle phase two: after the first render
      // commits, the live <slot> elements exist. Attach mutation
      // observers so authored-child + slot-name changes drive
      // incremental projection. (Shadow DOM uses native slot
      // projection; nothing to attach.)
      if (this._renderRoot === this) {
        attachSlotObservers(this);
      }
    });
  }

  /**
   * True when this host's first child is the framework's hydration
   * marker, meaning the SSR pipeline already rendered the template's
   * shape (including <slot data-webjs-light> elements with their
   * projected children inside) and the client should bind events
   * without re-creating DOM. Sets __hydratedAtActivate as a side
   * effect so the post-render path picks up the SSR assignment table.
   *
   * @returns {boolean}
   * @private
   */
  __isHydrating() {
    const first = this.firstChild;
    const isHydrate =
      first != null &&
      first.nodeType === 8 &&
      /** @type {Comment} */ (first).data === 'webjs-hydrate';
    if (isHydrate) this.__hydratedAtActivate = true;
    return isHydrate;
  }


  /**
   * Called when the element is removed from the DOM.
   *
   * Notifies all attached {@link ReactiveController}s so they can clean up
   * subscriptions, timers, and observers. If you override this in a
   * subclass, always call `super.disconnectedCallback()`.
   */
  disconnectedCallback() {
    this._connected = false;
    // Clean up the hydration observer if the element is removed before
    // it became visible.
    if (this.__hydrationObserver) {
      this.__hydrationObserver.disconnect();
      this.__hydrationObserver = null;
    }
    // Pause slot observers. The per-host state (assignment table,
    // pending fragments, last snapshots) is preserved so a subsequent
    // reconnection picks up where it left off.
    if (this._renderRoot === this) detachSlotObservers(this);
    for (const c of this.__controllers) {
      if (c.hostDisconnected) c.hostDisconnected();
    }
  }

  /**
   * @param {string} name  Kebab-cased attribute name
   * @param {string|null} _old
   * @param {string|null} value
   */
  attributeChangedCallback(name, _old, value) {
    // When we are reflecting a property back to an attribute, ignore the
    // resulting attributeChangedCallback to avoid infinite loops.
    if (this.__reflectingAttribute) return;

    const Ctor = /** @type any */ (this.constructor);
    const propName = camelCase(name);
    const def = Ctor.properties && (Ctor.properties[propName] || Ctor.properties[name]);
    if (!def) return;

    let v;
    if (def.converter && def.converter.fromAttribute) {
      v = def.converter.fromAttribute(value, def.type);
    } else if (def.type === Number) {
      v = value == null ? null : Number(value);
    } else if (def.type === Boolean) {
      v = value != null && value !== 'false';
    } else if (def.type === Object || def.type === Array) {
      try { v = value == null ? null : JSON.parse(value); } catch { v = value; }
    } else {
      v = value;
    }

    if (this[propName] !== v) {
      this[propName] = v;
      if (this._connected) this.requestUpdate();
    }
  }

  /**
   * Shallow-merge new state and schedule a re-render.
   *
   * Adds a `'state'` entry to `changedProperties` with the previous state
   * bag as the old value, so lifecycle hooks (`shouldUpdate`, `willUpdate`,
   * `updated`) can detect that setState was invoked this cycle.
   *
   * @param {Record<string, unknown>} patch
   */
  setState(patch) {
    const oldState = this.state;
    this.state = { ...this.state, ...patch };
    if (!this._changedProperties.has('state')) {
      this._changedProperties.set('state', oldState);
    }
    this._scheduleUpdate();
  }

  /**
   * Schedule a re-render. Optionally record a property change in
   * `changedProperties` so hooks can branch on what changed.
   *
   * @param {string} [name]      Property name that changed
   * @param {unknown} [oldValue] Previous value of the property
   */
  requestUpdate(name, oldValue) {
    if (name !== undefined && !this._changedProperties.has(name)) {
      this._changedProperties.set(name, oldValue);
    }
    this._scheduleUpdate();
  }

  /**
   * Internal scheduler shared by `setState` and `requestUpdate`. Coalesces
   * multiple changes in the same tick into a single microtask render.
   * Manages the `updateComplete` promise lifecycle. Short-circuits when
   * the component is mid-update (assignments during `willUpdate` / `update`
   * fold into the current cycle's `changedProperties` Map).
   * @private
   */
  _scheduleUpdate() {
    if (this._updateResolve === null) {
      this._updatePromise = new Promise((resolve) => {
        this._updateResolve = resolve;
      });
    }
    if (this._isUpdating) return;
    if (this._scheduled || !this._connected) return;
    this._scheduled = true;
    queueMicrotask(() => {
      this._scheduled = false;
      try {
        this._performRender();
      } catch (err) {
        // _performRender wraps the update phase in try/finally so this
        // catches throws from shouldUpdate / willUpdate / hostUpdate /
        // hostUpdated / firstUpdated / updated. The component is not
        // left in a bad state (the finally blocks reset _isUpdating and
        // resolve updateComplete). Surface the error for visibility.
        console.error(`[webjs] lifecycle hook threw during update cycle:`, err);
      }
    });
  }

  /**
   * Core update cycle, lit-aligned:
   *   1. Snapshot + clear `changedProperties`
   *   2. `shouldUpdate(changedProperties)`. If false, resolve updateComplete and return.
   *   3. `willUpdate(changedProperties)`. Safe to set properties without re-triggering.
   *   4. Controllers' `hostUpdate()`
   *   5. `update(changedProperties)`. Default impl calls `render()` + commits.
   *      Wrapped in error boundary that falls back to `renderError(error)`.
   *   6. Controllers' `hostUpdated()`
   *   7. `firstUpdated(changedProperties)` runs once, on the first render only
   *   8. `updated(changedProperties)` runs after every commit
   *   9. Resolve `updateComplete` promise
   * @private
   */
  _performRender() {
    if (!this._renderRoot) return;

    // Hold a stable reference to the current Map so all hooks see the same
    // snapshot. During the update phase (steps 3-6) the Map is mutated in
    // place when property setters fire, folding those changes into THIS
    // cycle. The Map is replaced with a fresh empty one only after a
    // successful commit so post-commit assignments queue the NEXT cycle.
    // On `shouldUpdate=false` or hook errors, the Map is preserved so the
    // accumulated changes survive into the next render.
    const changedProperties = this._changedProperties;

    // --- 1. Mark we're inside an update cycle ---
    this._isUpdating = true;
    let didCommit = false;

    // --- 2-6. Update phase. Lifecycle-hook throws are logged and
    // swallowed so the component is not left in a deadlocked state
    // (`_isUpdating` stuck true, `updateComplete` never resolves).
    try {
      if (this.shouldUpdate(changedProperties)) {
        // --- 3. willUpdate (may mutate properties; folds into this cycle) ---
        this.willUpdate(changedProperties);

        // --- 4. controllers' hostUpdate ---
        for (const c of this.__controllers) {
          if (c.hostUpdate) c.hostUpdate();
        }

        // --- 5. update + DOM commit (with render-error boundary) ---
        try {
          this.update(changedProperties);
        } catch (error) {
          console.error(`[webjs] render error in <${tagOf(/** @type any */ (this.constructor)) || this.tagName?.toLowerCase()}>:`, error);
          try {
            const fallback = this.renderError(/** @type {Error} */ (error));
            if (fallback !== undefined) clientRender(fallback, this._renderRoot);
          } catch (fallbackError) {
            console.error(`[webjs] renderError() also threw:`, fallbackError);
          }
        }

        // --- 6. controllers' hostUpdated ---
        for (const c of this.__controllers) {
          if (c.hostUpdated) c.hostUpdated();
        }

        didCommit = true;
      }
      // shouldUpdate=false: preserve _changedProperties so the next
      // requestUpdate keeps accumulating on top of the entries that
      // didn't render this cycle.
    } catch (preCommitError) {
      console.error(`[webjs] lifecycle hook threw during update phase:`, preCommitError);
    } finally {
      this._isUpdating = false;
      if (didCommit) {
        this._changedProperties = new Map();
      }
    }

    // --- 7-8. Post-commit hooks. Errors here are also caught so the
    // updateComplete promise always resolves.
    if (didCommit) {
      try {
        // --- 7. firstUpdated (once) ---
        if (!this.__firstRendered) {
          this.__firstRendered = true;
          this.firstUpdated(changedProperties);
        }
        // --- 8. updated (every render) ---
        this.updated(changedProperties);
      } catch (postCommitError) {
        console.error(`[webjs] lifecycle hook threw during post-commit phase:`, postCommitError);
      } finally {
        this._resolveUpdate();
      }
    } else {
      this._resolveUpdate();
    }
  }

  /**
   * Resolve the pending updateComplete promise. Value reflects whether any
   * further updates were queued during the current cycle: `true` means the
   * component has settled, `false` means another render will run.
   * @private
   */
  _resolveUpdate() {
    if (this._updateResolve) {
      const settled = this._changedProperties.size === 0;
      this._updateResolve(settled);
      this._updateResolve = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle hooks: override in subclasses
  // ---------------------------------------------------------------------------

  /**
   * Decide whether the component should render in response to a queued
   * update. Default implementation returns `true` (always render).
   *
   * **When to use:** override to skip an update when the relevant inputs
   * haven't changed, e.g. an expensive component that only depends on a
   * subset of its reactive properties.
   *
   * ```js
   * shouldUpdate(changedProperties) {
   *   return changedProperties.has('itemCount') || changedProperties.has('mode');
   * }
   * ```
   *
   * @param {Map<string, unknown>} _changedProperties
   * @returns {boolean}
   */
  shouldUpdate(_changedProperties) {
    return true;
  }

  /**
   * Run immediately before `update()`. Safe to set reactive properties
   * here without triggering another update cycle: assignments made inside
   * `willUpdate` are folded into the current `changedProperties` snapshot
   * and rendered in the same pass.
   *
   * **When to use:** computing derived values from changed inputs before
   * `render()` reads them. Lit users typically migrate `shouldUpdate`
   * heuristics that mutate state into `willUpdate`.
   *
   * ```js
   * willUpdate(changedProperties) {
   *   if (changedProperties.has('items')) {
   *     this.totalCount = this.items.length;
   *   }
   * }
   * ```
   *
   * @param {Map<string, unknown>} _changedProperties
   */
  willUpdate(_changedProperties) {}

  /**
   * The render-and-commit step. Default impl calls `render()` and commits
   * the returned `TemplateResult` to the render root.
   *
   * **When to use:** rarely. Override only when you need to wrap or
   * short-circuit the commit. Most users override `render()` instead.
   * If you do override, you MUST commit something to `this._renderRoot`
   * (or call `super.update(changedProperties)`).
   *
   * @param {Map<string, unknown>} _changedProperties
   */
  update(_changedProperties) {
    const tpl = this.render();
    clientRender(tpl, this._renderRoot);
  }

  /**
   * Called after every render commit (both the first and all subsequent
   * renders). Receives the `changedProperties` Map so you can branch on
   * what changed this cycle.
   *
   * **When to use:** post-render DOM work that depends on the new DOM,
   * triggered by specific property changes. This is the lit-aligned
   * replacement for ad-hoc `requestAnimationFrame` shims that components
   * historically used to defer DOM work after `render()`.
   *
   * ```js
   * updated(changedProperties) {
   *   if (changedProperties.has('open') && this.open) {
   *     this.querySelector('input')?.focus();
   *   }
   * }
   * ```
   *
   * @param {Map<string, unknown>} _changedProperties
   */
  updated(_changedProperties) {}

  /**
   * Called exactly once, after the component's very first render completes
   * and the DOM is live. Receives the same `changedProperties` Map that
   * `updated()` does for the first render; entries reflect the initial
   * values of reactive properties (old values are `undefined`).
   *
   * **When to use:** one-time post-render setup that requires DOM access.
   * Auto-focusing an input, measuring layout, initializing a third-party
   * library on a DOM node. `connectedCallback` fires before the first
   * render, so querying shadow children there yields nothing.
   *
   * ```js
   * firstUpdated(changedProperties) {
   *   this.shadowRoot.querySelector('input')?.focus();
   * }
   * ```
   *
   * @param {Map<string, unknown>} _changedProperties
   */
  firstUpdated(_changedProperties) {}

  /**
   * A Promise that resolves after the next render commit. Resolves to
   * `true` when the component has settled (no further updates queued),
   * `false` if another render is already scheduled.
   *
   * **When to use:** awaiting a re-render in tests, or in user code that
   * needs to read the post-render DOM after triggering an update.
   *
   * ```js
   * el.count = 5;
   * await el.updateComplete;
   * // DOM now reflects count = 5
   * ```
   *
   * @returns {Promise<boolean>}
   */
  get updateComplete() {
    return this.getUpdateComplete();
  }

  /**
   * Override point for `updateComplete`. Default returns the internal
   * update promise. Override to await additional async work that should
   * be considered part of the update cycle (e.g. lazy-loaded subcomponents).
   *
   * ```js
   * async getUpdateComplete() {
   *   const result = await super.getUpdateComplete();
   *   await this._chart?.updateComplete;
   *   return result;
   * }
   * ```
   *
   * @returns {Promise<boolean>}
   */
  getUpdateComplete() {
    return this._updatePromise;
  }

  // ---------------------------------------------------------------------------
  // Reactive controllers
  // ---------------------------------------------------------------------------

  /**
   * Register a {@link ReactiveController} with this component.
   *
   * **When to use:** call this from your controller's constructor (which
   * typically receives the host as its first argument) or from the
   * component's constructor / `connectedCallback`.
   *
   * **Why it exists:** controllers decouple reusable lifecycle behaviour
   * from the class hierarchy. Instead of extending a base class or using
   * a mixin, you compose controllers:
   *
   * ```js
   * class MouseController {
   *   constructor(host) {
   *     this.host = host;
   *     host.addController(this);
   *   }
   *   hostConnected() { window.addEventListener('mousemove', this._onMove); }
   *   hostDisconnected() { window.removeEventListener('mousemove', this._onMove); }
   * }
   * ```
   *
   * If the host is already connected when the controller is added, the
   * controller's `hostConnected()` is called immediately.
   *
   * @param {ReactiveController} controller
   */
  addController(controller) {
    this.__controllers.add(controller);
    if (this._connected && controller.hostConnected) {
      controller.hostConnected();
    }
  }

  /**
   * Unregister a previously added {@link ReactiveController}.
   *
   * **When to use:** call this when a controller's lifetime is shorter
   * than the component's: e.g. a controller that tracks a specific
   * resource and should be swapped out when the resource changes.
   *
   * The controller's `hostDisconnected()` is NOT called by `removeController`;
   * if cleanup is needed, call it yourself before removing.
   *
   * @param {ReactiveController} controller
   */
  removeController(controller) {
    this.__controllers.delete(controller);
  }

  /**
   * Override in subclasses to return a TemplateResult.
   * @returns {unknown}
   */
  render() {
    return '';
  }

  /**
   * Called when `render()` throws an error on the client side.
   *
   * **When to override (AI hint):** Override this to show a fallback UI
   * when a component's render fails. Without this, the error is logged
   * and the component renders nothing. The default implementation returns
   * `undefined` (empty render).
   *
   * **Why it exists:** Client-side error boundary. Prevents one broken
   * component from crashing the entire page. Similar to React's
   * `componentDidCatch` / Error Boundaries.
   *
   * ```js
   * renderError(error) {
   *   return html`<p style="color:red">Something went wrong: ${error.message}</p>`;
   * }
   * ```
   *
   * @param {Error} error  The error thrown by render().
   * @returns {unknown}  A TemplateResult fallback, or undefined for empty.
   */
  renderError(error) {
    return undefined;
  }
}

/** @param {string} s */
function hyphenate(s) {
  return s.replace(/([A-Z])/g, '-$1').toLowerCase();
}
/** @param {string} s */
function camelCase(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
