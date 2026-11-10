/** The value `css` and `unsafeCSS` return (Lit's `CSSResult`). */
export declare class CSSResult {
  private constructor(cssText: string);
  readonly _$webjsCss: true;
  /** The style text. */
  readonly cssText: string;
  /** The style text, an alias of `cssText`. */
  readonly text: string;
  /** A shared constructed stylesheet in the browser; undefined on the server. */
  readonly styleSheet: CSSStyleSheet | undefined;
  toString(): string;
}

/** A `css` result or a constructed stylesheet (Lit's `CSSResultOrNative`). */
export type CSSResultOrNative = CSSResult | CSSStyleSheet;

/** Arbitrarily nested arrays of styles (Lit's `CSSResultArray`). */
export interface CSSResultArray extends Array<CSSResultOrNative | CSSResultArray> {}

/** What `static styles` accepts (Lit's `CSSResultGroup`). */
export type CSSResultGroup = CSSResultOrNative | CSSResultArray;

/**
 * Tagged template producing a `CSSResult`. A hole may hold another `css`
 * result or a number; anything else throws (wrap a trusted string in
 * `unsafeCSS()`).
 */
export function css(strings: TemplateStringsArray | string[], ...values: (CSSResult | number)[]): CSSResult;
/** Wrap a trusted string as a `CSSResult`. Never pass user input. */
export function unsafeCSS(value: unknown): CSSResult;
export function isCSS(x: unknown): x is CSSResult;
/** Flatten `static styles` into the list both renderers apply (Lit's `finalizeStyles`). */
export function finalizeStyles(styles?: CSSResultGroup | null): CSSResultOrNative[];
export function adoptStyles(root: ShadowRoot | Document, styles: CSSResultOrNative[]): void;
export function stylesToString(styles: CSSResultOrNative[]): string;
