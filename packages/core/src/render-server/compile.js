import { BINDING_PREFIXES } from '../binding-prefixes.js';
import { isVoidElement, isRawtextTag, isTextOnlyTag } from './html-scan.js';

/**
 * The SSR template compiler (#1646): one tokenizer pass per template, run
 * ONCE per `TemplateStringsArray` identity and cached, so a render interleaves
 * the cached static chunks with its values instead of walking every character
 * of every template on every render.
 *
 * The state machine is the one `renderTemplate` used to run per render, moved
 * here unchanged in what it decides (where a hole sits: text, comment, raw
 * text, an attribute value, a plain attribute, a prefixed binding) and extended
 * with what the output rescans used to decide afterwards (where an element
 * opens and closes, which content is text rather than markup), so the walker
 * in `walk.js` can expand custom elements in the same pass with no second scan.
 *
 * Nothing here consults the component registry. An op records a tag NAME, and
 * the walker resolves it with `lookup(tag)` at render time, because the
 * registry can grow after a template compiled (`primeModuleUrl` inserts keys
 * before classes register, and `bun --hot` re-registers), and a memo keyed on
 * the registry rendered components as bare tags once already (#1645).
 *
 * Op shapes, all plain objects with a numeric `t`:
 *
 *   TEXT     { s }                     a static chunk, emitted verbatim
 *   OPEN     { tag }                   a start tag begins at the NEXT chunk's `<`
 *   TAG_END  { selfClose, close }      the start tag's `>` or `/>` (`close` is its text)
 *   CLOSE    { tag, text }             a whole end tag (`text` is its source bytes)
 *   HOLE     { k, ... }                a value position, `k` says where it sits:
 *              CHILD                     text content, escaped or rendered
 *              RAW                       comment or raw text, emitted as a string
 *              ATTR  { name, kind, tag, lead }     a whole-value attribute hole;
 *                                        `kind` is the BINDING_PREFIXES class
 *                                        (`event` / `prop` / `bool`) or `plain`,
 *                                        `lead` the removed `name=` source text
 *              VALUE { name, tag }       inside a quoted or unquoted value
 *              DROP                      an unsupported position, value ignored
 *
 * A text-only element (`title`, `textarea`, `iframe`, ...) emits no OPEN or
 * CLOSE for anything inside it, and a comment, raw text or attribute value
 * never does either, which is how a tag name written in one of those stays
 * text (#1128, #1133, #1134). Script data honours the double-escaped state
 * (#1134) so its real end is not necessarily the first `</script>`.
 */

export const TEXT = 0;
export const OPEN = 1;
export const TAG_END = 2;
export const CLOSE = 3;
export const HOLE = 4;

export const CHILD = 0;
export const RAW = 1;
export const ATTR = 2;
export const VALUE = 3;
export const DROP = 4;

/** @typedef {TemplateStringsArray | string[]} Strings */
/** @typedef {{ t: number, s?: string, tag?: string, selfClose?: boolean, close?: string, text?: string, k?: number, name?: string, kind?: string, lead?: string }} Op */

/** @type {WeakMap<object, Op[]>} */
const cache = new WeakMap();

// Test seam: how many templates the tokenizer has walked, so a test can prove
// a second render of the same template did NOT re-tokenize it.
let compiled = 0;
export function _compileCount() { return compiled; }

/**
 * Ops for a template, tokenized once per `strings` identity.
 * @param {Strings} strings
 * @returns {Op[]}
 */
export function compile(strings) {
  let ops = cache.get(strings);
  if (ops === undefined) {
    ops = tokenize(strings);
    cache.set(strings, ops);
  }
  return ops;
}

/**
 * Ops for a raw HTML string (an `unsafeHTML` value, a streamed boundary's
 * children, a legacy `injectDSD` caller). Not cached: every string is new.
 * @param {string} html
 * @returns {Op[]}
 */
export function compileRaw(html) {
  return tokenize([html]);
}

const WS = /\s/;
const LETTER = /[a-zA-Z]/;
const BOUNDARY = /[\s/>]/;
// A processing-instruction opener (`<?`), matched by regex rather than by a
// character compare so the sigil guard (no `=== '<sigil>'` literal in a
// renderer) stays meaningful.
const QUESTION = /^\?$/;
// The states between a start tag's `<name` and its `>`.
const START_TAG_STATES = new Set(['tag-name', 'in-tag', 'attr-name', 'after-name', 'after-eq', 'attr-quoted', 'attr-unquoted']);

