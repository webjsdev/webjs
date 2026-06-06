/**
 * Low-level lexical scanning helpers shared by the convention validator
 * (`check.js`) and the component-elision analyser (`component-elision.js`).
 *
 * These are deliberately a hand-rolled lexer, NOT a full TS parse. The
 * framework prioritises fast dev-time rebuilds; a real parser would be ~50x
 * slower for patterns this shallow. The lexer tracks the JS lexical grammar
 * (strings, regex literals, comments, and templates with nested `${...}`
 * interpolation) so structural scanners never trip on a literal's contents.
 */

/**
 * Keywords after which a `/` opens a regex literal rather than dividing
 * (`return /re/`, `typeof /re/`). After a plain identifier or number a `/` is
 * division. Used by the lexer's regex-versus-division decision.
 */
const REGEX_PRECEDING_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'do', 'else', 'case', 'yield', 'await', 'throw',
]);

/**
 * Return `src` with the BODY of every comment, single-quoted string,
 * double-quoted string, and template literal replaced by spaces (with
 * newlines preserved). Quote delimiters / comment markers themselves
 * are kept so the brace counter and other structural scanners still
 * see the surrounding shape. Positions (line + column) are preserved
 * exactly, so a violation reported against the redacted source maps
 * back to the same line/column in the original.
 *
 * The point: lint rules that pattern-match across raw source (regex
 * for `class X extends WebComponent`, `enum`, `register('tag')`,
 * etc.) must not match the same pattern when it appears as a
 * code-example string INSIDE an `html\`...\`` template body. Docs
 * pages legitimately render such examples to teach users; without
 * redaction the scanner reads them as real declarations and emits
 * false positives.
 *
 * Template literals split by tag + shape:
 *
 * Preserved verbatim only when ALL of: untagged, no newline in the
 * body, no `${...}` interpolation. This is the "backticks as a
 * quote-style alias" shape, e.g. `` register(`my-tag`) ``, where
 * the backtick literal is morally a short string argument. Lint
 * rules then read it the same way they read `register('my-tag')`.
 *
 * Blanked in every other case:
 *   (a) TAGGED templates like `` html`...` ``, `` css`...` ``,
 *       `` Class.method`...` ``, which carry multi-line code-shaped
 *       strings in docs pages and JSDoc examples.
 *   (b) Multi-line untagged literals, typically code-shaped
 *       fixtures the linter should not read in place.
 *   (c) Interpolated literals; the `${...}` body is dynamic and
 *       cannot be statically validated anyway.
 *
 * A real `register('foo')` call inside a blanked region (e.g.
 * inside a tagged interpolation `` html`${X.register('foo')}` ``)
 * disappears from the lint surface. Accepted trade-off: register()
 * calls in practice live at top-level in component files, not
 * inside template interpolations.
 *
 * Regex literals ARE tracked. A `/.../` in expression position (decided by
 * the previous significant token, the standard regex-versus-division rule)
 * has its body blanked with the `/` delimiters kept, so a quote, brace, or
 * comment-like sequence inside a regex cannot desync the walker. Template
 * literals are tracked with full `${...}` interpolation and arbitrary
 * nesting, so a nested `` html`...${html`...`}...` `` is delimited correctly
 * (the inner backtick is not mistaken for the outer close).
 *
 * `blankStrings` (default false, so existing callers are byte-identical)
 * additionally blanks PLAIN string bodies and disables the verbatim-template
 * fast path, yielding a mask in which NO literal body survives. Callers that
 * only check whether a keyword sits in code position (not inside any literal),
 * e.g. the import-versioning pass, pass true so an `import '…'` written inside
 * a plain string is correctly masked out (the default mask keeps plain-string
 * bodies verbatim so `register('tag')` stays readable, which would otherwise
 * leave such a string looking like a real import).
 *
 * @param {string} src
 * @param {boolean} [blankStrings=false]  also blank plain-string + verbatim-template bodies
 * @returns {string}
 */
