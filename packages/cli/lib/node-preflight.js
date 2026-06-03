/**
 * Inline, dependency-free Node-version preflight for the CLI (issue #238).
 *
 * This is deliberately SEPARATE from `@webjsdev/server`'s `node-version.js`:
 * importing the server package links `src/dev.js`, which references Node 24+
 * builtins, so on an old Node that import LINK-fails before any preflight could
 * run. The CLI's primary guard must therefore depend on nothing but
 * `process.versions.node`. `bin/webjs.js` imports `checkNodeInline` from here
 * and runs it before any `import @webjsdev/server`. This module imports nothing.
 */

/**
 * Pure Node-major check. Reads the minimum from the passed `engines` range
 * (the CLI's own `engines.node`, so the requirement lives in one place) and
 * compares the running major. Fails open (`ok: true`) on an unparseable running
 * version so an unusual runtime is not blocked; falls back to 24 when the
 * engines range carries no integer.
 * @param {string} current  running Node version (e.g. `process.versions.node`)
 * @param {string} engines  the CLI package's `engines.node` range
 * @returns {{ ok: boolean, current: string, currentMajor: number, requiredMajor: number }}
 */
export function checkNodeInline(current, engines) {
  const cm = String(current).match(/^v?(\d+)/);
  const rm = String(engines).match(/(\d+)/);
  const currentMajor = cm ? Number(cm[1]) : NaN;
  const requiredMajor = rm ? Number(rm[1]) : 24;
  const ok = Number.isNaN(currentMajor) || currentMajor >= requiredMajor;
  return { ok, current, currentMajor, requiredMajor };
}

/**
 * Compose the actionable stderr message for an unsupported Node. Names the found
 * and required version and the reason (the built-in TS strip + recursive
 * fs.watch need Node 24+).
 * @param {{ current: string, currentMajor: number, requiredMajor: number }} r
 * @returns {string}
 */
export function nodeInlineMessage(r) {
  return (
    `webjs requires Node ${r.requiredMajor}+ but found Node ${r.current}. ` +
    `webjs is buildless and relies on Node ${r.requiredMajor}'s built-in ` +
    `TypeScript strip (module.stripTypeScriptTypes) and recursive fs.watch, ` +
    `neither of which exists on Node ${r.currentMajor}. ` +
    `Upgrade to Node ${r.requiredMajor} or newer (see https://nodejs.org).`
  );
}
