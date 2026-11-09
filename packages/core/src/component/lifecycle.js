import { render as clientRender } from '../render-client.js';
import {
  readAttributeValue, resolveAttributeProperty, observedAttributeNames, declaredProperties,
  normalizeDecl, addCreatedProperty, attributeNameFor,
} from '../attribute-reader.js';
import { setActiveActionSignal, activeActionSignal } from '../action-abort-client.js';
import { carriesFunction } from '../form-action.js';
import { adoptStyles, finalizeStyles, lightDomStylesMessage } from '../css.js';
import { register, tagOf } from '../registry.js';
import { parse as deserializeProp } from '../serialize.js';
import { Signal } from '../signal.js';
import { noChange } from '../sentinels.js';
import {
  captureAuthoredChildren,
  adoptSSRAssignments,
  ensureSlotState,
  hasSlotState,
  hasFrameworkRenderedSubtree,
  installSlotInterception,
  installSlotSensors,
  teardownSlotSensors,
  reconnectSweep,
} from '../slot.js';
import { ServerElement } from './server-element.js';
import {
  defaultHasChanged,
  safeString,
  warnFunctionReflection,
  warnUnserializableReflection,
  prop,
} from './reactive.js';

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
 *   HTML attribute on the element (Lit's lowercased property name unless
 *   `attribute` names one). Useful when you want
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
 *   to skip. Default: `(a, b) => !Object.is(a, b)`.
 *
 *   Note: this fires on the FIRST assignment too, with `oldValue` set
 *   to `undefined`. Numeric comparators that subtract against undefined
 *   produce `NaN`, which evaluates to `false`, silently rejecting the
 *   constructor's initial assignment. Treat `oldValue === undefined` as
 *   "always changed" in custom comparators so the initial value lands.
 *
 * @property {{ fromAttribute: (value: string|null, type?: Function) => unknown, toAttribute: (value: unknown, type?: Function) => string|null }} [converter]
 *   Custom serialization/deserialization pair for the HTML attribute.
 *   `fromAttribute` is called by BOTH attribute readers through the shared
 *   `readAttributeValue` in `attribute-reader.js`: the client
 *   `attributeChangedCallback` and the SSR
 *   `applyAttrsToInstance` in `render-server.js` (#1340). So it runs
 *   server-side too, and must not touch browser globals.
 *   `toAttribute` is called when reflecting back to the attribute.
 *   If omitted, the built-in type-based coercion is used.
 */
// Base class choice: real HTMLElement on the browser, the shim on the server.
const Base = isBrowser ? HTMLElement : /** @type {any} */ (ServerElement);


/** A settled `updateComplete` shared by every instance until its first update. */
const RESOLVED_TRUE = Promise.resolve(true);
/** Iterated in place of a controller set no instance has created. */
const NO_CONTROLLERS = new Set();

/**
 * Per class, the declared reactive properties with their accessors installed
 * on the prototype.
 * @type {WeakMap<Function, { propName: string, decl: any }[]>}
 */
const _accessorPlans = new WeakMap();

/** Classes whose `finalize()` has run. @type {WeakSet<Function>} */
const FINALIZED = new WeakSet();

/** Per class, the memoized `elementProperties` Map. @type {WeakMap<Function, Map<string, any>>} */
const ELEMENT_PROPERTIES = new WeakMap();

/** Per class, the memoized `elementStyles` list. @type {WeakMap<Function, any[]>} */
const ELEMENT_STYLES = new WeakMap();

/** Light-DOM classes already told that `static styles` needs shadow DOM. @type {WeakSet<Function>} */
const WARNED_LIGHT_STYLES = new WeakSet();

/** Controller classes whose `hostUpdate()` already threw at SSR. @type {WeakSet<Function>} */
const REPORTED_SSR_CONTROLLERS = new WeakSet();

/** What `getPropertyOptions()` answers for an undeclared name, Lit's default declaration. */
const DEFAULT_DECLARATION = Object.freeze({ type: String });

/**
 * The setters WebJs generated, mapped to the author accessor each one wraps
 * (or `null` for the built-in per-instance storage). A subclass constructed
 * after its parent finds the parent's generated pair first; this map lets it
 * wrap the author's accessor underneath instead of mistaking the wrapper for
 * one.
 * @type {WeakMap<Function, { get?: () => unknown, set?: (v: unknown) => void } | null>}
 */
const GENERATED_SETTERS = new WeakMap();

/**
 * The nearest author-written accessor for `name` on `Cls`'s prototype chain,
 * below the WebJs base: what Lit's `getPropertyDescriptor` wraps when a class
 * declares a reactive property AND defines its own `get` / `set` for it.
 * Returns null when there is none (the property uses built-in storage).
 * @param {any} Cls
 * @param {string} name
 */
function authorAccessor(Cls, name) {
  for (let p = Cls.prototype; p && p !== WebComponentBase.prototype; p = Object.getPrototypeOf(p)) {
    const d = Object.getOwnPropertyDescriptor(p, name);
    if (!d) continue;
    if (d.set && GENERATED_SETTERS.has(d.set)) return GENERATED_SETTERS.get(d.set) ?? null;
    if (d.get || d.set) return { get: d.get, set: d.set };
    return null;
  }
  return null;
}

/**
 * Define the getter/setter pair for every declared property on the class's
 * prototype, once, and record the plan the constructor applies per instance
 * (own-value capture and `default`). The descriptor comes from the class's
 * `static getPropertyDescriptor()`, Lit's override point, so a subclass can
 * wrap it.
 * @param {any} Ctor
 * @param {Record<string, unknown>} props
 */
function installAccessors(Ctor, props) {
  /** @type {{ propName: string, decl: any }[]} */
  const plan = [];
  for (const [propName, decl] of Object.entries(props)) {
    const d = normalizeDecl(decl);
    // `noAccessor` (Lit): the author's own accessor stays and calls
    // `requestUpdate()` itself. A wrapped author accessor owns its storage, so
    // the constructor neither lifts a pre-upgrade value into it nor applies a
    // `default` (its private fields may not exist yet); `_activate` lifts a
    // shadowing own value through the accessor on first connect.
    const builtIn = !d.noAccessor && authorAccessor(Ctor, propName) === null;
    plan.push({ propName, decl: d, builtIn });
    if (d.noAccessor) continue;
    const descriptor = Ctor.getPropertyDescriptor(propName, Symbol(propName), d);
    if (descriptor !== undefined) Object.defineProperty(Ctor.prototype, propName, descriptor);
  }
  _accessorPlans.set(Ctor, plan);
  return plan;
}


/**
 * The declarative CLOSED shadow root the parser attached to `el`, through
 * `ElementInternals.shadowRoot`, or null when there is none or internals are
 * unavailable. `attachInternals()` may be called once per element, so the
 * internals object is handed back to the component's own later call instead
 * of that call throwing. A component that already took its internals (in its
 * constructor, the form-associated pattern) makes this throw, and then the
 * caller falls back to attachShadow(), Lit's behaviour.
 * @param {HTMLElement} el
 * @returns {ShadowRoot | null}
 */
function declarativeClosedRoot(el) {
  if (typeof el.attachInternals !== 'function') return null;
  let internals;
  try {
    internals = el.attachInternals();
  } catch {
    return null;
  }
  Object.defineProperty(el, 'attachInternals', { value: () => internals, configurable: true, writable: true });
  return internals.shadowRoot ?? null;
}

class WebComponentBase extends Base {
  /** Whether to use shadow DOM. Default: false (light DOM). @type {boolean} */
  static shadow = false;

  /**
   * Lit's `shadowRootOptions`: the options `createRenderRoot()` passes to
   * `attachShadow()`, and the attributes the server writes on the Declarative
   * Shadow DOM template (`delegatesFocus`, `clonable`, `serializable`, and a
   * `closed` mode). Read only with `static shadow = true`.
   * @type {ShadowRootInit}
   */
  static shadowRootOptions = { mode: 'open' };

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
   * Properties with `state: true` (internal state) or `attribute: false` (a
   * property-only input) are excluded from `observedAttributes` and never
   * reflect.
   *
   * @type {Record<string, PropertyDeclaration>}
   */
  static properties = {};

  /**
   * Styles to adopt into the shadow root, Lit's `static styles`: a `css`
   * result, a `CSSStyleSheet`, or nested arrays of them. Shadow DOM only
   * (`static shadow = true`); a light-DOM component has no root to adopt
   * them into, so declaring them there is reported as an error.
   * @type {unknown}
   */
  static styles = null;

  /**
   * Lit's `elementStyles`: `static styles` flattened by `finalizeStyles()`,
   * the list `createRenderRoot()` adopts and the server inlines. Memoized per
   * class.
   * @type {(import('../css.js').CSSResult | CSSStyleSheet)[]}
   */
  static get elementStyles() {
    let list = ELEMENT_STYLES.get(this);
    if (list === undefined) {
      list = this.finalizeStyles(this.styles);
      ELEMENT_STYLES.set(this, list);
    }
    return list;
  }

  /**
   * Lit's `finalizeStyles(styles)`: flatten nested arrays and drop
   * duplicates, keeping each style's LAST position so a later override still
   * wins. Override it to post-process the list.
   * @param {unknown} styles
   * @returns {(import('../css.js').CSSResult | CSSStyleSheet)[]}
   */
  static finalizeStyles(styles) {
    return finalizeStyles(styles);
  }

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
   * The node `render()` commits into, Lit's `renderRoot`: the element itself
   * for a light-DOM component, its shadow root for `static shadow = true`.
   * Undefined until the element first connects, and always undefined at SSR,
   * which has no DOM. Query rendered children through it
   * (`this.renderRoot.querySelector('input')`) so the same line works in
   * either mode.
   * @type {HTMLElement | ShadowRoot | DocumentFragment | undefined}
   */
  get renderRoot() {
    return this._renderRoot;
  }

  set renderRoot(value) {
    this._renderRoot = value;
  }

  /**
   * True once the component has completed its first update, Lit's
   * `hasUpdated`. It is still false inside the first `willUpdate()` and
   * `render()`, and true from `firstUpdated()` on.
   * @type {boolean}
   */
  get hasUpdated() {
    return !!this.__firstRendered;
  }

  /**
   * True while an update is queued or running, Lit's `isUpdatePending`.
   * @type {boolean}
   */
  get isUpdatePending() {
    return this._scheduled || this._isUpdating;
  }

  /**
   * Returns the list of attribute names the browser should observe.
   * Properties with `state: true` or `attribute: false` are excluded: they
   * do not correspond to any HTML attribute.
   *
   * @returns {string[]}
   */
  static get observedAttributes() {
    this.finalize();
    // Derived from the same walk `resolveAttributeProperty` matches against, so
    // every observed name resolves and nothing else does. A camelCase prop with
    // no custom `attribute` is observed under Lit's lowercased name (what it
    // reflects to, and what the parser turns `quizId=` into) AND its kebab
    // name, kept as a read alias.
    return observedAttributeNames(this);
  }

  /**
   * Lit's `elementProperties`: every reactive property this class declares,
   * its own and its superclasses', as a Map of name to normalised
   * declaration. Built from the same merge the accessors and the attribute
   * readers use (`static properties`, the factory, `createProperty`).
   * @type {Map<string, PropertyDeclaration>}
   */
  static get elementProperties() {
    let map = ELEMENT_PROPERTIES.get(this);
    if (map === undefined) {
      map = new Map();
      for (const [name, decl] of Object.entries(declaredProperties(this))) map.set(name, normalizeDecl(decl));
      ELEMENT_PROPERTIES.set(this, map);
    }
    return map;
  }

  /**
   * Lit's `getPropertyOptions(name)`: the declaration for `name`, or the
   * default declaration (`{ type: String }`) when it is not declared.
   * @param {string} name
   * @returns {PropertyDeclaration}
   */
  static getPropertyOptions(name) {
    return this.elementProperties.get(name) ?? DEFAULT_DECLARATION;
  }

  /**
   * Lit's `createProperty(name, options)`: declare a reactive property from
   * code instead of `static properties`. It must run before the first
   * instance is constructed (accessors are installed then, once per class),
   * which is where Lit calls it from, so a later call throws.
   * @param {string} name
   * @param {PropertyDeclaration} [options]
   */
  static createProperty(name, options = {}) {
    if (_accessorPlans.has(this)) {
      throw new Error(
        `[webjs] ${this.name || 'A component'}.createProperty('${name}') ran after an instance of the class was constructed. ` +
          `Declare the property in \`static properties\` (or the WebComponent({ ... }) factory), or call createProperty ` +
          `at class definition time, before any element is created.`,
      );
    }
    addCreatedProperty(this, name, options);
    ELEMENT_PROPERTIES.delete(this);
  }

  /**
   * Lit's `getPropertyDescriptor(name, key, options)`: the accessor pair
   * installed on the prototype for one reactive property. Override it to wrap
   * the default (call `super.getPropertyDescriptor(...)` and delegate to its
   * `get` / `set`); return `undefined` to install no accessor.
   *
   * When the class defines its own `get` / `set` for a declared property, the
   * default wraps it, as Lit's does: reads go to the author's getter, and a
   * write calls the author's setter and then `requestUpdate(name, oldValue,
   * options)`. Otherwise the value is stored per instance. Either way
   * `requestUpdate` runs `hasChanged`, records the change, reflects, and
   * schedules the update.
   * @param {string} name
   * @param {symbol} _key
   * @param {PropertyDeclaration} options
   * @returns {PropertyDescriptor | undefined}
   */
  static getPropertyDescriptor(name, _key, options) {
    const author = authorAccessor(this, name);
    /** @type {PropertyDescriptor} */
    let descriptor;
    if (author) {
      const { get, set } = author;
      descriptor = {
        configurable: true,
        enumerable: true,
        get() { return get?.call(this); },
        set(value) {
          const oldValue = get?.call(this);
          set?.call(this, value);
          this.requestUpdate(name, oldValue, options);
        },
      };
    } else {
      descriptor = {
        configurable: true,
        enumerable: true,
        get() { return this.__propValues[name]; },
        set(value) {
          const oldValue = this.__propValues[name];
          this.__propValues[name] = value;
          // requestUpdate runs hasChanged, records the (name, oldValue) entry,
          // reflects, AND schedules a render. During the update phase the
          // scheduler short-circuits and the entry folds into the current
          // cycle's changedProperties.
          this.requestUpdate(name, oldValue, options);
        },
      };
    }
    GENERATED_SETTERS.set(/** @type {Function} */ (descriptor.set), author);
    return descriptor;
  }

  /**
   * Lit's `finalize()`: prepare the class's metadata once. Idempotent and
   * called for you (from `observedAttributes` and `register()`), so calling it
   * yourself is never required.
   */
  static finalize() {
    if (FINALIZED.has(this)) return;
    FINALIZED.add(this);
    const parent = Object.getPrototypeOf(this);
    if (parent && typeof parent.finalize === 'function') parent.finalize();
    void this.elementProperties;
    void this.elementStyles;
  }

  /**
   * Lit's `addInitializer(initializer)`: run `initializer(instance)` in the
   * constructor of every instance of this class and its subclasses. A
   * subclass inherits its parent's initializers; one added to a subclass does
   * not reach the parent.
   * @param {(element: any) => void} initializer
   */
  static addInitializer(initializer) {
    if (!Object.hasOwn(this, '_initializers')) {
      const inherited = /** @type {any} */ (Object.getPrototypeOf(this))._initializers;
      this._initializers = inherited ? [...inherited] : [];
    }
    this._initializers.push(initializer);
  }

  constructor() {
    super();
    /**
     * The node `render()` commits into: the element itself for light DOM, its
     * shadow root for shadow DOM. Undefined until the element connects (and at
     * SSR, where nothing is connected), as in Lit.
     * @type {HTMLElement | ShadowRoot | DocumentFragment | undefined}
     */
    this._renderRoot = undefined;
    this._scheduled = false;
    this._connected = false;

    /**
     * Set of attached reactive controllers, created by the first
     * `addController` (#1646: most instances never attach one, and the SSR
     * walk constructs an instance per rendered element).
     * @type {Set<ReactiveController> | null}
     */
    this.__controllers = null;

    /**
     * Whether the component has completed its first render.
     * Used to gate the one-time `firstUpdated()` call.
     * @type {boolean}
     */
    this.__firstRendered = false;

    /**
     * Map of changed properties accumulated since the last render. Keys are
     * property names; values are the previous value before the change. Passed
     * to `shouldUpdate`, `willUpdate`,
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
    this._updatePromise = RESOLVED_TRUE;

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

    // Install the reactive property accessors. Props come from Lit's
    // `static properties` and from the `WebComponent({ ... })` factory alike,
    // merged down the class chain by `declaredProperties`.
    this._initializeProperties();

    // Lit's `addInitializer` callbacks, after the properties exist.
    const initializers = /** @type {any} */ (this.constructor)._initializers;
    if (initializers) for (const init of initializers) init(this);
  }

  /**
   * Give the instance its reactive-property backing store and make sure the
   * class's getter/setter pairs (which run `hasChanged`, schedule updates and
   * optionally reflect to the HTML attribute) are installed on its PROTOTYPE,
   * once per class. Per instance this only lifts a value written before the
   * element upgraded and applies the declared `default`s.
   *
   * Called once from the constructor. The backing store is a plain object
   * (`this.__propValues`), so the accessors never collide with it.
   * @private
   */
  _initializeProperties() {
    const Ctor = /** @type {any} */ (this.constructor);
    const props = declaredProperties(Ctor);

    /** @type {Record<string, unknown>} */
    this.__propValues = {};

    // The accessors live on the PROTOTYPE, installed once per class (#1646).
    // They used to be defined on every instance, two closures and a
    // defineProperty per declared property, which was the largest single
    // cost of constructing a component on the SSR path (one instance per
    // rendered element) and a measurable one on upgrade in the browser.
    let plan = _accessorPlans.get(Ctor);
    if (plan === undefined) plan = installAccessors(Ctor, props);

    for (let i = 0; i < plan.length; i++) {
      const { propName, decl: d, builtIn } = plan[i];
      if (!builtIn) continue;
      // Capture any value set before the accessor could apply (an own data
      // property written on the element before it upgraded). It shadows the
      // prototype accessor, so it is lifted into the backing store.
      let initial;
      if (Object.hasOwn(this, propName)) {
        initial = /** @type {any} */ (this)[propName];
        delete (/** @type {any} */ (this))[propName];
      }
      if (initial !== undefined) {
        this.__propValues[propName] = initial;
      } else if (d.default !== undefined) {
        // Declarative `default` option (lit-parity). A function default is
        // CALLED per instance, so an object / array default is a fresh value
        // per element. Written straight to the backing store; an applied
        // attribute (attributeChangedCallback runs later) overrides it.
        this.__propValues[propName] =
          typeof d.default === 'function' ? d.default() : d.default;
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
    // A property with no attribute (`state: true` / `attribute: false`) has
    // nothing to reflect to.
    // The attribute name comes from the one rule the readers use, so a prop
    // reflects to exactly the name it observes.
    const attrName = attributeNameFor(propName, decl);
    if (attrName === undefined) return;
    // Guard against re-entrant loops: attributeChangedCallback fires when
    // we call setAttribute, which would call the setter again.
    if (this.__reflectingAttribute) return;
    this.__reflectingAttribute = true;
    try {
      if (decl.converter && decl.converter.toAttribute) {
        const serialized = decl.converter.toAttribute(value, decl.type);
        if (serialized == null) this.removeAttribute(attrName);
        else this.setAttribute(attrName, serialized);
      } else if (typeof value === 'function') {
        // #1169: the value IS a function, and no branch below has a
        // meaningful serialization for one. `String(fn)` is the function's
        // SOURCE, so a reflected `'use server'` action would ship its whole
        // body, closure secrets included, to every visitor, and
        // `JSON.stringify(fn)` is `undefined`, which `setAttribute` writes as
        // the literal string "undefined". Treat it like `null` and remove the
        // attribute, matching what the `.prop=${fn}` SSR binding already does
        // for an unserializable value.
        //
        // Placed AFTER the converter branch on purpose: a custom
        // `toAttribute` is author-controlled, so its author has taken
        // responsibility for serializing whatever they are handed.
        this.removeAttribute(attrName);
        warnFunctionReflection(this, propName, attrName);
      } else if (decl.type === Boolean) {
        if (value) this.setAttribute(attrName, '');
        else this.removeAttribute(attrName);
      } else if (value == null) {
        this.removeAttribute(attrName);
      } else if (decl.type === Object || decl.type === Array) {
        // One rule about an unserializable reflected value, in two halves.
        //
        // A JSON-typed prop CARRYING a function is safe and stays whole:
        // `JSON.stringify` drops a function to `null` in an array and omits
        // the key in an object, so `[1, 2, fn]` serializes to `[1,2,null]`
        // with no source and no data loss. Refusing here would discard the
        // `1` and the `2` on a path that never leaked.
        //
        // A value `JSON.stringify` cannot serialize AT ALL is the other half
        // (#1253): a cycle, a `BigInt`, or an author `toJSON()` that throws.
        // The throw used to escape reflection entirely, so a property
        // assignment threw from the setter, a client upgrade threw out of
        // `connectedCallback` before the first render, and an SSR render was
        // swallowed by per-component isolation, which surfaces an error box in
        // dev and emits the component EMPTY at a 200 in PRODUCTION, where the
        // cause is only in the server log. There is no string to put in the
        // attribute, so the
        // attribute goes, exactly as it does for a function. The `catch` IS
        // the detection: `JSON.stringify` already walks the value, so its own
        // failure covers all three causes, where a cycle-only pre-walk would
        // miss the other two and pay a full traversal per reflection.
        let serialized;
        let serializable = true;
        try {
          serialized = JSON.stringify(value);
        } catch (e) {
          serializable = false;
          this.removeAttribute(attrName);
          warnUnserializableReflection(this, propName, attrName, e && e.message);
        }
        // Outside the `try` on purpose, so a genuine `setAttribute` failure
        // (an invalid attribute name) still surfaces instead of being folded
        // into the unserializable path.
        if (serializable) this.setAttribute(attrName, serialized);
      } else if (carriesFunction(value)) {
        // The string fall-through is the one place a CARRIED function still
        // leaks. `String([fn])` is `Array.prototype.join`, which runs
        // `String()` on every element, so `[serverAction]` writes the same
        // source `serverAction` does. Hence the recursive predicate the
        // form-action guard already uses, rather than a bare `typeof`, but
        // scoped to this branch rather than applied above, where JSON
        // handles the same shape losslessly.
        this.removeAttribute(attrName);
        warnFunctionReflection(this, propName, attrName);
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
    // A value written on the element before its class was defined is an own
    // data property, and it hides any accessor of the same name for good.
    // `_initializeProperties` lifts the declared properties in the
    // constructor; an accessor the subclass defines itself (a getter/setter
    // over a private signal, the shape internal state another element assigns
    // takes) gets the same lift here, on the first connect, since its private
    // field does not exist yet while the base constructor runs.
    if (!this.__accessorsLifted) {
      this.__accessorsLifted = true;
      liftShadowedAccessors(this);
    }
    // Reflect declared reflect:true properties from their current value now
    // that the element is connected. Constructor / willUpdate defaults were
    // set while disconnected (the setter skips reflection then), so this is
    // what makes a freshly-created client element carry the same reflected
    // attributes the SSR walker emitted. Same-value reflects are no-ops, so a
    // hydrated element (whose attribute already arrived from SSR) is unchanged.
    this._reflectDeclaredAttributes();
    const Ctor = /** @type any */ (this.constructor);
    // Mark LIGHT-DOM component hosts so the framework default host rule
    // (`@layer webjs-host { :where([data-wj-host]) { display: block } }`)
    // applies. SSR already stamps this on server-rendered light hosts
    // (idempotent here); this also covers a client-only light component (never
    // SSR'd) so it does not collapse. Shadow hosts are NOT marked: a document
    // rule would override the shadow author's own `:host { display: … }`, so
    // shadow components control their host display via `:host` in `static styles`.
    if (Ctor.shadow !== true && !this.hasAttribute('data-wj-host')) {
      this.setAttribute('data-wj-host', '');
    }
    // Lit's `createRenderRoot()`, called once per element. The server renders
    // from `static shadow` alone (it has no DOM to call this against), so a
    // root that contradicts it would hydrate against markup of the other kind:
    // refuse that loudly instead.
    if (this._renderRoot === undefined) {
      const root = this.createRenderRoot();
      const isShadowRoot = typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot;
      if (isShadowRoot !== (Ctor.shadow === true)) {
        const name = tagOf(Ctor) || this.tagName?.toLowerCase();
        throw new Error(
          isShadowRoot
            ? `[webjs] <${name}> createRenderRoot() returned a shadow root, but the class does not declare \`static shadow = true\`. ` +
              `WebJs renders on the server from \`static shadow\`, so add \`static shadow = true\` (with \`static shadowRootOptions\` for the ` +
              `attachShadow options) and drop the override, or call \`super.createRenderRoot()\` from it.`
            : `[webjs] <${name}> declares \`static shadow = true\`, but createRenderRoot() returned something other than a shadow root. ` +
              `Return \`super.createRenderRoot()\` from the override, or remove \`static shadow = true\` to render into light DOM.`,
        );
      }
      this._renderRoot = root;
    }
    if (Ctor.shadow !== true && this._renderRoot === this) {
      // Light DOM: static styles is not supported (no shadow root for
      // adoptedStyleSheets), so they would silently never apply. Say so,
      // loudly, once per class.
      if (Ctor.styles && !WARNED_LIGHT_STYLES.has(Ctor)) {
        WARNED_LIGHT_STYLES.add(Ctor);
        console.error(lightDomStylesMessage(tagOf(Ctor) || this.tagName?.toLowerCase()));
      }
      // Light-DOM slot capture: ONCE per host lifetime (#1015). Three
      // sub-paths, all of which resolve to "the record is populated
      // exactly once and never re-captured":
      //
      // a. Reconnection. The record already exists from a prior mount.
      //    The host still carries the rendered template DOM (plus
      //    placed slot children) from before the disconnect. Skip
      //    capture (would wrongly hoover up rendered nodes) and skip
      //    SSR adoption. clientRender will see the existing INSTANCE
      //    and updateInstance instead of recreating; the DOM stays.
      //
      // b. SSR hydration (first mount, <!--webjs-hydrate--> marker
      //    present). Children are already inside their
      //    <slot data-webjs-light data-projection="actual"> elements
      //    (the SSR walk placed them). Adopt those assignments BEFORE
      //    _performRender so we retain references to the SSR'd nodes;
      //    the renderer's createInstance().replaceChildren() will
      //    detach them, but the slot-apply step re-attaches the same
      //    Node refs into the freshly-cloned slot. DOM identity
      //    preserved through the hydration round-trip.
      //
      // c. First mount, no SSR. Partition authored children into the
      //    record before _performRender wipes the host.
      //
      // After capture, installSlotInterception + installSlotSensors below make
      // native DOM writes on a mounted host live (appendChild, slot= flips,
      // innerHTML, HTMLSlotElement.assign), so light-DOM slots match shadow DOM
      // through the standard API.
      if (this.render === WebComponentBase.prototype.render) {
        // A render-less component (no `render()` override). Lit's default
        // `render()` returns `noChange`, so its children are never touched:
        // there is no template to project them into, so they are neither
        // captured nor intercepted, and the commit leaves them in place.
        this.removeAttribute('data-wj-serialized');
      } else if (hasSlotState(this)) {
        // (a) Reconnection. Record already populated. Sweep any direct child
        //     added by a raw bypass write while the host was disconnected (no
        //     sensor was live to catch it), then re-arm the sensors below.
        reconnectSweep(this);
      } else if (
        this.__isHydrating() ||
        this.hasAttribute('data-wj-serialized') ||
        hasFrameworkRenderedSubtree(this)
      ) {
        // (b) Framework-rendered markup, from any of three signals: boot-time
        //     SSR hydration (the webjs-hydrate marker), the router's
        //     data-wj-serialized stamp (applySwap marks every host in a parsed
        //     doc, covering a snapshot restore whose serialized shape has no
        //     projected slot to detect), or the structural detector (own
        //     data-webjs-light[data-projection] slots, attributes only the
        //     renderer / SSR stamps). Adopt-not-capture: capturing restored
        //     post-hydration HTML would hoover the rendered tree into the
        //     record and duplicate content on the next render (the #1006
        //     shape, on the restore path).
        this.removeAttribute('data-wj-serialized');
        ensureSlotState(this);
        adoptSSRAssignments(this);
      } else {
        // (c) First mount with author-written children. Capture them.
        captureAuthoredChildren(this);
      }
      // Install native-write interception AFTER capture (capture uses the
      // host's still-native methods), then arm the sensors. Together they make
      // appendChild / insertBefore / removeChild / innerHTML / slot= flips on a
      // mounted light host drive the slot record, restoring full shadow-DOM
      // parity through the standard DOM API. Interception installs once;
      // sensors are armed on every connect and torn down on disconnect.
      if (hasSlotState(this)) {
        installSlotInterception(this);
        installSlotSensors(this);
      }
    }

    // Notify all controllers that the host is connected.
    for (const c of this.__controllers || NO_CONTROLLERS) {
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
    // Lit's `enableUpdating(requestedUpdate)` hook: called once the element is
    // ready to update, before the first update is queued.
    this.enableUpdating(true);
    if (this._scheduled) return;
    this._scheduled = true;
    // The renderer's slot parts place the record content as part of the
    // commit; native DOM writes on the host (appendChild, slot= flips,
    // innerHTML) drive the record live through the interception + sensors
    // installed on connect. There is no WebJs-specific slot API.
    queueMicrotask(() => this._runScheduledUpdate('initial render'));
  }

  /**
   * The microtask both scheduling sites queue: hand the update to
   * `scheduleUpdate()` (Lit's override point for WHEN an update runs) and
   * surface a throw, or the rejection of an async override, as a console
   * error instead of bricking the element. `_performRender` already resets
   * `_isUpdating` and settles `updateComplete` in its own `finally` blocks.
   * @param {string} phase
   * @private
   */
  _runScheduledUpdate(phase) {
    try {
      const r = this.scheduleUpdate();
      if (r && typeof (/** @type {any} */ (r).then) === 'function') {
        /** @type {Promise<unknown>} */ (r).then(undefined, (err) => {
          console.error(`[webjs] lifecycle hook threw during ${phase}:`, err);
        });
      }
    } catch (err) {
      console.error(`[webjs] lifecycle hook threw during ${phase}:`, err);
    }
  }

  /**
   * Lit's `scheduleUpdate()`: called from the update microtask to run the
   * pending update. Override it to change WHEN an update runs, for example to
   * wait for a frame, and call `super.scheduleUpdate()` (or
   * `this.performUpdate()`) when it should run. `updateComplete` waits for it.
   *
   * ```js
   * async scheduleUpdate() {
   *   await new Promise((r) => requestAnimationFrame(r));
   *   super.scheduleUpdate();
   * }
   * ```
   *
   * @returns {void | Promise<unknown>}
   */
  scheduleUpdate() {
    return this.performUpdate();
  }

  /**
   * Lit's `performUpdate()`: run the pending update now, synchronously. Does
   * nothing when no update is pending, so calling it to flush a queued update
   * early is safe.
   * @returns {void}
   */
  performUpdate() {
    if (!this._scheduled) return;
    this._scheduled = false;
    this._performRender();
  }

  /**
   * Lit's `enableUpdating(requestedUpdate)` hook, called when the element
   * connects, right before its first update is queued. The default does
   * nothing.
   * @param {boolean} _requestedUpdate
   */
  enableUpdating(_requestedUpdate) {}

  /**
   * Lit's `createRenderRoot()`: create the node `render()` commits into. The
   * default returns the element itself for a light-DOM component, and for
   * `static shadow = true` the shadow root, attached with
   * `static shadowRootOptions` (default `{ mode: 'open' }`) unless the server
   * already rendered one as Declarative Shadow DOM, with `static styles`
   * adopted into it. Override it for Lit's `createRenderRoot() { return this; }`
   * (already the default) or to post-process the root; a shadow root is
   * accepted only with `static shadow = true`, because the server renders
   * from that flag.
   * @returns {HTMLElement | ShadowRoot | DocumentFragment}
   */
  createRenderRoot() {
    const Ctor = /** @type any */ (this.constructor);
    if (Ctor.shadow !== true) return this;
    const options = Ctor.shadowRootOptions ?? { mode: 'open' };
    // A CLOSED declarative root is invisible to `this.shadowRoot`, and
    // attachShadow() on an element that has one empties it (the spec reuses
    // the root but removes its children), so the server-rendered markup would
    // vanish and the first render would build from nothing. Lit has the same
    // gap; ElementInternals reaches the declarative root, so use it.
    const existing = this.shadowRoot ?? (options.mode === 'closed' ? declarativeClosedRoot(this) : null);
    const root = existing ?? /** @type any */ (this).attachShadow(options);
    const list = Ctor.elementStyles;
    if (list.length) {
      // A shadow root that came from Declarative Shadow DOM (SSR) carries the
      // inline <style> the server emitted. Remove it before switching to
      // adoptedStyleSheets so the rules are not applied twice.
      if (existing) {
        const ssrStyle = existing.querySelector('style');
        if (ssrStyle) ssrStyle.remove();
      }
      adoptStyles(root, list);
    }
    return root;
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
    // Tear down the slot sensors, processing any queued records first (a bare
    // disconnect() drops them). The per-host slot record + interception are
    // preserved so a reconnection picks up where it left off (sensors re-arm in
    // connectedCallback).
    teardownSlotSensors(this);
    // Dispose the signal watcher so dependency edges drop. Without
    // this the element holds references to module-scope signals
    // (and vice versa) forever.
    for (const slot of ['__signalWatcher', '__postWatcher']) {
      const self = /** @type {any} */ (this);
      if (self[slot]) {
        self[slot].dispose();
        self[slot] = undefined;
      }
    }
    for (const c of this.__controllers || NO_CONTROLLERS) {
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

    // One name resolver for both sides (#1341). The browser only calls this for
    // a name in `observedAttributes`, and it has already lowercased that name
    // while parsing, so it passes straight through; the SSR caller lowercases
    // its source name first. `resolveAttributeProperty` also normalises the
    // declaration, so a bare-constructor shorthand (`count: Number`) and the
    // long form (`{ type: Number, … }`) both arrive here as `{ type, … }`.
    const resolved = resolveAttributeProperty(this.constructor, name);
    if (resolved === undefined) return;
    const { propName, def } = resolved;

    // One reader for both sides, in `attribute-reader.js`: this and
    // `applyAttrsToInstance` in `render-server.js` call the same function, so
    // precedence and every fallback are shared rather than mirrored (#1340).
    // It takes an already-decoded value, which the DOM has done here and
    // `decodeAttrEntities` does at the SSR call site (#1341).
    const v = readAttributeValue(def, value, propName);

    if (this[propName] !== v) {
      this[propName] = v;
      if (this._connected) this.requestUpdate();
    }
  }

  /**
   * Schedule a re-render, Lit's `requestUpdate(name, oldValue, options)`.
   * With a name, the property's `hasChanged` (from `options`, else its
   * declaration) compares its current value with `oldValue`: an unchanged
   * value schedules nothing. A change is recorded in `changedProperties`
   * and reflected when the property declares `reflect: true`. With no
   * arguments it always schedules an update.
   *
   * @param {string} [name]      Property name that changed
   * @param {unknown} [oldValue] Previous value of the property
   * @param {PropertyDeclaration} [options] The property's declaration
   */
  requestUpdate(name, oldValue, options) {
    if (name !== undefined) {
      const decl = options ?? /** @type {any} */ (this.constructor).getPropertyOptions(name);
      const hasChanged = decl.hasChanged || defaultHasChanged;
      const value = /** @type {any} */ (this)[name];
      if (!hasChanged(value, oldValue)) return;
      if (!this._changedProperties.has(name)) this._changedProperties.set(name, oldValue);
      // Reflect to the attribute if requested (_reflectAttribute skips a prop
      // with no attribute: `state: true` or `attribute: false`). Disconnected,
      // it waits for the next update.
      if (decl.reflect) {
        if (this._connected) this._reflectAttribute(name, value, decl);
        else (this.__reflectPending ??= new Set()).add(name);
      }
    }
    this._scheduleUpdate();
  }

  /**
   * Internal scheduler driven by reactive-property setters, the signal
   * watcher, and explicit `requestUpdate()` calls. Coalesces multiple
   * changes in the same tick into a single microtask render.
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
    // _performRender wraps the update phase in try/finally, so a throw from
    // shouldUpdate / willUpdate / hostUpdate / hostUpdated / firstUpdated /
    // updated leaves the component in a good state; the wrapper only
    // surfaces it.
    queueMicrotask(() => this._runScheduledUpdate('update cycle'));
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
   *
   * Every signal the SYNCHRONOUS part of that cycle reads is tracked, not
   * only the ones `render()` reads, which is the span lit-labs/signals tracks
   * by running `performUpdate` inside a computed. So a signal read only in
   * `willUpdate()` or `updated()` (a host attribute derived from internal
   * state) re-renders the component when it changes. Two watchers split it
   * (see {@link _tracked}): one over steps 2-6 (`render()` included), one
   * over the post-commit hooks, so a write `updated()` makes to something
   * `render()` read still schedules the next update. The DOM commits are
   * the parts left untracked (see `update()`).
   * @private
   */
  _performRender() {
    if (!this._renderRoot) return;
    this.__cycleRendered = false;
    const postCommit = this._tracked('__signalWatcher', () => this._runUpdateCycle());
    // A sync commit runs its post-commit hooks OUTSIDE the first watcher's
    // phase, under their own watcher.
    if (postCommit) postCommit();
  }

  /**
   * Run one phase of the update cycle with the signals it reads recorded on
   * the watcher in `slot`, creating the watcher on first use. A watcher
   * re-records its read set on every phase it observes, and a later change
   * to any of those signals schedules an update.
   *
   * Three rules keep that safe:
   *  - A phase ignores notifications from its OWN writes. A write to a signal
   *    the phase read earlier is the phase's business, not a reason to run it
   *    again: before a commit it is already folded into this pass, and after
   *    one it is often not the component's code at all (an event `updated()`
   *    dispatches, whose listener does a read-modify-write on a store), which
   *    would otherwise loop.
   *  - A pre-commit phase that never reached `render()` (`shouldUpdate()`
   *    returned false, or a hook threw) keeps the signals the last render
   *    read on top of the ones it read itself, or a skipped cycle would
   *    silently unsubscribe the component.
   *  - A watcher disposed during its own phase (a hook that detached the
   *    host) is disposed again afterwards, since the phase kept recording.
   *
   * @template T
   * @param {'__signalWatcher' | '__postWatcher'} slot
   * @param {() => T} fn
   * @returns {T}
   * @private
   */
  _tracked(slot, fn) {
    const self = /** @type {any} */ (this);
    /** @type {any} */
    let watcher = self[slot];
    if (!watcher) {
      watcher = self[slot] = new Signal.subtle.Watcher(() => {
        if (!watcher.__inPhase && this._connected) this.requestUpdate();
      });
    }
    const before = slot === '__signalWatcher' ? Signal.subtle.introspectSources(watcher) : null;
    watcher.__inPhase = true;
    try {
      return watcher.observe(fn);
    } finally {
      watcher.__inPhase = false;
      if (before && !this.__cycleRendered) {
        watcher.watch(...new Set([...before, ...Signal.subtle.introspectSources(watcher)]));
      }
      if (!this._connected) {
        watcher.dispose();
        if (self[slot] === watcher) self[slot] = undefined;
      }
    }
  }

  /**
   * Steps 1-6 of the update cycle, the phase {@link _performRender} tracks
   * with the first watcher. Returns the post-commit half to run for a sync
   * commit, or nothing (an async commit runs it when it lands).
   * @returns {(() => void) | undefined}
   * @private
   */
  _runUpdateCycle() {

    // Hold a stable reference to the current Map so all hooks see the same
    // snapshot. During the update phase (steps 3-6) the Map is mutated in
    // place when property setters fire, folding those changes into THIS
    // cycle. The Map is replaced when this phase finishes, including skipped
    // updates and hook errors, so post-commit writes belong to the NEXT cycle.
    const changedProperties = this._changedProperties;

    // --- 1. Mark we're inside an update cycle ---
    this._isUpdating = true;
    let didCommit = false;
    // Set when render() was async: the DOM commit lands when this settles,
    // so the post-commit half of the cycle defers until then (#469).
    let pendingCommit = null;

    // --- 2-6. Update phase. Lifecycle-hook throws are logged and
    // swallowed so the component is not left in a deadlocked state
    // (`_isUpdating` stuck true, `updateComplete` never resolves).
    try {
      if (this.shouldUpdate(changedProperties)) {
        // --- 3. willUpdate (may mutate properties; folds into this cycle) ---
        this.willUpdate(changedProperties);

        // --- 4. controllers' hostUpdate ---
        for (const c of this.__controllers || NO_CONTROLLERS) {
          if (c.hostUpdate) c.hostUpdate();
        }

        // --- 5. update + DOM commit (with render-error boundary) ---
        // Stamp a fresh render token for THIS commit, sync or async. A later
        // cycle that reaches here bumps it, so an in-flight async render whose
        // token no longer matches drops its now-stale resolution. Stamping
        // here (not inside _commitAsync) is what guards the async-superseded-
        // by-sync case (#469); a shouldUpdate=false cycle never reaches here,
        // so it does not invalidate an in-flight async render.
        this.__renderToken = (this.__renderToken || 0) + 1;
        // Abort the superseded render's in-flight action fetches (#492) and
        // start a fresh controller for this render. update() binds its signal
        // around render() alone (see there), never the DOM commit. A
        // superseded fetch's AbortError is dropped by the render-token guard
        // in _commitAsync.
        if (this.__renderAbort) this.__renderAbort.abort();
        this.__renderAbort = typeof AbortController !== 'undefined' ? new AbortController() : null;
        this.__cycleRendered = true;
        try {
          const r = this.update(changedProperties);
          if (r && typeof r.then === 'function') pendingCommit = r;
        } catch (error) {
          this._handleRenderError(/** @type {Error} */ (error));
        }

        if (!pendingCommit) {
          didCommit = true;
        }
      }
    } catch (preCommitError) {
      console.error(`[webjs] lifecycle hook threw during update phase:`, preCommitError);
    } finally {
      this._isUpdating = false;
      // Consume this phase's snapshot even when shouldUpdate skips it. For an
      // async render, changes during the fetch start a new cycle whose token
      // supersedes the in-flight commit.
      this._changedProperties = new Map();
    }

    // --- Async render: finish the cycle when the pending commit settles. ---
    if (pendingCommit) {
      const token = this.__renderToken;
      // Count this in-flight async commit so a non-committing cycle
      // (shouldUpdate=false) running during the fetch does NOT resolve
      // updateComplete early: the pending commit owns the resolution.
      this.__pendingAsyncCommits = (this.__pendingAsyncCommits || 0) + 1;
      const settle = () => {
        // Always decrement first, even when superseded, so the in-flight
        // count never leaks (a superseded cycle returns below without
        // committing, but it is no longer pending).
        this.__pendingAsyncCommits--;
        // A newer render superseded this one; let the newer cycle finish.
        if (token !== this.__renderToken) return;
        // --- 7-8 + updateComplete ---
        this._postCommit(changedProperties);
      };
      // A rejection has to settle the cycle too, or the counter stays >= 1
      // forever: that both wedges `updateComplete` for this instance and
      // disables the `!this.__pendingAsyncCommits` escape below for every
      // later non-committing cycle. `_commitAsync` is written not to reject,
      // but it is not the only thenable that reaches here: `update()` is a
      // documented override point and may return one, so the handler belongs
      // at this site rather than only at the one implementation of it.
      pendingCommit.then(settle, (error) => {
        // The token check gates the DOM write, NOT the release. A superseded
        // cycle rejecting late (a discarded fetch, or the #492 abort of its own
        // in-flight action surfacing as an AbortError) must not commit its
        // error state over the newer render that already replaced it, which is
        // the same rule both handlers inside _commitAsync follow. `settle()`
        // still runs either way: it does its own token check before touching
        // anything, and the decrement it owns has to happen regardless or the
        // counter wedges exactly as it did before this handler existed.
        // `finally`, not a trailing statement: the release must survive
        // anything the reporting path throws. `String(error)` is evaluated in
        // the argument expression, OUTSIDE _handleRenderError's own try/catch,
        // so a rejection reason that cannot be coerced (a null-prototype
        // object, a revoked Proxy) threw a TypeError straight out of this
        // handler and skipped the decrement, wedging the counter in exactly
        // the way this handler exists to prevent.
        try {
          if (token === this.__renderToken) {
            this._handleRenderError(error instanceof Error ? error : new Error(safeString(error)));
          }
        } finally {
          settle();
        }
      });
      return;
    }

    // --- 7-8. Post-commit hooks (sync path), returned so they run outside
    // this phase. Errors are caught so the updateComplete promise always
    // resolves.
    if (didCommit) {
      return () => this._postCommit(changedProperties);
    } else if (!this.__pendingAsyncCommits) {
      // A non-committing cycle resolves updateComplete only when no async
      // commit is in flight; otherwise the pending commit resolves it once it
      // lands, so `await el.updateComplete` never returns before that DOM.
      this._resolveUpdate();
    }
    // No post-commit phase this cycle: re-arm its watcher, so a change it
    // was notified of meanwhile does not leave it deaf to the next one.
    if (!didCommit && /** @type {any} */ (this).__postWatcher) /** @type {any} */ (this).__postWatcher.watch();
    return undefined;
  }

  /**
   * Resolve the pending updateComplete promise. Value reflects whether any
   * further updates were queued during the current cycle: `true` means the
   * component has settled, `false` means another render will run.
   * @private
   */
  _resolveUpdate() {
    if (this._updateResolve) {
      const settled = !this._scheduled;
      this._updateResolve(settled);
      this._updateResolve = null;
    }
  }

  /**
   * Run the pre-render half of the update cycle synchronously for SSR.
   *
   * The SSR walker constructs the instance, applies attributes/props, then
   * calls this BEFORE `render()`. It mirrors how lit drives the update
   * lifecycle server-side: `willUpdate` runs so derived state computed there
   * is correct in the SSR'd HTML, then reactive controllers' `hostUpdate`
   * runs, then reflect:true properties are written to attributes so they
   * appear in the serialized output. It deliberately does NOT run
   * `shouldUpdate` (SSR always produces the first paint, there is no prior
   * render to skip), `update` (the walker commits by calling `render`
   * itself), or the post-commit hooks `firstUpdated` / `updated` (browser-only
   * DOM work).
   *
   * `_isUpdating` is set so a property assignment inside `willUpdate` folds
   * into the current `changedProperties` snapshot instead of scheduling a
   * fresh cycle (the SSR scheduler short-circuits anyway, since the element
   * is not connected). Hook throws propagate to the walker's per-component
   * try/catch, which logs an actionable hint and skips DSD for that element,
   * the same as a throwing `render()`.
   */
  performServerUpdate() {
    const changedProperties = this._changedProperties;
    this._isUpdating = true;
    try {
      this.willUpdate(changedProperties);
      // Each controller is isolated: a `hostUpdate()` that reaches for the
      // browser (a third-party Lit controller written for the client) is
      // reported once per controller class and skipped, so the component
      // still renders its first paint instead of an error state.
      for (const c of this.__controllers || NO_CONTROLLERS) {
        if (!c.hostUpdate) continue;
        try {
          c.hostUpdate();
        } catch (err) {
          reportSsrControllerError(this, c, err);
        }
      }
      this._reflectDeclaredAttributes();
    } finally {
      this._isUpdating = false;
    }
  }

  /**
   * Reflect every reflect:true (non-state) property to its attribute from its
   * CURRENT value, regardless of whether the value arrived via the setter.
   *
   * The property setter only reflects on a connected change, so a value set
   * in the constructor (a default) or in `willUpdate` is not reflected by the
   * setter alone. This syncs those: the SSR walker calls it in
   * `performServerUpdate` (writing into the server attribute shim, which the
   * walker reads back into the rendered HTML), and `_activate` calls it on
   * the client's first connected render. Running it on both sides is what
   * keeps a server-rendered element and a freshly-created client element
   * agree on their reflected attributes (matching lit, which reflects during
   * the first update). `_reflectAttribute`'s re-entrancy guard makes a
   * same-value reflect a no-op, so re-reflecting an attribute that already
   * arrived from SSR does not churn.
   * @private
   */
  _reflectDeclaredAttributes() {
    const props = declaredProperties(this.constructor);
    for (const name of Object.keys(props)) {
      const decl = props[name];
      if (!decl || !decl.reflect) continue;
      this._reflectAttribute(name, this[name], decl);
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
    const pendingReflection = this.__reflectPending;
    this.__reflectPending = undefined;
    for (const name of pendingReflection || []) {
      const def = declaredProperties(this.constructor)[name];
      this._reflectAttribute(name, this[name], def);
    }
    // The signal reads render() makes are tracked by the watcher
    // _performRender runs the whole cycle under.
    let tpl;
    // Bind this render's abort signal (#492) around the synchronous part of
    // render() ONLY, so the RPC stub ties an action called there to this
    // render and the next render cancels it. The commit below runs unbound:
    // it connects the child elements this template creates, and an action a
    // child starts in its connectedCallback belongs to the child, not to this
    // render, so the parent's next render must not cancel it (#1514). The
    // previous binding is restored rather than cleared, so a render nested
    // inside another's synchronous work leaves the outer one intact.
    const outer = activeActionSignal();
    setActiveActionSignal(this.__renderAbort ? this.__renderAbort.signal : null);
    try {
      tpl = this.render();
    } finally {
      setActiveActionSignal(outer || null);
    }
    // Bare-await async render (#469): render() returned a promise. Use
    // stale-while-revalidate: keep the current DOM (the SSR first paint on
    // hydration, or the prior content on a re-fetch) visible until the new
    // template resolves, then commit it. Returns the pending promise so
    // _performRender defers the post-commit half of the cycle (hostUpdated,
    // firstUpdated/updated, updateComplete) until the real commit lands.
    // (Note: only signal reads BEFORE the first `await` are tracked; reads
    // after a suspension point do not establish reactive dependencies.)
    if (tpl && typeof (/** @type any */ (tpl).then) === 'function') {
      return this._commitAsync(/** @type {Promise<unknown>} */ (tpl));
    }
    // The commit is untracked: a signal read while the DOM is patched (a
    // `watch()` part, a child's synchronous work) belongs to whatever read
    // it, not to this component's next render.
    Signal.subtle.untrack(() => clientRender(tpl, this._renderRoot, { host: this }));
    return undefined;
  }

  /**
   * Commit a promise-returning render() with stale-while-revalidate
   * semantics (#469). The current DOM stays untouched until the template
   * resolves; on a client RE-FETCH an author-defined renderFallback()
   * optionally swaps in a loading state first. The cycle's render token
   * (stamped by _performRender before update() ran) drops a superseded
   * resolution so an out-of-order fetch never commits stale DOM, INCLUDING
   * when the superseding render is synchronous (a later cycle re-stamps the
   * token whether or not it is async). A rejection routes to the
   * renderError() boundary, isolated to this component. Returns a promise
   * that settles once the commit (or its error / fallback) has been applied.
   *
   * @param {Promise<unknown>} pending
   * @returns {Promise<void>}
   * @private
   */
  _commitAsync(pending) {
    const token = this.__renderToken;
    // First paint (hydration): keep the SSR DOM, never a fallback, so
    // first-paint data stays visible with no skeleton flash. Re-fetch: an
    // author-defined renderFallback() overrides the stale-while-revalidate
    // default with an explicit loading state.
    if (this.__firstRendered && this._overridesRenderFallback()) {
      try {
        const fb = this.renderFallback();
        if (fb !== undefined) Signal.subtle.untrack(() => clientRender(fb, this._renderRoot, { host: this }));
      } catch (e) {
        console.error(`[webjs] renderFallback() threw:`, e);
      }
    }
    return Promise.resolve(pending).then(
      (tpl) => {
        if (token !== this.__renderToken) return; // superseded by a newer render
        // The COMMIT throws too, not just the fetch, and a sibling rejection
        // handler cannot see it: `.then(onFulfil, onRejected)` never routes
        // onFulfil's own throw to onRejected. Left uncaught, the returned
        // promise rejected and _performRender's `.then` had no rejection
        // handler, so the error escaped as an unhandled rejection,
        // renderError() never ran, __pendingAsyncCommits never decremented
        // (wedging it >= 1 forever, which also disables the non-committing
        // cycle's _resolveUpdate escape), and updateComplete never settled.
        // The sync path routes an identical throw to the same boundary, so
        // this is what makes the two paths agree.
        try {
          clientRender(tpl, this._renderRoot, { host: this });
        } catch (commitError) {
          this._handleRenderError(
            commitError instanceof Error ? commitError : new Error(String(commitError)),
          );
        }
      },
      (error) => {
        if (token !== this.__renderToken) return;
        this._handleRenderError(error instanceof Error ? error : new Error(String(error)));
      },
    );
  }

  /**
   * Whether the subclass overrides renderFallback() (vs the inert default).
   * @returns {boolean}
   * @private
   */
  _overridesRenderFallback() {
    return this.renderFallback !== WebComponent.prototype.renderFallback;
  }

  /**
   * Client-side render-error boundary, shared by the sync and async commit
   * paths. Logs, then commits renderError()'s output (if any) so one broken
   * component does not crash the page.
   * @param {Error} error
   * @private
   */
  _handleRenderError(error) {
    console.error(
      `[webjs] render error in <${tagOf(/** @type any */ (this.constructor)) || this.tagName?.toLowerCase()}>:`,
      error,
    );
    try {
      const fallback = this.renderError(error);
      if (fallback !== undefined) Signal.subtle.untrack(() => clientRender(fallback, this._renderRoot, { host: this }));
    } catch (fallbackError) {
      console.error(`[webjs] renderError() also threw:`, fallbackError);
    }
  }

  /**
   * Post-commit half of the update cycle (steps 7-8 + updateComplete),
   * shared by the sync path and the async (post-resolution) path.
   * @param {Map<string, unknown>} changedProperties
   * @private
   */
  _postCommit(changedProperties) {
    const resolve = this._updateResolve;
    this._updateResolve = null;
    try {
      this._tracked('__postWatcher', () => {
        for (const c of this.__controllers || NO_CONTROLLERS) c.hostUpdated?.();
        if (!this.__firstRendered) {
          this.__firstRendered = true;
          this.firstUpdated(changedProperties);
        }
        this.updated(changedProperties);
      });
    } catch (postCommitError) {
      console.error(`[webjs] lifecycle hook threw during post-commit phase:`, postCommitError);
    } finally {
      resolve?.(!this._scheduled);
    }
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
   *   this.renderRoot.querySelector('input')?.focus();
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
    (this.__controllers ??= new Set()).add(controller);
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
    if (this.__controllers) this.__controllers.delete(controller);
  }

  /**
   * Override in subclasses to return a TemplateResult. The default returns
   * `noChange`, as Lit's does, so a component with no `render()` leaves its
   * children exactly as they are, on the server and in the browser.
   * @returns {unknown}
   */
  render() {
    return noChange;
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

  /**
   * Optional loading UI for an async render() (#469), shown ONLY during a
   * client RE-FETCH (a prop / dependency change re-runs `async render()`),
   * NEVER on the first paint.
   *
   * **When to override (AI hint):** the client re-fetch default is
   * stale-while-revalidate (the component keeps showing its current content
   * until the new render resolves). Override `renderFallback()` only when you
   * want a loading state (skeleton / spinner) shown during the re-fetch
   * instead of the stale content, e.g. when stale data would mislead.
   *
   * **What it does NOT do:** it does not affect the first paint (SSR always
   * blocks and bakes real data in), and it does NOT create a server-streaming
   * boundary. To show a first-paint fallback for slow data, wrap the component
   * in `<webjs-suspense .fallback=${...}>` instead. It is a prop-aware method,
   * not a static field, so it can branch on the component's current state.
   *
   * ```js
   * renderFallback() { return html`<div class="skeleton h-24"></div>`; }
   * async render() { const u = await getUser(this.id); return html`<h3>${u.name}</h3>`; }
   * ```
   *
   * @returns {unknown} A TemplateResult loading state, or undefined to keep
   *   the stale-while-revalidate default.
   */
  renderFallback() {
    return undefined;
  }
}

/**
 * Report a controller whose `hostUpdate()` threw during SSR, once per
 * controller class.
 * @param {any} host
 * @param {any} controller
 * @param {unknown} err
 */
function reportSsrControllerError(host, controller, err) {
  const Cls = controller && controller.constructor;
  if (Cls && REPORTED_SSR_CONTROLLERS.has(Cls)) return;
  if (Cls) REPORTED_SSR_CONTROLLERS.add(Cls);
  const tag = host.__ssrTag || tagOf(host.constructor) || 'a component';
  console.error(
    `[webjs] ${Cls && Cls.name ? Cls.name : 'A controller'}.hostUpdate() threw during SSR of <${tag}>, so it was skipped ` +
      `and the component rendered without it. Controllers' hostUpdate() runs on the server too; guard browser-only ` +
      `work with \`if (isServer) return;\` (isServer from '@webjsdev/core'), or move it to hostConnected() or hostUpdated(), ` +
      `which never run at SSR.`,
    err,
  );
}

/**
 * The error a light-DOM component with `static styles` gets, on the server
 * (dev) and in the browser.
 * @param {string | undefined} tag
 * @returns {string}
 */
/** @param {string} s */
function camelCase(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Dual-role WebComponent class and factory.
 * Can be extended directly: `class X extends WebComponent`
 * Or called as a class factory: `class X extends WebComponent({ count: Number })`
 *
 * @param {Record<string, any>} [properties]
 * @returns {any}
 */
export function WebComponent(properties) {
  if (new.target) {
    return Reflect.construct(WebComponentBase, arguments, new.target);
  } else {
    return class extends WebComponentBase {
      static properties = properties;
    };
  }
}

/**
 * Re-assign every own data property of `el` that hides a setter defined on
 * its class chain below the WebJs base, so the value goes through the
 * accessor instead of shadowing it.
 *
 * @param {any} el
 */
function liftShadowedAccessors(el) {
  for (const key of Object.keys(el)) {
    for (let p = Object.getPrototypeOf(el); p && p !== WebComponentBase.prototype; p = Object.getPrototypeOf(p)) {
      const d = Object.getOwnPropertyDescriptor(p, key);
      if (!d) continue;
      if (d.set) {
        const value = el[key];
        delete el[key];
        el[key] = value;
      }
      break;
    }
  }
}

// Ensure static inheritance and instanceof checks work
Object.setPrototypeOf(WebComponent, WebComponentBase);
WebComponent.prototype = WebComponentBase.prototype;
