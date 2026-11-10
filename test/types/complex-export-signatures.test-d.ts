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
  ContextRequestEvent,
  repeat,
  html,
} from '@webjsdev/core';
import { ref, createRef } from '@webjsdev/core/directives';
import type { ContextType } from '@webjsdev/core/context';
import { register } from '@webjsdev/core/registry';

/* ---- register(tag, cls): accepts a user component class (#1033) ---- */
// The second param is a component constructor, NOT the class+factory dual
// `WebComponentConstructor` (which no ordinary class satisfies, since a plain
// class is not callable as a factory). A class produced by the factory is fine.
class RegWidget extends WebComponent({ count: Number }) {
  render() { return html``; }
}
register('reg-widget', RegWidget);
// A subclass of a factory-produced class is a component constructor too.
class RegWidget2 extends RegWidget {}
register('reg-widget-2', RegWidget2);
// @ts-expect-error a plain object is not a component constructor
register('reg-widget', {});
// @ts-expect-error the tag must be a string
register(123, RegWidget);

type Assert<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;

class Host extends WebComponent({}) {
  render() { return html``; }
}
Host.register('cx-host');
const host = new Host();

/* ---- Task<Args, Result>: Lit's shape, task(argsArray, { signal }) ---- */
const task = new Task(host, {
  task: async ([n, label], { signal }) => {
    void signal;
    const _n: number = n;
    const _l: string = label;
    void _n; void _l;
    return 42;
  },
  args: () => [1, 'x'] as const,
  autoRun: false,
});
// Exact-type pin (stronger than an assignability check): value is EXACTLY R | undefined.
type _TaskValue = Assert<Equal<typeof task.value, 42 | undefined>>;
const _run: Promise<void> = task.run();
void _run;
const _done: Promise<42> = task.taskComplete;
void _done;
// The positional form (host, taskFn, argsFn) infers the same way.
const positional = new Task(host, async ([id]: readonly [string]) => id.length, () => ['a'] as const);
type _PositionalValue = Assert<Equal<typeof positional.value, number | undefined>>;
// autoRun accepts Lit's 'afterUpdate'.
new Task(host, { task: async () => 1, autoRun: 'afterUpdate' });
// @ts-expect-error Task needs a host before the task
new Task(async () => 1);
// @ts-expect-error the task option must be a function
new Task(host, { task: 5 });
// @ts-expect-error autoRun is boolean or 'afterUpdate'
new Task(host, { task: async () => 1, autoRun: 'always' });

/* ---- ref / createRef: element-typed refs ---- */
const inputRef = createRef<HTMLInputElement>();
const _el: HTMLInputElement | undefined = inputRef.value;
void _el;
void html`<input ${ref(inputRef)} />`;
// @ts-expect-error ref takes a RefObject or callback, not a string
void html`<input ${ref('nope')} />`;

/* ---- repeat: keyed list directive (items, keyFn, template) ---- */
void html`<ul>${repeat([1, 2, 3], (n) => n, (n) => html`<li>${n}</li>`)}</ul>`;

/* ---- context: Lit's shape, createContext<V>(key) returns the typed key ---- */
const themeCtx = createContext<string>('theme');
// With the value type given and the key type left out, the key is typed
// `unknown` and carries the value type, exactly as in Lit.
type _CtxValue = Assert<Equal<ContextType<typeof themeCtx>, string>>;
const provider = new ContextProvider(host, { context: themeCtx, initialValue: 'dark' });
const _pv: string = provider.value;
void _pv;
provider.setValue('light');
// @ts-expect-error the provided value must match the context type (string)
provider.setValue(123);
// The positional form (host, context, initialValue).
const positionalProvider = new ContextProvider(host, themeCtx, 'dark');
void positionalProvider;
// @ts-expect-error the positional initial value must match the context type
new ContextProvider(host, themeCtx, 5);

const consumer = new ContextConsumer(host, { context: themeCtx, subscribe: true });
// Exact-type pin: a consumer's value is EXACTLY V | undefined (provider's is V).
type _ConsumerValue = Assert<Equal<typeof consumer.value, string | undefined>>;
type _ProviderValue = Assert<Equal<typeof provider.value, string>>;
// The callback option receives the typed value.
new ContextConsumer(host, { context: themeCtx, callback: (v) => { const _s: string = v; void _s; } });
// @ts-expect-error a consumer needs a host before the context
new ContextConsumer(themeCtx);
// @ts-expect-error the request event takes the requesting element second
new ContextRequestEvent(themeCtx, (v: string) => v);
