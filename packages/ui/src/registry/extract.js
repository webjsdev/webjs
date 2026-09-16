/**
 * The shared ui-kit projector (#983).
 *
 * ONE leaf that turns the packaged registry into an agent-facing view of the
 * kit, consumed by BOTH `webjsui view` (the CLI / offline path) and the MCP
 * `ui` tool (the in-context agent path). Following the #979 shared-projector
 * pattern (one module backs both the CLI and the MCP surface, guarded by a
 * drift test), so the two cannot disagree. It lives in `@webjsdev/ui` (exported
 * as `@webjsdev/ui/registry/extract`), NOT in `@webjsdev/mcp`, because the
 * registry is THIS package's source of truth and mcp has no path to it.
 *
 * It reads the LOCAL packaged registry (via `local.js`): the kit inventory and
 * per-component helper signatures + the paste-ready `@example` + the JSDoc
 * header (description + a11y obligations) + npm deps. Pure over the on-disk
 * registry; no network, no app scope (this is about the KIT, unlike the MCP
 * `list_components` which is about the app).
 *
 * @module registry/extract
 */

import { loadRegistryItem, loadRegistryIndex, isCustomElementSource } from './local.js';
import { extractExample } from './example.js';

/**
 * Extract the exported class-helper signatures from a Tier-1 source, e.g.
 * `accordionTriggerClass(opts: { disabled?: boolean } = {})`. Best-effort
 * lexical scan (no TS parser dependency); the parameter list is captured up to
 * its closing paren, the return-type annotation dropped.
 *
 * @param {string} src
 * @returns {string[]}
 */
export function extractHelperSignatures(src) {
  /** @type {string[]} */
  const out = [];
  // Two authored forms, both class-helper functions:
  //   export const NAME = (params): T => ...      (arrow; the `=>` gates out
  //                                                 non-function consts)
  //   export function NAME(params): T { ... }
  // `export type` / `export interface` never match (no arrow, no `function`).
  const re =
    /export\s+(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(\([^)]*\))\s*(?::[^=]+?)?=>|function\s+([A-Za-z_$][\w$]*)\s*(\([^)]*\)))/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m[1]) out.push(`${m[1]}${m[2]}`);
    else if (m[3]) out.push(`${m[3]}${m[4]}`);
  }
  return out;
}

/**
 * The option AXES a Tier-1 class helper exposes, e.g.
 * `{ buttonClass: { variant: ['default', ...], size: ['default', 'xs', ...] } }`.
 *
 * `extractHelperSignatures` returns signature TEXT, which is right for `view`
 * and the MCP `ui` tool but cannot answer "which sizes exist", the question a
 * `webjsui lint` no-restyle message has to answer. Same lexical, parser-free
 * approach, same module, so the two cannot drift. Pure over SOURCE TEXT so the
 * linter can feed it the APP's copied `components/ui/*.ts` (which may have
 * added or removed a variant) rather than the packaged registry.
 *
 * Resolves the two shapes the registry actually writes:
 *   const size = opts.size ?? 'default';  ...  SIZES[size]      (button.ts)
 *   VARIANTS[opts.variant ?? 'default']                          (badge.ts)
 * Two objects feeding one axis are unioned (switch.ts: TRACK_SIZES[size] and
 * THUMB_SIZES[size]). A helper matching neither shape yields no axes, and the
 * caller then omits the value list rather than inventing one.
 *
 * @param {string} src
 * @returns {Record<string, Record<string, string[]>>}
 */
export function extractHelperAxes(src) {
  // Comments are blanked first (string-aware), so an apostrophe or a brace in
  // a comment inside the app's variant map cannot swallow the rest of the
  // object; positions are not reported here, so blanking to spaces is enough.
  src = blankComments(src);
  // 1. Every `const NAME(: T)? = { ... }` object literal and its top-level keys.
  /** @type {Map<string, string[]>} */
  const objects = new Map();
  const objRe = /\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*?)?=\s*\{/g;
  let m;
  while ((m = objRe.exec(src)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchBrace(src, open);
    if (close === -1) continue;
    objects.set(m[1], topLevelKeys(src.slice(open + 1, close)));
    objRe.lastIndex = close;
  }
  if (objects.size === 0) return {};

  // 2. Every exported helper, by start offset, so a read below is attributed to
  //    the nearest preceding declaration (helpers are sequential in a module).
  /** @type {{ name: string, at: number }[]} */
  const helpers = [];
  const fnRe =
    /export\s+(?:const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::[^=]+?)?=>|function\s+([A-Za-z_$][\w$]*)\s*\()/g;
  while ((m = fnRe.exec(src)) !== null) helpers.push({ name: m[1] || m[2], at: m.index });
  const helperAt = (/** @type {number} */ offset) => {
    let h = null;
    for (const c of helpers) if (c.at <= offset) h = c.name;
    return h;
  };

  // 3. `const <local> = <param>.<axis> ?? ...` bindings, scoped to their helper.
  /** @type {Map<string, Map<string, string>>} */
  const bindings = new Map();
  const bindRe = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*[A-Za-z_$][\w$]*\.([A-Za-z_$][\w$]*)\s*\?\?/g;
  while ((m = bindRe.exec(src)) !== null) {
    const h = helperAt(m.index);
    if (!h) continue;
    if (!bindings.has(h)) bindings.set(h, new Map());
    bindings.get(h).set(m[1], m[2]);
  }

  // 4. Every `OBJ[<index>]` read: the axis is `<param>.<axis>` in the index, or
  //    the axis the bare local was bound to. Union per helper + axis, first-seen
  //    order, so the message lists `default` first as the source does.
  /** @type {Record<string, Record<string, string[]>>} */
  const out = {};
  const readRe = /\b([A-Za-z_$][\w$]*)\[([^\]]+)\]/g;
  while ((m = readRe.exec(src)) !== null) {
    const keys = objects.get(m[1]);
    if (!keys) continue;
    const h = helperAt(m.index);
    if (!h) continue;
    const index = m[2];
    let axis = null;
    const member = /[A-Za-z_$][\w$]*\.([A-Za-z_$][\w$]*)/.exec(index);
    if (member) axis = member[1];
    else {
      const local = index.trim();
      axis = bindings.get(h)?.get(local) ?? null;
    }
    if (!axis) continue;
    const forHelper = (out[h] ??= {});
    const values = (forHelper[axis] ??= []);
    for (const k of keys) if (!values.includes(k)) values.push(k);
  }
  return out;
}

