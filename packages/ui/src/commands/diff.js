import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { getConfig } from '../utils/get-config.js';
import { fetchRegistryItem, fetchRegistryIndex, DEFAULT_REGISTRY_URL } from '../registry/fetcher.js';
import { transformForProject, resolveTarget } from './add.js';
import { logger } from '../utils/logger.js';

export const diff = new Command()
  .name('diff')
  .description('Show differences between local components or blocks and the registry')
  .argument('[name]', 'component or block to diff (omit to show all out-of-date)')
  .option('-c, --cwd <cwd>', 'the working directory', process.cwd())
  .option('--registry <url>', 'registry base URL', DEFAULT_REGISTRY_URL)
  .action(async (name, opts) => {
    const config = getConfig(opts.cwd);
    if (!config) {
      logger.error('No components.json. Run `npx @webjsdev/ui init` first.');
      process.exit(1);
    }

    // diff compares local files against the LIVE upstream, so it stays on the
    // network path (NOT local-first): local-first would compare the package
    // against itself. Resolve the names to compare, then fetch each item's full
    // content (the index is metadata-only). Installed blocks are compared too
    // (D18).
    let names;
    if (name) {
      names = [name];
    } else {
      const index = await fetchRegistryIndex(opts.registry);
      names = index.filter((i) => i.type === 'registry:ui' || i.type === 'registry:block').map((i) => i.name);
    }

    // Grouped by the file on disk, not by item: several blocks can write the
    // same target (every login block writes app/login/page.ts), so a file is
    // up to date when it matches ANY item that writes it, and is reported
    // once otherwise.
    /** @type {Map<string, { items: string[], expected: string[] }>} */
    const byTarget = new Map();
    for (const n of names) {
      const item = await fetchRegistryItem(n, opts.registry);
      for (const file of item.files || []) {
        // The path `add` writes, so the two cannot disagree (#983).
        const target = resolveTarget(opts.cwd, config, item, file);
        if (!existsSync(target)) continue;
        // Compare against what `add` WOULD write (bake, import rewrite and
        // example strip), not the raw registry content: otherwise a pristine
        // install reports every import-rewritten file as differing (#983).
        const expected = transformForProject(file.content || '', target, config, item, { file, cwd: opts.cwd });
        const entry = byTarget.get(target) ?? { items: [], expected: [] };
        entry.items.push(item.name);
        entry.expected.push(expected);
        byTarget.set(target, entry);
      }
    }

    let changed = 0;
    for (const [target, { items, expected }] of byTarget) {
      const local = readFileSync(target, 'utf8');
      if (expected.includes(local)) continue;
      const rel = target.startsWith(opts.cwd) ? target.slice(opts.cwd.length + 1) : target;
      logger.info(items.length === 1
        ? `${logger.bold(items[0])}: ${rel} differs from registry`
        : `${rel} differs from every item that writes it (${items.join(', ')})`);
      changed++;
    }

    if (changed === 0) logger.success('All local components and blocks match the registry.');
    else logger.info(`\n${changed} file${changed === 1 ? '' : 's'} differ. Re-add with ${logger.cyan('npx @webjsdev/ui add <name> -o')} to overwrite.`);
  });
