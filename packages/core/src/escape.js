// Both escapers skip the three replaces when the string carries none of the
// characters they rewrite, which is the common case for a template value and
// was measurable on the SSR hot path (#1646).
const TEXT_SPECIAL = /[&<>]/;
const ATTR_SPECIAL = /[&"<]/;

/** @param {string} s */
export function escapeText(s) {
  const str = String(s);
  if (!TEXT_SPECIAL.test(str)) return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** @param {string} s */
export function escapeAttr(s) {
  const str = String(s);
  if (!ATTR_SPECIAL.test(str)) return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}
