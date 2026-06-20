/**
 * Tiny class-name merger. Drop-in replacement for the clsx + tailwind-merge
 * pair used in shadcn.
 *
 * - Concatenates truthy arguments separated by spaces.
 * - Later Tailwind utilities win when they target the same property, mimicking
 *   `tailwind-merge`'s behaviour for the cases components actually hit
 *   (background colour, text colour, padding, margin, width, height, border,
 *   rounded, opacity, display).
 *
 * For projects that want the full tailwind-merge behaviour, install
 * `clsx` + `tailwind-merge` and replace this file:
 *
 *   import { clsx, type ClassValue } from 'clsx';
 *   import { twMerge } from 'tailwind-merge';
 *   export function cn(...inputs: ClassValue[]) {
 *     return twMerge(clsx(inputs));
 *   }
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

// Conflict groups: classes with the same group key: last one wins.
// Covers ~95% of in-component overrides the registry exposes.
//
// IMPORTANT: text-size (text-sm, text-xs, text-base, text-lg, …) and
// text-color (text-primary, text-foreground, …) are DIFFERENT properties
// and must be in different groups. Same for bg-size vs bg-color etc.
const GROUPS: Array<[RegExp, string]> = [
  [/^p-/, 'p'], [/^px-/, 'px'], [/^py-/, 'py'], [/^pt-/, 'pt'], [/^pr-/, 'pr'], [/^pb-/, 'pb'], [/^pl-/, 'pl'],
  [/^m-/, 'm'], [/^mx-/, 'mx'], [/^my-/, 'my'], [/^mt-/, 'mt'], [/^mr-/, 'mr'], [/^mb-/, 'mb'], [/^ml-/, 'ml'],
  [/^w-/, 'w'], [/^h-/, 'h'], [/^size-/, 'size'],
  [/^bg-(linear|gradient|conic|radial|none)/, 'bg-image'],
  [/^bg-(no-repeat|repeat|repeat-x|repeat-y|repeat-round|repeat-space)$/, 'bg-repeat'],
  [/^bg-(fixed|local|scroll)$/, 'bg-attach'],
  [/^bg-(auto|cover|contain)$/, 'bg-size'],
  [/^bg-(bottom|center|left|right|top)$/, 'bg-position'],
  [/^bg-/, 'bg-color'],
  // Font size: explicit list of Tailwind size scale.
  [/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/, 'text-size'],
  // Text color: anything else starting with text- that isn't alignment / wrap / overflow.
  [/^text-(?!align-|left$|right$|center$|justify$|start$|end$|wrap$|nowrap$|balance$|pretty$|clip$|ellipsis$|xs$|sm$|base$|lg$|xl$|\d?xl$)/, 'text-color'],
  [/^border(-[trblxy])?-?\d/, 'border-w'],
  [/^rounded(-[a-z]+)?$/, 'rounded'],
  [/^rounded-/, 'rounded'],
  [/^opacity-/, 'opacity'],
  [/^font-(thin|light|normal|medium|semibold|bold|black|extralight|extrabold)$/, 'font-weight'],
  [/^shadow(-|$)/, 'shadow'],
  [/^z-/, 'z'],
  [/^flex(-|$)/, 'flex'],
  [/^grid(-|$)/, 'grid'],
];

function dedupeUtilities(input: string): string {
  const tokens = input.split(/\s+/).filter(Boolean);
  const seen = new Map<string, number>();
  const result: Array<string | null> = [];

  for (const token of tokens) {
    let key: string | null = null;
    // Strip variant prefix (`hover:`, `dark:md:`, …) before testing each
    // dedupe regex so `hover:bg-red-500` still matches the `bg-color` group.
    const prefix = variantPrefix(token);
    const bare = prefix ? token.slice(prefix.length) : token;
    for (const [re, gk] of GROUPS) {
      if (re.test(bare)) { key = `${prefix}::${gk}`; break; }
    }
    if (key && seen.has(key)) result[seen.get(key)!] = null;
    if (key) seen.set(key, result.length);
    result.push(token);
  }
  return result.filter(Boolean).join(' ');
}

function variantPrefix(token: string): string {
  // capture leading variants like `hover:`, `dark:`, `md:`: overrides only conflict within the same variant set
  const i = token.lastIndexOf(':');
  return i === -1 ? '' : token.slice(0, i + 1);
}

// ---------------------------------------------------------------------------
// Stable DOM ids for wiring ARIA relationships (aria-controls /
// aria-labelledby / aria-describedby) between sibling light-DOM nodes.
// A monotonic counter is fine for uniqueness within a document: the id is
// only consumed as an attribute value, never persisted. When SSR emits an
// id on a host element, the upgraded element reuses it (ensureId is a no-op
// when an id is already present), so the server and client agree.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Custom-element base: SSR-safe. In the browser `Base = HTMLElement`. On
// the server (Node, during SSR) `HTMLElement` is undefined; we substitute
// a stub class so that `class Foo extends Base { … }` doesn't throw at
// module-load time. The stub's methods are never actually called server-side
// because connectedCallback/lifecycle hooks only run when the element is
// inserted into a live DOM, which doesn't happen during webjs SSR.
// ---------------------------------------------------------------------------

const HasHTMLElement = typeof HTMLElement !== 'undefined';

class ServerHTMLElementStub {
  // Minimal surface so attribute reads/writes inside synchronous code paths
  // that DO execute during SSR (e.g. attribute reflection) don't throw.
  _ssrAttrs: Record<string, string> = {};
  getAttribute(name: string): string | null {
    return this._ssrAttrs[name] ?? null;
  }
  setAttribute(name: string, value: string): void {
    this._ssrAttrs[name] = String(value);
  }
  hasAttribute(name: string): boolean {
    return name in this._ssrAttrs;
  }
  removeAttribute(name: string): void {
    delete this._ssrAttrs[name];
  }
  toggleAttribute(name: string, force?: boolean): boolean {
    const want = force === undefined ? !this.hasAttribute(name) : force;
    if (want) this.setAttribute(name, '');
    else this.removeAttribute(name);
    return want;
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true;
  }
  // Tree-walk APIs no-op into null: components that call them server-side
  // simply see "no children / no siblings", which is acceptable for SSR.
  closest(): null {
    return null;
  }
  querySelector(): null {
    return null;
  }
  querySelectorAll(): never[] {
    return [];
  }
  focus(): void {}
  blur(): void {}
  contains(): boolean {
    return false;
  }
  insertBefore<T>(node: T): T {
    return node;
  }
  appendChild<T>(node: T): T {
    return node;
  }
  replaceChildren(): void {}
  get firstChild(): null {
    return null;
  }
  get classList() {
    return { add: () => {}, remove: () => {}, toggle: () => false, contains: () => false };
  }
  get className(): string {
    return this._ssrAttrs.class ?? '';
  }
  set className(v: string) {
    this._ssrAttrs.class = v;
  }
  get style(): Record<string, string> {
    return {};
  }
}

/** SSR-safe base class: `HTMLElement` in browser, a thin stub in Node. */
export const Base: typeof HTMLElement = (HasHTMLElement
  ? HTMLElement
  : (ServerHTMLElementStub as unknown as typeof HTMLElement)) as typeof HTMLElement;