export function redactStringsAndTemplates(src, blankStrings = false) {
  const n = src.length;
  let out = '';
  let i = 0;
  // Previous significant token in code position, tracked as we walk (more
  // robust than scanning `out`, whose tail is blanked spaces inside a hole).
  // `lastSig` is the last non-whitespace source char; `lastWord` is the last
  // identifier. Both drive regex-versus-division and tagged-template decisions.
  let lastSig = '';
  let lastWord = '';
  // Whether `lastWord` was a property access (`.of`, `?.in`). A member named
  // like a keyword is a value, never a regex-preceding keyword.
  let lastWordIsProp = false;
  // Whether the last two significant chars formed a postfix `++` / `--`. A
  // postfix increment/decrement yields a value, so a following `/` is division
  // (`a++ / 2`), not a regex start. Without this the `/` opens a phantom regex
  // that blanks to the next `/`, swallowing a following module-scope call.
  let lastWasIncDec = false;
  // After a literal (string/regex/template) the next `/` is division and the
  // next backtick is a tag, so mark a value-ender.
  const markValue = () => { lastSig = 'x'; lastWord = ''; lastWordIsProp = false; lastWasIncDec = false; };

  // `/` opens a regex unless the previous token is a value (identifier that is
  // not a regex-preceding keyword, number, `)`, `]`, or a literal).
  const isRegex = () => {
    if (lastSig === '') return true;
    if (lastSig === ')' || lastSig === ']') return false;
    if (lastSig === "'" || lastSig === '"' || lastSig === '`') return false;
    if (lastWasIncDec) return false;   // postfix `a++` / `a--` is a value
    if (/[\w$]/.test(lastSig)) return !lastWordIsProp && REGEX_PRECEDING_KEYWORDS.has(lastWord);
    return true;
  };
  // A template is tagged when the previous token is a value.
  const isTagged = () => /[\w$)\]'"`]/.test(lastSig);

  const scanLineComment = () => {
    out += '//'; i += 2;
    while (i < n && src[i] !== '\n') { out += ' '; i++; }
  };
  const scanBlockComment = () => {
    out += '/*'; i += 2;
    while (i < n) {
      if (src[i] === '*' && src[i + 1] === '/') { out += '*/'; i += 2; return; }
      out += src[i] === '\n' ? '\n' : ' '; i++;
    }
  };
  const scanRegex = () => {
    out += '/'; i++;
    let inClass = false;
    while (i < n) {
      const d = src[i];
      if (d === '\\' && i + 1 < n) { out += '  '; i += 2; continue; }
      if (d === '\n') break;                 // unterminated regex
      if (d === '[') inClass = true;
      else if (d === ']') inClass = false;
      else if (d === '/' && !inClass) { out += '/'; i++; break; }
      out += ' '; i++;
    }
    markValue();
  };
  // Strings: KEEP the body verbatim at top level (so tag-name-has-hyphen can
  // read register('foo')); blank it when inside an already-blanked hole.
  const scanString = (q, blank) => {
    out += q; i++;
    while (i < n) {
      if (src[i] === '\\' && i + 1 < n) { out += blank ? '  ' : src[i] + src[i + 1]; i += 2; continue; }
      if (src[i] === q) { out += q; i++; break; }
      if (src[i] === '\n') { out += '\n'; i++; break; }   // unterminated
      out += blank ? ' ' : src[i]; i++;
    }
    markValue();
  };
  // Template literal. `forceBlank` is set when already inside a blanked hole
  // (everything nested blanks regardless of tag/shape).
  const scanTemplate = (forceBlank) => {
    const tagged = isTagged();
    let hasInterp = false, hasNewline = false, closed = false, depth = 0, k = i + 1;
    while (k < n) {
      const ch = src[k];
      if (ch === '\\') { k += 2; continue; }
      if (depth === 0 && ch === '`') { closed = true; break; }
      if (ch === '$' && src[k + 1] === '{') { hasInterp = true; depth++; k += 2; continue; }
      else if (ch === '{' && depth > 0) depth++;
      else if (ch === '}' && depth > 0) depth--;
      if (ch === '\n') hasNewline = true;
      k++;
    }
    const verbatim = !forceBlank && !blankStrings && !tagged && closed && !hasNewline && !hasInterp;
    out += '`'; i++;
    if (verbatim) {
      while (i < n) {
        if (src[i] === '\\' && i + 1 < n) { out += src[i] + src[i + 1]; i += 2; continue; }
        if (src[i] === '`') { out += '`'; i++; break; }
        out += src[i]; i++;
      }
      markValue();
      return;
    }
    // Blanked template: blank the literal text, recurse through `${...}` holes
    // (scanned as blanked code, so nested templates/strings/regexes inside a
    // hole are delimited correctly and never desync the outer scan).
    while (i < n) {
      const c = src[i];
      if (c === '\\' && i + 1 < n) { out += ' '; out += src[i + 1] === '\n' ? '\n' : ' '; i += 2; continue; }
      if (c === '`') { out += '`'; i++; break; }
      if (c === '$' && src[i + 1] === '{') {
        out += '  '; i += 2;
        scanCode(true, true);
        if (i < n && src[i] === '}') { out += ' '; i++; }
        continue;
      }
      out += c === '\n' ? '\n' : ' '; i++;
    }
    markValue();
  };

  // Scan code. `stopHole`: return at the `}` that closes the enclosing template
  // hole (the caller emits it). `blank`: emit spaces for code (inside a blanked
  // hole). Literals are always lexed so braces/quotes inside them never count.
  function scanCode(stopHole, blank) {
    let brace = 0;
    while (i < n) {
      const c = src[i], next = src[i + 1];
      if (stopHole && c === '}' && brace === 0) return;
      if (c === '/' && next === '/') { scanLineComment(); continue; }
      if (c === '/' && next === '*') { scanBlockComment(); continue; }
      if (c === '/' && isRegex()) { scanRegex(); continue; }
      if (c === "'" || c === '"') { scanString(c, blank || blankStrings); continue; }
      if (c === '`') { scanTemplate(blank); continue; }
      if (c === '{') { brace++; lastSig = '{'; lastWord = ''; lastWasIncDec = false; out += blank ? ' ' : c; i++; continue; }
      if (c === '}') { brace--; lastSig = '}'; lastWord = ''; lastWasIncDec = false; out += blank ? ' ' : c; i++; continue; }
      if (/[A-Za-z_$]/.test(c)) {
        const prop = lastSig === '.';   // member access -> a value, not a keyword
        let w = '';
        while (i < n && /[\w$]/.test(src[i])) { w += src[i]; out += blank ? ' ' : src[i]; i++; }
        lastWord = w; lastSig = w[w.length - 1]; lastWordIsProp = prop; lastWasIncDec = false;
        continue;
      }
      if (/\s/.test(c)) { out += c === '\n' ? '\n' : (blank ? ' ' : c); i++; continue; }
      // A `++` / `--` repeats the operator char; the second one forms a postfix
      // op when it followed a value (identifier / `)` / `]`), the only case that
      // matters for the regex-vs-division decision here.
      lastWasIncDec = (c === '+' || c === '-') && c === lastSig;
      lastSig = c; lastWord = ''; out += blank ? ' ' : c; i++;
    }
  }

  scanCode(false, false);
  return out;
}

