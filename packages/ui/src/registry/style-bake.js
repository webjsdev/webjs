/**
 * The style bake (#1666, D8): turn a registry component written in BASE FORM
 * into plain Tailwind for one chosen style.
 *
 * A base-form component carries shadcn's semantic class names alongside the
 * layout classes it keeps inline, the way shadcn's own
 * `registry/bases/radix/ui/*.tsx` does:
 *
 *   const BASE = 'cn-button group/button inline-flex shrink-0 items-center ...';
 *
 * A STYLE is a file of nested rules that map each of those names to Tailwind
 * through `@apply`, all under one `.style-<name>` wrapper:
 *
 *   .style-nova { .cn-button { @apply rounded-lg border text-sm ...; } }
 *
 * The bake replaces each `cn-*` name with the classes its style maps it to,
 * ahead of the classes already in the string, and drops the name. It runs
 * wherever an app or an agent READS code: `add` and `diff` (through
 * `transformForProject`), `webjs ui view`, and the MCP `ui` tool. So an
 * installed file, and anything an agent copies, is plain readable Tailwind
 * with no `cn-*` name in it, and `cn()` merging keeps working on it.
 *
 * This is a port of shadcn's `createStyleMap` and `transformStyle`
 * (`packages/shadcn/src/styles/` in the shadcn repo), written without postcss
 * or ts-morph so the CLI gains no dependency. Two deliberate differences:
 *
 * - shadcn inlines a name only at its FIRST occurrence in a file. Here every
 *   occurrence is inlined, because a Tier-2 template can render the same part
 *   in two branches and both must be styled.
 * - shadcn merges with tailwind-merge. Here the mapped classes are placed
 *   BEFORE the string's own classes with exact duplicates dropped, and the
 *   component's runtime `cn()` (or the class attribute as written) resolves
 *   the rest. Placing them first is what lets an inline layout class win a
 *   conflict, the same precedence `twMerge(mapped, original)` gives.
 *
 * A `cn-*` name must sit in static text: a string literal, or the static part
 * of a `class="..."` attribute in an `html` template. A name produced inside a
 * `${...}` hole is never seen and never baked.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { REGISTRY_ROOT } from './local.js';

const CN_PREFIX = 'cn-';
const CN_TOKEN = /^cn-[\w-]+$/;

/**
 * Names that survive the bake, because they are hooks rather than styles: a
 * selector elsewhere targets them, or the CLI rewrites them at install time.
 * shadcn's own list (`ALLOWLIST` in transform-style-map.ts).
 */
export const CN_ALLOWLIST = new Set([
  'cn-menu-target',
  'cn-menu-translucent',
  'cn-logical-sides',
  'cn-rtl-flip',
  'cn-font-heading',
]);

/** The styles the kit ships, in the order a picker lists them. `new-york` is the default. */
export const STYLE_NAMES = ['new-york', 'vega', 'nova', 'maia', 'lyra', 'mira', 'luma', 'sera', 'rhea'];
export const DEFAULT_STYLE = 'new-york';

/**
 * Normalise a `components.json` `style` value to a style the kit ships.
 * `'default'` (the schema's default) and an absent value mean `new-york`.
 * @param {string | undefined | null} style
 */
export function resolveStyleName(style) {
  if (!style || style === 'default') return DEFAULT_STYLE;
  return STYLE_NAMES.includes(style) ? style : DEFAULT_STYLE;
}

// ---------------------------------------------------------------------------
// Style map: CSS with @apply rules -> { 'cn-x': 'tailwind classes' }
// ---------------------------------------------------------------------------

/**
 * Build the style map from a style file's CSS. Mirrors shadcn's
 * `createStyleMap`: every rule whose body holds `@apply` contributes its
 * classes to the LAST `cn-*` class of each selector in its selector list,
 * with `&` removed; a later rule for the same name is PREPENDED to what the
 * earlier ones gave it. A rule with no `@apply` contributes nothing.
 *
 * @param {string} css
 * @returns {Record<string, string>}
 */
