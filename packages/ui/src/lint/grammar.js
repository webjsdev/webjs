/**
 * The class grammar behind `webjsui lint`: how one Tailwind token is parsed,
 * which class GROUP it belongs to, and which appearance CATEGORY that group
 * maps to.
 *
 * `GROUP_CATEGORY` is a verbatim transcription of `packages/lint/src/grammar/
 * categories.ts` from `shadcn-ui/lint` (https://github.com/shadcn-ui/lint),
 * same group ids in the same order, so it can be diffed against upstream. The
 * taxonomy is adopted as-is on purpose: `@webjsdev/ui` exists for shadcn
 * parity, and a WebJs-local redefinition would make `allow: ["layout"]` mean
 * two different things in two tools an agent runs side by side. Two placements
 * are counterintuitive and both are shadcn's: padding is `spacing` and margin
 * is layout (`null`).
 *
 * `groupOf(utility)` is WebJs's own resolver from a utility to one of those
 * group ids. It is a prefix table rather than `tailwind-merge`'s config, which
 * the linter deliberately does not depend on (a runtime dependency for a
 * dev-time analysis). A utility it cannot place resolves to `null`, which is
 * layout, the permissive direction.
 *
 * @module lint/grammar
 */

/** @type {Record<string, 'color'|'typography'|'spacing'|'shape'|'effects'|'motion'|null>} */
export const GROUP_CATEGORY = {
  aspect: null,
  container: null,
  'container-type': null,
  'container-named': null,
  contain: null,
  'contain-size': null,
  'contain-layout': null,
  'contain-paint': null,
  'contain-style': null,
  columns: null,
  'break-after': null,
  'break-before': null,
  'break-inside': null,
  'box-decoration': null,
  box: null,
  display: null,
  sr: null,
  float: null,
  clear: null,
  isolation: null,
  'object-fit': null,
  'object-position': null,
  overflow: null,
  'overflow-x': null,
  'overflow-y': null,
  overscroll: null,
  'overscroll-x': null,
  'overscroll-y': null,
  position: null,
  inset: null,
  'inset-x': null,
  'inset-y': null,
  start: null,
  end: null,
  'inset-bs': null,
  'inset-be': null,
  top: null,
  right: null,
  bottom: null,
  left: null,
  visibility: null,
  z: null,
  basis: null,
  'flex-direction': null,
  'flex-wrap': null,
  flex: null,
  grow: null,
  shrink: null,
  order: null,
  'grid-cols': null,
  'col-start-end': null,
  'col-start': null,
  'col-end': null,
  'grid-rows': null,
  'row-start-end': null,
  'row-start': null,
  'row-end': null,
  'grid-flow': null,
  'auto-cols': null,
  'auto-rows': null,
  gap: 'spacing',
  'gap-x': 'spacing',
  'gap-y': 'spacing',
  'justify-content': null,
  'justify-items': null,
  'justify-self': null,
  'align-content': null,
  'align-items': null,
  'align-self': null,
  'place-content': null,
  'place-items': null,
  'place-self': null,
  p: 'spacing',
  px: 'spacing',
  py: 'spacing',
  ps: 'spacing',
  pe: 'spacing',
  pbs: 'spacing',
  pbe: 'spacing',
  pt: 'spacing',
  pr: 'spacing',
  pb: 'spacing',
  pl: 'spacing',
  m: null,
  mx: null,
  my: null,
  ms: null,
  me: null,
  mbs: null,
  mbe: null,
  mt: null,
  mr: null,
  mb: null,
  ml: null,
  'space-x': 'spacing',
  'space-x-reverse': 'spacing',
  'space-y': 'spacing',
  'space-y-reverse': 'spacing',
  size: null,
  'inline-size': null,
  'min-inline-size': null,
  'max-inline-size': null,
  'block-size': null,
  'min-block-size': null,
  'max-block-size': null,
  w: null,
  'min-w': null,
  'max-w': null,
  h: null,
  'min-h': null,
  'max-h': null,
  'font-size': 'typography',
  'font-smoothing': 'typography',
  'font-style': 'typography',
  'font-weight': 'typography',
  'font-stretch': 'typography',
  'font-family': 'typography',
  'font-features': 'typography',
  'fvn-normal': 'typography',
  'fvn-ordinal': 'typography',
  'fvn-slashed-zero': 'typography',
  'fvn-figure': 'typography',
  'fvn-spacing': 'typography',
  'fvn-fraction': 'typography',
  tracking: 'typography',
  'line-clamp': 'typography',
  leading: 'typography',
  'list-image': 'typography',
  'list-style-position': 'typography',
  'list-style-type': 'typography',
  'text-alignment': null,
  'placeholder-color': 'color',
  'text-color': 'color',
  'text-decoration': 'typography',
  'text-decoration-style': 'typography',
  'text-decoration-thickness': 'typography',
  'text-decoration-color': 'color',
  'underline-offset': 'typography',
  'text-transform': 'typography',
  'text-overflow': 'typography',
  'text-wrap': 'typography',
  indent: 'typography',
  'tab-size': null,
  'vertical-align': null,
  whitespace: null,
  break: null,
  wrap: null,
  hyphens: 'typography',
  content: null,
  'bg-attachment': 'effects',
  'bg-clip': 'effects',
  'bg-origin': 'effects',
  'bg-position': 'effects',
  'bg-repeat': 'effects',
  'bg-size': 'effects',
  'bg-image': 'effects',
  'bg-color': 'color',
  'gradient-from-pos': 'effects',
  'gradient-via-pos': 'effects',
  'gradient-to-pos': 'effects',
  'gradient-from': 'color',
  'gradient-via': 'color',
  'gradient-to': 'color',
  rounded: 'shape',
  'rounded-s': 'shape',
  'rounded-e': 'shape',
  'rounded-t': 'shape',
  'rounded-r': 'shape',
  'rounded-b': 'shape',
  'rounded-l': 'shape',
  'rounded-ss': 'shape',
  'rounded-se': 'shape',
  'rounded-ee': 'shape',
  'rounded-es': 'shape',
  'rounded-tl': 'shape',
  'rounded-tr': 'shape',
  'rounded-br': 'shape',
  'rounded-bl': 'shape',
  'border-w': 'shape',
  'border-w-x': 'shape',
  'border-w-y': 'shape',
  'border-w-s': 'shape',
  'border-w-e': 'shape',
  'border-w-bs': 'shape',
  'border-w-be': 'shape',
  'border-w-t': 'shape',
  'border-w-r': 'shape',
  'border-w-b': 'shape',
  'border-w-l': 'shape',
  'divide-x': 'shape',
  'divide-x-reverse': 'shape',
  'divide-y': 'shape',
  'divide-y-reverse': 'shape',
  'border-style': 'shape',
  'divide-style': 'shape',
  'border-color': 'color',
  'border-color-x': 'color',
  'border-color-y': 'color',
  'border-color-s': 'color',
  'border-color-e': 'color',
  'border-color-bs': 'color',
  'border-color-be': 'color',
  'border-color-t': 'color',
  'border-color-r': 'color',
  'border-color-b': 'color',
  'border-color-l': 'color',
  'divide-color': 'color',
  'outline-style': 'shape',
  'outline-offset': 'shape',
  'outline-w': 'shape',
  'outline-color': 'color',
  shadow: 'effects',
  'shadow-color': 'color',
  'inset-shadow': 'effects',
  'inset-shadow-color': 'color',
  'ring-w': 'shape',
  'ring-w-inset': 'shape',
  'ring-color': 'color',
  'ring-offset-w': 'shape',
  'ring-offset-color': 'color',
  'inset-ring-w': 'shape',
  'inset-ring-color': 'color',
  'text-shadow': 'effects',
  'text-shadow-color': 'color',
  opacity: 'effects',
  'mix-blend': 'effects',
  'bg-blend': 'effects',
  'mask-clip': 'effects',
  'mask-composite': 'effects',
  'mask-image-linear-pos': 'effects',
  'mask-image-linear-from-pos': 'effects',
  'mask-image-linear-to-pos': 'effects',
  'mask-image-linear-from-color': 'color',
  'mask-image-linear-to-color': 'color',
  'mask-image-t-from-pos': 'effects',
  'mask-image-t-to-pos': 'effects',
  'mask-image-t-from-color': 'color',
  'mask-image-t-to-color': 'color',
  'mask-image-r-from-pos': 'effects',
  'mask-image-r-to-pos': 'effects',
  'mask-image-r-from-color': 'color',
  'mask-image-r-to-color': 'color',
  'mask-image-b-from-pos': 'effects',
  'mask-image-b-to-pos': 'effects',
  'mask-image-b-from-color': 'color',
  'mask-image-b-to-color': 'color',
  'mask-image-l-from-pos': 'effects',
  'mask-image-l-to-pos': 'effects',
  'mask-image-l-from-color': 'color',
  'mask-image-l-to-color': 'color',
  'mask-image-x-from-pos': 'effects',
  'mask-image-x-to-pos': 'effects',
  'mask-image-x-from-color': 'color',
  'mask-image-x-to-color': 'color',
  'mask-image-y-from-pos': 'effects',
  'mask-image-y-to-pos': 'effects',
  'mask-image-y-from-color': 'color',
  'mask-image-y-to-color': 'color',
  'mask-image-radial': 'effects',
  'mask-image-radial-from-pos': 'effects',
  'mask-image-radial-to-pos': 'effects',
  'mask-image-radial-from-color': 'color',
  'mask-image-radial-to-color': 'color',
  'mask-image-radial-shape': 'effects',
  'mask-image-radial-size': 'effects',
  'mask-image-radial-pos': 'effects',
  'mask-image-conic-pos': 'effects',
  'mask-image-conic-from-pos': 'effects',
  'mask-image-conic-to-pos': 'effects',
  'mask-image-conic-from-color': 'color',
  'mask-image-conic-to-color': 'color',
  'mask-mode': 'effects',
  'mask-origin': 'effects',
  'mask-position': 'effects',
  'mask-repeat': 'effects',
  'mask-size': 'effects',
  'mask-type': 'effects',
  'mask-image': 'effects',
  filter: 'effects',
  blur: 'effects',
  brightness: 'effects',
  contrast: 'effects',
  'drop-shadow': 'effects',
  'drop-shadow-color': 'color',
  grayscale: 'effects',
  'hue-rotate': 'effects',
  invert: 'effects',
  saturate: 'effects',
  sepia: 'effects',
  'backdrop-filter': 'effects',
  'backdrop-blur': 'effects',
  'backdrop-brightness': 'effects',
  'backdrop-contrast': 'effects',
  'backdrop-grayscale': 'effects',
  'backdrop-hue-rotate': 'effects',
  'backdrop-invert': 'effects',
  'backdrop-opacity': 'effects',
  'backdrop-saturate': 'effects',
  'backdrop-sepia': 'effects',
  'border-collapse': null,
  'border-spacing': 'spacing',
  'border-spacing-x': 'spacing',
  'border-spacing-y': 'spacing',
  'table-layout': null,
  caption: null,
  transition: 'motion',
  'transition-behavior': 'motion',
  duration: 'motion',
  ease: 'motion',
  delay: 'motion',
  animate: 'motion',
  backface: null,
  perspective: null,
  'perspective-origin': null,
  rotate: null,
  'rotate-x': null,
  'rotate-y': null,
  'rotate-z': null,
  scale: null,
  'scale-x': null,
  'scale-y': null,
  'scale-z': null,
  'scale-3d': null,
  skew: null,
  'skew-x': null,
  'skew-y': null,
  transform: null,
  'transform-origin': null,
  'transform-style': null,
  translate: null,
  'translate-x': null,
  'translate-y': null,
  'translate-z': null,
  'translate-none': null,
  zoom: null,
  accent: 'color',
  appearance: null,
  'caret-color': 'color',
  'color-scheme': null,
  cursor: null,
  'field-sizing': null,
  'pointer-events': null,
  resize: null,
  'scroll-behavior': null,
  'scrollbar-thumb-color': 'color',
  'scrollbar-track-color': 'color',
  'scrollbar-gutter': null,
  'scrollbar-w': null,
  'scroll-m': null,
  'scroll-mx': null,
  'scroll-my': null,
  'scroll-ms': null,
  'scroll-me': null,
  'scroll-mbs': null,
  'scroll-mbe': null,
  'scroll-mt': null,
  'scroll-mr': null,
  'scroll-mb': null,
  'scroll-ml': null,
  'scroll-p': null,
  'scroll-px': null,
  'scroll-py': null,
  'scroll-ps': null,
  'scroll-pe': null,
  'scroll-pbs': null,
  'scroll-pbe': null,
  'scroll-pt': null,
  'scroll-pr': null,
  'scroll-pb': null,
  'scroll-pl': null,
  'snap-align': null,
  'snap-stop': null,
  'snap-type': null,
  'snap-strictness': null,
  touch: null,
  'touch-x': null,
  'touch-y': null,
  'touch-pz': null,
  select: null,
  'will-change': null,
  fill: 'color',
  'stroke-w': 'shape',
  stroke: 'color',
  'forced-color-adjust': null,
};

