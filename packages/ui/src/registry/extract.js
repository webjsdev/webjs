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
import { bakeForStyle } from './style-bake.js';
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
 * The source is BAKED first (#1666): the registry is in base form, and what an
 * agent copies from this projection must be the plain Tailwind an app gets,
 * never a `cn-*` name. `style` is the app's `components.json` style, and an
 * absent one means `new-york`, the kit's default look.
 *
 * @param {string} name
 * @param {{ style?: string }} [opts]
 * @returns {{
 *   name: string, tier: 1|2, type: string,
 *   description: string, helpers: string[], example: string,
 *   dependencies: string[], registryDependencies: string[],
 * } | null}
 */
export function uiComponent(name, opts = {}) {
  const item = loadRegistryItem(name);
  if (!item || item.type !== 'registry:ui') return null;
  const src = (item.files || []).map((f) => bakeForStyle(f.content || '', opts.style)).join('\n');
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
 * A component's files baked for a style, as `webjs ui view` prints them and
 * `add` writes them (paths are the registry's). The /ui docs' Manual tab
 * shows these, so the page and the CLI cannot disagree about the source.
 *
 * @param {string} name
 * @param {{ style?: string }} [opts]
 * @returns {Array<{ path: string, content: string }> | null}
 */
export function uiComponentFiles(name, opts = {}) {
  const item = loadRegistryItem(name);
  if (!item) return null;
  return (item.files || []).map((f) => ({ path: f.path, content: bakeForStyle(f.content || '', opts.style) }));
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

/* -------------------- blocks and charts (#1666, D18) -------------------- */

/**
 * What a block is, in the one phrasing every agent-facing surface uses. A
 * block and a chart are both `registry:block` items on the wire (shadcn
 * parity), told apart by a chart's `chart` category.
 */
export const BLOCK_DEFINITION = 'a ready-made view you install and then edit';

/** The category that marks a `registry:block` as a chart. */
export const CHART_CATEGORY = 'chart';

/**
 * The agent-facing kind of a registry item: `ui` for a component, `chart` for
 * a block carrying the `chart` category, `block` for any other block, and
 * null for everything else (a lib, a theme).
 *
 * @param {{ type?: string, categories?: string[] }} item
 * @returns {'ui' | 'block' | 'chart' | null}
 */
export function itemKind(item) {
  if (!item) return null;
  if (item.type === 'registry:ui') return 'ui';
  if (item.type !== 'registry:block') return null;
  return (item.categories || []).includes(CHART_CATEGORY) ? 'chart' : 'block';
}

/**
 * The category a block is grouped under in a compact listing: its LAST, most
 * specific category (`login` for `['authentication', 'login']`, `area` for
 * `['chart', 'area']`), so each name appears once. A block with none is
 * grouped under `other`. Filtering by category still matches every one.
 *
 * @param {{ categories?: string[] }} item
 * @returns {string}
 */
export function primaryCategory(item) {
  const cats = (item.categories || []).filter((c) => c !== CHART_CATEGORY);
  return cats.length ? cats[cats.length - 1] : 'other';
}

/**
 * One compact entry per block or chart (and per component when `type` asks
 * for them): `{ name, type, categories, description }`, sorted by name. The
 * shape `webjsui list --json` prints and the MCP `ui` tool's filtered
 * listing returns.
 *
 * @param {{ type?: 'ui' | 'block' | 'chart' | 'all', category?: string }} [opts]
 *   `type` defaults to `block` plus `chart`; `all` adds the components.
 * @param {any[]} [index] the registry index, the packaged one by default
 * @returns {Array<{ name: string, type: 'ui' | 'block' | 'chart', categories: string[], description: string }>}
 */
export function uiBlocks(opts = {}, index = loadRegistryIndex()) {
  const want = opts.type || 'blocks';
  const keep = (/** @type {string|null} */ kind) =>
    kind !== null && (
      want === 'all' ? true
        : want === 'blocks' ? kind === 'block' || kind === 'chart'
          : kind === want
    );
  return index
    .map((i) => ({ i, kind: itemKind(i) }))
    .filter(({ i, kind }) => keep(kind) && (!opts.category || (i.categories || []).includes(opts.category)))
    .map(({ i, kind }) => ({
      name: i.name,
      type: /** @type {'ui' | 'block' | 'chart'} */ (kind),
      categories: i.categories || [],
      description: i.description || '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The blocks and charts as NAME LISTS grouped by {@link primaryCategory}, with
 * no descriptions: `{ blocks: { login: [...] }, charts: { area: [...] } }`.
 * The no-argument MCP `ui` payload carries this, so it stays cheap however
 * many blocks the kit ships.
 *
 * @param {any[]} [index]
 * @returns {{ blocks: Record<string, string[]>, charts: Record<string, string[]> }}
 */
export function uiBlockIndex(index = loadRegistryIndex()) {
  /** @type {{ blocks: Record<string, string[]>, charts: Record<string, string[]> }} */
  const out = { blocks: {}, charts: {} };
  for (const b of uiBlocks({}, index)) {
    const group = b.type === 'chart' ? out.charts : out.blocks;
    (group[primaryCategory(b)] ??= []).push(b.name);
  }
  return out;
}

/** The command that installs a registry item, as every printed hint spells it (invariant 8). */
export function installCommand(name) {
  return `npx @webjsdev/ui add ${name}`;
}

/**
 * Project one block (or chart) item into the agent-facing shape: what it is,
 * how to install it, and the files it writes with their targets. Pure over
 * the item, so `view` can project an item fetched from a custom registry.
 * Returns null when the item is not a block.
 *
 * The sources are left out unless `source` is true, since the cheap path is
 * to install the block and read the files on disk. When included they are
 * BAKED (#1666), so no `cn-*` name reaches an agent, but their imports stay
 * registry-relative: `add` is what rewrites them to the app's aliases.
 *
 * @param {any} item a registry item with its files
 * @param {{ style?: string, source?: boolean }} [opts]
 */
export function projectBlock(item, opts = {}) {
  const kind = itemKind(item);
  if (kind !== 'block' && kind !== 'chart') return null;
  return {
    name: item.name,
    type: kind,
    title: item.title || item.name,
    description: item.description || '',
    categories: item.categories || [],
    install: installCommand(item.name),
    dependencies: item.dependencies || [],
    registryDependencies: item.registryDependencies || [],
    ...(item.cssVars ? { cssVars: item.cssVars } : {}),
    files: (item.files || []).map((f) => ({
      path: f.path,
      type: f.type,
      target: f.target || f.path,
      ...(opts.source ? { content: bakeForStyle(f.content || '', opts.style) } : {}),
    })),
  };
}

/**
 * {@link projectBlock} for a block in the packaged registry, by name. Null
 * when the name is not a block.
 *
 * @param {string} name
 * @param {{ style?: string, source?: boolean }} [opts]
 */
export function uiBlock(name, opts = {}) {
  const item = loadRegistryItem(name);
  return item ? projectBlock(item, opts) : null;
}

/**
 * Render a block projection as human-readable text for `webjsui view`: the
 * description, categories, dependencies, the install command and the file
 * list with targets. The sources, when the projection carries them, follow.
 *
 * @param {ReturnType<typeof projectBlock>} b
 * @returns {string}
 */
export function renderBlockText(b) {
  if (!b) return '';
  const lines = [`# ${b.name}  (${b.type})`];
  if (b.description) lines.push('', b.description);
  if (b.categories.length) lines.push('', `categories: ${b.categories.join(', ')}`);
  if (b.registryDependencies.length) lines.push(`registry deps: ${b.registryDependencies.join(', ')}`);
  if (b.dependencies.length) lines.push(`npm: ${b.dependencies.join(', ')}`);
  lines.push('', `Install: ${b.install}`, '', 'Files:');
  for (const f of b.files) lines.push(`  ${f.target}`);
  for (const f of b.files) {
    if (f.content === undefined) continue;
    lines.push('', `# --- ${f.target} ---`, f.content.replace(/\n$/, ''));
  }
  return lines.join('\n');
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
