import { nothing } from './sentinels.js';
export interface ClassMapDirective { readonly _$webjs: 'class-map'; readonly value: Record<string, unknown>; }
export interface StyleMapDirective { readonly _$webjs: 'style-map'; readonly value: Record<string, string | number | null | undefined>; }
export function classMap(classes: Record<string, unknown>): ClassMapDirective;
export function styleMap(styles: Record<string, string | number | null | undefined>): StyleMapDirective;
export function ifDefined<T>(value: T): NonNullable<T> | typeof nothing;
