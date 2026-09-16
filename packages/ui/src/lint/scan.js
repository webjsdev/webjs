/**
 * The class-site scanner behind `webjsui lint`: where in a module the linter
 * reads Tailwind classes from. Pure over `(source, { helpers, cnNames })`, no
 * filesystem, so every rule test is a string in and an array out.
 *
 * A CLASS SITE is one of three shapes, and they are the complete set:
 *
 *   1. Template attribute site. A `class=` attribute inside an OPEN TAG inside
 *      an `html` tagged template. Nested `html` templates inside holes are
 *      recursed into (the blog's positives all sit inside
 *      `${cond ? html\`...\` : ''}`).
 *   2. Helper argument site. Every string literal lexically inside a call to a
 *      recognized `cn(` (the app's utils alias) anywhere in the module. A
 *      recognized `*Class(` helper call contributes its NAME (the class beside
 *      it is composed with that helper) and its own arguments are never read
 *      as classes, since `buttonClass({ variant: 'secondary' })` carries option
 *      values, not classes.
 *   3. Hole site. Every string literal inside a `class=${...}` hole.
 *
 * Sites 2 and 3 overlap (`class=${cn(buttonClass(), 'w-9')}`) and a `cn` call
 * inside a class hole feeds the hole's site rather than opening a second one,
 * so one string is never reported twice.
 *
 * The TAG-REGION requirement is what makes an escaped code sample inert: a
 * `class=` is a site only when a literal `<` followed by a tag-name character
 * opened a tag that a `>` has not yet closed. In a docs page the markup is
 * written `&lt;p class="..."&gt;`, so no tag is ever open and nothing is read.
 * This is a structural rule, not a "does this look like a docs page" guess.
 *
 * A class string spanning a hole is split at the hole boundary. Each static
 * run is tokenized on whitespace, and a token touching a hole with no
 * intervening whitespace is DROPPED as a fragment (`class="text-${size} p-2"`
 * yields only `p-2`). Nothing is reconstructed across a hole.
 *
 * The lexer is hand-rolled, borrowing the regex-versus-division and nested
 * `${...}` handling of `@webjsdev/server`'s `js-scan.js`. It is NOT imported:
 * this package must not depend on `@webjsdev/server`, and that module blanks
 * template bodies while this one must read them.
 *
 * @module lint/scan
 */

import { dirname, resolve, sep } from 'node:path';

/**
 * @typedef {{ name: string, offset: number, line: number, column: number }} ClassToken
 * @typedef {{
 *   kind: 'attribute'|'hole'|'call',
 *   offset: number, line: number, column: number,
 *   classes: ClassToken[],
 *   helpers: string[],
 * }} ClassSite
 */

const REGEX_PRECEDING_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'do', 'else', 'case', 'yield', 'await', 'throw',
]);

/**
 * Scan one module's source for class sites.
 *
 * @param {string} src
 * @param {{ helpers?: Iterable<string>, cnNames?: Iterable<string> }} [opts]
 * @returns {ClassSite[]}
 */