/**
 * Blank ONLY comments, keeping string AND template-literal content verbatim
 * (position-preserving: same length, newlines kept). The sibling
 * `redactStringsAndTemplates` blanks templates too, which is wrong for callers
 * that need to read inside `html` templates (the elision render-tag scanner) or
 * inside string arguments (`whenDefined('tag')`). This keeps both and removes
 * only comment text, so prose in a comment cannot be read as a real signal
 * (issue #179). It reuses the same regex-versus-division and tagged-template
 * disambiguation so a `//` inside a string/template/regex is never mistaken for
 * a comment.
 *
 * @param {string} src
 * @returns {string} src with comment bodies blanked, everything else verbatim
 */
export function maskComments(src) {
  const n = src.length;
  let out = '';
  let i = 0;
  let lastSig = '';
  let lastWord = '';
  let lastWordIsProp = false;
  let lastWasIncDec = false;
  const markValue = () => { lastSig = 'x'; lastWord = ''; lastWordIsProp = false; lastWasIncDec = false; };
  const isRegex = () => {
    if (lastSig === '') return true;
    if (lastSig === ')' || lastSig === ']') return false;
    if (lastSig === "'" || lastSig === '"' || lastSig === '`') return false;
    if (lastWasIncDec) return false;
    if (/[\w$]/.test(lastSig)) return !lastWordIsProp && REGEX_PRECEDING_KEYWORDS.has(lastWord);
    return true;
  };
  // Comments: blank the body (keep the `//` / `/* */` delimiters and newlines).
  const scanLineComment = () => { out += '//'; i += 2; while (i < n && src[i] !== '\n') { out += ' '; i++; } };
  const scanBlockComment = () => {
    out += '/*'; i += 2;
    while (i < n) {
      if (src[i] === '*' && src[i + 1] === '/') { out += '*/'; i += 2; return; }
      out += src[i] === '\n' ? '\n' : ' '; i++;
    }
  };
  // String / template / regex: copy verbatim, but lex correctly so a `//` or
  // `/*` inside them is not treated as a comment.
  const scanString = (q) => {
    out += q; i++;
    while (i < n) {
      if (src[i] === '\\' && i + 1 < n) { out += src[i] + src[i + 1]; i += 2; continue; }
      if (src[i] === q) { out += q; i++; break; }
      if (src[i] === '\n') { out += '\n'; i++; break; }
      out += src[i]; i++;
    }
    markValue();
  };
  const scanRegex = () => {
    out += '/'; i++;
    let inClass = false;
    while (i < n) {
      const d = src[i];
      if (d === '\\' && i + 1 < n) { out += d + src[i + 1]; i += 2; continue; }
      if (d === '\n') break;
      if (d === '[') inClass = true;
      else if (d === ']') inClass = false;
      else if (d === '/' && !inClass) { out += '/'; i++; break; }
      out += d; i++;
    }
    markValue();
  };
  const scanTemplate = () => {
    out += '`'; i++;
    while (i < n) {
      const c = src[i];
      if (c === '\\' && i + 1 < n) { out += c + src[i + 1]; i += 2; continue; }
      if (c === '`') { out += '`'; i++; break; }
      if (c === '$' && src[i + 1] === '{') { out += '${'; i += 2; scanCode(true); if (i < n && src[i] === '}') { out += '}'; i++; } continue; }
      out += c; i++;
    }
    markValue();
  };
  function scanCode(stopHole) {
    let brace = 0;
    while (i < n) {
      const c = src[i], next = src[i + 1];
      if (stopHole && c === '}' && brace === 0) return;
      if (c === '/' && next === '/') { scanLineComment(); continue; }
      if (c === '/' && next === '*') { scanBlockComment(); continue; }
      if (c === '/' && isRegex()) { scanRegex(); continue; }
      if (c === "'" || c === '"') { scanString(c); continue; }
      if (c === '`') { scanTemplate(); continue; }
      if (c === '{') { brace++; lastSig = '{'; lastWord = ''; lastWasIncDec = false; out += c; i++; continue; }
      if (c === '}') { brace--; lastSig = '}'; lastWord = ''; lastWasIncDec = false; out += c; i++; continue; }
      if (/[A-Za-z_$]/.test(c)) {
        const prop = lastSig === '.';
        let w = '';
        while (i < n && /[\w$]/.test(src[i])) { w += src[i]; out += src[i]; i++; }
        lastWord = w; lastSig = w[w.length - 1]; lastWordIsProp = prop; lastWasIncDec = false;
        continue;
      }
      if (/\s/.test(c)) { out += c; i++; continue; }
      lastWasIncDec = (c === '+' || c === '-') && c === lastSig;
      lastSig = c; lastWord = ''; out += c; i++;
    }
  }
  scanCode(false);
  return out;
}

