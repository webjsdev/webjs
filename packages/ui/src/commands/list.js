import { Command } from 'commander';
import { fetchRegistryIndex, DEFAULT_REGISTRY_URL } from '../registry/fetcher.js';
import { logger } from '../utils/logger.js';

export const list = new Command()
  .name('list')
  .alias('search')
  .description('List components available in the registry')
  .argument('[filter]', 'filter by substring')
  .option('--registry <url>', 'registry base URL', DEFAULT_REGISTRY_URL)
  .action(async (filter, opts) => {
    const items = await fetchRegistryIndex(opts.registry);
    const ui = items.filter((i) => i.type === 'registry:ui');
    const filtered = filter ? ui.filter((i) => i.name.includes(filter)) : ui;
    if (!filtered.length) {
      logger.info('No matches.');
      return;
    }
    for (const i of filtered) {
      const desc = i.description ? logger.dim(': ' + i.description) : '';
      logger.info(`  ${logger.cyan(i.name)}${desc}`);
    }
    logger.info('');
    logger.info(`${filtered.length} component${filtered.length === 1 ? '' : 's'}.`);
  });