/**
 * @param {Strings} strings
 * @returns {Op[]}
 */
function tokenize(strings) {
  compiled += 1;
  /** @type {Op[]} */
  const ops = [];
  let chunk = '';
  const flush = () => { if (chunk) { ops.push({ t: TEXT, s: chunk }); chunk = ''; } };

  let state = 'text';
  let attrName = '';
  let attrStart = 0;   // index into `chunk` of the attribute's first character
  let attrQuote = '';
  let commentDashes = 0;
  let currentTag = '';
  /** @type {Op | null} */
  let pendingOpen = null;  // the OPEN op whose name is still being read
  let openIndex = -1;      // index in `ops` of the start tag being read
  let closeStart = 0;      // index into `chunk` of a close tag's `<`
  let solidus = false;     // a `/` in a tag state that may be a self-closing solidus
  // Raw text (`script` / `style`): ends at `</script>` / `</style>`, with the
  // #1134 escaped and double-escaped states for script data.
  let rawTail = '';
  let rawEscaped = false;
  let rawDbl = false;
  let rawScriptOpen = false;   // `<script` just completed; the next char decides
  // Text-only content (`title`, `textarea`, `iframe`, ...): ends at `</tag`.
  let textOnlyTag = '';
  let textOnlyTail = '';

  const nameDone = () => {
    if (pendingOpen) { pendingOpen.tag = currentTag; pendingOpen = null; }
  };
  /** Push the CLOSE op for the end tag whose bytes start at `closeStart`. */
  const pushClose = (tag) => {
    const text = chunk.slice(closeStart);
    chunk = chunk.slice(0, closeStart);
    flush();
    ops.push({ t: CLOSE, tag, text });
    state = 'text';
  };
  /**
   * Content state after a start tag. `allowRawtext` is NOT a preference: only
   * the `tag-name` and `in-tag` exits ever entered raw text in the renderer
   * this replaces, while the three attribute exits (`attr-name`, `after-eq`,
   * `attr-unquoted`) forced `text`, so `<script defer>` and
   * `<style media=print>` escaped their bodies. That is an XSS-facing
   * behaviour this compiler keeps exactly: through an attribute exit a
   * raw-text element's holes stay escaped, and only the "is a tag in here an
   * element" question gets the text-only answer. A self-closed text-only tag
   * (`<svg><title/></svg>`) has no content in foreign content, so it opens
   * nothing (#1128).
   */
  const finishStartTag = (allowRawtext) => {
    const selfClose = solidus;
    const close = selfClose ? '/>' : '>';
    chunk = chunk.slice(0, chunk.length - close.length);
    flush();
    ops.push({ t: TAG_END, selfClose, close });
    solidus = false;
    attrName = '';
    const tag = currentTag;
    if (isRawtextTag(tag) && allowRawtext) {
      state = 'rawtext';
      rawTail = '';
      rawEscaped = false;
      rawDbl = false;
      rawScriptOpen = false;
      return;
    }
    if (!selfClose && isTextOnlyTag(tag)) {
      state = 'textonly';
      textOnlyTag = tag;
      textOnlyTail = '';
      return;
    }
    state = 'text';
  };

  for (let i = 0; i < strings.length; i++) {
    const s = strings[i];
    for (let j = 0; j < s.length; j++) {
      const c = s[j];
      switch (state) {
        case 'text':
          if (c === '<') { flush(); state = 'tag-open'; }
          chunk += c;
          break;
        case 'tag-open':
          if (c === '!') { chunk += c; state = 'bang-1'; }
          else if (QUESTION.test(c)) { chunk += c; state = 'bogus'; }
          else if (c === '/') { chunk += c; state = 'close-open'; }
          else if (LETTER.test(c)) {
            // A start tag. The OPEN op precedes the chunk holding `<name...`.
            chunk = chunk.slice(0, -1);
            flush();
            pendingOpen = { t: OPEN, tag: '' };
            openIndex = ops.length;
            ops.push(pendingOpen);
            chunk = '<' + c;
            currentTag = c.toLowerCase();
            state = 'tag-name';
          } else { chunk += c; state = 'text'; }
          break;
        case 'close-open':
          if (LETTER.test(c)) {
            closeStart = chunk.length - 2;
            chunk += c;
            currentTag = c.toLowerCase();
            state = 'close-name';
          } else {
            // `</` followed by anything else is a bogus comment to the next `>`.
            chunk += c;
            state = c === '>' ? 'text' : 'bogus';
          }
          break;
        case 'close-name':
          chunk += c;
          if (c === '>') pushClose(currentTag);
          else if (WS.test(c) || c === '/') state = 'close-tail';
          else currentTag += c.toLowerCase();
          break;
        case 'close-tail':
          chunk += c;
          if (c === '>') pushClose(currentTag);
          break;
        case 'bang-1':
          chunk += c;
          state = c === '-' ? 'bang-dash' : 'bogus';
          break;
        case 'bang-dash':
          chunk += c;
          state = c === '-' ? 'comment-start' : 'bogus';
          break;
        case 'bogus':
          // `<!doctype ...>`, `<![CDATA[...]]>`, `<?...>`, `</1...>`: to the next `>`.
          chunk += c;
          if (c === '>') state = 'text';
          break;
        case 'comment-start':
          // The spec short forms: `<!-->` and `<!--->` close immediately.
          chunk += c;
          if (c === '>') state = 'text';
          else if (c === '-') state = 'comment-start-dash';
          else { state = 'comment'; commentDashes = 0; }
          break;
        case 'comment-start-dash':
          chunk += c;
          if (c === '>') state = 'text';
          else if (c === '-') { state = 'comment'; commentDashes = 2; }
          else { state = 'comment'; commentDashes = 0; }
          break;
        case 'comment':
          chunk += c;
          if (c === '-') commentDashes += 1;
          else if (c === '>' && commentDashes >= 2) { state = 'text'; commentDashes = 0; }
          else if (c === '!' && commentDashes >= 2) state = 'comment-bang';
          else commentDashes = 0;
          break;
        case 'comment-bang':
          // `--!>` closes like `-->`.
          chunk += c;
          if (c === '>') { state = 'text'; commentDashes = 0; }
          else { state = 'comment'; commentDashes = c === '-' ? 1 : 0; }
          break;
        case 'tag-name':
          chunk += c;
          if (c === '>') { nameDone(); finishStartTag(true); }
          else if (WS.test(c)) { nameDone(); state = 'in-tag'; }
          else if (c === '/') { nameDone(); solidus = true; state = 'in-tag'; }
          else currentTag += c.toLowerCase();
          break;
        case 'in-tag':
          chunk += c;
          if (c === '>') finishStartTag(true);
          else if (c === '/') solidus = true;
          else if (WS.test(c)) solidus = false;
          else {
            solidus = false;
            state = 'attr-name';
            attrName = c;
            attrStart = chunk.length - 1;
          }
          break;
        case 'attr-name':
          if (c === '=') { state = 'after-eq'; chunk += c; }
          else if (WS.test(c)) { state = 'after-name'; chunk += c; }
          else if (c === '/') { state = 'in-tag'; attrName = ''; solidus = true; chunk += c; }
          else if (c === '>') { chunk += c; finishStartTag(false); }
          else { attrName += c; chunk += c; }
          break;
        case 'after-name':
          // Whitespace after an attribute name (after-attribute-name state):
          // an `=` still belongs to that attribute, so `href = ${x}` binds.
          chunk += c;
          if (c === '=') state = 'after-eq';
          else if (WS.test(c)) { /* keep waiting */ }
          // Whitespace already ended the attribute, the renderer this replaces
          // was back in `in-tag` here, and that exit entered raw text, so
          // `<script async >` keeps its holes raw.
          else if (c === '>') finishStartTag(true);
          else if (c === '/') { state = 'in-tag'; attrName = ''; solidus = true; }
          else { state = 'attr-name'; attrName = c; attrStart = chunk.length - 1; }
          break;
        case 'after-eq':
          // Whitespace after `=` is skipped (before-attribute-value state), so
          // `title= "x"` still opens a quoted value. The renderer this replaces
          // dropped to `in-tag` here and lost the attribute's hole.
          if (c === '"' || c === "'") { state = 'attr-quoted'; attrQuote = c; chunk += c; }
          else if (WS.test(c)) { chunk += c; }
          else if (c === '>') { chunk += c; finishStartTag(false); }
          else { state = 'attr-unquoted'; chunk += c; }
          break;
        case 'attr-unquoted':
          if (WS.test(c)) { state = 'in-tag'; attrName = ''; chunk += c; }
          else if (c === '>') { chunk += c; finishStartTag(false); }
          else chunk += c;
          break;
        case 'attr-quoted':
          chunk += c;
          if (c === attrQuote) { state = 'in-tag'; attrName = ''; }
          break;
        case 'rawtext': {
          chunk += c;
          const lc = c.toLowerCase();
          if (currentTag === 'script') {
            // Script data (#1134). `<!--` enters the escaped state, `-->` and
            // `--!>` leave it, a `<script` inside the escaped state enters the
            // double-escaped one where a `</script>` is text, and the element
            // ends at the first `</script>` outside the double-escaped state.
            if (rawScriptOpen) { rawScriptOpen = false; if (BOUNDARY.test(c) && rawEscaped) rawDbl = true; }
            rawTail = (rawTail + lc).slice(-9);
            if (rawTail.endsWith('<!--')) { if (!rawEscaped) rawEscaped = true; }
            else if (rawTail.endsWith('-->') || rawTail.endsWith('--!>')) { rawEscaped = false; rawDbl = false; }
            else if (rawTail.endsWith('<script')) rawScriptOpen = true;
            else if (rawTail.endsWith('</script>')) {
              if (rawDbl) rawDbl = false;
              else { closeStart = chunk.length - 9; pushClose('script'); rawTail = ''; currentTag = ''; }
            }
          } else {
            rawTail = (rawTail + lc).slice(-8);
            if (rawTail.endsWith('</style>')) { closeStart = chunk.length - 8; pushClose('style'); rawTail = ''; currentTag = ''; }
          }
          break;
        }
        case 'textonly':
          // Text until `</tag` on a name boundary; `plaintext` never ends.
          if (textOnlyTail === '</' + textOnlyTag && BOUNDARY.test(c)) {
            closeStart = chunk.length - textOnlyTail.length;
            chunk += c;
            currentTag = textOnlyTag;
            textOnlyTag = '';
            textOnlyTail = '';
            if (c === '>') pushClose(currentTag);
            else state = 'close-tail';
            break;
          }
          chunk += c;
          if (textOnlyTag !== 'plaintext') textOnlyTail = (textOnlyTail + c.toLowerCase()).slice(-(textOnlyTag.length + 2));
          break;
      }
    }

    if (i < strings.length - 1) {
      // A value hole sits here. Its op says where, and the walker decides what.
      if (state === 'comment' || state === 'comment-start' || state === 'comment-start-dash' || state === 'comment-bang') {
        flush();
        ops.push({ t: HOLE, k: RAW });
        commentDashes = 0;
        state = 'comment';
      } else if (state === 'rawtext') {
        flush();
        ops.push({ t: HOLE, k: RAW });
        rawTail = '';
        rawScriptOpen = false;
      } else if (state === 'text' || state === 'textonly') {
        flush();
        ops.push({ t: HOLE, k: CHILD });
        textOnlyTail = '';
      } else if (state === 'after-eq') {
        const prefix = attrName[0];
        const kind = BINDING_PREFIXES[prefix];
        const lead = chunk.slice(attrStart);
        chunk = chunk.slice(0, attrStart);
        flush();
        ops.push({
          t: HOLE, k: ATTR, kind: kind === undefined ? 'plain' : kind,
          name: kind === undefined ? attrName : attrName.slice(1), tag: currentTag, lead,
        });
        state = 'in-tag';
        attrName = '';
      } else if (state === 'attr-quoted' || state === 'attr-unquoted') {
        flush();
        ops.push({ t: HOLE, k: VALUE, name: attrName, tag: currentTag });
      } else {
        // A hole in a tag name, between attributes, in a close tag or a markup
        // declaration: nothing is emitted for it, as before.
        flush();
        ops.push({ t: HOLE, k: DROP });
        closeStart = 0;
      }
    }
  }
  // An unterminated tag, comment or close tag: the bytes stay text, as a
  // browser treats them. A start tag still open here has no TAG_END, so its
  // OPEN is dropped too: the walker would otherwise begin taking the element
  // (a registered tag moves the page built so far aside until the `>`) and
  // never finish, losing everything before it (a truncated `unsafeHTML`).
  if (pendingOpen) pendingOpen.tag = currentTag;
  if (openIndex !== -1 && START_TAG_STATES.has(state)) ops.splice(openIndex, 1);
  flush();
  return ops;
}

export { isVoidElement };
