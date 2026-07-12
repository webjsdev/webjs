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
 * Pure: drop the whole marker COMMENT that carries the token, not just the token
 * line. The token never shares a line with code, but the marker comment is not
 * always one line: the layout footer marker is a multi-line `<!-- ... -->` HTML
 * comment, and several metadata markers wrap across consecutive `//` lines.
 * Removing only the token line would orphan the rest (raw text and a dangling
 * `-->` inside a template, or leftover `//` prose), so extend to the full
 * comment. Both marker styles start on the token line, so extend downward.
 * @param {string} content
 * @param {string} [marker]
 * @returns {{ content: string, removed: number }}
 */
export function stripPlaceholderMarkers(content, marker = MARKER) {
  const lines = content.split('\n');
  const isLineComment = (line) => /^\s*\/\//.test(line);
  const kept = [];
  let removed = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes(marker)) { kept.push(line); continue; }
    if (line.includes('<!--') && !line.includes('-->')) {
      // Multi-line HTML comment (the "Built with" footer): drop through the
      // closing `-->` so no orphaned text or dangling terminator survives.
      let j = i;
      while (j < lines.length && !lines[j].includes('-->')) j++;
      removed += j - i + 1;
      i = j;
    } else if (isLineComment(line)) {
      // A `//` marker comment, possibly wrapped across consecutive `//` lines.
      // Drop the token line plus its contiguous `//` continuation.
      let j = i + 1;
      while (j < lines.length && isLineComment(lines[j])) j++;
      removed += j - i;
      i = j - 1;
    } else {
      // A self-closed `<!-- ... -->` on one line, or any other single-line form.
      removed += 1;
    }
  }
  return { content: kept.join('\n'), removed };
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
