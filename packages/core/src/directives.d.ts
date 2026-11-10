import type { nothing, noChange } from './sentinels.js';
export { repeat, isRepeat } from './repeat.js';
export type { RepeatDirective } from './repeat.js';

export interface UnsafeHTMLDirective {
  _$webjs: 'unsafe-html';
  value: string;
  /** Set by `unsafeSVG` / `unsafeMathML`: the namespace the client parses the markup in. */
  ns?: 'svg' | 'mathml';
}

export interface LiveDirective<T = unknown> {
  _$webjs: 'live';
  value: T;
}

export interface KeyedDirective<T = unknown> {
  _$webjs: 'keyed';
  key: unknown;
  value: T;
}

export interface GuardDirective<T = unknown> {
  _$webjs: 'guard';
  deps: readonly unknown[];
  fn: () => T;
}

export interface TemplateContentDirective {
  _$webjs: 'template-content';
  template: HTMLTemplateElement | { innerHTML?: string; content?: DocumentFragment };
}

export interface RefObject<T extends Element = Element> {
  value: T | undefined;
}

export interface RefDirective<T extends Element = Element> {
  _$webjs: 'ref';
  target: RefObject<T> | ((el: T | undefined) => void);
}

export interface CacheDirective<T = unknown> {
  _$webjs: 'cache';
  value: T;
}

export interface UntilDirective {
  _$webjs: 'until';
  args: unknown[];
}

export interface AsyncAppendDirective<T = unknown> {
  _$webjs: 'async-append';
  iterable: AsyncIterable<T>;
  mapper?: (value: T, index: number) => unknown;
}

export interface AsyncReplaceDirective<T = unknown> {
  _$webjs: 'async-replace';
  iterable: AsyncIterable<T>;
  mapper?: (value: T, index: number) => unknown;
}

export interface WatchDirective<T = unknown> {
  _$webjs: 'watch';
  signal: { get(): T; __isSignal: true };
}

export function unsafeHTML(htmlString: string | null | undefined | typeof nothing | typeof noChange): UnsafeHTMLDirective;
export function isUnsafeHTML(x: unknown): x is UnsafeHTMLDirective;
/** lit's `unsafeSVG`: trusted SVG markup, parsed in the SVG namespace on the client. */
export function unsafeSVG(svgString: string | null | undefined | typeof nothing | typeof noChange): UnsafeHTMLDirective;
/** lit's `unsafeMathML`: trusted MathML markup, parsed in the MathML namespace on the client. */
export function unsafeMathML(mathString: string | null | undefined | typeof nothing | typeof noChange): UnsafeHTMLDirective;
export function live<T>(value: T): LiveDirective<T>;
export function isLive(x: unknown): x is LiveDirective;
export function keyed<T>(key: unknown, template: T): KeyedDirective<T>;
export function isKeyed(x: unknown): x is KeyedDirective;
export function guard<T>(deps: readonly unknown[], fn: () => T): GuardDirective<T>;
export function isGuard(x: unknown): x is GuardDirective;
export function templateContent(
  template: HTMLTemplateElement | { innerHTML?: string; content?: DocumentFragment },
): TemplateContentDirective;
export function isTemplateContent(x: unknown): x is TemplateContentDirective;
export function ref<T extends Element = Element>(
  refOrCallback: RefObject<T> | ((el: T | undefined) => void),
): RefDirective<T>;
export function isRef(x: unknown): x is RefDirective;
export function createRef<T extends Element = Element>(): RefObject<T>;
export function cache<T>(value: T): CacheDirective<T>;
export function isCache(x: unknown): x is CacheDirective;
export function until(...args: unknown[]): UntilDirective;
export function isUntil(x: unknown): x is UntilDirective;
export function asyncAppend<T>(
  iterable: AsyncIterable<T>,
  mapper?: (value: T, index: number) => unknown,
): AsyncAppendDirective<T>;
export function isAsyncAppend(x: unknown): x is AsyncAppendDirective;
export function asyncReplace<T>(
  iterable: AsyncIterable<T>,
  mapper?: (value: T, index: number) => unknown,
): AsyncReplaceDirective<T>;
export function isAsyncReplace(x: unknown): x is AsyncReplaceDirective;
export function watch<T>(sig: { get(): T; __isSignal: true }): WatchDirective<T>;
export function isWatch(x: unknown): x is WatchDirective;

type Falsy = null | undefined | false | 0 | -0 | 0n | '';

/** lit's `when`: the case functions receive the condition value. */
export function when<C, T, F = undefined>(
  condition: C,
  trueCase: (c: Exclude<C, Falsy>) => T,
  falseCase?: (c: Extract<C, Falsy>) => F,
): C extends Falsy ? F : T;
/** lit's `choose`: the case whose key is `===` to `value`, else the default. */
export function choose<T, V, K extends T = T>(
  value: T,
  cases: Array<[K, () => V]>,
  defaultCase?: () => V,
): V | undefined;
/** lit's `map`: a lazy generator over `items`, renderable anywhere an array is. */
export function map<T, U>(
  items: Iterable<T> | undefined,
  f: (value: T, index: number) => U,
): Generator<U, void, unknown>;
/** lit's `join`: `items` with `joiner` (or `joiner(index)`) between each pair. */
export function join<I, J>(
  items: Iterable<I> | undefined,
  joiner: J | ((index: number) => J),
): Generator<I | J, void, unknown>;
/** lit's `range`: `range(end)`, `range(start, end)` or `range(start, end, step)`. */
export function range(end: number): Generator<number, void, unknown>;
export function range(start: number, end: number, step?: number): Generator<number, void, unknown>;

export { classMap, styleMap, ifDefined } from './attribute-directives.js';
export type { ClassMapDirective, StyleMapDirective } from './attribute-directives.js';
