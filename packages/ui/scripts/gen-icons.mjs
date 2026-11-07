#!/usr/bin/env node
/**
 * Generate the kit's five icon libraries (#1666, D8):
 *
 *   packages/registry/lib/icons.ts            Lucide (the default)
 *   packages/registry/lib/icons-tabler.ts     Tabler Icons
 *   packages/registry/lib/icons-hugeicons.ts  Hugeicons
 *   packages/registry/lib/icons-phosphor.ts   Phosphor
 *   packages/registry/lib/icons-remixicon.ts  Remix Icon
 *
 * Every file exports the SAME function names, the canonical names in
 * scripts/icon-map.json. Those are the lucide-react names shadcn's
 * components import (its registry/icons/__lucide__.ts), and each entry
 * names the glyph shadcn draws for that icon in the other four libraries
 * (its public/r/icons/index.json, built from the IconPlaceholder props in
 * registry/bases). So switching an app's icon library means switching which
 * file sits at the icons path, and no import changes.
 *
 * The icons come from the plain SVG packages, not the React ones. Nothing is
 * installed: fetch each with `npm pack` into a scratch directory, untar it
 * there, and pass that directory.
 *
 *   npm pack lucide @tabler/icons @hugeicons/core-free-icons @phosphor-icons/core remixicon@4.8.0
 *   (untar each tarball into lucide/, tabler/, huge/, phosphor/, remix/)
 *   node packages/ui/scripts/gen-icons.mjs <scratch dir>
 *
 * Remix Icon is pinned to 4.8.0, the last release whose License file is
 * Apache-2.0. From 4.9 the package ships the Remix Icon License v1.0, which
 * forbids redistributing the icons as an icon set, so do not move the pin
 * without reading the license of the version you move to.
 *
 * Each function renders what the library's React component renders for that
 * glyph (a 24px currentColor SVG at the library's own stroke and fill), with
 * an optional extra class. The generated files are committed; nothing is
 * fetched at runtime.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '..', 'packages', 'registry', 'lib');
const MAP = JSON.parse(readFileSync(join(here, 'icon-map.json'), 'utf8'));
const [scratch] = process.argv.slice(2);
if (!scratch) {
  console.error('usage: node packages/ui/scripts/gen-icons.mjs <dir holding the untarred icon packages>');
  process.exit(1);
}
const pkg = (dir) => join(resolve(scratch), dir, 'package');
const version = (dir) => JSON.parse(readFileSync(join(pkg(dir), 'package.json'), 'utf8')).version;
const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').replace(/([a-zA-Z])([0-9])/g, '$1-$2').toLowerCase();
const attr = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

/** Serialize a [tag, attrs] node list (the lucide and Hugeicons format). */
function nodesToSvg(nodes, override = {}) {
  return nodes.map(([tag, props]) => {
    const a = Object.entries({ ...props, ...override })
      .filter(([k]) => k !== 'key')
      .map(([k, v]) => `${attr(k)}="${v}"`)
      .join(' ');
    return `<${tag} ${a}></${tag}>`;
  }).join('');
}

/** The children of a standalone .svg file, whitespace collapsed. */
function svgInner(text) {
  return text.slice(text.indexOf('>', text.indexOf('<svg')) + 1, text.lastIndexOf('</svg>')).replace(/\s+/g, ' ').trim();
}

/** The `[tag, attrs]` array a library module exports as its default. */
function nodesOf(file) {
  const src = readFileSync(file, 'utf8');
  return Function(`return ${src.slice(src.indexOf('['), src.lastIndexOf(']') + 1)}`)();
}

