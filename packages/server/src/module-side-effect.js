/**
 * Whether a module runs code when it loads (#1689), read lexically from its
 * source. The dev hot swap (`dev-hot-classify.js`, through `hotVerdict` in
 * `dev/handler.js`) walks an edit up the shipped importer graph to the
 * component modules that re-import it, and a module passed through on the way
 * must have no module-scope side effect, since re-evaluating it at a new
 * version would repeat that effect in the open tab. Lifted from the component
 * elision analyser this check used to live in, which #1686 removed.
 *
 * @module module-side-effect
 */
import { redactToPlaceholders } from './js-scan.js';

/**
 * Constructors that produce inert DATA with no side effect, so a module-scope
 * `export const X = new Set([...])` (a lookup table, a compiled RegExp, a
 * parsed URL) does no work at load (#623). Any constructor NOT in this set
 * (`new WebSocket()`, `new Worker()`, `new EventSource()`, `new Audio()`) IS a
 * side effect.
 */
const PURE_DATA_CONSTRUCTORS = new Set([
  'Set', 'Map', 'WeakSet', 'WeakMap', 'Date', 'RegExp', 'Array', 'Object',
  'Number', 'String', 'Boolean', 'BigInt', 'Symbol',
  'Error', 'TypeError', 'RangeError', 'SyntaxError',
  'URL', 'URLSearchParams', 'ArrayBuffer', 'DataView',
  'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array',
  'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array',
  'BigInt64Array', 'BigUint64Array',
]);

/**
 * Marks where `hasModuleScopeSideEffect` dropped a top-level `{...}` body from
 * its depth-0 frame, so an arrow followed by a block body is not mistaken for
 * an expression body that runs on into the next statement. Removed again
 * before the call scan.
 */
const BLOCK = '\x01';