export function createStyleMap(css) {
  /** @type {Record<string, string>} */
  const result = {};
  const src = stripCssComments(css);
  /** @type {string[][]} */
  const stack = []; // selector lists of the enclosing rules (unused for the subject, kept for clarity)
  let i = 0;
  let buf = '';
  /** @type {{ selectors: string[], applies: string[] }[]} */
  const frames = [];
  while (i < src.length) {
    const ch = src[i];
    if (ch === '{') {
      const prelude = buf.trim();
      buf = '';
      const selectors = prelude.startsWith('@') ? [] : splitSelectors(prelude);
      frames.push({ selectors, applies: [] });
      stack.push(selectors);
      i++;
      continue;
    }
    if (ch === '}') {
      const frame = frames.pop();
      stack.pop();
      buf = '';
      if (frame && frame.applies.length) {
        const classes = frame.applies.join(' ');
        for (const sel of frame.selectors) {
          const subject = subjectClass(sel.replace(/\s*&\s*/g, '').trim());
          if (!subject) continue;
          result[subject] = result[subject] ? `${classes} ${result[subject]}` : classes;
        }
      }
      i++;
      continue;
    }
    if (ch === ';') {
      const decl = buf.trim();
      buf = '';
      const m = /^@apply\s+([\s\S]+)$/.exec(decl);
      if (m && frames.length) {
        const value = m[1].trim().replace(/\s+/g, ' ');
        if (value) frames[frames.length - 1].applies.push(value);
      }
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  return result;
}

/** @param {string} css */
function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/** Split a selector list on top-level commas (not inside () or []). */
function splitSelectors(prelude) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of prelude) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** The last `.cn-*` class in a selector, ignoring anything inside [] or (). */
function subjectClass(selector) {
  let depth = 0;
  let last = null;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (ch === '(' || ch === '[') { depth++; continue; }
    if (ch === ')' || ch === ']') { depth--; continue; }
    if (depth === 0 && ch === '.' && selector.startsWith(CN_PREFIX, i + 1)) {
      const m = /^[\w-]+/.exec(selector.slice(i + 1));
      if (m) last = m[0];
    }
  }
  return last;
}

/** @type {Map<string, Record<string, string>>} */
const MAP_CACHE = new Map();

/** Absolute path of a shipped style file. */
export function styleFilePath(name) {
  return join(REGISTRY_ROOT, 'styles', `style-${name}.css`);
}

/**
 * The style map for one shipped style, read from the packaged registry and
 * cached. An unknown or missing style yields an empty map, which bakes every
 * `cn-*` name away to nothing rather than leaking it.
 * @param {string | undefined | null} style
 */
export function loadStyleMap(style) {
  const name = resolveStyleName(style);
  const cached = MAP_CACHE.get(name);
  if (cached) return cached;
  const file = styleFilePath(name);
  const map = existsSync(file) ? createStyleMap(readFileSync(file, 'utf8')) : {};
  MAP_CACHE.set(name, map);
  return map;
}

// ---------------------------------------------------------------------------
// Class segments: where in a JS/TS source a class list can sit
// ---------------------------------------------------------------------------

/**
 * @typedef {{ start: number, end: number, quote: "'" | '"' | '`' | 'attr' }} Segment
 * `start` / `end` delimit the RAW source text of the segment (between the
 * quotes, or the static run of a class attribute). `quote` is the delimiter
 * the text must stay legal inside.
 */

const REGEX_PRECEDERS = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await']);

/**
 * Find every string literal in a JS/TS source, plus every static run of a
 * `class="..."` attribute inside an `html` tagged template. This one function
 * is what the bake rewrites, what the fixture records and what the snapshot
 * test compares, so the three cannot disagree about which strings carry
 * classes. Comments and regex literals are skipped. A template literal with
 * no holes is a plain string; a template with holes contributes nothing of
 * its own unless it is an `html` template, where only class attribute text
 * counts.
 *
 * @param {string} src
 * @returns {Segment[]}
 */
