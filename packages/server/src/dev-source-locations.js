/**
 * Dev-only source locations on rendered elements (#1499).
 *
 * Under `webjs dev` with `WEBJS_SOURCE_LOCATIONS=1`, every element opening tag
 * written in an `html` tagged template inside the app carries
 * `data-webjs-src="<app-relative-file>:<line>"`, in SSR output AND in client
 * renders, so a tool hosting the app (an inspector, click-to-edit in an
 * embedding builder) can map a clicked DOM element back to the line that wrote
 * it.
 *
 * Mechanism: a SOURCE transform, applied to the same module bytes on both
 * sides. The dev server runs it over app modules it serves to the browser
 * (`dev/serve.js`), and a load hook runs it over app modules the server imports
 * for SSR (`module.registerHooks` on Node, `Bun.plugin` on Bun). Because both
 * sides see one transform of one file, the SSR markup and the client render
 * carry identical attributes.
 *
 * Why a source transform and not a runtime one inside `html`: the runtime knows
 * a template's CALL SITE (from a stack) but not where each element sits inside
 * it, because the static strings it receives drop the text of every `${...}`
 * expression, so any multi-line hole would skew every line after it. Lexing the
 * source keeps every line exact, needs no change to `@webjsdev/core`, and the
 * inserted text never contains a newline, so every later line keeps its number
 * (stack traces included; only columns on an annotated line shift).
 *
 * What is annotated: element opening tags in the STATIC text of an `html`
 * template. The attribute goes right after the tag name, before any other
 * attribute, so attribute, property (`.x=`), event (`@x=`) and boolean (`?x=`)
 * holes keep their positions and their names. What is not: closing tags,
 * comments, `<!doctype>`, the inside of a tag or an attribute value, the body of
 * a raw-text element (`script`, `style`, `textarea`, `title`), descendants of
 * `svg` / `math` (the root element itself is annotated), document-shell and
 * head-only elements (`html`, `head`, `body`, `meta`, `link`, `base`, `title`,
 * `script`, `style`, `noscript`, `template`, `slot`), `css` / `svg` tagged
 * templates, and any untagged template literal.
 *
 * The lexer understands line and block comments, single and double quoted
 * strings, template literals with nested `${}` (including nested templates),
 * and regex literals (told apart from division by the previous token). It is a
 * dev aid, so it fails OPEN: anything it cannot make sense of is returned
 * unchanged rather than throwing.
 */
import { isAbsolute, relative, sep } from 'node:path';

/** Elements never annotated, even at the top level of a template. */
const SKIP_TAGS = new Set([
  'html', 'head', 'body', 'meta', 'link', 'base', 'title',
  'script', 'style', 'noscript', 'template', 'slot',
]);

/** Raw-text elements: their body is text up to the matching close tag. */
const RAW_TAGS = new Set(['script', 'style', 'textarea', 'title']);

/** Foreign-content roots: annotate the root, never its descendants. */
const FOREIGN_TAGS = new Set(['svg', 'math']);

/** Keywords after which a `/` starts a regex rather than a division. */
const REGEX_AFTER_KEYWORDS = new Set([
  'return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete',
  'void', 'throw', 'instanceof', 'yield', 'await',
]);

/** The env var that turns the feature on (dev only). */
export const SOURCE_LOCATIONS_ENV = 'WEBJS_SOURCE_LOCATIONS';

/**
 * Whether the env asks for source locations. Read by the dev handler once, at
 * construction; the caller also requires `dev`, so production never consults it.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {boolean}
 */
export function sourceLocationsRequested(env = process.env) {
  const v = String(env[SOURCE_LOCATIONS_ENV] || '').trim().toLowerCase();
  return v === '1' || v === 'true';
}

/**
 * Whether `abs` is an app module the transform should touch: inside `appDir`,
 * not under `node_modules`, not a `*.server.*` module (server actions and
 * server-only utilities never render to the page through a component, and the
 * `'use server'` load hook owns them), and a JS / TS module.
 *
 * @param {string} abs absolute file path (no query)
 * @param {string} appDir absolute app root
 * @returns {boolean}
 */