export function scanClassSites(src, opts = {}) {
  const helpers = new Set(opts.helpers ?? []);
  const cnNames = new Set(opts.cnNames ?? ['cn']);
  const n = src.length;
  /** @type {ClassSite[]} */
  const sites = [];
  const lineStarts = [0];
  for (let k = 0; k < n; k++) if (src[k] === '\n') lineStarts.push(k + 1);
  const pos = (offset) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= offset) lo = mid; else hi = mid - 1;
    }
    return { line: lo + 1, column: offset - lineStarts[lo] + 1 };
  };
  const newSite = (kind, offset) => ({ kind, offset, ...pos(offset), classes: [], helpers: [] });
  const emit = (site) => { if (site.classes.length) sites.push(site); };

  /** @type {ClassSite[]} the active collector stack (innermost last) */
  const collectors = [];
  let mute = 0;
  const active = () => (collectors.length ? collectors[collectors.length - 1] : null);
  const pushTokens = (site, text, base) => {
    const re = /\S+/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      site.classes.push({ name: m[0], offset: base + m.index, ...pos(base + m.index) });
    }
  };

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

  const scanLineComment = () => { i += 2; while (i < n && src[i] !== '\n') i++; };
  const scanBlockComment = () => {
    i += 2;
    while (i < n) { if (src[i] === '*' && src[i + 1] === '/') { i += 2; return; } i++; }
  };
  const scanRegex = () => {
    i++;
    let inClass = false;
    while (i < n) {
      const d = src[i];
      if (d === '\\' && i + 1 < n) { i += 2; continue; }
      if (d === '\n') break;
      if (d === '[') inClass = true;
      else if (d === ']') inClass = false;
      else if (d === '/' && !inClass) { i++; break; }
      i++;
    }
    markValue();
  };
  const scanString = (q) => {
    const start = i + 1;
    i++;
    let body = '';
    while (i < n) {
      if (src[i] === '\\' && i + 1 < n) { body += src[i] + src[i + 1]; i += 2; continue; }
      if (src[i] === q) { i++; break; }
      if (src[i] === '\n') { i++; break; }
      body += src[i]; i++;
    }
    const site = active();
    if (site && mute === 0) pushTokens(site, body, start);
    markValue();
  };
  const scanPlainTemplate = () => {
    i++;
    while (i < n) {
      const c = src[i];
      if (c === '\\' && i + 1 < n) { i += 2; continue; }
      if (c === '`') { i++; break; }
      if (c === '$' && src[i + 1] === '{') {
        i += 2;
        scanCode('hole');
        if (i < n && src[i] === '}') i++;
        continue;
      }
      i++;
    }
    markValue();
  };

  // An `html` tagged template: read the TEXT for open tags and `class=`
  // attributes, recurse into holes as code.
  const scanHtmlTemplate = () => {
    i++;
    let inTag = false;
    /** @type {{ site: ClassSite|null, quote: string|null, run: string, runStart: number, holeBefore: boolean }|null} */
    let attr = null;
    let pendingClassHole = false;
    const flushRun = (touchesHoleRight) => {
      if (!attr || !attr.site) return;
      let text = attr.run;
      let base = attr.runStart;
      if (text.length) {
        if (attr.holeBefore && !/^\s/.test(text)) {
          const m = /^\S+/.exec(text);
          base += m[0].length; text = text.slice(m[0].length);
        }
        if (touchesHoleRight && !/\s$/.test(text)) {
          text = text.replace(/\S+$/, '');
        }
        pushTokens(attr.site, text, base);
      }
      attr.run = ''; attr.runStart = -1; attr.holeBefore = false;
    };
    const closeAttr = () => { flushRun(false); if (attr.site) emit(attr.site); attr = null; };
    while (i < n) {
      const c = src[i];
      if (c === '\\' && i + 1 < n) {
        if (attr && attr.site) { if (attr.runStart === -1) attr.runStart = i; attr.run += src[i] + src[i + 1]; }
        i += 2;
        continue;
      }
      if (c === '`') { i++; break; }
      if (c === '$' && src[i + 1] === '{') {
        const at = i;
        i += 2;
        if (attr && attr.site) {
          flushRun(true);
          attr.holeBefore = true;
          collectors.push(attr.site);
          scanCode('hole');
          collectors.pop();
        } else if (pendingClassHole) {
          pendingClassHole = false;
          const site = newSite('hole', at);
          collectors.push(site);
          scanCode('hole');
          collectors.pop();
          emit(site);
        } else {
          scanCode('hole');
        }
        if (i < n && src[i] === '}') i++;
        continue;
      }
      if (attr) {
        if (attr.quote ? c === attr.quote : (/\s/.test(c) || c === '>')) {
          const consume = attr.quote !== null;
          closeAttr();
          if (consume) i++;
          continue;
        }
        if (attr.site) { if (attr.runStart === -1) attr.runStart = i; attr.run += c; }
        i++;
        continue;
      }
      if (!inTag) {
        if (c === '<' && /[A-Za-z]/.test(src[i + 1] || '')) { inTag = true; i += 2; continue; }
        i++;
        continue;
      }
      if (c === '>') { inTag = false; pendingClassHole = false; i++; continue; }
      if (c === '"' || c === "'") {
        // Another attribute's quoted value: skip it, still scanning holes as code.
        attr = { site: null, quote: c, run: '', runStart: -1, holeBefore: false };
        i++;
        continue;
      }
      if (src.startsWith('class=', i) && /[\s]/.test(src[i - 1] || '')) {
        i += 6;
        const q = src[i];
        if (q === '"' || q === "'") {
          attr = { site: newSite('attribute', i), quote: q, run: '', runStart: -1, holeBefore: false };
          i++;
        } else if (q === '$' && src[i + 1] === '{') {
          pendingClassHole = true;
        } else {
          attr = { site: newSite('attribute', i), quote: null, run: '', runStart: -1, holeBefore: false };
        }
        continue;
      }
      i++;
    }
    if (attr) closeAttr();
    markValue();
  };

  // A recognized call: `cn(` opens a call site unless one is already
  // collecting; a `*Class(` helper contributes its name and mutes its args.
  const scanCall = (word, wordAt) => {
    // i sits at `(`
    i++;
    if (helpers.has(word)) {
      const site = active();
      if (site && mute === 0 && !site.helpers.includes(word)) site.helpers.push(word);
      mute++;
      scanCode('paren');
      mute--;
    } else if (active() || mute > 0) {
      scanCode('paren');
    } else {
      const site = newSite('call', wordAt);
      collectors.push(site);
      scanCode('paren');
      collectors.pop();
      emit(site);
    }
    if (i < n && src[i] === ')') i++;
    lastSig = ')'; lastWord = ''; lastWordIsProp = false; lastWasIncDec = false;
  };

  /** @param {'hole'|'paren'|null} stop */
  function scanCode(stop) {
    let brace = 0;
    let paren = 0;
    while (i < n) {
      const c = src[i], next = src[i + 1];
      if (stop === 'hole' && c === '}' && brace === 0) return;
      if (stop === 'paren' && c === ')' && paren === 0) return;
      if (c === '/' && next === '/') { scanLineComment(); continue; }
      if (c === '/' && next === '*') { scanBlockComment(); continue; }
      if (c === '/' && isRegex()) { scanRegex(); continue; }
      if (c === "'" || c === '"') { scanString(c); continue; }
      if (c === '`') {
        if (lastWord === 'html' && /[\w$]/.test(lastSig) && !lastWordIsProp) scanHtmlTemplate();
        else scanPlainTemplate();
        continue;
      }
      if (c === '{') { brace++; lastSig = '{'; lastWord = ''; lastWasIncDec = false; i++; continue; }
      if (c === '}') { brace--; lastSig = '}'; lastWord = ''; lastWasIncDec = false; i++; continue; }
      if (c === '(') { paren++; lastSig = '('; lastWord = ''; lastWasIncDec = false; i++; continue; }
      if (c === ')') { paren--; lastSig = ')'; lastWord = ''; lastWasIncDec = false; i++; continue; }
      if (/[A-Za-z_$]/.test(c)) {
        const prop = lastSig === '.';
        const at = i;
        let w = '';
        while (i < n && /[\w$]/.test(src[i])) { w += src[i]; i++; }
        lastWord = w; lastSig = w[w.length - 1]; lastWordIsProp = prop; lastWasIncDec = false;
        if (!prop && (cnNames.has(w) || helpers.has(w))) {
          let j = i;
          while (j < n && /[ \t]/.test(src[j])) j++;
          if (src[j] === '(') { i = j; scanCall(w, at); }
        }
        continue;
      }
      if (/\s/.test(c)) { i++; continue; }
      lastWasIncDec = (c === '+' || c === '-') && c === lastSig;
      lastSig = c; lastWord = ''; i++;
    }
  }

  scanCode(null);
  return sites;
}