export function classSegments(src) {
  /** @type {Segment[]} */
  const segs = [];
  let i = 0;
  let prevSig = ''; // last significant code char, for regex detection
  let prevWord = '';
  /** @type {{ html: boolean, inClass: boolean, attrQuote: string, runStart: number }[]} */
  const tpl = []; // open template literals (innermost last)
  /** @type {number[]} */
  const holeDepth = []; // brace depth inside each open ${ } hole

  const n = src.length;
  const inCode = () => tpl.length === 0 || holeDepth.length === tpl.length;

  while (i < n) {
    if (!inCode()) {
      // Inside the static text of the innermost template.
      const t = tpl[tpl.length - 1];
      const ch = src[i];
      if (ch === '\\') { i += 2; continue; }
      if (ch === '`') {
        if (t.html && t.inClass && i > t.runStart) segs.push({ start: t.runStart, end: i, quote: 'attr' });
        tpl.pop();
        i++;
        prevSig = ')';
        prevWord = '';
        continue;
      }
      if (ch === '$' && src[i + 1] === '{') {
        if (t.html && t.inClass && i > t.runStart) segs.push({ start: t.runStart, end: i, quote: 'attr' });
        holeDepth.push(0);
        i += 2;
        prevSig = '{';
        prevWord = '';
        continue;
      }
      if (t.html) {
        if (t.inClass) {
          if (ch === t.attrQuote) {
            if (i > t.runStart) segs.push({ start: t.runStart, end: i, quote: 'attr' });
            t.inClass = false;
          }
        } else {
          const m = /^class=(["'])/.exec(src.slice(i, i + 7));
          if (m && /[\s<]/.test(src[i - 1] || ' ')) {
            t.inClass = true;
            t.attrQuote = m[1];
            i += 7;
            t.runStart = i;
            continue;
          }
        }
      }
      i++;
      continue;
    }

    // Code.
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); i = e < 0 ? n : e; continue; }
    if (ch === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (ch === "'" || ch === '"') {
      const start = i + 1;
      let j = start;
      while (j < n && src[j] !== ch) { if (src[j] === '\\') j++; if (src[j] === '\n') break; j++; }
      segs.push({ start, end: j, quote: ch });
      i = j + 1;
      prevSig = ')';
      prevWord = '';
      continue;
    }
    if (ch === '`') {
      // A template with no holes is a plain string. Decide by scanning ahead.
      const isHtml = /\bhtml\s*$/.test(src.slice(Math.max(0, i - 12), i));
      let j = i + 1;
      let hasHole = false;
      while (j < n && src[j] !== '`') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') { hasHole = true; break; }
        j++;
      }
      if (!hasHole && !isHtml) {
        segs.push({ start: i + 1, end: j, quote: '`' });
        i = j + 1;
        prevSig = ')';
        prevWord = '';
        continue;
      }
      tpl.push({ html: isHtml, inClass: false, attrQuote: '"', runStart: 0 });
      i++;
      continue;
    }
    if (ch === '/' ) {
      const regexAllowed = !prevSig || REGEX_PRECEDERS.has(prevSig) || REGEX_KEYWORDS.has(prevWord);
      if (regexAllowed) {
        let j = i + 1;
        let inClassSet = false;
        while (j < n) {
          const c = src[j];
          if (c === '\\') { j += 2; continue; }
          if (c === '\n') break;
          if (inClassSet) { if (c === ']') inClassSet = false; }
          else if (c === '[') inClassSet = true;
          else if (c === '/') break;
          j++;
        }
        j++;
        while (j < n && /[a-z]/i.test(src[j])) j++;
        i = j;
        prevSig = ')';
        prevWord = '';
        continue;
      }
    }
    if (holeDepth.length && holeDepth.length === tpl.length) {
      if (ch === '{') holeDepth[holeDepth.length - 1]++;
      else if (ch === '}') {
        if (holeDepth[holeDepth.length - 1] === 0) {
          holeDepth.pop();
          const t = tpl[tpl.length - 1];
          i++;
          t.runStart = i; // a class attribute continues after the hole
          continue;
        }
        holeDepth[holeDepth.length - 1]--;
      }
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < n && /[\w$]/.test(src[j])) j++;
      prevWord = src.slice(i, j);
      prevSig = 'a';
      i = j;
      continue;
    }
    if (!/\s/.test(ch)) { prevSig = ch; prevWord = ''; }
    i++;
  }
  return segs;
}

/**
 * The cooked value of a segment: what the string MEANS at runtime, with its
 * escapes resolved. Class attribute text is taken as written.
 * @param {string} src
 * @param {Segment} seg
 */
export function segmentValue(src, seg) {
  const raw = src.slice(seg.start, seg.end);
  if (seg.quote === 'attr') return raw;
  return raw.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (_, e) => {
    if (e[0] === 'u' && e[1] === '{') return String.fromCodePoint(parseInt(e.slice(2, -1), 16));
    if (e[0] === 'u' && e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16));
    if (e[0] === 'x' && e.length === 3) return String.fromCharCode(parseInt(e.slice(1), 16));
    return { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' }[e] ?? e;
  });
}