export function isSourceLocationCandidate(abs, appDir) {
  if (!abs || !appDir) return false;
  const rel = relative(appDir, abs);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return false;
  if (rel.split(/[\\/]/).includes('node_modules')) return false;
  if (!/\.m?[jt]s$/.test(abs)) return false;
  if (/\.server\.m?[jt]s$/.test(abs)) return false;
  return true;
}

/**
 * The attribute value for a file: the app-relative path with forward slashes.
 * Characters that could end the attribute, the template literal, or start a
 * hole are percent-encoded, so the inserted text is always inert.
 *
 * @param {string} abs
 * @param {string} appDir
 * @returns {string}
 */
export function sourceLocationFile(abs, appDir) {
  return relative(appDir, abs).split(sep).join('/')
    .replace(/["'<>&`$\\\s]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
}

/**
 * Annotate every element opening tag in the `html` templates of `source`.
 * Returns the source unchanged when it has no `html` template (or on any
 * lexing surprise). Never adds or removes a newline.
 *
 * @param {string} source module source, JavaScript or erasable TypeScript
 * @param {string} file the attribute's file part (app-relative, see `sourceLocationFile`)
 * @returns {string}
 */
export function annotateSourceLocations(source, file) {
  if (typeof source !== 'string' || !source.includes('html')) return source;
  try {
    const inserts = collectInserts(source, file);
    if (!inserts.length) return source;
    let out = '';
    let last = 0;
    for (const [at, text] of inserts) {
      out += source.slice(last, at) + text;
      last = at;
    }
    return out + source.slice(last);
  } catch {
    return source;
  }
}

/**
 * Lex `src` and return `[offset, text]` insertions, in ascending order.
 *
 * @param {string} src
 * @param {string} file
 * @returns {Array<[number, string]>}
 */
function collectInserts(src, file) {
  /** @type {Array<[number, string]>} */
  const inserts = [];
  const n = src.length;
  let i = 0;
  // 1-based line of `src[i]`, maintained by `advance`-style bookkeeping: every
  // place that skips characters counts the newlines it passes.
  let line = 1;
  // The previous significant token, for regex-vs-division: 'id' (with its
  // text in prevWord), 'num', 'str', 'close' (`)` / `]` / `}` ending an
  // expression), or 'punct'.
  let prev = 'punct';
  let prevWord = '';
  let prevWordStart = -1;
  // Stack of brace contexts. A '{' frame is an ordinary block; a 'tpl' frame
  // is a `${` inside a template, and its matching `}` resumes that template.
  /** @type {Array<{ kind: 'brace' } | { kind: 'tpl', html: HtmlState | null }>} */
  const stack = [];

  /** @param {number} from @param {number} to */
  const countLines = (from, to) => {
    for (let k = from; k < to; k++) if (src.charCodeAt(k) === 10) line++;
  };

  /**
   * Scan template literal text starting at `i` (just after a backtick or a
   * hole's closing brace). Stops after the closing backtick (returns 'end') or
   * after a `${` (returns 'hole'). Feeds static text to the html machine.
   * @param {HtmlState | null} html
   * @returns {'end' | 'hole'}
   */
  const scanTemplateText = (html) => {
    while (i < n) {
      const c = src[i];
      if (c === '\\') {
        // An escape is static text the html machine sees as an opaque char.
        if (html) html.feed(src, i, line);
        if (src[i + 1] === '\n') line++;
        i += 2;
        continue;
      }
      if (c === '`') { i++; return 'end'; }
      if (c === '$' && src[i + 1] === '{') { i += 2; return 'hole'; }
      if (html) {
        const ins = html.feed(src, i, line);
        if (ins !== -1) inserts.push([ins, ` data-webjs-src="${file}:${line}"`]);
      }
      if (c === '\n') line++;
      i++;
    }
    throw new Error('unterminated template');
  };

  /**
   * Enter a template literal whose backtick is at `i`.
   * @param {boolean} isHtml
   */
  const enterTemplate = (isHtml) => {
    i++; // the backtick
    const html = isHtml ? new HtmlState() : null;
    const r = scanTemplateText(html);
    if (r === 'hole') { stack.push({ kind: 'tpl', html }); prev = 'punct'; }
    else prev = 'str';
  };

  while (i < n) {
    const c = src[i];
    const cc = src.charCodeAt(i);
    // Whitespace.
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || cc === 0xfeff || cc === 0xa0 || cc === 0x2028 || cc === 0x2029) { i++; continue; }
    // Comments.
    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      i = end === -1 ? n : end;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end === -1) throw new Error('unterminated comment');
      countLines(i, end);
      i = end + 2;
      continue;
    }
    // Strings.
    if (c === '"' || c === "'") {
      let k = i + 1;
      while (k < n && src[k] !== c) {
        if (src[k] === '\\') k++;
        else if (src[k] === '\n') throw new Error('unterminated string');
        k++;
      }
      countLines(i, k);
      i = k + 1;
      prev = 'str';
      continue;
    }
    // Template literals: tagged with `html` (and not a property access like
    // `foo.html`) means annotate.
    if (c === '`') {
      const isHtml = prev === 'id' && prevWord === 'html' && !isPropertyAccess(src, prevWordStart);
      enterTemplate(isHtml);
      continue;
    }
    // Identifiers and keywords.
    if (isIdStart(cc)) {
      const start = i;
      while (i < n && isIdPart(src.charCodeAt(i))) i++;
      prevWord = src.slice(start, i);
      prevWordStart = start;
      prev = 'id';
      continue;
    }
    // Numbers.
    if (cc >= 48 && cc <= 57) {
      while (i < n && /[0-9a-zA-Z_.]/.test(src[i])) i++;
      prev = 'num';
      continue;
    }
    // Regex literal vs division.
    if (c === '/') {
      const regexAllowed = prev === 'punct' || (prev === 'id' && REGEX_AFTER_KEYWORDS.has(prevWord));
      if (regexAllowed) {
        let k = i + 1;
        let inClass = false;
        while (k < n) {
          const d = src[k];
          if (d === '\\') { k += 2; continue; }
          if (d === '\n') throw new Error('unterminated regex');
          if (inClass) { if (d === ']') inClass = false; }
          else if (d === '[') inClass = true;
          else if (d === '/') break;
          k++;
        }
        i = k + 1;
        while (i < n && isIdPart(src.charCodeAt(i))) i++; // flags
        prev = 'str';
        continue;
      }
      i++;
      prev = 'punct';
      continue;
    }
    // Braces drive the template-hole stack.
    if (c === '{') { stack.push({ kind: 'brace' }); i++; prev = 'punct'; continue; }
    if (c === '}') {
      const top = stack.pop();
      i++;
      if (top && top.kind === 'tpl') {
        // Back inside the template the hole interrupted.
        const r = scanTemplateText(top.html);
        if (r === 'hole') { stack.push(top); prev = 'punct'; }
        else prev = 'str';
        continue;
      }
      prev = 'close';
      continue;
    }
    if (c === ')' || c === ']') { i++; prev = 'close'; continue; }
    // Any other punctuation.
    i++;
    prev = 'punct';
  }
  return inserts;
}

