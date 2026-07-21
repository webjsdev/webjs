/**
 * Compile-time signature tests for @webjsdev/core's COMPLEX exports (#1031).
 *
 * The `dts-no-phantom-exports` guard proves every declared value export EXISTS
 * at runtime, but it deliberately does NOT diff signatures: the hand-written
 * overlays are richer than the loose JSDoc, so an automatic shape diff is all
 * false positives on exactly these exports (generic classes, directive
 * overloads, factory functions). Per-signature correctness for them is pinned
 * POSITIVELY here instead. Each complex export gets a realistic valid use (must
 * compile) and, where a wrong shape is statically checkable, a wrong use
 * (`// @ts-expect-error`, must error), so a regression in the declared signature
 * surfaces as a fixture failure. (`Task`, `ref`, and the context classes carry
 * a wrong-use case; `repeat` is JSDoc-inferred and loosely typed, so it gets the
 * valid use only.)
 *
 * Not executed by node:test; compiled by `type-fixtures.test.mjs` (which asserts
 * valid lines compile and every `@ts-expect-error` is a genuine error).
 */
import {
  WebComponent,
  Task,
  createContext,
  ContextProvider,
  ContextConsumer,
  repeat,
  html,
} from '@webjsdev/core';
import { ref, createRef } from '@webjsdev/core/directives';

// NOTE: the standalone `register(tag, cls)` / `lookup` signatures are pinned by
// #1033 (its param type rejects a user component class today); their positive
// cases land with that fix. The static `Class.register('tag')` idiom is covered
// by `component-types.test-d.ts`.

type Assert<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;

class Host extends WebComponent({}) {
  render() { return html``; }
}
Host.register('cx-host');
const host = new Host();

/* ---- Task<T>: constructor(host, { task, args?, autoRun? }), typed value ---- */
const task = new Task<number>(host, {
  task: async () => 42,
  args: () => [],
  autoRun: false,
});
// Exact-type pin (stronger than an assignability check): value is EXACTLY T | undefined.
type _TaskValue = Assert<Equal<typeof task.value, number | undefined>>;
const _run: Promise<void> = task.run();
void _run;
// @ts-expect-error Task needs a host + options, not a bare callback
new Task<number>(async () => 1);
// @ts-expect-error the task option must return a Promise-producing function
new Task<number>(host, { task: 5 });

/* ---- ref / createRef: element-typed refs ---- */
const inputRef = createRef<HTMLInputElement>();
const _el: HTMLInputElement | undefined = inputRef.value;
void _el;
void html`<input ${ref(inputRef)} />`;
// @ts-expect-error ref takes a RefObject or callback, not a string
void html`<input ${ref('nope')} />`;

/* ---- repeat: keyed list directive (items, keyFn, template) ---- */
void html`<ul>${repeat([1, 2, 3], (n) => n, (n) => html`<li>${n}</li>`)}</ul>`;

/* ---- context: createContext<T>, ContextProvider<T>, ContextConsumer<T> ---- */
const themeCtx = createContext<string>('theme');
const provider = new ContextProvider<string>(host, { context: themeCtx, initialValue: 'dark' });
const _pv: string = provider.value;
void _pv;
provider.setValue('light');
// @ts-expect-error the provided value must match the context type (string)
provider.setValue(123);

const consumer = new ContextConsumer<string>(host, { context: themeCtx, subscribe: true });
// Exact-type pin: a consumer's value is EXACTLY T | undefined (provider's is T).
type _ConsumerValue = Assert<Equal<typeof consumer.value, string | undefined>>;
type _ProviderValue = Assert<Equal<typeof provider.value, string>>;
// @ts-expect-error a consumer needs a host + options, not a bare context
new ContextConsumer<string>(themeCtx);
