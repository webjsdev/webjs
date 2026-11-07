/**
 * The physical-to-logical class table and the token function both RTL tools
 * use: `logical-properties.mjs` (which rewrote the kit's own classes, #1666)
 * and `port-styles.mjs` (which maps shadcn's ported styles the same way, as
 * shadcn's own install-time RTL transform does). The table is shadcn's
 * `RTL_MAPPINGS` (packages/registry/src/transformers/transform-rtl.ts in the
 * shadcn repo). A left-to-right page renders a logical class exactly as its
 * physical twin, so mapping changes nothing there.
 */

// Order matters (negatives before positives, specific before general).
export const MAPPINGS = [
  ['-ml-', '-ms-'], ['-mr-', '-me-'], ['ml-', 'ms-'], ['mr-', 'me-'],
  ['pl-', 'ps-'], ['pr-', 'pe-'],
  ['-left-', '-start-'], ['-right-', '-end-'], ['left-', 'start-'], ['right-', 'end-'],
  ['inset-l-', 'inset-inline-start-'], ['inset-r-', 'inset-inline-end-'],
  ['rounded-tl-', 'rounded-ss-'], ['rounded-tr-', 'rounded-se-'],
  ['rounded-bl-', 'rounded-es-'], ['rounded-br-', 'rounded-ee-'],
  ['rounded-l-', 'rounded-s-'], ['rounded-r-', 'rounded-e-'],
  ['border-l-', 'border-s-'], ['border-r-', 'border-e-'],
  ['border-l', 'border-s'], ['border-r', 'border-e'],
  ['text-left', 'text-start'], ['text-right', 'text-end'],
  ['scroll-ml-', 'scroll-ms-'], ['scroll-mr-', 'scroll-me-'],
  ['scroll-pl-', 'scroll-ps-'], ['scroll-pr-', 'scroll-pe-'],
  ['float-left', 'float-start'], ['float-right', 'float-end'],
  ['clear-left', 'clear-start'], ['clear-right', 'clear-end'],
  ['origin-top-left', 'origin-top-start'], ['origin-top-right', 'origin-top-end'],
  ['origin-bottom-left', 'origin-bottom-start'], ['origin-bottom-right', 'origin-bottom-end'],
  ['origin-left', 'origin-start'], ['origin-right', 'origin-end'],
];
// Direction-neutral centring offsets, left as they are.
const CENTRING = /^-?(left|right)-(\[50%\]|1\/2)$/;

/** The utility part of a class, after its variants (split at the last top-level colon). */
function splitVariant(token) {
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < token.length; i++) {
    const c = token[i];
    if (c === '[' || c === '(') depth++;
    else if (c === ']' || c === ')') depth--;
    else if (c === ':' && depth === 0) cut = i;
  }
  return [token.slice(0, cut + 1), token.slice(cut + 1)];
}

/** Map one class token to its logical form, or return it unchanged. */
export function logicalToken(token) {
  const [variant, rest] = splitVariant(token);
  const bang = rest.startsWith('!') ? '!' : '';
  const util = bang ? rest.slice(1) : rest;
  if (CENTRING.test(util)) return token;
  for (const [from, to] of MAPPINGS) {
    const exact = !from.endsWith('-');
    if (exact ? util === from || util.startsWith(from + '/') : util.startsWith(from)) {
      return variant + bang + to + util.slice(from.length);
    }
  }
  return token;
}

/** A class list, mapped token by token, whitespace kept as it was. */
export function logicalClassList(value) {
  return value.split(/(\s+)/).map((t) => (/^\s*$/.test(t) ? t : logicalToken(t))).join('');
}
