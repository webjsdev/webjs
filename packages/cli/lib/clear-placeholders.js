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

// Every scaffold marker's text ends with this closing clause (wrapped across
// lines or not), so it precisely bounds the marker sentence. See create.js /
// api-gallery.js where the markers are emitted.
const TERMINATOR = 'the marker remains';

// Strip comment punctuation and collapse whitespace so a marker wrapped across
// several `//` or `<!-- -->` lines can be matched as one normalized sentence.
const norm = (line) => line.replace(/<!--|-->|\/\//g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const isLineComment = (line) => /^\s*\/\//.test(line);

/**
 * Pure: drop exactly the marker COMMENT that carries the token, not just the
 * token line and NOT the adjacent educational comment/code. The marker is not
 * always one line (the layout footer is a multi-line `<!-- ... -->`, and the
 * global-* markers wrap across `//` lines), and it is often immediately followed
 * by a SEPARATE comment paragraph, so a greedy "remove the whole comment run"
 * over-removes. The marker sentence always ends in TERMINATOR, so extend from
 * the token line only to the line that completes that clause (or, if the clause
 * is somehow absent, remove just the token line rather than over-reaching).
 * @param {string} content
 * @param {string} [marker]
 * @returns {{ content: string, removed: number, markers: number }}
 */
export function stripPlaceholderMarkers(content, marker = MARKER) {
  const lines = content.split('\n');
  const kept = [];
  let removed = 0;
  let markers = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes(marker)) { kept.push(line); continue; }
    markers += 1;
    let acc = norm(line);
    let end = i;
    if (!acc.includes(TERMINATOR)) {
      // Extend over the marker's own comment (contiguous `//`, or up to the HTML
      // `-->`) until the closing clause completes. Stop at the comment boundary
      // if the clause never appears, so an edited marker under-removes, never
      // eats the following paragraph or code.
      const html = line.includes('<!--');
      for (let j = i + 1; j < lines.length; j++) {
        if (!html && !isLineComment(lines[j])) break;
        acc += ' ' + norm(lines[j]);
        end = j;
        if (acc.includes(TERMINATOR) || (html && lines[j].includes('-->'))) break;
      }
      if (!acc.includes(TERMINATOR) && !html) end = i; // clause absent: token line only
    }
    removed += end - i + 1;
    i = end;
  }
  return { content: kept.join('\n'), removed, markers };
}

/**
 * Walk an app root, strip the marker comments in place, and return a per-file
 * report of how many markers were cleared (and how many lines that removed).
 * Only `.ts`/`.js`/`.mts`/`.mjs` files that actually carry the marker are
 * rewritten.
 * @param {string} root
 * @param {{ marker?: string, write?: (path: string, content: string) => void }} [opts]
 * @returns {Array<{ file: string, markers: number, removed: number }>}
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
      const { content, removed, markers } = stripPlaceholderMarkers(src, marker);
      write(full, content);
      report.push({ file: full, markers, removed });
    }
  })(root);
  return report;
}
