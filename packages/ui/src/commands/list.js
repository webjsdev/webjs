import { Command } from 'commander';
import { getRegistryIndex, DEFAULT_REGISTRY_URL } from '../registry/fetcher.js';
import { uiBlocks, BLOCK_DEFINITION } from '../registry/extract.js';
import { logger } from '../utils/logger.js';

const TYPES = ['ui', 'block', 'chart', 'all'];

/** The three labelled groups `list` prints, in order. */
const GROUPS = [
  ['ui', 'Components'],
  ['block', `Blocks (${BLOCK_DEFINITION})`],
  ['chart', 'Charts'],
];

export const list = new Command()
  .name('list')
  .alias('search')
  .description('List the components, blocks and charts in the registry')
  .argument('[filter]', 'filter by substring of the name')
  .option('--type <type>', `ui, block, chart or all (${TYPES.join(' | ')})`, 'all')
  .option('--category <name>', 'only blocks and charts in this category (e.g. login, sidebar, area)')
  .option('--json', 'print one compact JSON array of { name, type, categories, description }')
  .option('--registry <url>', 'registry base URL', DEFAULT_REGISTRY_URL)
  .action(async (filter, opts) => {
    if (!TYPES.includes(opts.type)) {
      logger.error(`Unknown --type "${opts.type}". Use one of: ${TYPES.join(', ')}.`);
      process.exit(1);
    }
    const index = await getRegistryIndex(opts.registry);
    const items = uiBlocks({ type: opts.type, category: opts.category }, index)
      .filter((i) => !filter || i.name.includes(filter));

    // The JSON form is the whole of stdout, so nothing else is printed.
    if (opts.json) {
      console.log(JSON.stringify(items));
      return;
    }
    if (!items.length) {
      logger.info('No matches.');
      return;
    }
    for (const [type, label] of GROUPS) {
      const group = items.filter((i) => i.type === type);
      if (!group.length) continue;
      logger.info(logger.bold(`${label}:`));
      for (const i of group) {
        const desc = i.description ? logger.dim(': ' + i.description) : '';
        logger.info(`  ${logger.cyan(i.name)}${desc}`);
      }
      logger.info('');
    }
    const count = (type, word) => {
      const n = items.filter((i) => i.type === type).length;
      return n ? `${n} ${word}${n === 1 ? '' : 's'}` : null;
    };
    logger.info([count('ui', 'component'), count('block', 'block'), count('chart', 'chart')].filter(Boolean).join(', ') + '.');
  });