/**
 * The HTML tokenizer state for one `html` template, carried across holes so an
 * attribute value or a raw-text body that a hole interrupts stays recognised.
 */
class HtmlState {
  constructor() {
    /** @type {'text' | 'tag' | 'dq' | 'sq' | 'comment' | 'raw'} */
    this.mode = 'text';
    /** Tag name of the tag being read (lowercased), '' for a close / bang tag. */
    this.tag = '';
    /** True while reading a closing tag. */
    this.closing = false;
    /** Raw-text element whose body we are in. */
    this.rawTag = '';
    /** Depth inside svg / math. */
    this.foreign = 0;
    /** The previous char in `tag` mode, to spot a self-closing `/>`. */
    this.lastTagChar = '';
  }

  /**
   * Feed the static char at `src[i]`. Returns the offset to insert the
   * attribute at (just past an annotatable tag name), else -1.
   * @param {string} src
   * @param {number} i
   * @param {number} _line
   * @returns {number}
   */
  feed(src, i, _line) {
    const c = src[i];
    switch (this.mode) {
      case 'text': {
        if (c !== '<') return -1;
        if (src.startsWith('<!--', i)) { this.mode = 'comment'; return -1; }
        const next = src[i + 1];
        if (next === '/') {
          const name = readTagName(src, i + 2);
          this.mode = 'tag';
          this.closing = true;
          this.tag = name.toLowerCase();
          this.lastTagChar = '';
          if (FOREIGN_TAGS.has(this.tag) && this.foreign > 0) this.foreign--;
          return -1;
        }
        if (next === '!' || next === '?') {
          this.mode = 'tag';
          this.closing = true; // treated like a close tag: never annotated
          this.tag = '';
          this.lastTagChar = '';
          return -1;
        }
        const name = readTagName(src, i + 1);
        if (!name || !/^[A-Za-z]/.test(name)) return -1; // a bare `<` in text
        this.mode = 'tag';
        this.closing = false;
        this.tag = name.toLowerCase();
        this.lastTagChar = '';
        if (this.foreign > 0 || SKIP_TAGS.has(this.tag)) return -1;
        return i + 1 + name.length;
      }
      case 'comment': {
        if (c === '>' && src[i - 1] === '-' && src[i - 2] === '-') this.mode = 'text';
        return -1;
      }
      case 'dq': {
        if (c === '"') this.mode = 'tag';
        return -1;
      }
      case 'sq': {
        if (c === "'") this.mode = 'tag';
        return -1;
      }
      case 'raw': {
        if (c === '<' && src[i + 1] === '/' &&
          readTagName(src, i + 2).toLowerCase() === this.rawTag) {
          this.mode = 'tag';
          this.closing = true;
          this.tag = this.rawTag;
          this.rawTag = '';
          this.lastTagChar = '';
        }
        return -1;
      }
      case 'tag': {
        if (c === '"') { this.mode = 'dq'; return -1; }
        if (c === "'") { this.mode = 'sq'; return -1; }
        if (c === '>') {
          const selfClosing = this.lastTagChar === '/';
          this.mode = 'text';
          if (!this.closing && !selfClosing) {
            if (RAW_TAGS.has(this.tag)) { this.mode = 'raw'; this.rawTag = this.tag; }
            else if (FOREIGN_TAGS.has(this.tag)) this.foreign++;
          }
          return -1;
        }
        if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') this.lastTagChar = c;
        return -1;
      }
    }
    return -1;
  }
}

/**
 * Read an HTML tag name starting at `at` (letters, digits, `-`, `:`, `_`, `.`).
 * @param {string} src
 * @param {number} at
 * @returns {string}
 */
function readTagName(src, at) {
  let k = at;
  while (k < src.length && /[A-Za-z0-9\-:_.]/.test(src[k])) k++;
  return src.slice(at, k);
}

/**
 * Whether the identifier starting at `start` is a member access (`x.html`,
 * `x?.html`), skipping whitespace back to the previous character.
 * @param {string} src
 * @param {number} start
 * @returns {boolean}
 */
function isPropertyAccess(src, start) {
  let k = start - 1;
  while (k >= 0 && /\s/.test(src[k])) k--;
  return k >= 0 && src[k] === '.';
}

/** @param {number} cc */
function isIdStart(cc) {
  return (cc >= 65 && cc <= 90) || (cc >= 97 && cc <= 122) || cc === 36 || cc === 95 || cc > 127;
}

/** @param {number} cc */
function isIdPart(cc) {
  return isIdStart(cc) || (cc >= 48 && cc <= 57);
}
