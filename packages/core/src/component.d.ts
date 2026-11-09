/**
 * TypeScript overlay for packages/core/src/component.js.
 *
 * The runtime is JSDoc-authored JavaScript; this file exists so editors
 * (tsserver: used by VS Code, Neovim, Zed, WebStorm) resolve imports
 * with full type information. Without this overlay, `declare foo: Foo`
 * would type the field but the surrounding class (`this.requestUpdate`,
 * lifecycle hooks, controllers) would be weakly typed. Zero runtime
 * cost: nothing in this file ships to the browser.
 */

import type { CSSResultGroup, CSSResultOrNative } from './css.js';
import type { TemplateResult } from './html.js';

/** Any constructor the framework accepts as the `type:` field of a property. */
export type PropertyConstructor<T = unknown> =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | ObjectConstructor
  | ArrayConstructor
  | (new (...args: any[]) => T)
  | ((v: any) => T);

/** Runtime-level property declaration: one entry in `WebComponent({ … })` or in Lit's `static properties`. */
export interface PropertyDeclaration<T = unknown> {
  /** Constructor used for string → value coercion when the attribute changes. */
  type?: PropertyConstructor<T>;
  /** Write property changes back to the HTML attribute (the lowercased property name unless `attribute` names one). */
  reflect?: boolean;
  /** Internal-only: no attribute, no reflection, but still reactive. */
  state?: boolean;
  /** Rename the attribute (a string), keep the default name (`true`), or suppress it (`false`). */
  attribute?: string | boolean;
  /**
   * Custom attribute ⇄ property serialisation. Takes precedence over `type`.
   * A bare function is the `fromAttribute` half (reflection then uses the
   * default serialisation), as in Lit.
   */
  converter?:
    | ((value: string | null, type?: PropertyConstructor<T>) => T)
    | {
        fromAttribute?: (value: string | null, type?: PropertyConstructor<T>) => T;
        toAttribute?: (value: T, type?: PropertyConstructor<T>) => string | null;
      };
  /**
   * Install no accessor: the class's own get/set stays and must call
   * `this.requestUpdate(name, oldValue)` itself (Lit's `noAccessor`).
   */
  noAccessor?: boolean;
  /** Custom dirty check. Return `true` to schedule an update. */
  hasChanged?: (newValue: T, oldValue: T) => boolean;
  /** Initial value, or a function called per instance for a fresh object / array. */
  default?: T | (() => T);
}

/** Reactive controller protocol (Lit-compatible). */
export interface ReactiveController {
  hostConnected?(): void;
  hostDisconnected?(): void;
  hostUpdate?(): void;
  hostUpdated?(): void;
}

/**
 * Lit's `ReactiveControllerHost`: what a controller may rely on from its host.
 * Every `WebComponent` satisfies it, so a controller typed against it works
 * with WebJs and Lit alike.
 */
export interface ReactiveControllerHost {
  addController(controller: ReactiveController): void;
  removeController(controller: ReactiveController): void;
  requestUpdate(): void;
  readonly updateComplete: Promise<boolean>;
}

/** Lit's `ComplexAttributeConverter`: the object form of a property `converter`. */
export interface ComplexAttributeConverter<Type = unknown, TypeHint = unknown> {
  fromAttribute?(value: string | null, type?: TypeHint): Type;
  toAttribute?(value: Type, type?: TypeHint): unknown;
}

/** Lit's `PropertyDeclarations`: the shape of a `static properties` block. */
export interface PropertyDeclarations {
  readonly [key: string]: PropertyDeclaration | PropertyConstructor;
}

/**
 * Lit's `PropertyValueMap<T>`: a `changedProperties` Map whose keys and old
 * values are typed against the component (`PropertyValues<this>`).
 */
export interface PropertyValueMap<T> extends Map<PropertyKey, unknown> {
  get<K extends keyof T>(k: K): T[K] | undefined;
  set<K extends keyof T>(key: K, value: T[K]): this;
  has<K extends keyof T>(k: K): boolean;
  delete<K extends keyof T>(k: K): boolean;
}

/**
 * Lit's `PropertyValues`: the `changedProperties` argument of the lifecycle
 * hooks. `PropertyValues<this>` types its keys against the component.
 */
export type PropertyValues<T = any> = T extends object ? PropertyValueMap<T> : Map<PropertyKey, unknown>;

