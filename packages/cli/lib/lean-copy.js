/**
 * The scaffold's lean-copy of a ui component (#983).
 *
 * `webjs create` copies a few `@webjsdev/ui` registry components into a
 * generated app. To match what `webjs ui add` writes, a Tier-1 helper's worked
 * `@example` is stripped (the example is served on demand by `webjs ui view` /
 * the MCP `ui` tool), while a Tier-2 element file is kept whole. Both scaffold
 * copiers (`create.js` and `saas-template.js`) go through THIS one helper so
 * they cannot drift.
 *
 * The strip primitives live in `@webjsdev/ui/registry/extract`; if that subpath
 * cannot be resolved, this degrades to a no-op (keep the example) so the strip
 * is never a reason `webjs create` fails.
 *
 * @module lean-copy
 */

let _mod = null;

async function loadPrimitives() {
  if (_mod) return _mod;
  try {
    const m = await import('@webjsdev/ui/registry/extract');
    _mod = { stripExample: m.stripExample, isCustomElementSource: m.isCustomElementSource };
  } catch {
    _mod = { stripExample: (s) => s, isCustomElementSource: () => true };
  }
  return _mod;
}

/**
 * Return the component source as `webjs ui add` would write it: a Tier-1 helper
 * has its worked `@example` stripped and a pointer left; a Tier-2 element is
 * returned unchanged.
 *
 * @param {string} source  the component source (imports already rewritten)
 * @param {string} name    the component name (for the pointer)
 * @returns {Promise<string>}
 */
export async function leanComponentSource(source, name) {
  const { stripExample, isCustomElementSource } = await loadPrimitives();
  return isCustomElementSource(source) ? source : stripExample(source, name);
}