const LIBRARIES = {
  lucide: {
    file: 'icons.ts',
    title: 'Lucide',
    license: 'ISC',
    dir: 'lucide',
    setup() {
      const fileFor = new Map();
      for (const line of readFileSync(join(pkg('lucide'), 'dist/esm/lucide.mjs'), 'utf8').split('\n')) {
        const m = line.match(/^export \{ (.*) \} from '\.\/icons\/([^']+)\.mjs';$/);
        if (!m) continue;
        for (const part of m[1].split(',')) fileFor.set(part.trim().replace(/^default as /, ''), m[2]);
      }
      return fileFor;
    },
    render(name, fileFor) {
      const base = fileFor.has(name) ? name : name.replace(/Icon$/, '');
      const file = fileFor.get(base);
      if (!file) throw new Error(`lucide has no ${name}`);
      const inner = nodesToSvg(nodesOf(join(pkg('lucide'), `dist/esm/icons/${file}.mjs`)));
      return { open: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`, cls: `lucide lucide-${file}`, inner };
    },
  },
  tabler: {
    file: 'icons-tabler.ts',
    title: 'Tabler Icons',
    license: 'MIT',
    dir: 'tabler',
    render(name) {
      const filled = name.endsWith('Filled');
      const slug = kebab(name.replace(/^Icon/, '').replace(/Filled$/, ''));
      const text = readFileSync(join(pkg('tabler'), `icons/${filled ? 'filled' : 'outline'}/${slug}.svg`), 'utf8');
      const open = filled
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
      return { open, cls: `tabler-icon tabler-icon-${slug}${filled ? '-filled' : ''}`, inner: svgInner(text) };
    },
  },
  hugeicons: {
    file: 'icons-hugeicons.ts',
    title: 'Hugeicons',
    license: 'MIT',
    dir: 'huge',
    setup() {
      const fileFor = new Map();
      for (const line of readFileSync(join(pkg('huge'), 'dist/esm/index.js'), 'utf8').split('\n')) {
        const m = line.match(/^export \{ (.*) \} from '\.\/([^']+)';$/);
        if (!m) continue;
        for (const part of m[1].split(',')) fileFor.set(part.trim().replace(/^default as /, ''), m[2]);
      }
      return fileFor;
    },
    // shadcn draws these through <HugeiconsIcon strokeWidth={2}>, which
    // overrides every stroked child's width, so the 1.5 the data carries
    // renders as 2.
    render(name, fileFor) {
      const file = fileFor.get(name);
      if (!file) throw new Error(`hugeicons has no ${name}`);
      const nodes = nodesOf(join(pkg('huge'), `dist/esm/${file}`)).map(([tag, props]) => [tag, props.strokeWidth ? { ...props, strokeWidth: '2' } : props]);
      return { open: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"`, cls: '', inner: nodesToSvg(nodes) };
    },
  },
  phosphor: {
    file: 'icons-phosphor.ts',
    title: 'Phosphor',
    license: 'MIT',
    dir: 'phosphor',
    // A React name can be an alias of a renamed glyph (ActivityIcon draws
    // `pulse`), so resolve it through the package's own catalogue.
    setup() {
      const fileFor = new Map();
      const src = readFileSync(join(pkg('phosphor'), 'dist/index.mjs'), 'utf8');
      for (const m of src.matchAll(/name: "([^"]+)",\s*pascal_name: "([^"]+)",(?:\s*alias: \{ name: "[^"]+", pascal_name: "([^"]+)" \},)?/g)) {
        fileFor.set(m[2], m[1]);
        if (m[3]) fileFor.set(m[3], m[1]);
      }
      return fileFor;
    },
    // The React package's default weight is "regular".
    render(name, fileFor) {
      const slug = fileFor.get(name.replace(/Icon$/, ''));
      if (!slug) throw new Error(`phosphor has no ${name}`);
      const text = readFileSync(join(pkg('phosphor'), `assets/regular/${slug}.svg`), 'utf8');
      return { open: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"`, cls: '', inner: svgInner(text) };
    },
  },
  remixicon: {
    file: 'icons-remixicon.ts',
    title: 'Remix Icon',
    license: 'Apache-2.0',
    dir: 'remix',
    setup() {
      const fileFor = new Map();
      const root = join(pkg('remix'), 'icons');
      for (const cat of readdirSync(root)) {
        for (const f of readdirSync(join(root, cat))) fileFor.set(f.replace(/\.svg$/, ''), join(root, cat, f));
      }
      return fileFor;
    },
    render(name, fileFor) {
      const slug = kebab(name.replace(/^Ri/, ''));
      const file = fileFor.get(slug);
      if (!file) throw new Error(`remixicon has no ${name} (${slug})`);
      return { open: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"`, cls: '', inner: svgInner(readFileSync(file, 'utf8')) };
    },
  },
};

/**
 * A glyph class can spell a browser global (`lucide-app-window`). WebJs's
 * elision analyser reads a non-route module's template text for those names,
 * and one in a class string would mark the whole icon file as client work,
 * pinning every page that imports it to the browser. Escaping one character
 * keeps the runtime string identical and the word out of the source.
 */
const BROWSER_GLOBALS = /\b(window|document|navigator|localStorage|sessionStorage|customElements|matchMedia|addEventListener)\b/g;
function guardGlobals(text) {
  return text.replace(BROWSER_GLOBALS, (word) => `\\u${word.charCodeAt(0).toString(16).padStart(4, '0')}${word.slice(1)}`);
}

const canonical = Object.keys(MAP).sort();

for (const [lib, def] of Object.entries(LIBRARIES)) {
  const ctx = def.setup ? def.setup() : undefined;
  let body = '';
  for (const name of canonical) {
    const glyph = MAP[name][lib];
    if (!glyph) throw new Error(`icon-map.json has no ${lib} glyph for ${name}`);
    const { open, cls, inner } = def.render(glyph, ctx);
    const classExpr = cls ? `\${'${guardGlobals(cls)}' + (cls ? ' ' + cls : '')}` : '${cls || null}';
    const doc = lib === 'lucide' ? '' : `/** ${def.title}: ${glyph}. */\n`;
    body += `${doc}export function ${name}(cls = '') {\n  return html\`${open} class=${classExpr}>${inner}</svg>\`;\n}\n\n`;
  }
  const head = `import { html } from '@webjsdev/core';

/**
 * Icons, ${def.title} edition (#1666). Generated from ${def.dir === 'huge' ? '@hugeicons/core-free-icons' : def.dir === 'tabler' ? '@tabler/icons' : def.dir === 'phosphor' ? '@phosphor-icons/core' : def.dir} ${version(def.dir)}
 * (${def.license}; see THIRD_PARTY_NOTICES.md) by packages/ui/scripts/gen-icons.mjs.
 * Do not edit by hand: re-run the script.
 *
 * Every icon the kit's blocks and demos draw is a pure function returning an
 * inline SVG, with an optional extra class. The five icon libraries the kit
 * offers (lib/icons.ts, lib/icons-tabler.ts, lib/icons-hugeicons.ts,
 * lib/icons-phosphor.ts, lib/icons-remixicon.ts) export the SAME function
 * names, the lucide-react names shadcn's components import, each drawing that
 * library's equivalent glyph. In an app the chosen library is written to one
 * path, beside the cn() helper (\`webjsui init --icons <library>\`), so
 * switching libraries replaces that file and changes no import.
 *
 * @example
 *   import { ChevronDownIcon } from '../lib/icons.ts';
 *   html\`<button>Open \${ChevronDownIcon('size-4')}</button>\`
 */
`;
  writeFileSync(join(OUT, def.file), head + '\n' + body.trimEnd() + '\n');
  console.log(`[gen-icons] ${def.file}: ${canonical.length} icons from ${def.title} ${version(def.dir)}`);
}
