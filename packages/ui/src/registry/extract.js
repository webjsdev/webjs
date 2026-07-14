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
