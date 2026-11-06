import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getConfig } from '../utils/get-config.js';
import { DEFAULT_REGISTRY_URL } from '../registry/fetcher.js';
import { loadRegistryIndex } from '../registry/local.js';
import { itemKind } from '../registry/extract.js';
import { logger } from '../utils/logger.js';

export const info = new Command()
  .name('info')
  .description('Print project diagnostics (config, registry)')
  .option('-c, --cwd <cwd>', 'the working directory', process.cwd())
  .action((opts) => {
    const cwd = opts.cwd;
    const config = getConfig(cwd);

    logger.info(`${logger.bold('cwd')}          ${cwd}`);
    logger.info(`${logger.bold('Registry')}     ${DEFAULT_REGISTRY_URL}`);
    // What the installed kit ships (the packaged registry `add` reads), with
    // the blocks and charts counted beside the components (D18).
    const kinds = loadRegistryIndex().map(itemKind);
    const count = (k) => kinds.filter((x) => x === k).length;
    logger.info(`${logger.bold('Kit')}          ${count('ui')} components, ${count('block')} blocks, ${count('chart')} charts`);
    logger.info(`${logger.bold('Config')}       ${config ? 'components.json ✔' : 'components.json ✖ (run `npx @webjsdev/ui init`)'}`);
    if (config) {
      logger.info(`${logger.bold('Base color')}   ${config.tailwind.baseColor}`);
      logger.info(`${logger.bold('Tailwind CSS')} ${config.tailwind.css}`);
      logger.info(`${logger.bold('Aliases')}      ${JSON.stringify(config.aliases)}`);
    }
    logger.info(`${logger.bold('Tailwind')}     ${existsSync(join(cwd, 'tailwind.config.js')) || existsSync(join(cwd, 'tailwind.config.ts')) ? 'config detected' : '(none: Tailwind v4 uses CSS-only config)'}`);
  });
