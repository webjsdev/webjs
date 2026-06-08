import type { ReactiveController, WebComponent } from './component.js';

export interface Context<T = unknown> {
  __context__: symbol;
  name: string;
}

export function createContext<T = unknown>(name: string): Context<T>;

export class ContextRequestEvent<T = unknown> extends Event {
  context: Context<T>;
  callback: (value: T, unsubscribe?: () => void) => void;
  subscribe: boolean;
  constructor(
    context: Context<T>,
    callback: (value: T, unsubscribe?: () => void) => void,
    subscribe?: boolean,
  );
}

export class ContextProvider<T = unknown> implements ReactiveController {
  constructor(host: WebComponent, options: { context: Context<T>; initialValue?: T });
  get value(): T;
  setValue(newValue: T): void;
  hostConnected(): void;
  hostDisconnected(): void;
}

export class ContextConsumer<T = unknown> implements ReactiveController {
  constructor(host: WebComponent, options: { context: Context<T>; subscribe?: boolean });
  get value(): T | undefined;
  hostConnected(): void;
  hostDisconnected(): void;
}
