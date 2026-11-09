/** Lit's default attribute converter, as `lit` exports it. */
export declare const defaultConverter: {
  toAttribute(value: unknown, type?: unknown): unknown;
  fromAttribute(value: string | null, type?: unknown): unknown;
};
/** Lit's default `hasChanged`: true when `value` and `old` differ by `Object.is`. */
export declare const notEqual: (value: unknown, old: unknown) => boolean;
