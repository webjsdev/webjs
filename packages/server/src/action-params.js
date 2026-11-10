/**
 * How many parameters a server action DECLARES (#1686), which is how a form
 * submission tells a `(prevState, formData)` action from a `(formData)` one.
 *
 * `fn.length` cannot answer it: it stops counting at the first parameter with
 * a default, so `async function save(prevState = initial, formData)` reports 0
 * and never received its previous result. That default is exactly how an
 * action supplies the first submission's state, the role `useActionState`'s
 * second argument plays in Next.js, so the count comes from the function's
 * source instead. A rest parameter is not counted, and anything that is not
 * plain source (a native or bound function) falls back to `fn.length`.
 *
 * @param {Function} fn
 * @returns {number}
 */
export function declaredParamCount(fn) {
  let src;
  try {
    src = Function.prototype.toString.call(fn);
  } catch {
    return fn.length;
  }
  if (/\{\s*\[native code\]\s*\}\s*$/.test(src)) return fn.length;
  // A single bare parameter arrow: `x => ...` or `async x => ...`.
  if (/^\s*(?:async\s+)?[A-Za-z_$][\w$]*\s*=>/.test(src)) return 1;
  const open = src.indexOf('(');
  if (open < 0) return fn.length;
  const list = paramListAt(src, open);
  if (list === null) return fn.length;
  return Math.max(fn.length, countParams(list));
}

/**
 * The text between the `(` at `open` and its matching `)`, skipping strings,
 * template literals, comments and nested brackets, or null if unbalanced.
 * @param {string} src
 * @param {number} open
 * @returns {string | null}
 */
function paramListAt(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      i = skipQuoted(src, i);
      continue;
    }
    if (c === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); i = nl < 0 ? src.length : nl; continue; }
    if (c === '/' && src[i + 1] === '*') { const end = src.indexOf('*/', i + 2); i = end < 0 ? src.length : end + 1; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return null;
}

/**
 * @param {string} src
 * @param {number} start index of the opening quote
 * @returns {number} index of the closing quote
 */
function skipQuoted(src, start) {
  const q = src[start];
  for (let i = start + 1; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue; }
    if (q === '`' && src[i] === '$' && src[i + 1] === '{') {
      const inner = paramListAt(src, i + 1);
      i += 2 + (inner === null ? 0 : inner.length);
      continue;
    }
    if (src[i] === q) return i;
  }
  return src.length;
}

/**
 * Whether the function's declared parameters each carry a default, in order
 * (rest parameter excluded), or null when the source cannot be read (a native
 * or bound function). `(input, opts = {})` is `[false, true]`.
 * @param {Function} fn
 * @returns {boolean[] | null}
 */
export function declaredParamDefaults(fn) {
  let src;
  try {
    src = Function.prototype.toString.call(fn);
  } catch {
    return null;
  }
  if (/\{\s*\[native code\]\s*\}\s*$/.test(src)) return null;
  if (/^\s*(?:async\s+)?[A-Za-z_$][\w$]*\s*=>/.test(src)) return [false];
  const open = src.indexOf('(');
  if (open < 0) return null;
  const list = paramListAt(src, open);
  if (list === null) return null;
  return splitParams(list).map(hasTopLevelDefault);
}

/**
 * Whether a parameter's source has a default: an `=` at depth 0 that is not
 * part of `==`, `=>`, `<=`, `>=` or `!=` (a destructuring pattern's own
 * defaults sit inside its brackets).
 * @param {string} param
 */
function hasTopLevelDefault(param) {
  let depth = 0;
  for (let i = 0; i < param.length; i++) {
    const c = param[i];
    if (c === '"' || c === "'" || c === '`') { i = skipQuoted(param, i); continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === '=' && depth === 0 && param[i + 1] !== '=' && param[i + 1] !== '>' && !'=!<>'.includes(param[i - 1] || '')) return true;
  }
  return false;
}

/**
 * Top-level parameters in a parameter list, a rest parameter not counted.
 * @param {string} list
 * @returns {number}
 */
function countParams(list) {
  return splitParams(list).length;
}

/**
 * The declared parameters' source texts, top-level commas only, the rest
 * parameter dropped.
 * @param {string} list
 * @returns {string[]}
 */
function splitParams(list) {
  /** @type {string[]} */
  const parts = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === '"' || c === "'" || c === '`') {
      const end = skipQuoted(list, i);
      cur += list.slice(i, end + 1);
      i = end;
      continue;
    }
    if (c === '/' && list[i + 1] === '/') { const nl = list.indexOf('\n', i); i = nl < 0 ? list.length : nl; continue; }
    if (c === '/' && list[i + 1] === '*') { const end = list.indexOf('*/', i + 2); i = end < 0 ? list.length : end + 1; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter((p) => p && !p.startsWith('...'));
}
