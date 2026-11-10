export interface TemplateResult {
  _$webjs: 'template';
  strings: TemplateStringsArray | string[];
  values: unknown[];
  /** Set by the `svg` tag: the client parses the strings inside an `<svg>` wrapper. */
  svg?: boolean;
  /** Set by the `mathml` tag: the client parses the strings inside a `<math>` wrapper. */
  mathml?: boolean;
}

export function html(strings: TemplateStringsArray | string[], ...values: unknown[]): TemplateResult;
/** lit's `svg` tag: a fragment parsed as SVG on the client, rendered like `html` on the server. */
export function svg(strings: TemplateStringsArray | string[], ...values: unknown[]): TemplateResult;
/** lit's `mathml` tag: a fragment parsed as MathML on the client, rendered like `html` on the server. */
export function mathml(strings: TemplateStringsArray | string[], ...values: unknown[]): TemplateResult;
export function isTemplate(x: unknown): x is TemplateResult;
export const MARKER: 'wjm-';