/**
 * Base class for interactive web components.
 *
 * Declare reactive properties in either of two equivalent ways. The
 * `extends WebComponent({ … })` factory installs the reactive accessor AND
 * types each field for you (no `declare` needed):
 *
 *     class StudentCard extends WebComponent({ student: prop<Student>(Object) }) {
 *       render() { return html`<p>${this.student.name}</p>`; }
 *     }
 *     StudentCard.register('student-card');
 *
 * A bare constructor type covers the common case (`WebComponent({ count:
 * Number })` gives `this.count: number`); use the `prop()` helper for
 * options (`prop(Number, { reflect: true })`) or to narrow the type
 * (`prop<Student>(Object)`). Lit's own spelling works too, with an erasable
 * `declare` for the type:
 *
 *     class Counter extends WebComponent {
 *       static properties = { count: { type: Number, reflect: true } };
 *       declare count: number;
 *     }
 *
 * Props merge down the class chain as in Lit, so a subclass's own
 * `static properties` adds to its parent's. Set defaults via the `default`
 * option or in the constructor, never a class-field initializer (it runs
 * after super() and clobbers the reactive accessor).
 *
 * See the Editor Setup doc for tooling that gives attribute/tag
 * intelligence inside `html\`…\`` templates.
 */
// An INTERFACE, not an `abstract class`, on purpose. A class is a value as well
// as a type, and a non-exported class referenced from exported positions
// (`new (): WebComponentBase`, `export type WebComponent = WebComponentBase`)
// still leaks into the module's VALUE namespace, so `import { WebComponentBase }
// from '@webjsdev/core'` type-checks and then crashes at load because the runtime
// never exports it (#1032). An interface has no value meaning, so it describes the
// instance shape without becoming a phantom export. The static surface lives on
// `WebComponentStatics` / `WebComponentConstructor` below.
interface WebComponentBase extends HTMLElement {
  /**
   * Schedule a re-render. Optionally record a property change so lifecycle
   * hooks can branch on what changed via `changedProperties`.
   *
   * For instance-local state, use a reactive property (`WebComponent({
   * open: prop<boolean>({ state: true }) })`) or a signal from
   * `@webjsdev/core`'s `signal()`. The framework's built-in SignalWatcher
   * wires every signal the update cycle reads to a re-render automatically;
   * explicit `requestUpdate()` is rarely needed.
   */
  requestUpdate(name?: PropertyKey, oldValue?: unknown, options?: PropertyDeclaration): void;
  /** A Promise that resolves after the next render commit. */
  readonly updateComplete: Promise<boolean>;
  /** Override point for `updateComplete`. Default returns the internal promise. */
  getUpdateComplete(): Promise<boolean>;
  /** Attach a reactive controller. */
  addController(controller: ReactiveController): void;
  /** Detach a reactive controller. */
  removeController(controller: ReactiveController): void;
  /** Returns the template for this render. May be async. The default returns `noChange`. */
  render(): unknown;
  /**
   * The node `render()` commits into: the element itself for light DOM, its
   * shadow root for `static shadow = true`. Undefined until the element
   * connects, and at SSR.
   */
  renderRoot: HTMLElement | ShadowRoot | DocumentFragment | undefined;
  /** True once the first update has completed. */
  readonly hasUpdated: boolean;
  /** True while an update is queued or running. */
  readonly isUpdatePending: boolean;
  /**
   * Create the render root, once per element. The default returns the element
   * for light DOM, and for `static shadow = true` attaches the shadow root
   * with `static shadowRootOptions` and adopts `static styles`.
   */
  createRenderRoot(): HTMLElement | ShadowRoot | DocumentFragment;
  /** Called from the update microtask; override to change when an update runs. */
  scheduleUpdate(): void | Promise<unknown>;
  /** Run the pending update now, synchronously. No-op when nothing is pending. */
  performUpdate(): void;
  /** Called on connect, right before the first update is queued. */
  enableUpdating(requestedUpdate: boolean): void;
  /** Decide whether to update. Default returns `true`. */
  shouldUpdate(changedProperties: PropertyValues): boolean;
  /** Pre-render hook. Safe to set properties; folds into current cycle. */
  willUpdate(changedProperties: PropertyValues): void;
  /** Render-and-commit step. Default calls `render()` and commits. */
  update(changedProperties: PropertyValues): void;
  /** Post-render hook. Runs after every commit. */
  updated(changedProperties: PropertyValues): void;
  /** One-shot hook after the first render lands in the DOM. */
  firstUpdated?(changedProperties: PropertyValues): void;
  /** Optional render-error boundary inside the component. */
  renderError?(error: Error): TemplateResult | void;
  /**
   * Optional loading UI for an async `render()` (#469), shown ONLY during a
   * client re-fetch (a prop / dependency change re-runs `async render()`),
   * NEVER on the first paint. The default re-fetch behaviour is
   * stale-while-revalidate; define this to override it with a loading state.
   */
  renderFallback?(): TemplateResult | void;

  // Concrete on the base (component.js implements all three), so a subclass
  // override can call `super.connectedCallback()` etc. without a
  // possibly-undefined error (#433). NOT optional, unlike the subclass-only
  // hooks above (firstUpdated / renderError).
  connectedCallback(): void;
  disconnectedCallback(): void;
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void;
}

export type WebComponent = WebComponentBase;

