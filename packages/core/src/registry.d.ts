import type { WebComponent } from './component.js';

export type WebComponentConstructor = typeof WebComponent;

export function register(tag: string, cls: WebComponentConstructor): void;
export function primeModuleUrl(tag: string, moduleUrl: string): void;
export function lookup(tag: string): WebComponentConstructor | undefined;
export function lookupModuleUrl(tag: string): string | undefined;
export function isLazy(tag: string): boolean;
export function tagOf(cls: WebComponentConstructor): string | undefined;
export function allTags(): string[];