/**
 * Extract the body of every `class … extends WebComponent { … }` block.
 * Brace-counts to handle nested template literals, methods, and arrow
 * functions. String state is tracked so braces inside strings/templates
 * don't shift depth.
 *
 * @param {string} content
 * @returns {string[]}
 */
export function extractWebComponentClassBodies(content) {
  const bodies = [];
  const re = /class\s+\w+\s+extends\s+WebComponent\s*\{/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const bodyStart = m.index + m[0].length;
    const end = matchClosingBrace(content, bodyStart);
    if (end !== -1) bodies.push(content.slice(bodyStart, end));
  }
  return bodies;
}

/**
 * Walk forward from `start` (just after an opening `{`) and return the
 * index of the matching `}`. Tracks string/template-literal state so
 * `}` inside `'…'`, `"…"`, or backtick templates don't decrement depth.
 * Returns -1 if no balanced brace is found.
 *
 * @param {string} s
 * @param {number} start
 */
export function matchClosingBrace(s, start) {
  let depth = 1;
  let i = start;
  let str = ''; // '', "'", '"', or backtick
  while (i < s.length) {
    const c = s[i];
    if (str) {
      if (c === '\\') { i += 2; continue; }
      if (c === str) str = '';
      else if (str === '`' && c === '$' && s[i + 1] === '{') {
        // template hole, count its closing `}` toward our brace depth.
        depth++;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { str = c; i++; continue; }
    if (c === '/' && s[i + 1] === '/') { // line comment
      while (i < s.length && s[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && s[i + 1] === '*') { // block comment
      i += 2;
      while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
    i++;
  }
  return -1;
}