export type Infer<C> =
  C extends BooleanConstructor ? boolean :
  C extends NumberConstructor ? number :
  C extends StringConstructor ? string :
  C extends new (...a: any[]) => infer T ? T :
  C extends (v: any) => infer T ? T : unknown;

export type InferProps<S> = {
  [K in keyof S]: S[K] extends PropertyDeclaration<infer T> ? T : Infer<S[K]>
};

/**
 * The static surface every `WebComponent` constructor carries (the bare base,
 * a factory-produced base, and a registered subclass alike). Declared ONCE
 * here and referenced from both `WebComponentConstructor` and the factory-call
 * return type below, so adding or changing a static can never let the two
 * positions drift. Mirrors the `static` members on `WebComponentBase`.
 */
interface WebComponentStatics {
  shadow: boolean;
  /** The `attachShadow()` options, also written onto the server's Declarative Shadow DOM template. */
  shadowRootOptions: ShadowRootInit;
  hydrate: 'visible' | undefined;
  properties: Record<string, PropertyDeclaration | PropertyConstructor>;
  styles: CSSResultGroup | null | undefined;
  /** `static styles` flattened by `finalizeStyles()`: what the shadow root adopts. */
  readonly elementStyles: CSSResultOrNative[];
  /** Flatten and dedupe `static styles`; override to post-process. */
  finalizeStyles(styles?: CSSResultGroup | null): CSSResultOrNative[];
  lazy?: boolean;
  register(tag: string): void;
  readonly observedAttributes: string[];
  /** Every declared reactive property, own and inherited, as name to declaration. */
  readonly elementProperties: Map<PropertyKey, PropertyDeclaration>;
  /** The declaration for `name`, or the default `{ type: String }`. */
  getPropertyOptions(name: PropertyKey): PropertyDeclaration;
  /** Declare a reactive property from code. Must run before the first instance. */
  createProperty(name: PropertyKey, options?: PropertyDeclaration): void;
  /**
   * The accessor installed on the prototype for one reactive property.
   * Override to wrap `super.getPropertyDescriptor(...)`; return `undefined`
   * to install none.
   */
  getPropertyDescriptor(name: PropertyKey, key: string | symbol, options: PropertyDeclaration): PropertyDescriptor | undefined;
  /** Prepare the class metadata once. Called for you; idempotent. */
  finalize(): void;
  /** Run `initializer(element)` in the constructor of every instance of this class and its subclasses. */
  addInitializer(initializer: (element: WebComponentBase) => void): void;
}

export interface WebComponentConstructor extends WebComponentStatics {
  new (): WebComponentBase;
  prototype: WebComponentBase;

  <S extends Record<string, any>>(shape: S): WebComponentStatics & {
    new (): WebComponentBase & InferProps<S>;
    prototype: WebComponentBase & InferProps<S>;
  };
}

/**
 * A constructor for a registered component: the static surface plus a plain
 * `new ()`, WITHOUT the factory call signature that `WebComponentConstructor`
 * carries. That call signature is what the `WebComponent` const needs (it is
 * both a class and a factory), but it means no ordinary component class is
 * assignable to `WebComponentConstructor` (a plain class is not callable as a
 * factory). So the standalone `register(tag, cls)` / `lookup` / `tagOf` surface
 * types against THIS instead, and a user's `class X extends WebComponent({…})`
 * satisfies it (#1033).
 */
export interface WebComponentInstanceConstructor extends WebComponentStatics {
  new (): WebComponentBase;
  prototype: WebComponentBase;
}

export declare const WebComponent: WebComponentConstructor;

export declare function prop<C extends PropertyConstructor<any>>(
  type: C,
  opts?: Omit<PropertyDeclaration<Infer<C>>, 'type'>
): PropertyDeclaration<Infer<C>>;

export declare function prop<T>(
  type: PropertyConstructor<any>,
  opts?: Omit<PropertyDeclaration<T>, 'type'>
): PropertyDeclaration<T>;

// No type constructor and no attribute: nothing says what the value is, so it
// is `unknown` until narrowed (`prop<boolean>({ state: true })`).
export declare function prop<T = unknown>(
  opts: PropertyDeclaration<T> & ({ state: true } | { attribute: false })
): PropertyDeclaration<T>;

export declare function prop<T = string>(
  opts?: PropertyDeclaration<T>
): PropertyDeclaration<T>;

// The shared attribute reader (`resolveAttributeProperty`, #1341) is NOT here,
// and nothing about it belongs here. It lives in `src/attribute-reader.js`,
// which has no `exports` entry, because two guards bracket every mapped entry
// and `./component` is one: #388 forces every runtime named export of
// `component.js` to be declared in this file, and #1031 forces every
// declaration reachable from `index.d.ts` (which re-exports this file with
// `export *`) to exist on `index.js` at runtime. Together they leave no way to
// add an INTERNAL named export to `component.js`. That module's header carries
// the full reasoning.
