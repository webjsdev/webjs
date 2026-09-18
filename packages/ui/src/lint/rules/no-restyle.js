/**
 * `no-restyle`: a class composed NEXT TO a kit helper, in either shape WebJs
 * writes: a `cn()` call whose arguments include both a `*Class()` call and a
 * string literal, or a `class` attribute holding both a `${helperCall()}` hole
 * and static text. The scanner records the helpers a site is composed with,
 * so the rule fires on every class of a site that has at least one.
 *
 * The message names the helper's REAL variant and size values, read from the
 * app's own copied helper source through `extractHelperAxes` (the shared
 * projector in `registry/extract.js`), never from a second parser and never
 * invented: a helper matching neither authored shape yields no value list.
 *
 * `allow` takes category names and class-group ids. The documented starting
 * configuration is `["layout", "rounded"]`, which is what lets the skill's
 * sanctioned one-off (`cn(buttonClass({ size: 'none' }), 'w-9 h-9
 * rounded-full')`) pass: `w-9 h-9` is layout, and `rounded-full` is the plain
 * radius group granted by name without opening the whole `shape` category.
 *
 * @module lint/rules/no-restyle
 */

import { parseToken, isAllowed } from '../grammar.js';

/**
 * @param {import('../scan.js').ClassSite} site
 * @param {{ allow?: string[], axesFor: (helper: string) => { axes: Record<string, string[]>, file: string|null } }} ctx
 * @returns {Array<{ line: number, column: number, class: string, message: string }>}
 */
export function noRestyle(site, ctx) {
  if (!site.helpers.length) return [];
  const out = [];
  // Every composed helper is named; the axes come from the LAST one, since a
  // later argument is what `cn` lets win.
  const helper = site.helpers[site.helpers.length - 1];
  const named = site.helpers.length === 1 ? helper : `${site.helpers.slice(0, -1).join(', ')} and ${helper}`;
  const { axes, file } = ctx.axesFor(helper);
  for (const token of site.classes) {
    const parsed = parseToken(token.name);
    if (isAllowed(parsed, ctx.allow)) continue;
    let message = `${parsed.utility} overrides what ${named} already ${site.helpers.length === 1 ? 'sets' : 'set'}.`;
    const axisNames = Object.keys(axes);
    if (axisNames.length) {
      const axis = pickAxis(parsed, axisNames);
      message += ` Use a ${helper} ${axis}: ${axes[axis].join(', ')}`;
      message += file ? ` (declared in ${file}).` : '.';
    } else {
      message += ` Pick a variant ${helper} exposes${file ? ` (declared in ${file})` : ''}, or allow "${parsed.category ?? 'layout'}"${parsed.group ? ` or "${parsed.group}"` : ''} in the rule's allow list.`;
    }
    out.push({ line: token.line, column: token.column, class: token.name, message });
  }
  return out;
}

/**
 * A colour or typography override reads as a variant, and a size-ish one as a
 * size when the helper has one. Font size and line height are the two
 * typography groups a kit SIZE carries (`text-xs` in the button's `xs`), so they
 * read as a size, while a weight or an underline stays a variant.
 */
function pickAxis(parsed, axisNames) {
  const cat = parsed.category;
  const sizeLike = cat === null || cat === 'spacing' || cat === 'shape' || parsed.group === 'font-size' || parsed.group === 'leading';
  if (sizeLike && axisNames.includes('size')) return 'size';
  if (axisNames.includes('variant')) return 'variant';
  return axisNames[0];
}
