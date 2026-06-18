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

import type { CSSResult } from './css.js';
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

/** Runtime-level property declaration: one entry in `WebComponent({ … })`. */
export interface PropertyDeclaration<T = unknown> {
  /** Constructor used for string → value coercion when the attribute changes. */
  type?: PropertyConstructor<T>;
  /** Write property changes back to the HTML attribute (kebab-cased). */
  reflect?: boolean;
  /** Internal-only: no attribute, no reflection, but still reactive. */
  state?: boolean;
  /** Rename the attribute, or pass `false` to suppress it entirely. */
  attribute?: string | false;
  /** Custom attribute ⇄ property serialisation. Takes precedence over `type`. */
  converter?: {
    fromAttribute?: (value: string | null, type?: PropertyConstructor<T>) => T;
    toAttribute?: (value: T, type?: PropertyConstructor<T>) => string | null;
  };
  /** Custom dirty check. Return `true` to schedule an update. */
  hasChanged?: (newValue: T, oldValue: T) => boolean;
}

/** Reactive controller protocol (Lit-compatible). */
export interface ReactiveController {
  hostConnected?(): void;
  hostDisconnected?(): void;
  hostUpdate?(): void;
  hostUpdated?(): void;
}

/**
 * Base class for interactive web components.
 *
 * Declare reactive properties via the `extends WebComponent({ … })`
 * factory. It installs the reactive accessor AND types each field for
 * you (no `declare`, no `static properties`):
 *
 *     class StudentCard extends WebComponent({ student: prop<Student>(Object) }) {
 *       render() { return html`<p>${this.student.name}</p>`; }
 *     }
 *     StudentCard.register('student-card');
 *
 * A bare constructor type covers the common case (`WebComponent({ count:
 * Number })` gives `this.count: number`); use the `prop()` helper for
 * options (`prop(Number, { reflect: true })`) or to narrow the type
 * (`prop<Student>(Object)`). Set defaults via the `default` option or in
 * the constructor, never a class-field initializer (it runs after super()
 * and clobbers the reactive accessor). A hand-written `static properties`
 * in a class body is no longer supported and throws at construction.
 *
 * See the Editor Setup doc for tooling that gives attribute/tag
 * intelligence inside `html\`…\`` templates.
 */
abstract class WebComponentBase extends HTMLElement {
  static shadow: boolean;
  static hydrate: 'visible' | undefined;
  /** @internal Populated by the `WebComponent({ … })` factory, not by hand. */
  static properties: Record<string, PropertyDeclaration>;
  static styles: CSSResult | CSSResult[] | null;
  static lazy?: boolean;
  /** Register this class as a custom element under `tag`. Tag must contain a hyphen. */
  static register(tag: string): void;
  static readonly observedAttributes: string[];

  /**
   * Schedule a re-render. Optionally record a property change so lifecycle
   * hooks can branch on what changed via `changedProperties`.
   *
   * For instance-local state, prefer a reactive property (`WebComponent({
   * foo: prop({ state: true }) })`) or a signal from
   * `@webjsdev/core`'s `signal()`. The framework's built-in
   * SignalWatcher wires every signal read in `render()` to a re-render
   * automatically; explicit `requestUpdate()` is rarely needed.
   */
  requestUpdate(name?: string, oldValue?: unknown): void;
  /** A Promise that resolves after the next render commit. */
  readonly updateComplete: Promise<boolean>;
  /** Override point for `updateComplete`. Default returns the internal promise. */
  getUpdateComplete(): Promise<boolean>;
  /** Attach a reactive controller. */
  addController(controller: ReactiveController): void;
  /** Detach a reactive controller. */
  removeController(controller: ReactiveController): void;
  /** Returns the template for this render. May be async. */
  render(): TemplateResult | Promise<TemplateResult> | void;
  /** Decide whether to update. Default returns `true`. */
  shouldUpdate(changedProperties: Map<string, unknown>): boolean;
  /** Pre-render hook. Safe to set properties; folds into current cycle. */
  willUpdate(changedProperties: Map<string, unknown>): void;
  /** Render-and-commit step. Default calls `render()` and commits. */
  update(changedProperties: Map<string, unknown>): void;
  /** Post-render hook. Runs after every commit. */
  updated(changedProperties: Map<string, unknown>): void;
  /** One-shot hook after the first render lands in the DOM. */
  firstUpdated?(changedProperties: Map<string, unknown>): void;
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

export interface WebComponentConstructor {
  new (): WebComponentBase;
  prototype: WebComponentBase;

  shadow: boolean;
  hydrate: 'visible' | undefined;
  properties: Record<string, PropertyDeclaration>;
  styles: CSSResult | CSSResult[] | null;
  lazy?: boolean;
  register(tag: string): void;
  readonly observedAttributes: string[];

  <S extends Record<string, any>>(shape: S): {
    new (): WebComponentBase & InferProps<S>;
    prototype: WebComponentBase & InferProps<S>;

    shadow: boolean;
    hydrate: 'visible' | undefined;
    properties: Record<string, PropertyDeclaration>;
    styles: CSSResult | CSSResult[] | null;
    lazy?: boolean;
    register(tag: string): void;
    readonly observedAttributes: string[];
  };
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

export declare function prop<T = string>(
  opts?: PropertyDeclaration<T>
): PropertyDeclaration<T>;
