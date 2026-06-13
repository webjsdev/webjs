/** Per-action middleware (#490). */

/** The context object middleware accumulate and the action reads via actionContext(). */
export interface ActionContext { [key: string]: unknown }

/** A middleware's ctx: the request, the action args, the abort signal, and the shared context. */
export interface ActionMiddlewareCtx {
  request?: Request;
  args?: unknown[];
  signal?: AbortSignal;
  context: ActionContext;
}

/** A per-action middleware: run `next()` to proceed, or return a value to short-circuit. */
export type ActionMiddleware = (ctx: ActionMiddlewareCtx, next: () => Promise<unknown>) => unknown;

/** The accumulated middleware context for the current action, or {} outside one. */
export declare function actionContext(): ActionContext;

/** Run an action through its middleware chain (framework-internal). */
export declare function runActionChain(middleware: ActionMiddleware[], baseCtx: Partial<ActionMiddlewareCtx>, finalFn: () => unknown): Promise<unknown>;
