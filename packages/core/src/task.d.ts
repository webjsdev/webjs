import type { ReactiveController, WebComponent } from './component.js';

export const TaskStatus: {
  readonly INITIAL: 0;
  readonly PENDING: 1;
  readonly COMPLETE: 2;
  readonly ERROR: 3;
};

export type TaskStatusValue = (typeof TaskStatus)[keyof typeof TaskStatus];

export class Task<T = unknown> implements ReactiveController {
  constructor(host: WebComponent, options: {
    task: (...args: any[]) => Promise<T>;
    args?: () => unknown[];
    autoRun?: boolean;
  });
  get status(): TaskStatusValue;
  get value(): T | undefined;
  get error(): unknown;
  run(): Promise<void>;
  abort(): void;
  render(handlers?: {
    initial?: () => unknown;
    pending?: () => unknown;
    complete?: (value: T) => unknown;
    error?: (error: unknown) => unknown;
  }): unknown;
  hostUpdate(): void;
  hostUpdated(): void;
  hostConnected(): void;
  hostDisconnected(): void;
}
