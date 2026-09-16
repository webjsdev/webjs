/**
 * `no-arbitrary-values`: a token whose UTILITY carries a bracket (`p-[13px]`,
 * `ring-[3px]`, `[padding:13px]`), which sidesteps the theme's scale. An
 * arbitrary VARIANT (`[&_svg]:size-4`, `has-[>svg]:px-3`) never fires, and the
 * `(--var)` shorthand never fires, per the grammar. `allow` takes category
 * names (`layout`, `spacing`) and class-group ids (`rounded`).
 *
 * @module lint/rules/no-arbitrary-values
 */

import { parseToken, isAllowed } from '../grammar.js';

/**
 * @param {import('../scan.js').ClassSite} site
 * @param {{ allow?: string[] }} ctx
 * @returns {Array<{ line: number, column: number, class: string, message: string }>}
 */
export function noArbitraryValues(site, ctx) {
  const out = [];
  for (const token of site.classes) {
    const parsed = parseToken(token.name);
    if (!parsed.arbitraryValue) continue;
    if (isAllowed(parsed, ctx.allow)) continue;
    const category = parsed.category ?? 'layout';
    out.push({
      line: token.line,
      column: token.column,
      class: token.name,
      message: `${parsed.utility} is an arbitrary value (${category}${parsed.group ? `, group ${parsed.group}` : ''}). Use a theme scale step instead, or allow "${category}"${parsed.group && !parsed.group.startsWith('arbitrary..') ? ` or "${parsed.group}"` : ''} in the rule's allow list.`,
    });
  }
  return out;
}