/** `function`, `function*`, `async function name` up to its parameter list's `(`. */
const FUNCTION_PARAMS_RE = /(?<![\w$.])function\s*\*?\s*(?:[A-Za-z_$][\w$]*)?\s*\(/g;

/**
 * The text before an arrow's `=>` when that arrow is a declarator initializer
 * (`const usd = (m) =>`, `let f = async x =>`, `, g = (a) =>`). The parameter
 * list must hold no parens, so a call in a parameter default
 * (`(a = init()) =>`) keeps its arrow unrecognised and still counts.
 */
const ARROW_DECLARATOR_RE =
  /(?:(?<![\w$.])(?:const|let|var)\s+|,\s*)[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*$/;

/**
 * An expression body that ends this way cannot stop at the newline (a binary
 * operator, `?`, `:`, or a curried `=>`). Postfix `++` / `--` and a regex
 * literal's closing `/` end a statement, so neither is listed.
 */
const BODY_CONTINUES_RE = /(?:=>|&&|\|\||\?\?|[?:=*%|&^<>]|(?<![+])\+|(?<![-])-)\s*$/;

/** A line starting this way continues the previous one: no statement starts with it. */
const LINE_CONTINUES_RE = /^\s*(?:\?|:|&&|\|\||\.(?![.\d])|\*|%|=(?!>)|\|)/;

/**
 * Removes the two depth-0 shapes that look like calls and run nothing at module
 * load: a `function` declaration's parameter list (a default such as
 * `now = Date.now()` runs per call) and an arrow's expression body when the
 * arrow initializes a declarator (`const usd = (m) => Math.round(m) / MICROS`).
 *
 * The arrow body ends at a `,` or `;` at its own paren/bracket depth 0, at a
 * `)` / `]` closing something outside it, or at a newline once the body has
 * content, unless `BODY_CONTINUES_RE` / `LINE_CONTINUES_RE` prove the
 * expression carries on. Ending early is always safe, because whatever is left
 * stays in the frame and is still scanned; ending late could swallow a real
 * statement, so every rule errs towards ending.
 *
 * @param {string} frame depth-0 text, with `BLOCK` where a `{...}` was dropped
 * @returns {string | null} the frame without those parts, or null when a
 *   parameter list does not close (the caller then reports a side effect)
 */
function blankDeclarationOnlyCode(frame) {
  let out = '';
  let last = 0;
  for (const m of frame.matchAll(FUNCTION_PARAMS_RE)) {
    if (m.index < last) continue;
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let close = -1;
    for (let j = open; j < frame.length; j++) {
      if (frame[j] === '(') depth++;
      else if (frame[j] === ')' && --depth === 0) { close = j; break; }
    }
    if (close < 0) return null;
    out += frame.slice(last, open + 1);
    last = close;
  }
  frame = out + frame.slice(last);

  out = '';
  let depth = 0;
  for (let i = 0; i < frame.length; i++) {
    const c = frame[i];
    if (c === '(' || c === '[') depth++;
    else if ((c === ')' || c === ']') && depth > 0) depth--;
    if (depth === 0 && c === '=' && frame[i + 1] === '>' && ARROW_DECLARATOR_RE.test(out)) {
      out += '=>';
      i = arrowBodyEnd(frame, i + 2) - 1;
      continue;
    }
    out += c;
  }
  return out;
}

/**
 * Index where an arrow's expression body starting at `start` ends (see
 * `blankDeclarationOnlyCode`).
 *
 * @param {string} frame
 * @param {number} start index just past the `=>`
 * @returns {number}
 */
function arrowBodyEnd(frame, start) {
  let depth = 0;
  let i = start;
  for (; i < frame.length; i++) {
    const c = frame[i];
    if (c === '(' || c === '[') { depth++; continue; }
    if (c === ')' || c === ']') {
      if (depth === 0) return i;
      depth--;
      continue;
    }
    if (depth > 0) continue;
    if (c === ',' || c === ';') return i;
    if (c === '\n') {
      const body = frame.slice(start, i);
      if (!body.trim() || BODY_CONTINUES_RE.test(body)) continue;
      if (LINE_CONTINUES_RE.test(frame.slice(i + 1))) continue;
      return i;
    }
  }
  return i;
}

/**
 * Module-scope work, detected by an ALLOWLIST of safe top-level forms rather
 * than a denylist of browser globals. A module that runs ANY code when it
 * loads (other than registering a component) has a side effect that a second
 * evaluation would repeat, so the dev hot swap (#1689) refuses to pass an edit
 * through it and reloads instead (`side-effect-module` in
 * `dev-hot-classify.js`). Unlike a global
 * denylist this does not rot as browsers add APIs: a brand-new global trips it
 * automatically, because it is the CALL (or `new`, or dynamic `import()`), not
 * the global's name, that is recognised.
 *
 * Rule: at brace depth 0 (so code inside function / class / method bodies and
 * template holes, which do not run at module load, is ignored), the only
 * permitted forms are declarations (`import` / `export` / `function` / `class`
 * / `const` / `let` / `var`) and the component registration call
 * (`X.register(...)` / `customElements.define(...)`). Any other call, any
 * `new`, any dynamic `import(...)`, or top-level `await` is a side effect.
 *
 * Scans the redacted copy (strings / templates / comments blanked, regex
 * literals and nested `${...}` interpolation tracked by the lexer) so template
 * prose and JSDoc cannot trip it; quoted-string bodies, which redaction keeps
 * verbatim for other rules, are blanked here too so a string like `"foo()"` or
 * `"{"` is not read as a call and cannot unbalance the brace scan. The
 * unbalanced-brace and unterminated-string fallbacks below are defense in
 * depth: with the lexer tracking regex literals, neither should trigger on
 * valid code, but if either does the module counts as having a side effect
 * rather than risk hiding one.
 *
 * PASS TYPE-ERASED SOURCE for a TypeScript module. Redaction blanks comments
 * and literals, NOT type syntax, and TS annotations are call-shaped often
 * enough to matter: `readonly (readonly [number, number, number])[]` is an
 * identifier immediately followed by `(`, so a module holding nothing but a
 * typed data literal reads as running code at module scope (#1423). The dev
 * handler strips types before it calls this; a caller handing it `.ts` source
 * as authored is opting into that false positive.
 *
 * A `function` declaration's parameter list and the expression body of an
 * arrow that initializes a `const` / `let` / `var` declarator are dropped from
 * the frame first (`blankDeclarationOnlyCode`): `now = Date.now()` and
 * `(m) => Math.round(m) / MICROS` declare code, they do not run it.
 *
 * Over-detection is safe (a pure top-level helper call, or an arrow outside a
 * declarator whose body calls something, only costs a reload). The accepted
 * residual misses, all
 * contrived and structural (so they do not rot), are a call buried inside a
 * top-level object / array initializer or a destructuring default, and a
 * side-effecting tagged-template hole evaluated at module scope.
 *
 * @param {string} src module source, type-erased if it came from a TypeScript file
 * @param {string[]} [literals] the redaction's literal bodies, when already computed
 * @returns {boolean}
 */
export function hasModuleScopeSideEffect(src, literals) {
  let redacted = src;
  if (!literals) {
    const r = redactToPlaceholders(src);
    redacted = r.redacted;
    literals = r.literals;
  }
  // Keep only depth-0 text (outside every `{}`). Skip quoted-string bodies so
  // braces/parens inside a string neither desync the depth nor read as a call.
  let depth = 0;
  let frame = '';
  for (let i = 0; i < redacted.length; i++) {
    const c = redacted[i];
    if (c === "'" || c === '"') {
      i++;
      let closed = false;
      while (i < redacted.length) {
        const d = redacted[i];
        if (d === '\\') { i += 2; continue; }
        if (d === '\n') break;       // a real quoted string never spans a newline
        if (d === c) { closed = true; break; }
        i++;
      }
      // Not closed on its line is an unterminated string OR a regex literal
      // containing a quote that desynced the upstream redaction (regex bodies
      // are not tracked, so a stray quote shifts quote pairing). Either way the
      // lexical state is unreliable below here, so answer conservatively.
      if (!closed) return true;
      if (depth === 0) frame += "''";
      continue;
    }
    if (c === '{') { if (depth === 0) frame += BLOCK; depth++; continue; }
    if (c === '}') { if (depth > 0) depth--; continue; }
    if (depth === 0) frame += c;
  }
  // Unbalanced braces mean a construct we could not lexically resolve (a regex
  // literal with a stray brace is the common case). Report a side effect
  // rather than risk a hidden top-level statement.
  if (depth !== 0) return true;
  // Parameter lists and declarator arrow bodies are declarations, not code
  // that runs at load.
  const declared = blankDeclarationOnlyCode(frame);
  if (declared === null) return true;
  frame = declared.replaceAll(BLOCK, '');
  // Optional-chaining call/index: `foo?.()`, `x?.[i]()` (the `?.` defeats the
  // identifier-before-paren match below).
  if (/\?\.\s*[([]/.test(frame)) return true;
  // Top-level `new X`: a pure-data builtin constructor (Set / Map / Date /
  // RegExp / typed array / URL / ...) is inert module data, not a side effect, so
  // it is no side effect (#623); any other constructor is one. Catches
  // both `new X` and `new X(...)` (the constructor's own `(`, if present, is
  // then skipped in the call scan below).
  for (const nm of frame.matchAll(/(?<![.\w])new\s+([A-Za-z_$][\w$]*)/g)) {
    if (!PURE_DATA_CONSTRUCTORS.has(nm[1])) return true;
  }
  // Top-level `await`.
  if (/(?<![.\w])await\s/.test(frame)) return true;
  // A call: `(` preceded (ignoring whitespace) by an identifier, `)`, or `]`.
  const CALL_RE = /(?:([A-Za-z_$][\w$]*)|[)\]])\s*\(/g;
  // Identifiers that precede a `(` WITHOUT it being a call (keywords + a
  // `function` declaration's parameter list).
  const NOT_A_CALL = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'with', 'return', 'typeof',
    'instanceof', 'void', 'delete', 'in', 'of', 'yield', 'do', 'else',
    'case', 'default', 'function', 'await', 'new', 'async',
  ]);
  let m;
  while ((m = CALL_RE.exec(frame)) !== null) {
    const ident = m[1];
    if (ident === 'import') return true;                 // dynamic import()
    if (ident && NOT_A_CALL.has(ident)) continue;
    // A `function`-declaration parameter list (`function name(` or
    // `async function name(`) is not a call.
    if (ident && /\bfunction\s*\*?\s*$/.test(frame.slice(0, m.index))) continue;
    // The component registration call is the one permitted top-level call.
    if (ident === 'register' || ident === 'define') continue;
    // `extends WebComponent(...)` is the reactive-prop factory (#597 /
    // #599): a class-declaration construct, not an independent side-effecting
    // statement. Scoped to the `extends` position, so a top-level
    // `WebComponent(...)` call used anywhere else still counts as a side
    // effect (#604).
    if (ident === 'WebComponent' && /\bextends\s+$/.test(frame.slice(0, m.index))) continue;
    // A `new X(...)` constructor call: the `new`-prefixed cases were already
    // vetted above (a non-pure constructor returned true; a pure-data one is
    // inert), so its `(` here is not an independent side-effecting call.
    if (ident && /(?<![.\w])new\s+$/.test(frame.slice(0, m.index))) continue;
    return true;                                         // any other top-level call
  }
  return false;
}
