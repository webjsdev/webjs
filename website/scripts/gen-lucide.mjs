#!/usr/bin/env node
/**
 * Generate lib/ui/lucide.ts from an unpacked `lucide` package (ISC), limited
 * to the icon names passed on the command line, each spelled the way a
 * lucide-react import spells it (`ArrowUpIcon`, `ArrowUp`, an alias such as
 * `AlertCircleIcon`). The site does not depend on the package; fetch it once
 * with `npm pack lucide` in a scratch directory and untar it.
 *
 *   node scripts/gen-lucide.mjs <unpacked package dir> lib/ui/lucide.ts Name1 Name2 ...
 *
 * Pass the WHOLE list each time, since the output is rewritten. Each export
 * renders what lucide-react renders: a 24px, stroke 2, currentColor SVG with
 * the `lucide lucide-<name>` classes, plus an optional class.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [pkg, out, ...wanted] = process.argv.slice(2);
const index = readFileSync(`${pkg}/dist/esm/lucide.mjs`, 'utf8');
const fileFor = new Map();
for (const line of index.split('\n')) {
  const m = line.match(/^export \{ (.*) \} from '\.\/icons\/([^']+)\.mjs';$/);
  if (!m) continue;
  for (const part of m[1].split(',')) {
    const name = part.trim().replace(/^default as /, '');
    fileFor.set(name, m[2]);
  }
}
const version = JSON.parse(readFileSync(`${pkg}/package.json`, 'utf8')).version;

let body = '';
for (const name of [...new Set(wanted)].sort()) {
  const base = fileFor.has(name) ? name : name.replace(/Icon$/, '');
  const file = fileFor.get(base);
  if (!file) throw new Error(`no lucide icon ${name}`);
  const src = readFileSync(`${pkg}/dist/esm/icons/${file}.mjs`, 'utf8');
  const arr = src.slice(src.indexOf('['), src.lastIndexOf(']') + 1);
  const nodes = Function(`return ${arr}`)();
  const inner = nodes.map(([tag, props]) => {
    const a = Object.entries(props).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<${tag} ${a}></${tag}>`;
  }).join('');
  body += `export function ${name}(cls = '') {\n  return svg\`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=\${'lucide lucide-${file}' + (cls ? ' ' + cls : '')}>${inner}</svg>\`;\n}\n\n`;
}

const head = `import { svg } from '@webjsdev/core';

/**
 * The Lucide icons the /ui docs demos use (#1666), generated from lucide
 * ${version} (ISC; see packages/ui/THIRD_PARTY_NOTICES.md) by
 * scripts/gen-lucide.mjs. Each is named as the lucide-react import a shadcn
 * demo writes, aliases included, and renders the SVG lucide-react renders.
 *
 * The whole <svg> is an svg template rather than html: an icon is often
 * placed inside another svg-namespaced fragment, and an svg template parses
 * the same either way.
 */
`;
writeFileSync(out, head + '\n' + body.trimEnd() + '\n');
console.log(`wrote ${new Set(wanted).size} icons`);