/**
 * Arbitrary properties (`[color:red]`) are categorized by CSS property name
 * instead, first match winning (upstream: `ARBITRARY_PROPERTY_RULES`).
 * @type {Array<[RegExp, 'color'|'typography'|'spacing'|'shape'|'effects'|'motion']>}
 */
const ARBITRARY_PROPERTY_RULES = [
  [/(?:^|-)color$|^(?:background|fill|stroke|--tw-(?:gradient-(?:from|via|to)|shadow-color|ring-color|inset-ring-color|inset-shadow-color)|--tw-.*-color)$/, 'color'],
  [/^(?:padding|gap$|row-gap$|column-gap$)/, 'spacing'],
  [/^(?:font|letter-spacing$|line-height$|text-decoration|text-transform$|text-indent$|text-underline|word-spacing$|list-style)/, 'typography'],
  [/^(?:border(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?(?:-(?:width|style|radius))?$|border-.*-radius$|outline|--tw-ring-width$|--tw-ring-inset$)/, 'shape'],
  [/^(?:box-shadow|text-shadow|opacity|filter|backdrop-filter|mix-blend-mode|background-blend-mode|--tw-(?:shadow|inset-shadow|drop-shadow|blur|brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia|backdrop-.*)$)/, 'effects'],
  [/^(?:transition|animation|--tw-(?:duration|ease|delay)$)/, 'motion'],
];

const ARBITRARY_PREFIX = 'arbitrary..';

export const CATEGORIES = ['color', 'typography', 'spacing', 'shape', 'effects', 'motion'];

/**
 * The appearance category of a group id (`null` is layout).
 * @param {string|null} groupId
 */
export function categoryOf(groupId) {
  if (groupId === null) return null;
  if (groupId.startsWith(ARBITRARY_PREFIX)) {
    const property = groupId.slice(ARBITRARY_PREFIX.length);
    for (const [pattern, category] of ARBITRARY_PROPERTY_RULES) if (pattern.test(property)) return category;
    return null;
  }
  return GROUP_CATEGORY[groupId] ?? null;
}

// ---------------------------------------------------------------------------
// Utility -> group resolution
// ---------------------------------------------------------------------------

const T_SHIRT = /^(?:\d*xs|sm|md|lg|\d*xl)$/;
const NUMERIC = /^-?\d+(?:\.\d+)?$/;
const FRACTION = /^\d+\/\d+$/;
const LENGTH_HINT = /^(?:length|size|percentage|number):/;
const COLOR_HINT = /^color:/;
const COLOR_VALUE = /^(?:#|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|color\(|color-mix\(|var\(--color|--color-)/;

/** `[...]` or `(...)` shorthand inner text, or null when the value is neither. */
function arbitraryInner(value) {
  if (value.startsWith('[') && value.endsWith(']')) return value.slice(1, -1);
  if (value.startsWith('(') && value.endsWith(')')) return value.slice(1, -1);
  return null;
}

/** Whether an arbitrary value reads as a colour (a hint, a colour function or a colour variable). */
function isArbitraryColor(value) {
  const inner = arbitraryInner(value);
  if (inner === null) return false;
  return COLOR_HINT.test(inner) || COLOR_VALUE.test(inner);
}

/** Whether an arbitrary value reads as a length / number (the non-colour direction). */
function isArbitraryLength(value) {
  const inner = arbitraryInner(value);
  if (inner === null) return false;
  if (LENGTH_HINT.test(inner)) return true;
  if (COLOR_HINT.test(inner) || COLOR_VALUE.test(inner)) return false;
  return /^(?:-?\d|calc\(|min\(|max\(|clamp\(|var\()/.test(inner);
}

function isNumberish(value) {
  return NUMERIC.test(value) || FRACTION.test(value) || value === 'px' || value === 'full' || value === 'auto';
}

/**
 * Split `utility` at its first `-` into `[head, rest]` where `head` is the
 * longest prefix in `heads`. Returns null when no head matches.
 * @param {string} utility
 * @param {string[]} heads
 */
function splitHead(utility, heads) {
  for (const h of heads) {
    if (utility === h) return [h, ''];
    if (utility.startsWith(h + '-')) return [h, utility.slice(h.length + 1)];
  }
  return null;
}

/** Groups that take `<prefix>` or `<prefix>-<value>` and need no value disambiguation. Longest first. */
const SIMPLE_GROUPS = [
  'container-type', 'contain', 'columns', 'break-after', 'break-before', 'break-inside', 'box-decoration',
  'overflow-x', 'overflow-y', 'overflow', 'overscroll-x', 'overscroll-y', 'overscroll',
  'inset-x', 'inset-y', 'inset-bs', 'inset-be', 'inset', 'start', 'end', 'top', 'right', 'bottom', 'left', 'z',
  'basis', 'grow', 'shrink', 'order', 'grid-cols', 'grid-rows', 'grid-flow', 'auto-cols', 'auto-rows',
  'gap-x', 'gap-y', 'gap',
  'justify-items', 'justify-self', 'place-content', 'place-items', 'place-self',
  'px', 'py', 'ps', 'pe', 'pbs', 'pbe', 'pt', 'pr', 'pb', 'pl', 'p',
  'mx', 'my', 'ms', 'me', 'mbs', 'mbe', 'mt', 'mr', 'mb', 'ml', 'm',
  'space-x-reverse', 'space-y-reverse', 'space-x', 'space-y',
  'size', 'min-inline-size', 'max-inline-size', 'inline-size', 'min-block-size', 'max-block-size', 'block-size',
  'min-w', 'max-w', 'w', 'min-h', 'max-h', 'h',
  'font-stretch', 'tracking', 'line-clamp', 'leading', 'underline-offset', 'indent', 'tab-size', 'whitespace', 'hyphens',
  'gradient-from-pos', 'gradient-via-pos', 'gradient-to-pos',
  'outline-offset', 'opacity', 'mix-blend', 'bg-blend',
  'blur', 'brightness', 'contrast', 'grayscale', 'hue-rotate', 'invert', 'saturate', 'sepia',
  'backdrop-blur', 'backdrop-brightness', 'backdrop-contrast', 'backdrop-grayscale', 'backdrop-hue-rotate',
  'backdrop-invert', 'backdrop-opacity', 'backdrop-saturate', 'backdrop-sepia', 'backdrop-filter',
  'border-spacing-x', 'border-spacing-y', 'border-spacing', 'caption',
  'transition-behavior', 'transition', 'duration', 'ease', 'delay', 'animate',
  'backface', 'perspective-origin', 'perspective',
  'rotate-x', 'rotate-y', 'rotate-z', 'rotate', 'scale-3d', 'scale-x', 'scale-y', 'scale-z', 'scale',
  'skew-x', 'skew-y', 'skew', 'translate-none', 'translate-x', 'translate-y', 'translate-z', 'translate', 'zoom',
  'accent', 'appearance', 'cursor', 'field-sizing', 'pointer-events', 'resize', 'scroll-behavior',
  'scrollbar-gutter', 'scrollbar-w',
  'scroll-mx', 'scroll-my', 'scroll-ms', 'scroll-me', 'scroll-mbs', 'scroll-mbe', 'scroll-mt', 'scroll-mr', 'scroll-mb', 'scroll-ml', 'scroll-m',
  'scroll-px', 'scroll-py', 'scroll-ps', 'scroll-pe', 'scroll-pbs', 'scroll-pbe', 'scroll-pt', 'scroll-pr', 'scroll-pb', 'scroll-pl', 'scroll-p',
  'snap-align', 'snap-stop', 'snap-type', 'snap-strictness', 'touch-x', 'touch-y', 'touch-pz', 'touch',
  'select', 'will-change', 'forced-color-adjust', 'aspect', 'container', 'float', 'clear', 'filter',
  'mask-clip', 'mask-composite', 'mask-mode', 'mask-origin', 'mask-position', 'mask-repeat', 'mask-size', 'mask-type',
  'placeholder', 'caret', 'fill', 'stroke',
];

const DISPLAY = new Set(['block', 'inline-block', 'inline', 'flex', 'inline-flex', 'table', 'inline-table',
  'table-caption', 'table-cell', 'table-column', 'table-column-group', 'table-footer-group', 'table-header-group',
  'table-row-group', 'table-row', 'flow-root', 'grid', 'inline-grid', 'contents', 'list-item', 'hidden']);
const POSITION = new Set(['static', 'fixed', 'absolute', 'relative', 'sticky']);
const KEYWORDS = {
  'sr-only': 'sr', 'not-sr-only': 'sr', isolate: 'isolation', 'isolation-auto': 'isolation',
  visible: 'visibility', invisible: 'visibility', collapse: 'visibility',
  'box-border': 'box', 'box-content': 'box',
  italic: 'font-style', 'not-italic': 'font-style', antialiased: 'font-smoothing', 'subpixel-antialiased': 'font-smoothing',
  'normal-nums': 'fvn-normal', ordinal: 'fvn-ordinal', 'slashed-zero': 'fvn-slashed-zero',
  'lining-nums': 'fvn-figure', 'oldstyle-nums': 'fvn-figure', 'proportional-nums': 'fvn-spacing', 'tabular-nums': 'fvn-spacing',
  'diagonal-fractions': 'fvn-fraction', 'stacked-fractions': 'fvn-fraction',
  underline: 'text-decoration', overline: 'text-decoration', 'line-through': 'text-decoration', 'no-underline': 'text-decoration',
  uppercase: 'text-transform', lowercase: 'text-transform', capitalize: 'text-transform', 'normal-case': 'text-transform',
  truncate: 'text-overflow', 'break-normal': 'break', 'break-words': 'break', 'break-all': 'break', 'break-keep': 'break',
  'border-collapse': 'border-collapse', 'border-separate': 'border-collapse',
  'table-auto': 'table-layout', 'table-fixed': 'table-layout',
  'transform-none': 'transform', 'transform-gpu': 'transform', 'transform-cpu': 'transform',
  'ring-inset': 'ring-w-inset', 'flex-wrap': 'flex-wrap', 'flex-nowrap': 'flex-wrap', 'flex-wrap-reverse': 'flex-wrap',
  'flex-row': 'flex-direction', 'flex-row-reverse': 'flex-direction', 'flex-col': 'flex-direction', 'flex-col-reverse': 'flex-direction',
};
const BORDER_STYLES = new Set(['solid', 'dashed', 'dotted', 'double', 'hidden', 'none']);
const RADIUS_SIDES = ['ss', 'se', 'ee', 'es', 'tl', 'tr', 'br', 'bl', 's', 'e', 't', 'r', 'b', 'l'];
const BORDER_SIDES = ['bs', 'be', 'x', 'y', 's', 'e', 't', 'r', 'b', 'l'];
const SHADOW_SIZES = /^(?:none|2xs|xs|sm|md|lg|xl|2xl|inner)$/;

/**
 * Resolve a utility (variants, negative, important and opacity already
 * stripped) to a class-group id, or `null` for one the table cannot place.
 * @param {string} utility
 * @returns {string|null}
 */
export function groupOf(utility) {
  if (!utility) return null;
  // Arbitrary property: `[padding:13px]`.
  if (utility.startsWith('[') && utility.endsWith(']')) {
    const colon = utility.indexOf(':');
    if (colon > 1) return ARBITRARY_PREFIX + utility.slice(1, colon);
    return null;
  }
  if (DISPLAY.has(utility)) return 'display';
  if (POSITION.has(utility)) return 'position';
  if (Object.hasOwn(KEYWORDS, utility)) return KEYWORDS[utility];

  let s;
  // text-*
  if ((s = splitHead(utility, ['text']))) {
    const v = s[1];
    if (/^(?:left|center|right|justify|start|end)$/.test(v)) return 'text-alignment';
    if (/^(?:wrap|nowrap|balance|pretty)$/.test(v)) return 'text-wrap';
    if (/^(?:ellipsis|clip)$/.test(v)) return 'text-overflow';
    if (v === 'base' || T_SHIRT.test(v) || isArbitraryLength(v)) return 'font-size';
    if (/^(?:base|xs|sm|lg|\dxl|xl)\/[\w.]+$/.test(v)) return 'font-size';
    return 'text-color';
  }
  if ((s = splitHead(utility, ['text-shadow']))) {
    const v = s[1];
    if (v === '' || SHADOW_SIZES.test(v) || isArbitraryLength(v)) return 'text-shadow';
    return 'text-shadow-color';
  }
  // font-*
  if ((s = splitHead(utility, ['font']))) {
    const v = s[1];
    if (/^(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(v) || NUMERIC.test(v)) return 'font-weight';
    if (arbitraryInner(v)?.startsWith('weight:') || (arbitraryInner(v) && NUMERIC.test(arbitraryInner(v)))) return 'font-weight';
    return 'font-family';
  }
  // bg-*
  if ((s = splitHead(utility, ['bg']))) {
    const v = s[1];
    if (/^(?:fixed|local|scroll)$/.test(v)) return 'bg-attachment';
    if (/^clip-/.test(v)) return 'bg-clip';
    if (/^origin-/.test(v)) return 'bg-origin';
    if (/^(?:top|bottom|left|right|center)(?:-(?:top|bottom|left|right))?$/.test(v) || /^position-/.test(v)) return 'bg-position';
    if (/^(?:repeat|no-repeat|repeat-x|repeat-y|repeat-round|repeat-space)$/.test(v)) return 'bg-repeat';
    if (/^(?:auto|cover|contain)$/.test(v) || /^size-/.test(v)) return 'bg-size';
    if (v === 'none' || /^(?:linear|radial|conic|gradient)-/.test(v)) return 'bg-image';
    const inner = arbitraryInner(v);
    if (inner !== null && /^(?:url\(|image:|linear-gradient|radial-gradient|conic-gradient)/.test(inner)) return 'bg-image';
    return 'bg-color';
  }
  // gradient stops
  for (const stop of ['from', 'via', 'to']) {
    if ((s = splitHead(utility, [stop]))) {
      const v = s[1];
      if (/^\d+%$/.test(v) || NUMERIC.test(v) || isArbitraryLength(v)) return `gradient-${stop}-pos`;
      return `gradient-${stop}`;
    }
  }
  // rounded
  if ((s = splitHead(utility, ['rounded']))) {
    const v = s[1];
    if (v === '') return 'rounded';
    const side = RADIUS_SIDES.find((x) => v === x || v.startsWith(x + '-'));
    return side ? `rounded-${side}` : 'rounded';
  }
  // border
  if ((s = splitHead(utility, ['border']))) {
    const v = s[1];
    if (v === '') return 'border-w';
    if (BORDER_STYLES.has(v)) return 'border-style';
    if (v === 'collapse' || v === 'separate') return 'border-collapse';
    if (v.startsWith('spacing')) return v === 'spacing' ? 'border-spacing' : `border-spacing-${v.slice(8)}`;
    const side = BORDER_SIDES.find((x) => v === x || v.startsWith(x + '-'));
    const rest = side ? v.slice(side.length + 1) : v;
    const suffix = side ? `-${side}` : '';
    if (rest === '' || NUMERIC.test(rest) || isArbitraryLength(rest)) return `border-w${suffix}`;
    if (BORDER_STYLES.has(rest)) return 'border-style';
    return `border-color${suffix}`;
  }
  // divide
  if ((s = splitHead(utility, ['divide']))) {
    const v = s[1];
    if (/^(?:x|y)(?:-reverse)?$/.test(v) || /^(?:x|y)-/.test(v)) {
      const axis = v[0];
      if (v.endsWith('-reverse')) return `divide-${axis}-reverse`;
      return `divide-${axis}`;
    }
    if (BORDER_STYLES.has(v)) return 'divide-style';
    return 'divide-color';
  }
  // outline
  if ((s = splitHead(utility, ['outline']))) {
    const v = s[1];
    if (v === '' || NUMERIC.test(v) || isArbitraryLength(v)) return 'outline-w';
    if (BORDER_STYLES.has(v)) return 'outline-style';
    if (v.startsWith('offset')) return 'outline-offset';
    return 'outline-color';
  }
  // ring / inset-ring
  for (const [head, group] of [['inset-ring', 'inset-ring'], ['ring', 'ring']]) {
    if ((s = splitHead(utility, [head]))) {
      const v = s[1];
      if (head === 'ring' && v.startsWith('offset')) {
        const rest = v.slice(6).replace(/^-/, '');
        return rest === '' || NUMERIC.test(rest) || isArbitraryLength(rest) ? 'ring-offset-w' : 'ring-offset-color';
      }
      if (v === '' || NUMERIC.test(v) || isArbitraryLength(v)) return `${group}-w`;
      return `${group}-color`;
    }
  }
  // shadow / inset-shadow / drop-shadow
  for (const head of ['inset-shadow', 'drop-shadow', 'shadow']) {
    if ((s = splitHead(utility, [head]))) {
      const v = s[1];
      if (v === '' || SHADOW_SIZES.test(v) || (arbitraryInner(v) !== null && !isArbitraryColor(v))) return head;
      return `${head}-color`;
    }
  }
  // decoration
  if ((s = splitHead(utility, ['decoration']))) {
    const v = s[1];
    if (/^(?:solid|double|dotted|dashed|wavy)$/.test(v)) return 'text-decoration-style';
    if (/^(?:auto|from-font)$/.test(v) || NUMERIC.test(v) || isArbitraryLength(v)) return 'text-decoration-thickness';
    return 'text-decoration-color';
  }
  // stroke width vs colour
  if ((s = splitHead(utility, ['stroke']))) {
    const v = s[1];
    if (NUMERIC.test(v) || isArbitraryLength(v)) return 'stroke-w';
    return 'stroke';
  }
  if (utility.startsWith('placeholder-')) return 'placeholder-color';
  if (utility.startsWith('caret-')) return 'caret-color';
  if (utility.startsWith('scheme-')) return 'color-scheme';
  if (utility.startsWith('list-')) {
    const v = utility.slice(5);
    if (v === 'inside' || v === 'outside') return 'list-style-position';
    if (v.startsWith('image-')) return 'list-image';
    return 'list-style-type';
  }
  if (utility.startsWith('object-')) {
    return /^object-(?:contain|cover|fill|none|scale-down)$/.test(utility) ? 'object-fit' : 'object-position';
  }
  if (utility.startsWith('justify-')) return 'justify-content';
  if (utility.startsWith('items-')) return 'align-items';
  if (utility.startsWith('self-')) return 'align-self';
  if (utility.startsWith('content-')) {
    return /^content-(?:normal|center|start|end|between|around|evenly|baseline|stretch)$/.test(utility) ? 'align-content' : 'content';
  }
  if (utility.startsWith('align-')) return 'vertical-align';
  if (utility.startsWith('wrap-')) return 'wrap';
  if (utility.startsWith('origin-')) return 'transform-origin';
  if (utility.startsWith('transform-')) return 'transform-style';
  if (utility === 'transform') return 'transform';
  if (utility.startsWith('col-')) {
    if (utility.startsWith('col-start-')) return 'col-start';
    if (utility.startsWith('col-end-')) return 'col-end';
    return 'col-start-end';
  }
  if (utility.startsWith('row-')) {
    if (utility.startsWith('row-start-')) return 'row-start';
    if (utility.startsWith('row-end-')) return 'row-end';
    return 'row-start-end';
  }
  if ((s = splitHead(utility, ['flex']))) {
    // `flex` alone is display (handled above); `flex-1` / `flex-auto` / `flex-[..]` is the flex shorthand.
    return 'flex';
  }
  if (utility.startsWith('mask-')) return 'mask-image';
  if (utility.startsWith('scrollbar-')) return utility.includes('thumb') ? 'scrollbar-thumb-color' : 'scrollbar-track-color';
  if ((s = splitHead(utility, SIMPLE_GROUPS))) {
    if (s[0] === 'placeholder') return 'placeholder-color';
    if (s[0] === 'caret') return 'caret-color';
    return s[0];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Token parsing
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   raw: string, variants: string[], utility: string, base: string,
 *   group: string|null, category: string|null,
 *   arbitraryValue: boolean, negative: boolean, important: boolean,
 *   opacity: string|null,
 * }} ParsedClass
 */

/** Split `s` on `sep` at bracket and paren depth zero. */
function splitTopLevel(s, sep) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '[' || c === '(') depth++;
    else if (c === ']' || c === ')') depth = Math.max(0, depth - 1);
    if (c === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * Parse one class token. Variants are every top-level `:` segment but the last;
 * the last is the utility. A token is an arbitrary VALUE when, and only when,
 * its utility segment contains a `[`, so `[&_svg]:size-4` (an arbitrary
 * variant) is not one and `[padding:13px]` (an arbitrary property) is.
 *
 * @param {string} token
 * @returns {ParsedClass}
 */
export function parseToken(token) {
  const segments = splitTopLevel(token, ':');
  let utility = segments.pop() ?? '';
  const variants = segments;
  let negative = false;
  let important = false;
  if (utility.startsWith('!')) { important = true; utility = utility.slice(1); }
  if (utility.endsWith('!')) { important = true; utility = utility.slice(0, -1); }
  if (utility.startsWith('-') && utility.length > 1) { negative = true; utility = utility.slice(1); }

  let base = utility;
  let opacity = null;
  const parts = splitTopLevel(utility, '/');
  if (parts.length > 1) {
    const candidate = parts.slice(0, -1).join('/');
    const g = groupOf(candidate);
    if (categoryOf(g) === 'color') { base = candidate; opacity = parts[parts.length - 1]; }
  }
  const group = groupOf(base);
  return {
    raw: token,
    variants,
    utility,
    base,
    group,
    category: categoryOf(group),
    arbitraryValue: utility.includes('['),
    negative,
    important,
    opacity,
  };
}

/**
 * Whether `allow` grants this class: it names the class's category (`layout`
 * for the null category) or its exact group id (`rounded`, which covers the
 * plain radius group and not the corner groups).
 *
 * @param {ParsedClass} parsed
 * @param {string[]|undefined} allow
 */
export function isAllowed(parsed, allow) {
  if (!allow || allow.length === 0) return false;
  const category = parsed.category ?? 'layout';
  if (allow.includes(category)) return true;
  if (parsed.group !== null && allow.includes(parsed.group)) return true;
  return false;
}
