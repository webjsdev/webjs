import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { getConfig } from '../utils/get-config.js';
import { fetchRegistryItem, fetchRegistryIndex, DEFAULT_REGISTRY_URL } from '../registry/fetcher.js';
import { logger } from '../utils/logger.js';

export const diff = new Command()
  .name('diff')
  .description('Show differences between local components and the registry')
  .argument('[name]', 'component to diff (omit to show all out-of-date)')
  .option('-c, --cwd <cwd>', 'the working directory', process.cwd())
  .option('--registry <url>', 'registry base URL', DEFAULT_REGISTRY_URL)
  .action(async (name, opts) => {
    const config = getConfig(opts.cwd);
    if (!config) {
      logger.error('No components.json. Run `webjsui init` first.');
      process.exit(1);
    }

    const items = name ? [await fetchRegistryItem(name, opts.registry)] : (await fetchRegistryIndex(opts.registry)).filter((i) => i.type === 'registry:ui');
    const uiDir = config.resolvedPaths.ui;
    let changed = 0;

    for (const item of items) {
      for (const file of item.files || []) {
        const target = join(uiDir, basename(file.path));
        if (!existsSync(target)) continue;
        const local = readFileSync(target, 'utf8');
        if (local !== (file.content || '')) {
          logger.info(`${logger.bold(item.name)} — ${basename(file.path)} differs from registry`);
          changed++;
        }
      }
    }

    if (changed === 0) logger.success('All local components match the registry.');
    else logger.info(`\n${changed} file${changed === 1 ? '' : 's'} differ. Re-add with ${logger.cyan('webjsui add <name> -o')} to overwrite.`);
  });
