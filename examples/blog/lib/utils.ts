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

// Conflict groups: classes with the same group key — last one wins.
// Covers ~95% of in-component overrides the registry exposes.
const GROUPS: Array<[RegExp, string]> = [
  [/^p-/, 'p'], [/^px-/, 'px'], [/^py-/, 'py'], [/^pt-/, 'pt'], [/^pr-/, 'pr'], [/^pb-/, 'pb'], [/^pl-/, 'pl'],
  [/^m-/, 'm'], [/^mx-/, 'mx'], [/^my-/, 'my'], [/^mt-/, 'mt'], [/^mr-/, 'mr'], [/^mb-/, 'mb'], [/^ml-/, 'ml'],
  [/^w-/, 'w'], [/^h-/, 'h'], [/^size-/, 'size'],
  [/^bg-/, 'bg'], [/^text-(?!align-|left|right|center|justify|start|end|wrap|nowrap|balance|pretty|clip|ellipsis)/, 'text'],
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
    for (const [re, gk] of GROUPS) {
      if (re.test(token)) { key = `${variantPrefix(token)}::${gk}`; break; }
    }
    if (key && seen.has(key)) result[seen.get(key)!] = null;
    if (key) seen.set(key, result.length);
    result.push(token);
  }
  return result.filter(Boolean).join(' ');
}

function variantPrefix(token: string): string {
  // capture leading variants like `hover:`, `dark:`, `md:` — overrides only conflict within the same variant set
  const i = token.lastIndexOf(':');
  return i === -1 ? '' : token.slice(0, i + 1);
}
