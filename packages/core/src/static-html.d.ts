import type { TemplateResult } from './html.js';

/** A value spliced into a template's strings (lit's `StaticValue`). */
export interface StaticValue {
  readonly _$webjsStatic: string;
  readonly r: symbol;
}

/** lit's `unsafeStatic`: trusted text inserted as static markup. NEVER user input. */
export function unsafeStatic(value: string): StaticValue;
/** lit's `literal`: a static value whose interpolations must themselves be static. */
export function literal(strings: TemplateStringsArray, ...values: unknown[]): StaticValue;
/** lit's `withStatic`: wrap a template tag so it accepts static values. */
export function withStatic<R>(
  coreTag: (strings: TemplateStringsArray | string[], ...values: unknown[]) => R,
): (strings: TemplateStringsArray | string[], ...values: unknown[]) => R;
/** `html` that accepts `literal` / `unsafeStatic` values in any position. */
export function html(strings: TemplateStringsArray | string[], ...values: unknown[]): TemplateResult;
/** `svg` that accepts static values. */
export function svg(strings: TemplateStringsArray | string[], ...values: unknown[]): TemplateResult;
/** `mathml` that accepts static values. */
export function mathml(strings: TemplateStringsArray | string[], ...values: unknown[]): TemplateResult;
