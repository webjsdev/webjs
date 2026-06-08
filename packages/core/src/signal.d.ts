export interface SignalState<T = unknown> {
  readonly __isSignal: true;
  get(): T;
  set(value: T): void;
}

export interface SignalComputed<T = unknown> {
  readonly __isSignal: true;
  get(): T;
}

export function batch<T>(fn: () => T): T;
export function signal<T>(initial: T, options?: Record<string, unknown>): SignalState<T>;
export function computed<T>(fn: () => T, options?: Record<string, unknown>): SignalComputed<T>;
export function isSignal(v: unknown): v is SignalState | SignalComputed;
export function effect(fn: () => void): () => void;

export const Signal: {
  State: new <T>(initial: T, options?: Record<string, unknown>) => SignalState<T>;
  Computed: new <T>(fn: () => T, options?: Record<string, unknown>) => SignalComputed<T>;
};
