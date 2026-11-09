/**
 * @license
 * Portions derived from Lit (`@lit/context`), Copyright Google LLC, BSD-3-Clause.
 */
import type { ReactiveController } from './component.js';

/** Any element that hosts reactive controllers (a WebComponent). */
interface ContextHost extends HTMLElement {
  addController(controller: ReactiveController): void;
  requestUpdate(): void;
}

/**
 * A context key carrying its value type. At runtime it is the key itself (a
 * string, a Symbol, an object), and the key IS the identity.
 */
export type Context<KeyType, ValueType> = KeyType & { __context__: ValueType };

/** The value type a context carries. */
export type ContextType<Key extends Context<unknown, unknown>> =
  Key extends Context<unknown, infer ValueType> ? ValueType : never;

/** Returns `key`, typed as a context of `ValueType`. */
export function createContext<ValueType, K = unknown>(key: K): Context<K, ValueType>;

export type ContextCallback<ValueType> = (value: ValueType, unsubscribe?: () => void) => void;

export class ContextRequestEvent<C extends Context<unknown, unknown>> extends Event {
  readonly context: C;
  readonly contextTarget: Element;
  readonly callback: ContextCallback<ContextType<C>>;
  readonly subscribe: boolean;
  constructor(
    context: C,
    contextTarget: Element,
    callback: ContextCallback<ContextType<C>>,
    subscribe?: boolean,
  );
}

export class ContextProviderEvent<C extends Context<unknown, unknown>> extends Event {
  readonly context: C;
  readonly contextTarget: Element;
  constructor(context: C, contextTarget: Element);
}

declare global {
  interface HTMLElementEventMap {
    'context-request': ContextRequestEvent<Context<unknown, unknown>>;
    'context-provider': ContextProviderEvent<Context<unknown, unknown>>;
  }
}

export class ValueNotifier<T> {
  protected readonly subscriptions: Map<ContextCallback<T>, { disposer: () => void; consumerHost: Element }>;
  constructor(defaultValue?: T);
  get value(): T;
  set value(v: T);
  setValue(v: T, force?: boolean): void;
  updateObservers: () => void;
  addCallback(callback: ContextCallback<T>, consumerHost: Element, subscribe?: boolean): void;
  clearCallbacks(): void;
}

export interface ContextProviderOptions<C extends Context<unknown, unknown>> {
  context: C;
  initialValue?: ContextType<C>;
}

export class ContextProvider<
  T extends Context<unknown, unknown>,
  HostElement extends ContextHost = ContextHost,
> extends ValueNotifier<ContextType<T>> implements ReactiveController {
  protected readonly host: HostElement;
  constructor(host: HostElement, options: ContextProviderOptions<T>);
  constructor(host: HostElement, context: T, initialValue?: ContextType<T>);
  onContextRequest: (ev: ContextRequestEvent<Context<unknown, unknown>>) => void;
  onProviderRequest: (ev: ContextProviderEvent<Context<unknown, unknown>>) => void;
  hostConnected(): void;
}

export interface ContextConsumerOptions<C extends Context<unknown, unknown>> {
  context: C;
  callback?: (value: ContextType<C>, dispose?: () => void) => void;
  /** Keep receiving changes. Default `false`, a one-time read per connection. */
  subscribe?: boolean;
}

export class ContextConsumer<
  C extends Context<unknown, unknown>,
  HostElement extends ContextHost = ContextHost,
> implements ReactiveController {
  protected host: HostElement;
  value?: ContextType<C>;
  constructor(host: HostElement, options: ContextConsumerOptions<C>);
  constructor(
    host: HostElement,
    context: C,
    callback?: (value: ContextType<C>, dispose?: () => void) => void,
    subscribe?: boolean,
  );
  hostConnected(): void;
  hostDisconnected(): void;
}

/** Buffers unanswered subscribing requests and replays them when a provider connects. */
export class ContextRoot {
  attach(element: HTMLElement): void;
  detach(element: HTMLElement): void;
}
