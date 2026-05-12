import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getConfig } from '../utils/get-config.js';
import { detectProject } from '../utils/detect-project.js';
import { DEFAULT_REGISTRY_URL } from '../registry/fetcher.js';
import { logger } from '../utils/logger.js';

export const info = new Command()
  .name('info')
  .description('Print project diagnostics (config, project type, registry)')
  .option('-c, --cwd <cwd>', 'the working directory', process.cwd())
  .action((opts) => {
    const cwd = opts.cwd;
    const { type } = detectProject(cwd);
    const config = getConfig(cwd);

    logger.info(`${logger.bold('Project')}      ${type}`);
    logger.info(`${logger.bold('cwd')}          ${cwd}`);
    logger.info(`${logger.bold('Registry')}     ${DEFAULT_REGISTRY_URL}`);
    logger.info(`${logger.bold('Config')}       ${config ? 'components.json ✔' : 'components.json ✖ (run `webjsui init`)'}`);
    if (config) {
      logger.info(`${logger.bold('Base color')}   ${config.tailwind.baseColor}`);
      logger.info(`${logger.bold('Tailwind CSS')} ${config.tailwind.css}`);
      logger.info(`${logger.bold('Aliases')}      ${JSON.stringify(config.aliases)}`);
    }
    logger.info(`${logger.bold('Tailwind')}     ${existsSync(join(cwd, 'tailwind.config.js')) || existsSync(join(cwd, 'tailwind.config.ts')) ? 'config detected' : '(none — Tailwind v4 uses CSS-only config)'}`);
  });