/** Register a custom element. No-op on server (no `customElements` global). */
export function defineElement(name: string, cls: CustomElementConstructor): void {
  if (typeof customElements === 'undefined') return;
  if (customElements.get(name)) return; // already defined (HMR / double-import)
  customElements.define(name, cls);
}

// ---------------------------------------------------------------------------
// Layout helpers: encode the design-system rhythm (spacing between label /
// input / hint, between form fields, between sections). Change one helper to
// retune the whole app: call sites stay readable inline Tailwind.
// ---------------------------------------------------------------------------

/** Vertical rhythm inside a single form field: label ↔ control ↔ hint/error. */
export const fieldClass = () => 'grid gap-2';

/** Horizontal field layout: label on the left, control on the right. */
export const fieldRowClass = () => 'flex items-center gap-3';

/** Gap step for `stackClass({ gap })`. */
export type StackGap = 'sm' | 'md' | 'lg';

/**
 * Stack of form fields. `sm` for tight groupings, `lg` for spaced-out sections.
 *
 * Object-arg shape matches the rest of the kit (`buttonClass({ variant, size })`,
 * `badgeClass({ variant })`, etc.): predictable across all helpers and
 * extensible if a second dimension (e.g. `direction`) is ever added.
 */
export const stackClass = (opts: { gap?: StackGap } = {}): string => {
  const gap = opts.gap ?? 'md';
  return gap === 'sm' ? 'grid gap-3' : gap === 'lg' ? 'grid gap-8' : 'grid gap-6';
};

/** Form body: same rhythm as a `lg` stack; semantic name for `<form>` content. */
export const formClass = () => 'grid gap-6';

/** Top-level section separation (between form groups, between sections of a page). */
export const sectionClass = () => 'grid gap-8';

// ---------------------------------------------------------------------------
// Typography helpers: fixed text styles used across the design system.
// ---------------------------------------------------------------------------

/** Form-field label: `<label>` text style. */
export const fieldLabelClass = () =>
  'text-sm leading-none font-medium select-none group-data-[disabled=true]/field:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50';

/** Subdued helper / hint text below a form field. */
export const hintClass = () => 'text-sm text-muted-foreground';

/** Tertiary help text (smaller than hint). */
export const helpClass = () => 'text-xs text-muted-foreground';

/** Validation error text: replaces hint when the field is invalid. */
export const errorClass = () => 'text-sm font-medium text-destructive';
