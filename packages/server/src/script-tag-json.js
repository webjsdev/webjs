/**
 * JSON serialization safe for interpolation inside an HTML `<script>`
 * tag body.
 *
 * Four escape concerns when JSON ends up inside `<script>...<` + `/script>`:
 *
 * 1. The substring `<` + `/` is treated by the HTML parser as a
 *    script-element close even mid-string. A JSON string value
 *    containing `<` + `/script>` would close the host tag and let
 *    arbitrary content after it become regular HTML (or another
 *    inline script). Escape it to `<\/` (valid in JS strings,
 *    ignored by HTML parser).
 *
 * 2. The HTML5 tokenizer transitions into the "script-data-escaped"
 *    state when it sees `<!--` inside a script body. From that state
 *    a subsequent `<script>` (any casing) enters "script-data-double-
 *    escaped", where `</script>` no longer terminates the host
 *    element until a matching `-->` is seen. A vendor URL or import
 *    key containing the right `<!--...<script>...</script>` shape
 *    could survive escape (1) and still break out of the importmap.
 *    Escape both `<!--` and `-->` to `<\!--` / `--\>`, which JS
 *    parses as the same string literals but the HTML tokenizer no
 *    longer matches as comment-state transitions.
 *
 * 3. The Unicode line / paragraph separator code points (U+2028 and
 *    U+2029) are valid in JSON strings but legacy JavaScript treated
 *    them as line terminators inside source. Modern JS (ES2019+)
 *    accepts them, but encoding defensively keeps output compatible
 *    with older parsers and is what every major framework does.
 *
 * Use this anywhere a `JSON.stringify` output is interpolated inside
 * a `<script>...<` + `/script>` body (importmap content, env shim,
 * lazy registry, boot module imports).
 *
 * Built with String.fromCharCode and constructed RegExp to keep the
 * source file pure ASCII (no literal U+2028 / U+2029 / script-close).
 *
 * @param {unknown} value
 * @returns {string}
 */
const SCRIPT_CLOSE = '<' + '/';
const COMMENT_OPEN = '<!--';
const COMMENT_CLOSE = '-->';
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const ESCAPE_RE = new RegExp(
  '<' + '\\/' +
  '|<!--' +
  '|-->' +
  '|[\\u2028\\u2029]',
  'g',
);

export function jsonForScriptTag(value) {
  return JSON.stringify(value).replace(ESCAPE_RE, (ch) => {
    if (ch === SCRIPT_CLOSE) return '<' + '\\/';
    if (ch === COMMENT_OPEN) return '<\\!--';
    if (ch === COMMENT_CLOSE) return '--\\>';
    if (ch === LS) return '\\u2028';
    if (ch === PS) return '\\u2029';
    return ch;
  });
}
