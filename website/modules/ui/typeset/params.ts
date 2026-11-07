/**
 * The typeset builder's state, ported from shadcn/ui's
 * apps/v4/app/(app)/(typeset)/lib/search-params.ts (#1666).
 *
 * The state IS the query string, with shadcn's param names, options and
 * defaults, so a link to a typeset is a link to /ui/typeset?body=lora&...
 * This module is pure (no DOM, no server-only import), so the page, the
 * preview route, the customizer element in the browser and the tests all
 * read one model.
 */
import { FONTS, findFont, fontStack } from './fonts.ts';

/** The 01 to 05 switch under the preview, in shadcn's order (its fixtures/index.ts). */
export const CONTENT_OPTIONS = [
  { value: 'docs', label: 'Docs' },
  { value: 'chat', label: 'Chat' },
  { value: 'article', label: 'Article' },
  { value: 'changelog', label: 'Changelog' },
  { value: 'notes', label: 'Notes' },
] as const;

export type ItemName = (typeof CONTENT_OPTIONS)[number]['value'];

export const TYPESET_SIZES = [
  { value: '14', label: '14px' },
  { value: '15', label: '15px' },
  { value: '16', label: '16px' },
  { value: '18', label: '18px' },
] as const;

export const TYPESET_LEADINGS = [
  { value: '1.6', label: 'Tight (1.6)' },
  { value: '1.75', label: 'Regular (1.75)' },
  { value: '1.9', label: 'Loose (1.9)' },
] as const;

export const TYPESET_FLOWS = [
  { value: '1em', label: 'Compact (1em)' },
  { value: '1.25em', label: 'Regular (1.25em)' },
  { value: '2em', label: 'Airy (2em)' },
] as const;

export const TYPESET_MEASURES = [
  { value: '60', label: '60ch', width: '28em' },
  { value: '70', label: '70ch', width: '33em' },
  { value: '80', label: '80ch', width: '37em' },
  { value: '90', label: '90ch', width: '42em' },
] as const;

export interface TypesetParams {
  body: string;
  heading: string;
  mono: string;
  scale: string;
  measure: string;
  flow: string;
  leading: string;
  item: ItemName;
}

export type TypesetParam = keyof TypesetParams;

/** Every param but the specimen switch, the ones the customizer edits. */
export type DesignParam = Exclude<TypesetParam, 'item'>;

/**
 * The one source of truth for what each param accepts, as shadcn's. A
 * function rather than a module-scope table: work at module scope would make
 * every page importing this module ship it to the browser.
 */
export function paramValues(key: TypesetParam): readonly string[] {
  switch (key) {
    case 'body':
    case 'mono':
      return FONTS.map((font) => font.id);
    case 'heading':
      return ['inherit', ...FONTS.map((font) => font.id)];
    case 'scale':
      return TYPESET_SIZES.map((option) => option.value);
    case 'measure':
      return TYPESET_MEASURES.map((option) => option.value);
    case 'flow':
      return TYPESET_FLOWS.map((option) => option.value);
    case 'leading':
      return TYPESET_LEADINGS.map((option) => option.value);
    case 'item':
      return CONTENT_OPTIONS.map((option) => option.value);
  }
}

export const DEFAULTS: TypesetParams = {
  body: 'geist',
  heading: 'inherit',
  mono: 'geist-mono',
  scale: '15',
  measure: '80',
  flow: '1.25em',
  leading: '1.75',
  item: 'docs',
};

/** The params in shadcn's serialization order. */
export const PARAM_KEYS: readonly TypesetParam[] = ['body', 'heading', 'mono', 'scale', 'measure', 'flow', 'leading', 'item'];

/** The value if the param accepts it, else null. */
export function coerce(key: TypesetParam, value: string | null | undefined): string | null {
  return value != null && paramValues(key).includes(value) ? value : null;
}

/** Read the params from a query string. An unknown or missing value is the default. */
export function parseParams(search: URLSearchParams | Record<string, string | string[] | undefined>): TypesetParams {
  const read = (key: string): string | null => {
    if (search instanceof URLSearchParams) return search.get(key);
    const raw = search[key];
    return Array.isArray(raw) ? raw[0] ?? null : raw ?? null;
  };
  const out = { ...DEFAULTS };
  for (const key of PARAM_KEYS) {
    const value = coerce(key, read(key));
    if (value !== null) (out as Record<TypesetParam, string>)[key] = value;
  }
  return out;
}

/**
 * The query string for a set of params, shadcn's nuqs serializer: a param at
 * its default is left out, so the defaults are the bare path.
 */
export function serializeParams(base: string, params: TypesetParams): string {
  const query = new URLSearchParams();
  for (const key of PARAM_KEYS) {
    if (params[key] !== DEFAULTS[key]) query.set(key, params[key]);
  }
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

/** The /ui/typeset URL for a set of params. */
export const builderHref = (params: TypesetParams) => serializeParams('/ui/typeset', params);

/** The bare preview URL for a set of params, the iframe's src. */
export const previewHref = (params: TypesetParams) => serializeParams(`/ui/preview/typeset/${params.item}`, params);

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

/**
 * A random type design, shadcn's useShuffle: fonts, size, measure and rhythm
 * change, the specimen stays, and a locked param keeps its value. Body and
 * heading draw from the non-mono faces, mono from the mono ones.
 */
export function shuffleParams(
  params: TypesetParams,
  locks: Iterable<DesignParam> = [],
  random: () => number = Math.random,
): TypesetParams {
  const bodyFonts = FONTS.filter((font) => font.type !== 'mono').map((font) => font.id);
  const monoFonts = FONTS.filter((font) => font.type === 'mono').map((font) => font.id);
  const next: TypesetParams = {
    ...params,
    body: pick(bodyFonts, random),
    heading: pick(['inherit', ...bodyFonts], random),
    mono: pick(monoFonts, random),
    scale: pick(paramValues('scale'), random),
    measure: pick(paramValues('measure'), random),
    leading: pick(paramValues('leading'), random),
    flow: pick(paramValues('flow'), random),
  };
  for (const key of locks) next[key] = params[key];
  return next;
}

/** The width a measure caps the preview at, in em (shadcn's table). */
export function measureWidth(measure: string): string {
  return TYPESET_MEASURES.find((option) => option.value === measure)?.width ?? '37em';
}

/** The font id the heading renders in: its own, or the body's for "inherit". */
export function headingFontId(params: TypesetParams): string {
  return params.heading === 'inherit' ? params.body : params.heading;
}

/**
 * The preview's custom properties, shadcn's previewValues(). The preview
 * route writes them on its root at SSR, and the builder rewrites the same
 * names in the iframe when a choice changes, so no reload is needed.
 */
export function previewVars(params: TypesetParams): Record<string, string> {
  const body = fontStack(findFont(params.body) ?? FONTS[0]);
  return {
    '--preview-size': `${params.scale}px`,
    '--preview-leading': params.leading,
    '--preview-flow': params.flow,
    '--preview-measure': measureWidth(params.measure),
    '--preview-font': body,
    '--preview-font-heading': fontStack(findFont(headingFontId(params)) ?? FONTS[0]),
    '--preview-font-mono': fontStack(findFont(params.mono) ?? FONTS[0]),
  };
}

/** The same, as an inline style attribute value. */
export function previewStyle(params: TypesetParams): string {
  return Object.entries(previewVars(params)).map(([name, value]) => `${name}: ${value}`).join('; ');
}
