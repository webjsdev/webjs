/**
 * `no-raw-colors`: a Tailwind palette utility (`text-red-600`, `bg-sky-500`)
 * in a class site, where the app's theme declares a token that should carry
 * the role instead.
 *
 * The message names ONLY utilities the app's own theme declares (read from the
 * configured Tailwind CSS by `theme-tokens.js`), joined to the offender's own
 * prefix, so `--color-destructive` offers `text-destructive` for a `text-`
 * offender. A nearest-role suggestion is added only where the mapping is
 * unambiguous and the role is actually declared. When the theme yields no
 * tokens the orchestrator never calls this rule, because a message that
 * cannot name an alternative reproduces the prose-guidance failure at higher
 * volume.
 *
 * @module lint/rules/no-raw-colors
 */

import { parseToken } from '../grammar.js';

const PREFIXES = ['text', 'bg', 'border', 'ring', 'divide', 'outline', 'fill', 'stroke', 'from', 'via', 'to', 'shadow', 'decoration', 'placeholder', 'caret', 'accent'];
const FAMILIES = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose', 'slate', 'gray', 'zinc', 'neutral', 'stone'];
const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

const RAW = new RegExp(`^(${PREFIXES.join('|')})-(${FAMILIES.join('|')})-(${STEPS.join('|')})$`);

/** Families whose role match is unambiguous. */
const ROLE = {
  red: () => 'destructive',
  rose: () => 'destructive',
  slate: (prefix) => (prefix === 'text' ? 'muted-foreground' : 'muted'),
  gray: (prefix) => (prefix === 'text' ? 'muted-foreground' : 'muted'),
  zinc: (prefix) => (prefix === 'text' ? 'muted-foreground' : 'muted'),
  neutral: (prefix) => (prefix === 'text' ? 'muted-foreground' : 'muted'),
  stone: (prefix) => (prefix === 'text' ? 'muted-foreground' : 'muted'),
};

/** The tokens worth listing first for a given prefix, in this order, then the rest of the theme. */
const LEAD = ['destructive', 'muted-foreground', 'primary', 'foreground', 'muted', 'accent', 'secondary', 'background', 'border'];
const LIST_MAX = 6;

/**
 * @param {import('../scan.js').ClassSite} site
 * @param {{ tokens: string[], themePath: string }} ctx
 * @returns {Array<{ line: number, column: number, class: string, message: string, fix?: string }>}
 */
export function noRawColors(site, ctx) {
  const out = [];
  for (const token of site.classes) {
    const parsed = parseToken(token.name);
    const m = RAW.exec(parsed.base);
    if (!m) continue;
    const [, prefix, family] = m;
    const role = ROLE[family]?.(prefix);
    const roleDeclared = role !== undefined && ctx.tokens.includes(role);
    const ordered = [...LEAD.filter((t) => ctx.tokens.includes(t)), ...ctx.tokens.filter((t) => !LEAD.includes(t))];
    const list = ordered.slice(0, LIST_MAX).map((t) => `${prefix}-${t}`);
    let message = `${parsed.base} is a raw palette color. Use a theme token: ${list.join(', ')} (declared in ${ctx.themePath}).`;
    if (roleDeclared) {
      const what = family === 'red' || family === 'rose' ? 'error' : 'muted';
      message += ` For ${what} ${prefix === 'bg' ? 'surfaces' : 'text'}, ${prefix}-${role} is the role match`;
      message += role === 'destructive' && prefix === 'text' ? ', or use errorClass() from the kit.' : '.';
    }
    out.push({
      line: token.line,
      column: token.column,
      class: token.name,
      message,
      ...(roleDeclared ? { fix: `${prefix}-${role}` } : {}),
    });
  }
  return out;
}
