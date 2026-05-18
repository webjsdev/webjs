import { Command } from 'commander';
import { fetchRegistryItem, DEFAULT_REGISTRY_URL } from '../registry/fetcher.js';
import { logger } from '../utils/logger.js';

export const view = new Command()
  .name('view')
  .description("Print a registry item's source to stdout")
  .argument('<name>', 'component name')
  .option('--registry <url>', 'registry base URL', DEFAULT_REGISTRY_URL)
  .action(async (name, opts) => {
    const item = await fetchRegistryItem(name, opts.registry);
    logger.info(logger.dim(`# ${item.name}: ${item.type}`));
    if (item.description) logger.info(logger.dim(`# ${item.description}`));
    for (const f of item.files || []) {
      logger.info('');
      logger.info(logger.dim(`# ${f.path}`));
      console.log(f.content || '');
    }
  });
