#!/usr/bin/env node
/**
 * Generate lib/ui/tabler.ts from an unpacked `@tabler/icons` package (MIT),
 * limited to the icons named on the command line, each spelled the way a
 * @tabler/icons-react import spells it (`IconCheck`, `IconBrandJavascript`).
 * The site does not depend on the package; fetch it once with
 * `npm pack @tabler/icons` in a scratch directory and untar it.
 *
 *   node scripts/gen-tabler.mjs <unpacked package dir> lib/ui/tabler.ts IconCheck IconPlus ...
 *
 * Pass the WHOLE list each time, since the output is rewritten. Each export
 * renders what @tabler/icons-react renders: a 24px, stroke 2, currentColor
 * outline SVG with the `tabler-icon tabler-icon-<name>` classes, plus an
 * optional class.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [pkg, out, ...wanted] = process.argv.slice(2);
const version = JSON.parse(readFileSync(`${pkg}/package.json`, 'utf8')).version;

const kebab = (name) => name.replace(/^Icon/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();

let body = '';
for (const name of [...new Set(wanted)].sort()) {
  const slug = kebab(name);
  const svgText = readFileSync(`${pkg}/icons/outline/${slug}.svg`, 'utf8');
  const inner = svgText.slice(svgText.indexOf('>') + 1, svgText.lastIndexOf('</svg>')).replace(/\s+/g, ' ').trim();
  body += `\nexport function ${name}(cls = '') {\n  return svg\`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=\${'tabler-icon tabler-icon-${slug}' + (cls ? ' ' + cls : '')}>${inner}</svg>\`;\n}\n`;
}

writeFileSync(out, `import { svg } from '@webjsdev/core';

/**
 * The Tabler icons the /ui docs demos use (#1666), generated from
 * @tabler/icons ${version} (MIT; see packages/ui/THIRD_PARTY_NOTICES.md) by
 * scripts/gen-tabler.mjs. Each is named as the @tabler/icons-react import a
 * shadcn demo writes, and renders the SVG that component renders.
 */
${body}`);
console.log(`wrote ${new Set(wanted).size} icons`);
