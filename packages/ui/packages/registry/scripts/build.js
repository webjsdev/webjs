#!/usr/bin/env node
/**
 * Build the registry — read registry.json + sources, emit r/*.json files.
 *
 * Output:
 *   r/<name>.json         — one per registry item, with inlined content
 *   r/themes/<name>.json  — one per base-colour theme
 *   r/index.json          — flat list (used by `webjsui list`)
 *   r/registry.json       — full manifest (mirrors registry.json)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_COLORS, BASE_OVERRIDES } from '../themes/base-colors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = join(ROOT, 'r');

function main() {
  if (existsSync(OUT)) rmSync(OUT, { recursive: true });
  mkdirSync(OUT, { recursive: true });

  const manifest = JSON.parse(readFileSync(join(ROOT, 'registry.json'), 'utf8'));
  const enrichedItems = [];
  const indexEntries = [];

  for (const item of manifest.items) {
    const enriched = {
      $schema: 'https://ui.webjs.com/schema/registry-item.json',
      ...item,
      files: (item.files || []).map((f) => {
        const filePath = resolve(ROOT, f.path);
        if (!existsSync(filePath)) {
          console.warn(`[ui-registry] missing source: ${f.path} (item: ${item.name}) — emitting empty content`);
          return { ...f, content: '' };
        }
        return { ...f, content: readFileSync(filePath, 'utf8') };
      }),
    };
    writeFileSync(join(OUT, `${item.name}.json`), JSON.stringify(enriched, null, 2) + '\n', 'utf8');
    enrichedItems.push(enriched);
    indexEntries.push({ name: item.name, type: item.type, description: item.description, dependencies: item.dependencies, registryDependencies: item.registryDependencies });
  }

  // Themes — emit one JSON per base colour
  mkdirSync(join(OUT, 'themes'), { recursive: true });
  for (const color of BASE_COLORS) {
    const overrides = BASE_OVERRIDES[color] || { light: {}, dark: {} };
    const themeItem = {
      $schema: 'https://ui.webjs.com/schema/registry-item.json',
      name: `theme-${color}`,
      type: 'registry:theme',
      title: color.charAt(0).toUpperCase() + color.slice(1),
      description: `${color} base colour`,
      cssVars: { light: overrides.light, dark: overrides.dark },
    };
    writeFileSync(join(OUT, 'themes', `${color}.json`), JSON.stringify(themeItem, null, 2) + '\n', 'utf8');
    indexEntries.push({ name: `theme-${color}`, type: 'registry:theme' });
  }

  // Index
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(indexEntries, null, 2) + '\n', 'utf8');
  // Full manifest (also serve directly)
  writeFileSync(join(OUT, 'registry.json'), JSON.stringify({ ...manifest, items: enrichedItems }, null, 2) + '\n', 'utf8');

  console.log(`[ui-registry] built ${manifest.items.length} components + ${BASE_COLORS.length} themes → ${OUT}`);
}

main();
