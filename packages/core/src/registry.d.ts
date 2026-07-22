import type { WebComponentConstructor, WebComponentInstanceConstructor } from './component.d.ts';

// Re-exported for `@webjsdev/core/registry` consumers; it is the type of the
// `WebComponent` const itself (class + factory dual).
export type { WebComponentConstructor };

// `register` / `lookup` / `tagOf` deal in ordinary component classes, which are
// NOT assignable to the class+factory `WebComponentConstructor` (a plain class is
// not callable as a factory). They type against the instance-constructor shape so
// a user's `class X extends WebComponent({…})` is accepted (#1033).
export function register(tag: string, cls: WebComponentInstanceConstructor): void;
export function primeModuleUrl(tag: string, moduleUrl: string): void;
export function lookup(tag: string): WebComponentInstanceConstructor | undefined;
export function lookupModuleUrl(tag: string): string | undefined;
export function isLazy(tag: string): boolean;
export function tagOf(cls: WebComponentInstanceConstructor): string | undefined;
export function allTags(): string[];