/**
 * Write a cooked value back inside the delimiter it sits in.
 *
 * The result must read right TWICE: as JavaScript (or an HTML attribute), and
 * as the raw text Tailwind's scanner reads, which never unescapes anything. So
 * a quote is never escaped with a backslash or an entity if it can be helped:
 * `[class*=\'size-\']` is valid JavaScript, but Tailwind compiles the
 * backslashes into the selector and the rule never matches. bakeSource()
 * avoids it for a JS string by changing the string's delimiter (see there).
 * In an HTML attribute a double quote becomes a single one, which means the
 * same in a CSS string or attribute value. Escaping is the last resort, for a
 * value carrying both quotes, which no style emits.
 */
function escapeFor(value, quote) {
  if (quote === 'attr') {
    if (!value.includes('"')) return value;
    return value.includes("'") ? value.replace(/"/g, '&quot;') : value.replace(/"/g, "'");
  }
  let out = value.replace(/\\/g, '\\\\');
  if (quote === '`') return out.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  return out.replace(new RegExp(quote, 'g'), `\\${quote}`);
}

// ---------------------------------------------------------------------------
// The bake
// ---------------------------------------------------------------------------

/**
 * Bake one class list. Every `cn-*` name is replaced by the classes the map
 * gives it (none, when the map has no entry), the mapped classes go FIRST,
 * the allowlisted hooks stay, and exact duplicates are dropped.
 *
 * @param {string} value a cooked class list
 * @param {Record<string, string>} styleMap
 */
export function bakeClassList(value, styleMap) {
  const tokens = value.split(/\s+/).filter(Boolean);
  if (!tokens.some((t) => CN_TOKEN.test(t))) return value;
  const mapped = [];
  const rest = [];
  for (const t of tokens) {
    if (CN_TOKEN.test(t)) {
      if (CN_ALLOWLIST.has(t)) rest.push(t);
      else if (styleMap[t]) mapped.push(...styleMap[t].split(/\s+/).filter(Boolean));
    } else {
      rest.push(t);
    }
  }
  const seen = new Set();
  const out = [];
  for (const t of [...mapped, ...rest]) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  // Keep the original's leading / trailing whitespace, so a class list that
  // was concatenated into a longer string still has its separators.
  const lead = /^\s*/.exec(value)[0];
  const trail = /\s*$/.exec(value)[0];
  return out.length ? lead + out.join(' ') + trail : (lead || trail ? ' ' : '');
}

/**
 * Bake a whole source file for one style map. A file with no `cn-*` name
 * comes back unchanged, byte for byte.
 *
 * @param {string} src
 * @param {Record<string, string>} styleMap
 */
export function bakeSource(src, styleMap) {
  if (!src.includes(CN_PREFIX)) return src;
  const segs = classSegments(src);
  let out = '';
  let last = 0;
  for (const seg of segs) {
    const value = segmentValue(src, seg);
    if (!/(^|\s)cn-[\w-]/.test(value)) continue;
    const baked = bakeClassList(value, styleMap);
    // A class that carries the string's own quote (the styles' `[class*='size-']`
    // inside a single-quoted string) moves the string to the other quote, the
    // way a person writes it, rather than escaping: Tailwind reads the raw
    // text and would keep the backslashes.
    const q = seg.quote;
    const other = q === "'" ? '"' : q === '"' ? "'" : '';
    if (other && baked.includes(q) && !baked.includes(other)) {
      out += src.slice(last, seg.start - 1) + other + escapeFor(baked, other) + other;
      last = seg.end + 1;
      continue;
    }
    out += src.slice(last, seg.start) + escapeFor(baked, q);
    last = seg.end;
  }
  return out + src.slice(last);
}

/**
 * Bake for a project: the style named in its `components.json`, `new-york`
 * when there is none. This is the entry `transformForProject` and the kit
 * projector call.
 *
 * @param {string} src
 * @param {string | undefined | null} style
 */
export function bakeForStyle(src, style) {
  return bakeSource(src, loadStyleMap(style));
}

/**
 * Every `cn-*` name left in a baked source outside the allowlist. A test uses
 * it to prove nothing an app or agent reads ever carries one.
 * @param {string} src
 */
export function leftoverCnNames(src) {
  const names = new Set();
  for (const seg of classSegments(src)) {
    for (const t of segmentValue(src, seg).split(/\s+/)) {
      if (CN_TOKEN.test(t) && !CN_ALLOWLIST.has(t)) names.add(t);
    }
  }
  return [...names];
}
