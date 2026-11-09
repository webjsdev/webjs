/**
 * Which dev edits can hot-swap a live component class instead of reloading the
 * page (#1689). Pure and state-free like `dev-classify.js`, so every reason is
 * unit-testable without booting a server; the handler feeds it the previous
 * analysis and the files on disk.
 *
 * The browser half (`dev-hot-client.js`) patches the REGISTERED class in place,
 * because `customElements.define` is once per tag and the native registry keeps
 * the constructor and the lifecycle callbacks it read at define time. Some edits
 * cannot be applied that way, and they are refused here, from source, before
 * any frame is sent:
 *
 * - a changed `constructor`: the registry keeps constructing with the OLD one,
 *   so a new default could never apply to a new element either;
 * - a changed instance field initializer: it runs per instance at
 *   construction, so a live element keeps the old value (an arrow handler
 *   field would keep the old handler);
 * - any `#private` member: a patched method carries a new private brand the
 *   live instances lack, a `TypeError` on first use;
 * - a changed `static shadow`: the render root is chosen once per element.
 *
 * The rest of the guards (a changed property shape, `observedAttributes`, an
 * overridden native lifecycle callback) need the evaluated class and run in the
 * browser at swap time.
 */

import { matchClosingBrace, matchClosingParenthesis, redactStringsAndTemplates } from './js-scan.js';

/**
 * @typedef {{ name: string, ctor: string, fields: string, priv: boolean, shadow: string }} HotClassSignature
 * @typedef {{ classes: HotClassSignature[], componentOnlyExports: boolean }} HotSignature
 */

/** Collapse whitespace so a re-indent or a reflow is not read as a change. */
const squash = (/** @type {string} */ s) => s.replace(/\s+/g, ' ').trim();

/**
 * Every named class declaration in `masked` (a position-preserving mask) with
 * the offsets of its body, whatever it extends: a component that extends
 * another component carries constructor and field state like any other.
 * @param {string} masked
 * @returns {Array<{ name: string, start: number, end: number }>}
 */
function classBodies(masked) {
  const out = [];
  const re = /\bclass\s+([\w$]+)(?:\s*<[^{}();]*?>)?\s*/g;
  let m;
  while ((m = re.exec(masked)) !== null) {
    let i = m.index + m[0].length;
    if (masked.startsWith('extends', i)) {
      i += 'extends'.length;
      while (i < masked.length && /\s/.test(masked[i])) i++;
      const id = /^[\w$.]+/.exec(masked.slice(i));
      if (id) i += id[0].length;
      while (i < masked.length && /\s/.test(masked[i])) i++;
      if (masked[i] === '(') {
        const close = matchClosingParenthesis(masked, i + 1);
        if (close === -1) continue;
        i = close + 1;
        while (i < masked.length && /\s/.test(masked[i])) i++;
      }
    }
    if (masked[i] !== '{') continue;
    const end = matchClosingBrace(masked, i + 1);
    if (end === -1) continue;
    out.push({ name: m[1], start: i + 1, end });
    re.lastIndex = end;
  }
  return out;
}

/**
 * The depth-0 members of a class body: the constructor's raw text, every
 * instance field initializer's raw text, and a `static shadow` initializer.
 * Reads positions from `maskedBody` (strings, templates and comments blanked)
 * and text from `rawBody`, which shares its offsets.
 * @param {string} maskedBody
 * @param {string} rawBody
 */