/**
 * The recognized helper and `cn` identifiers of one module, read from its
 * imports. An identifier ending in `Class` is a kit helper only when imported
 * from a path resolving inside `uiDir`; `cn` only when imported from
 * `utilsPath` (the config's `aliases.utils`). A `#` specifier has its sigil
 * stripped and resolves against `appRoot`; a relative one against the file.
 * An unrelated local `fooClass()` is therefore never mistaken for a helper.
 *
 * @param {string} src
 * @param {{ filePath: string, appRoot: string, uiDir: string, utilsPath: string }} paths
 * @returns {{ helpers: string[], cnNames: string[] }}
 */
export function collectHelperImports(src, { filePath, appRoot, uiDir, utilsPath }) {
  /** @type {string[]} */
  const helpers = [];
  /** @type {string[]} */
  const cnNames = [];
  const stripExt = (p) => p.replace(/\.(?:ts|tsx|js|jsx|mts|mjs)$/, '');
  const ui = resolve(uiDir);
  const utils = stripExt(resolve(utilsPath));
  const re = /\bimport\s*(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const spec = m[2];
    let target;
    if (spec.startsWith('#')) target = resolve(appRoot, spec.slice(1));
    else if (spec.startsWith('.')) target = resolve(dirname(filePath), spec);
    else continue;
    const inUi = target === ui || target.startsWith(ui + sep);
    const isUtils = stripExt(target) === utils;
    if (!inUi && !isUtils) continue;
    for (const part of m[1].split(',')) {
      const piece = part.trim().replace(/^type\s+/, '');
      if (!piece) continue;
      const [imported, local = imported] = piece.split(/\s+as\s+/).map((s) => s.trim());
      if (inUi && /Class$/.test(local)) helpers.push(local);
      if (isUtils && imported === 'cn') cnNames.push(local);
    }
  }
  return { helpers, cnNames };
}
