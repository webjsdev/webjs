/**
 * @license
 * Portions derived from Lit (`@lit/task`), Copyright Google LLC, BSD-3-Clause.
 */
import type { ReactiveController } from './component.js';

/** The host a Task attaches to: any ReactiveController host (a WebComponent). */
interface TaskHost {
  addController(controller: ReactiveController): void;
  requestUpdate(): void;
}

export const TaskStatus: {
  readonly INITIAL: 0;
  readonly PENDING: 1;
  readonly COMPLETE: 2;
  readonly ERROR: 3;
};

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

/** Return it from a task function to put the task back into INITIAL. */
export const initialState: unique symbol;
export type InitialState = typeof initialState;

/** Called as `task(args, { signal })`, where `args` is the array `args()` returned. */
export type TaskFunction<D extends ReadonlyArray<unknown>, R = unknown> = (
  args: D,
  options: { signal: AbortSignal },
) => R | InitialState | Promise<R | InitialState>;

export type ArgsFunction<D extends ReadonlyArray<unknown>> = () => D;

export interface TaskConfig<T extends ReadonlyArray<unknown>, R> {
  task: TaskFunction<T, R>;
  args?: ArgsFunction<T>;
  /** `true` runs in `hostUpdate`, `'afterUpdate'` in `hostUpdated`, `false` only on `run()`. */
  autoRun?: boolean | 'afterUpdate';
  argsEqual?: (oldArgs: T, newArgs: T) => boolean;
  initialValue?: R;
  onComplete?: (value: R) => unknown;
  onError?: (error: unknown) => unknown;
}

export interface StatusRenderer<R> {
  initial?: () => unknown;
  pending?: () => unknown;
  complete?: (value: R) => unknown;
  error?: (error: unknown) => unknown;
}

export class Task<
  const T extends ReadonlyArray<unknown> = ReadonlyArray<unknown>,
  const R = unknown,
> implements ReactiveController {
  autoRun: boolean | 'afterUpdate';
  constructor(host: TaskHost, task: TaskFunction<T, R>, args?: ArgsFunction<T>);
  constructor(host: TaskHost, config: TaskConfig<T, R>);
  get taskComplete(): Promise<R>;
  get status(): TaskStatus;
  get value(): R | undefined;
  get error(): unknown;
  run(args?: T): Promise<void>;
  abort(reason?: unknown): void;
  render<X extends StatusRenderer<R>>(
    renderer: X,
  ): MaybeReturnType<X['initial']> | MaybeReturnType<X['pending']> | MaybeReturnType<X['complete']> | MaybeReturnType<X['error']>;
  hostUpdate(): void;
  hostUpdated(): void;
}

type MaybeReturnType<F> = F extends (...args: never[]) => infer R ? R : undefined;

export function shallowArrayEquals<T extends ReadonlyArray<unknown>>(oldArgs: T, newArgs: T): boolean;
export function deepArrayEquals<T extends ReadonlyArray<unknown>>(oldArgs: T, newArgs: T): boolean;
export function deepEquals(a: unknown, b: unknown): boolean;