function members(maskedBody, rawBody) {
  let ctor = '';
  let shadow = '';
  /** @type {string[]} */
  const fields = [];
  let depth = 0;
  let atStart = true;
  let tpl = false;
  for (let i = 0; i < maskedBody.length; i++) {
    const c = maskedBody[i];
    // A template's body is blanked but keeps its line breaks; skip it whole.
    if (c === '`') { tpl = !tpl; atStart = false; continue; }
    if (tpl) continue;
    if (c === '{' || c === '(' || c === '[') { depth++; atStart = false; continue; }
    if (c === '}' || c === ')' || c === ']') {
      depth--;
      // A method body closing at depth 0 ends the member.
      if (depth === 0 && c === '}') atStart = true;
      continue;
    }
    if (depth !== 0) continue;
    if (c === ';' || c === '\n') { atStart = true; continue; }
    if (!atStart || /\s/.test(c)) continue;
    atStart = false;
    const rest = maskedBody.slice(i);
    const ctorM = /^constructor\s*\(/.exec(rest);
    if (ctorM) {
      const open = i + ctorM[0].length;
      const close = matchClosingParenthesis(maskedBody, open);
      if (close === -1) continue;
      const brace = maskedBody.indexOf('{', close);
      const end = brace === -1 ? -1 : matchClosingBrace(maskedBody, brace + 1);
      if (end === -1) continue;
      ctor = squash(rawBody.slice(i, end + 1));
      i = end;
      atStart = true;
      continue;
    }
    const staticShadow = /^static\s+shadow\s*=/.exec(rest);
    const field = staticShadow ? null : /^(?:(?:readonly|declare|accessor)\s+)*(#?[\w$]+)\s*=(?!=)/.exec(rest);
    const assign = staticShadow || field;
    if (!assign || /^static\b/.test(rest) && !staticShadow) continue;
    // The initializer runs to the next depth-0 `;` or line end.
    let j = i + assign[0].length;
    let d = 0;
    let inTpl = false;
    for (; j < maskedBody.length; j++) {
      const ch = maskedBody[j];
      if (ch === '`') { inTpl = !inTpl; continue; }
      if (inTpl) continue;
      if (ch === '{' || ch === '(' || ch === '[') d++;
      else if (ch === '}' || ch === ')' || ch === ']') { if (d === 0) break; d--; }
      else if (d === 0 && (ch === ';' || ch === '\n')) break;
    }
    const text = squash(rawBody.slice(i, j));
    if (staticShadow) shadow = squash(rawBody.slice(i + assign[0].length, j));
    else fields.push(text);
    i = j - 1;
  }
  return { ctor, shadow, fields: fields.join('\n') };
}

/**
 * The hot-swap signature of a component module: per named class its
 * constructor text, its instance field initializers, whether it has a
 * `#private` member and its `static shadow` initializer, plus whether the
 * module exports only classes it declares. Two signatures that differ in a
 * class's `ctor`, `fields` or `shadow`, or in their class names, cannot be
 * hot-swapped.
 *
 * @param {string} erasedSrc the module source with TypeScript types erased
 * @returns {HotSignature}
 */
export function hotSignature(erasedSrc) {
  const masked = redactStringsAndTemplates(erasedSrc, true);
  const classes = classBodies(masked).map(({ name, start, end }) => {
    const body = masked.slice(start, end);
    const { ctor, shadow, fields } = members(body, erasedSrc.slice(start, end));
    return { name, ctor, fields, shadow, priv: /(^|[^\w$])#[A-Za-z_$]/.test(body) };
  });
  const declared = new Set(classes.map((c) => c.name));
  let componentOnlyExports = true;
  for (const m of masked.matchAll(/\bexport\b\s*(default\s+)?([^\n;]*)/g)) {
    const rest = m[2];
    if (/^class\b/.test(rest)) continue;
    const ident = /^([\w$]+)\s*$/.exec(rest);
    if (m[1] && ident && declared.has(ident[1])) continue;
    const list = /^\{([^}]*)\}\s*(from\b)?/.exec(rest);
    if (list && !list[2]) {
      const names = list[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      if (names.every((n) => declared.has(n))) continue;
    }
    componentOnlyExports = false;
    break;
  }
  return { classes, componentOnlyExports };
}

/**
 * Walk each changed shipped file UP the shipped importer graph to the component
 * modules (the hot BOUNDARIES) that would have to be re-imported for the tab to
 * run the edit. A component module stops the walk; a route module (a page or
 * layout that ships) or a module nothing shipped imports means the edit has no
 * boundary and the page must reload. Every module the walk passes through on
 * the way must have no module-scope side effect, because re-evaluating it would
 * run that effect a second time. Each boundary must still be hot-swappable
 * against the baseline signature the browser holds.
 *
 * @param {Iterable<string>} changed absolute paths of the changed shipped files
 * @param {{
 *   shipped: Set<string>,
 *   componentFiles: Set<string>,
 *   routeFiles: Set<string>,
 *   importersOf: (abs: string) => Iterable<string>,
 *   signatureOf: (abs: string) => HotSignature | null | Promise<HotSignature | null>,
 *   baselineOf: (abs: string) => HotSignature | null | undefined,
 *   sideEffectOf: (abs: string) => boolean | Promise<boolean>,
 *   rel?: (abs: string) => string,
 * }} ctx
 * @returns {Promise<{ ok: true, boundaries: string[] } | { ok: false, why: string, by: string }>}
 */
export async function findHotBoundaries(changed, ctx) {
  const rel = ctx.rel || ((/** @type {string} */ f) => f);
  const fail = (/** @type {string} */ why, /** @type {string} */ f) => ({ ok: /** @type {false} */ (false), why, by: rel(f) });
  /** @type {Set<string>} */
  const boundaries = new Set();
  /** @type {Set<string>} */
  const seen = new Set();
  const queue = [...changed];
  while (queue.length) {
    const f = /** @type {string} */ (queue.shift());
    if (seen.has(f)) continue;
    seen.add(f);
    // A component module is a boundary before anything else: one an
    // import-only page re-emits has no shipped importer, and is still one.
    if (ctx.componentFiles.has(f)) { boundaries.add(f); continue; }
    if (ctx.routeFiles.has(f)) return fail('no-hot-boundary', f);
    if (await ctx.sideEffectOf(f)) return fail('side-effect-module', f);
    const importers = [...ctx.importersOf(f)].filter((i) => ctx.shipped.has(i));
    if (!importers.length) return fail('no-hot-boundary', f);
    queue.push(...importers);
  }
  if (!boundaries.size) return fail('no-hot-boundary', [...changed][0] || '');
  for (const b of boundaries) {
    const base = ctx.baselineOf(b);
    if (!base) return fail('no-hot-baseline', b);
    const sig = await ctx.signatureOf(b);
    if (!sig) return fail('no-hot-baseline', b);
    if (sig.classes.some((c) => c.priv)) return fail('private-members', b);
    const names = (/** @type {HotSignature} */ s) => s.classes.map((c) => c.name).sort().join(',');
    if (names(sig) !== names(base)) return fail('class-set-changed', b);
    const old = new Map(base.classes.map((c) => [c.name, c]));
    for (const c of sig.classes) {
      const o = /** @type {HotClassSignature} */ (old.get(c.name));
      if (c.ctor !== o.ctor) return fail('constructor-changed', b);
      if (c.fields !== o.fields) return fail('instance-fields-changed', b);
      if (c.shadow !== o.shadow) return fail('static-shadow-changed', b);
    }
    if (!sig.componentOnlyExports) return fail('non-component-exports', b);
  }
  return { ok: true, boundaries: [...boundaries].sort() };
}