/** `src` with every line and block comment blanked to spaces, strings and templates left intact. */
function blankComments(src) {
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      out += c; i++;
      while (i < src.length && src[i] !== c) { if (src[i] === '\\') { out += src[i]; i++; } out += src[i]; i++; }
      out += src[i] ?? '';
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
      out += '\n';
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop - 1;
      continue;
    }
    out += c;
  }
  return out;
}

/** Index of the `}` matching the `{` at `open`, string-aware. -1 when unbalanced. */
function matchBrace(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"' || c === '`') {
      i++;
      while (i < s.length && s[i] !== c) { if (s[i] === '\\') i++; i++; }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** The top-level keys of an object-literal body (bare identifiers and quoted strings). */
function topLevelKeys(body) {
  /** @type {string[]} */
  const keys = [];
  let depth = 0;
  let atKey = true;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      let text = '';
      while (j < body.length && body[j] !== c) { if (body[j] === '\\') j++; text += body[j]; j++; }
      if (depth === 0 && atKey) { keys.push(text); atKey = false; }
      i = j;
      continue;
    }
    if (c === '{' || c === '[' || c === '(') { depth++; continue; }
    if (c === '}' || c === ']' || c === ')') { depth--; continue; }
    if (depth === 0 && c === ',') { atKey = true; continue; }
    if (depth === 0 && atKey && /[A-Za-z_$]/.test(c)) {
      let j = i;
      let word = '';
      while (j < body.length && /[\w$]/.test(body[j])) word += body[j++];
      keys.push(word);
      atKey = false;
      i = j - 1;
    }
  }
  return keys;
}

/**
 * The JSDoc header text (description + a11y obligations + token notes), with the
 * `@example` block and the `@module`/`@param`-style tags dropped. This is the
 * "lean header" the copied file keeps; serving it lets an agent read the
 * obligations without the worked example.
 *
 * @param {string} src
 * @returns {string}
 */
export function extractDocHeader(src) {
  const start = src.indexOf('/**');
  if (start === -1) return '';
  const end = src.indexOf('*/', start + 3);
  if (end === -1) return '';
  const lines = src.slice(start + 3, end).split('\n');
  /** @type {string[]} */
  const out = [];
  for (const raw of lines) {
    const line = raw.replace(/^\s*\*\s?/, '');
    if (/^\s*@\w+/.test(line)) break; // stop at the first tag (@example, @module, ...)
    out.push(line);
  }
  return out.join('\n').trim();
}

/**
 * Project one registry component into the agent-facing shape. Returns null when
 * the name is not a `registry:ui` component.
 *
 * @param {string} name
 * @returns {{
 *   name: string, tier: 1|2, type: string,
 *   description: string, helpers: string[], example: string,
 *   dependencies: string[], registryDependencies: string[],
 * } | null}
 */
export function uiComponent(name) {
  const item = loadRegistryItem(name);
  if (!item || item.type !== 'registry:ui') return null;
  const src = (item.files || []).map((f) => f.content || '').join('\n');
  const tier = isCustomElementSource(src) ? 2 : 1;
  return {
    name: item.name,
    tier,
    type: item.type,
    description: extractDocHeader(src),
    helpers: tier === 1 ? extractHelperSignatures(src) : [],
    example: extractExample(src),
    dependencies: item.dependencies || [],
    registryDependencies: item.registryDependencies || [],
  };
}

/**
 * The kit inventory: one compact entry per `registry:ui` component (name, tier,
 * helper signatures, npm deps). The no-args payload for the MCP `ui` tool and
 * the `references/ui-kit.md` skill surface, so an agent reaches for a helper
 * instead of expanding Tailwind by hand.
 *
 * @returns {Array<{ name: string, tier: 1|2, helpers: string[], dependencies: string[] }>}
 */
export function uiInventory() {
  return loadRegistryIndex()
    .filter((i) => i.type === 'registry:ui')
    .map((i) => {
      const c = uiComponent(i.name);
      return {
        name: i.name,
        tier: c ? c.tier : 1,
        helpers: c ? c.helpers : [],
        dependencies: c ? c.dependencies : [],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Render a component projection as human-readable text for `webjsui view`.
 * Shares the SAME {@link uiComponent} data the MCP `ui` tool returns, so the
 * two never drift.
 *
 * @param {ReturnType<typeof uiComponent>} c
 * @returns {string}
 */
export function renderComponentText(c) {
  if (!c) return '';
  const lines = [];
  lines.push(`# ${c.name}  (Tier ${c.tier})`);
  if (c.description) lines.push('', c.description);
  if (c.helpers.length) lines.push('', 'Helpers:', ...c.helpers.map((h) => `  ${h}`));
  if (c.dependencies.length) lines.push('', `npm: ${c.dependencies.join(', ')}`);
  if (c.registryDependencies.length) lines.push(`registry deps: ${c.registryDependencies.join(', ')}`);
  if (c.example) lines.push('', 'Example:', '', c.example);
  return lines.join('\n');
}
