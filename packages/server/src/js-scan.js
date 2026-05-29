/**
 * Low-level lexical scanning helpers shared by the convention validator
 * (`check.js`) and the component-elision analyser (`component-elision.js`).
 *
 * These are deliberately regex + hand-rolled-walker based, NOT a full TS
 * parse. The framework prioritises fast dev-time rebuilds; a real parser
 * would be ~50x slower for patterns this shallow. Each helper documents
 * the trade-offs it accepts.
 */

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
 * Regex literals are NOT specifically tracked. A `/.../` in source
 * that contains text resembling a comment-open or quote would be
 * misread by this walker, but the lint rules don't look for
 * patterns that would collide with regex bodies (`class extends`,
 * `enum`, etc. are not valid regex syntax). Acceptable until
 * proven otherwise.
 *
 * @param {string} src
 * @returns {string}
 */
export function redactStringsAndTemplates(src) {
  let out = '';
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];

    // Line comment: //...\n
    if (c === '/' && next === '/') {
      out += '//';
      i += 2;
      while (i < n && src[i] !== '\n') {
        out += ' ';
        i++;
      }
      // Newline handled by outer loop on next iteration.
      continue;
    }

    // Block comment: /* ... */
    if (c === '/' && next === '*') {
      out += '/*';
      i += 2;
      while (i < n) {
        if (src[i] === '*' && src[i + 1] === '/') {
          out += '*/';
          i += 2;
          break;
        }
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      continue;
    }

    // Single- or double-quoted string: KEEP the body verbatim so
    // rules like tag-name-has-hyphen can read register('foo').
    if (c === "'" || c === '"') {
      const quote = c;
      out += quote;
      i++;
      while (i < n) {
        if (src[i] === '\\' && i + 1 < n) {
          out += src[i];
          out += src[i + 1];
          i += 2;
          continue;
        }
        if (src[i] === quote) {
          out += quote;
          i++;
          break;
        }
        if (src[i] === '\n') {
          // Unterminated; emit and continue.
          out += '\n';
          i++;
          break;
        }
        out += src[i];
        i++;
      }
      continue;
    }

    // Template literal: see the JSDoc above for the tag + shape
    // classification. Delimiters always stay so structural scanners
    // see them.
    if (c === '`') {
      // Walk back through whitespace to find the previous
      // significant character. Newlines count as whitespace so
      // `const x = html\n  ` ... `` `(ASI-style line break between tag
      // and backtick) is still recognized as tagged.
      let j = out.length - 1;
      while (j >= 0 && /\s/.test(out[j])) j--;
      const prev = j >= 0 ? out[j] : '';
      const isTagged = /[A-Za-z0-9_$)\]]/.test(prev);

      let endIdx = -1;
      let hasInterp = false;
      let hasNewline = false;
      let k = i + 1;
      while (k < n) {
        if (src[k] === '\\' && k + 1 < n) { k += 2; continue; }
        if (src[k] === '`') { endIdx = k; break; }
        if (src[k] === '\n') hasNewline = true;
        if (src[k] === '$' && src[k + 1] === '{') hasInterp = true;
        k++;
      }
      const preserveVerbatim = !isTagged && endIdx !== -1 && !hasNewline && !hasInterp;

      out += '`';
      i++;
      if (preserveVerbatim) {
        while (i < n) {
          if (src[i] === '\\' && i + 1 < n) {
            out += src[i];
            out += src[i + 1];
            i += 2;
            continue;
          }
          if (src[i] === '`') {
            out += '`';
            i++;
            break;
          }
          out += src[i];
          i++;
        }
      } else {
        while (i < n) {
          if (src[i] === '\\' && i + 1 < n) {
            out += ' ';
            out += src[i + 1] === '\n' ? '\n' : ' ';
            i += 2;
            continue;
          }
          if (src[i] === '`') {
            out += '`';
            i++;
            break;
          }
          out += src[i] === '\n' ? '\n' : ' ';
          i++;
        }
      }
      continue;
    }

    out += c;
    i++;
  }
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
