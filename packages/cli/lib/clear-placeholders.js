// `webjs check --clear-placeholders`: acknowledge the scaffold gallery in one
// command instead of hand-editing every demo file. A fresh scaffold trips
// `no-scaffold-placeholder` on every unadapted file at once, and the rule's
// sanctioned "deliberately keep it, then delete the marker line" path otherwise
// means one manual edit per file. This strips the marker comment lines so the
// gate goes green while the demo CODE is kept verbatim (it does NOT prune the
// gallery; deleting a demo you do not want stays a deliberate `rm`).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Assembled so THIS source does not itself carry the contiguous literal (the
// check scans raw source, and this file ships in the published CLI).
export const MARKER = 'webjs-scaffold-' + 'placeholder';

const SKIP_DIRS = new Set(['node_modules', '.git', '.webjs', 'graphify-out', 'dist']);

/**
 * Pure: drop every line carrying the marker token. The token only ever appears
 * inside dedicated one-line `//` marker comments (the check depends on that), so
 * removing a token-carrying line can never delete real code.
 * @param {string} content
 * @param {string} [marker]
 * @returns {{ content: string, removed: number }}
 */
export function stripPlaceholderMarkers(content, marker = MARKER) {
  const lines = content.split('\n');
  const kept = lines.filter((line) => !line.includes(marker));
  return { content: kept.join('\n'), removed: lines.length - kept.length };
}

/**
 * Walk an app root, strip marker lines in place, and return a per-file report of
 * how many marker lines were removed. Only `.ts`/`.js`/`.mts`/`.mjs` files that
 * actually carry the marker are rewritten.
 * @param {string} root
 * @param {{ marker?: string, write?: (path: string, content: string) => void }} [opts]
 * @returns {Array<{ file: string, removed: number }>}
 */
export function clearPlaceholders(root, opts = {}) {
  const marker = opts.marker ?? MARKER;
  const write = opts.write ?? ((p, c) => writeFileSync(p, c));
  const report = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.m?[jt]s$/.test(name)) continue;
      const src = readFileSync(full, 'utf8');
      if (!src.includes(marker)) continue;
      const { content, removed } = stripPlaceholderMarkers(src, marker);
      write(full, content);
      report.push({ file: full, removed });
    }
  })(root);
  return report;
}
