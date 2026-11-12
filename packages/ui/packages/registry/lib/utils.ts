/**
 * `cn()`, shadcn's clsx + tailwind-merge in one: joins the truthy arguments,
 * and a later utility wins over an earlier one for the same CSS property.
 * Below it are the layout and typography class helpers.
 */
export type ClassValue = string | number | null | false | undefined | ClassValue[] | Record<string, unknown>;

export function cn(...inputs: ClassValue[]): string {
  const flat: string[] = [];
  walk(inputs, flat);
  return dedupeUtilities(flat.join(' ')).trim();
}

function walk(value: ClassValue, out: string[]): void {
  if (!value) return;
  if (typeof value === 'string' || typeof value === 'number') {
    out.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) walk(v, out);
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (v) out.push(k);
    }
  }
}

// The merger. One group per CSS property (never per class prefix); a later
// class evicts an earlier one in its group. Built on first use (#1320).
let _groups: Array<[RegExp, string]> | undefined;
function GROUPS(): Array<[RegExp, string]> {
  return (_groups ??= [
    [/^p-/, 'p'], [/^px-/, 'px'], [/^py-/, 'py'], [/^pt-/, 'pt'], [/^pr-/, 'pr'], [/^pb-/, 'pb'], [/^pl-/, 'pl'], [/^ps-/, 'ps'], [/^pe-/, 'pe'],
    [/^m-/, 'm'], [/^mx-/, 'mx'], [/^my-/, 'my'], [/^mt-/, 'mt'], [/^mr-/, 'mr'], [/^mb-/, 'mb'], [/^ml-/, 'ml'], [/^ms-/, 'ms'], [/^me-/, 'me'],
    [/^w-/, 'w'], [/^h-/, 'h'], [/^size-/, 'size'],
    [/^bg-\[(url\(|linear-gradient|radial-gradient|conic-gradient)/, 'bg-image'],
    [/^bg-(linear|gradient|conic|radial|none)/, 'bg-image'],
    [/^bg-(no-repeat|repeat|repeat-x|repeat-y|repeat-round|repeat-space)$/, 'bg-repeat'],
    [/^bg-(fixed|local|scroll)$/, 'bg-attach'],
    [/^bg-(auto|cover|contain)$/, 'bg-size'],
    [/^bg-size-/, 'bg-size'],
    [/^bg-(top|bottom)(-(left|right))?$/, 'bg-position'],
    [/^bg-(left|right|center)(-(top|bottom))?$/, 'bg-position'],
    [/^bg-position-/, 'bg-position'],
    [/^bg-clip-(border|padding|content|text)$/, 'bg-clip'],
    [/^bg-origin-(border|padding|content)$/, 'bg-origin'],
    [/^bg-blend-(normal|multiply|screen|overlay|darken|lighten|color-dodge|color-burn|hard-light|soft-light|difference|exclusion|hue|saturation|color|luminosity)$/, 'bg-blend'],
    [/^bg-/, 'bg-color'],
    [/^text-shadow(-(2xs|xs|sm|md|lg|none))?(\/([\d.]+|\[[^\]]*\]))?$/, 'text-shadow'],
    [/^text-shadow-(\[(inset|-|\.|\d|var\()|\(--)/, 'text-shadow'],
    [/^text-shadow-/, 'text-shadow-color'],
    [/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/, 'text-size'],
    [/^text-(left|center|right|justify|start|end)$/, 'text-align'],
    [/^text-(wrap|nowrap|balance|pretty)$/, 'text-wrap'],
    [/^text-(ellipsis|clip)$/, 'text-overflow'],
    [/^text-/, 'text-color'],
    [/^border-(collapse|separate)$/, 'border-collapse'],
    [/^border-spacing(-[xy])?-/, 'border-spacing'],
    [/^border-(solid|dashed|dotted|double|hidden|none)$/, 'border-style'],
    ...borderGroups(),
    [/^rounded(-[a-z]+)?$/, 'rounded'],
    [/^rounded-/, 'rounded'],
    [/^opacity-/, 'opacity'],
    [/^leading-/, 'leading'],
    [/^font-(thin|light|normal|medium|semibold|bold|black|extralight|extrabold)$/, 'font-weight'],
    // Shadow size and shadow colour are two properties; an unhinted arbitrary
    // value is a size when it opens like an offset list or is a bare var().
    [/^shadow(-(2xs|xs|sm|md|lg|xl|2xl|inner|none))?(\/([\d.]+|\[[^\]]*\]))?$/, 'shadow'],
    [/^shadow-(\[(inset|-|\.|\d|var\()|\(--)/, 'shadow'],
    [/^shadow-/, 'shadow-color'],
    [/^z-/, 'z'],
    // Display keywords, apart from the flex / grid sub-properties below.
    [/^(inline-block|inline-flex|inline-grid|inline-table|inline|block|flex|grid|flow-root|contents|hidden|list-item|table-caption|table-cell|table-column-group|table-column|table-footer-group|table-header-group|table-row-group|table-row|table)$/, 'display'],
    [/^flex-(row|row-reverse|col|col-reverse)$/, 'flex-direction'],
    [/^flex-(wrap|wrap-reverse|nowrap)$/, 'flex-wrap'],
    [/^flex-(\d+|auto|initial|none|\[[^\]]*\])$/, 'flex'],
    [/^grid-cols-/, 'grid-cols'],
    [/^grid-rows-/, 'grid-rows'],
    [/^grid-flow-/, 'grid-flow'],
    [/^basis-/, 'basis'],
    [/^justify-items-/, 'justify-items'],
    [/^justify-self-/, 'justify-self'],
    [/^justify-/, 'justify-content'],
    [/^items-/, 'align-items'],
    [/^self-/, 'align-self'],
  ]);
}

/**
 * Border width and colour groups, one per side. A bare or numeric value, or an
 * arbitrary length, is a width; anything else is a colour.
 */
function borderGroups(): Array<[RegExp, string]> {
  const width = '(\\d+(\\.\\d+)?|\\[(length:|\\d|\\.)[^\\]]*\\]|\\(length:[^)]*\\))';
  const out: Array<[RegExp, string]> = [];
  const sides = ['x', 'y', 't', 'r', 'b', 'l', 's', 'e', ''];
  for (const side of sides) {
    const seg = side ? `-${side}` : '';
    out.push([new RegExp(`^border${seg}(-${width})?$`), `border-w${seg}`]);
  }
  for (const side of sides) {
    const seg = side ? `-${side}` : '';
    out.push([new RegExp(`^border${seg}-`), `border-color${seg}`]);
  }
  return out;
}

/**
 * A type-hinted arbitrary value (`bg-[image:...]`, `shadow-(color:--x)`) is
 * grouped by its hint. '' means the prefix's own default property; an unlisted
 * pair gets a group of its own.
 */
const HINTED_GROUPS: Record<string, string> = {
  'bg:color': '',
  'bg:image': 'bg-image',
  'bg:position': 'bg-position',
  'bg:size': 'bg-size',
  'bg:length': 'bg-size',
  'text:color': '',
  'text:length': 'text-size',
  'shadow:color': 'shadow-color',
  'text-shadow:color': 'text-shadow-color',
};

/**
 * The group for a hinted arbitrary value, `null` when the normal GROUPS table
 * should decide it, `undefined` when the token carries no hint at all.
 */
function hintedGroup(bare: string): string | null | undefined {
  const m = /^([a-z][a-z-]*)-[\[(]([a-z][a-z-]*):/.exec(bare);
  if (!m) return undefined;
  const prefix = m[1];
  const hint = m[2];
  const key = `${prefix}:${hint}`;
  if (key in HINTED_GROUPS) return HINTED_GROUPS[key] || null;
  if (/^border(-[xytrbles])?$/.test(prefix) && (hint === 'length' || hint === 'color')) return null;
  return `hint:${key}`;
}

// A shorthand evicts the sides it subsumes (`p-0` drops an earlier `px-4`), not
// the other way round.
const CONFLICTS: Record<string, string[]> = {
  p: ['px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe'],
  px: ['pl', 'pr'],
  py: ['pt', 'pb'],
  m: ['mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me'],
  mx: ['ml', 'mr'],
  my: ['mt', 'mb'],
  size: ['w', 'h'],
  'border-w': ['border-w-x', 'border-w-y', 'border-w-t', 'border-w-r', 'border-w-b', 'border-w-l', 'border-w-s', 'border-w-e'],
  'border-w-x': ['border-w-l', 'border-w-r'],
  'border-w-y': ['border-w-t', 'border-w-b'],
  'border-color': ['border-color-x', 'border-color-y', 'border-color-t', 'border-color-r', 'border-color-b', 'border-color-l', 'border-color-s', 'border-color-e'],
  'border-color-x': ['border-color-l', 'border-color-r'],
  'border-color-y': ['border-color-t', 'border-color-b'],
};

function dedupeUtilities(input: string): string {
  const tokens = input.split(/\s+/).filter(Boolean);
  // `${prefix}::${group}` -> index of the last SURVIVING token in that group.
  const lastByKey = new Map<string, number>();
  const result: Array<string | null> = [];

  for (const token of tokens) {
    // Conflicts apply within one variant set (`px-4 hover:p-0` keeps both).
    const prefix = variantPrefix(token);
    const bare = prefix ? token.slice(prefix.length) : token;
    const hinted = hintedGroup(bare);
    let gk: string | null = hinted ?? null;
    if (hinted === undefined || hinted === null) {
      for (const [re, g] of GROUPS()) {
        if (re.test(bare)) { gk = g; break; }
      }
    }
    if (gk) {
      for (const g of [gk, ...(CONFLICTS[gk] ?? [])]) {
        const k = `${prefix}::${g}`;
        const idx = lastByKey.get(k);
        if (idx !== undefined) { result[idx] = null; lastByKey.delete(k); }
      }
      lastByKey.set(`${prefix}::${gk}`, result.length);
    }
    result.push(token);
  }
  return result.filter(Boolean).join(' ');
}

function variantPrefix(token: string): string {
  // The variants end at the last colon outside both brackets and parens, each
  // counted on its own, since an arbitrary value has colons of its own.
  let bracketDepth = 0;
  let parenDepth = 0;
  let i = -1;
  for (let n = 0; n < token.length; n += 1) {
    const c = token[n];
    if (c === '[') bracketDepth += 1;
    else if (c === ']') bracketDepth -= 1;
    else if (c === '(') parenDepth += 1;
    else if (c === ')') parenDepth -= 1;
    else if (c === ':' && bracketDepth === 0 && parenDepth === 0) i = n;
  }
  return i === -1 ? '' : token.slice(0, i + 1);
}

// Stable DOM ids for ARIA wiring between light-DOM nodes. An id already on
// the element (author-set, or from SSR) is kept, so server and client agree.
let _idSeq = 0;

/** A fresh, document-unique id string with a readable prefix. */
export function domId(prefix = 'ui'): string {
  _idSeq += 1;
  return `${prefix}-${_idSeq}`;
}

/**
 * Returns `el.id`, assigning a generated one (prefix-based) when absent.
 * Idempotent, so an id already present (author-set, or carried over from
 * SSR) is reused unchanged.
 */
export function ensureId(el: { id: string }, prefix = 'ui'): string {
  if (!el.id) el.id = domId(prefix);
  return el.id;
}

/** A Tier-2 host whose authored class {@link takeAuthoredClass} reads. */
export type ClassHost = {
  getAttribute?(name: string): string | null;
  setAttribute?(name: string, value: string): void;
  removeAttribute?(name: string): void;
  _authoredClass?: string | null;
};

/**
 * The class an author wrote on a Tier-2 part's host (shadcn's `className`),
 * recorded in `data-authored-class` on first read so a hydrating instance
 * reads the author's class, not the one the element served. `hostClass`
 * replaces it on the host (`null` removes it).
 */
export function takeAuthoredClass(host: ClassHost, hostClass?: string | null): string | null {
  if (host._authoredClass === undefined) {
    const recorded = host.getAttribute?.('data-authored-class') ?? null;
    const authored = recorded ?? host.getAttribute?.('class') ?? '';
    host._authoredClass = authored || null;
    if (recorded === null) host.setAttribute?.('data-authored-class', authored);
    if (hostClass) host.setAttribute?.('class', hostClass);
    else if (hostClass === null) host.removeAttribute?.('class');
  }
  return host._authoredClass;
}

// Layout helpers: the design system's spacing rhythm, in one place.

/** Vertical rhythm inside a single form field: label ↔ control ↔ hint/error. */
export const fieldClass = () => 'grid gap-2';

/** Horizontal field layout: label on the left, control on the right. */
export const fieldRowClass = () => 'flex items-center gap-3';

/** Gap step for `stackClass({ gap })`. */
export type StackGap = 'sm' | 'md' | 'lg';

/** Stack of form fields: `sm` tight, `lg` spaced out. */
export const stackClass = (opts: { gap?: StackGap } = {}): string => {
  const gap = opts.gap ?? 'md';
  return gap === 'sm' ? 'grid gap-3' : gap === 'lg' ? 'grid gap-8' : 'grid gap-6';
};

/** Form body: same rhythm as a `lg` stack; semantic name for `<form>` content. */
export const formClass = () => 'grid gap-6';

/** Top-level section separation (between form groups, between sections of a page). */
export const sectionClass = () => 'grid gap-8';

// Typography helpers.

/** Form-field label: `<label>` text style. */
export const fieldLabelClass = () =>
  'text-sm leading-none font-medium select-none group-data-[disabled=true]/field:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50';

/** Subdued helper / hint text below a form field. */
export const hintClass = () => 'text-sm text-muted-foreground';

/** Tertiary help text (smaller than hint). */
export const helpClass = () => 'text-xs text-muted-foreground';

/** Validation error text: replaces hint when the field is invalid. */
export const errorClass = () => 'text-sm font-medium text-destructive';
