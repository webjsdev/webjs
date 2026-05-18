import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import prompts from 'prompts';
import { defaultsForProject } from '../utils/detect-project.js';
import { writeConfig, CONFIG_FILE } from '../utils/get-config.js';
import { logger } from '../utils/logger.js';
import { fetchRegistryItem, DEFAULT_REGISTRY_URL } from '../registry/fetcher.js';

const BASE_COLORS = ['neutral', 'stone', 'zinc', 'mauve', 'olive', 'mist', 'taupe'];

export const init = new Command()
  .name('init')
  .description('Initialize @webjskit/ui in a project: writes components.json, theme CSS, lib/utils')
  .option('-c, --cwd <cwd>', 'the working directory', process.cwd())
  .option('-y, --yes', 'skip confirmation prompts', false)
  .option('--base-color <color>', `base color (${BASE_COLORS.join('|')})`)
  .option('--css <path>', 'path to the project Tailwind CSS file')
  .option('--registry <url>', 'registry base URL', DEFAULT_REGISTRY_URL)
  .action(async (opts) => {
    const cwd = opts.cwd;
    const defaults = defaultsForProject(cwd);

    /** @type {{ baseColor: string, css: string }} */
    let answers = {
      baseColor: opts.baseColor || 'neutral',
      css: opts.css || defaults.tailwindCss,
    };

    if (!opts.yes) {
      const r = await prompts(
        [
          {
            type: opts.baseColor ? null : 'select',
            name: 'baseColor',
            message: 'Base color?',
            choices: BASE_COLORS.map((c) => ({ title: c, value: c })),
            initial: 0,
          },
          {
            type: opts.css ? null : 'text',
            name: 'css',
            message: 'Tailwind CSS file path?',
            initial: defaults.tailwindCss,
          },
        ],
        { onCancel: () => process.exit(1) },
      );
      answers = { ...answers, ...r };
    }

    const config = {
      $schema: 'https://ui.webjs.dev/schema.json',
      style: 'default',
      tailwind: {
        css: answers.css,
        baseColor: answers.baseColor,
        cssVariables: true,
      },
      aliases: defaults.aliases,
      iconLibrary: 'lucide',
    };

    writeConfig(cwd, config);
    logger.success(`Wrote ${CONFIG_FILE}`);

    // Pull lib/utils + the chosen theme from the registry and write them in.
    await writeLibUtils(cwd, defaults.aliases.utils, opts.registry);
    await writeTheme(cwd, answers.baseColor, answers.css, opts.registry);

    logger.break();
    logger.success('Done.');
    logger.info('');
    logger.info(`Add components with:  ${logger.cyan('npx webjsui add button card dialog')}`);
  });

async function writeLibUtils(cwd, utilsAlias, registryUrl) {
  try {
    const item = await fetchRegistryItem('lib-utils', registryUrl);
    if (!item.files) return;
    for (const f of item.files) {
      // `utils` alias points at e.g. "lib/utils" → we write to lib/utils.ts
      const target = join(cwd, utilsAlias.replace(/^@\//, '') + '.ts');
      ensureDir(dirname(target));
      writeFileSync(target, f.content || '', 'utf8');
      logger.success(`Wrote ${utilsAlias}.ts`);
    }
  } catch (e) {
    logger.warn(`Could not fetch lib-utils from registry (${e.message}). You may need to write lib/utils.ts manually.`);
  }
}

async function writeTheme(cwd, baseColor, cssPath, registryUrl) {
  try {
    const item = await fetchRegistryItem(`theme-${baseColor}`, registryUrl);
    if (!item.files) return;
    const target = join(cwd, cssPath);
    ensureDir(dirname(target));
    const existing = existsSync(target) ? readFileSync(target, 'utf8') : '';
    const themeBlock = item.files[0]?.content || '';
    // Idempotent: only append if our marker isn't already present.
    if (existing.includes('/* @webjskit/ui theme */')) {
      logger.info(`Theme already present in ${cssPath}: skipping.`);
      return;
    }
    writeFileSync(target, existing + (existing && !existing.endsWith('\n') ? '\n' : '') + themeBlock, 'utf8');
    logger.success(`Wrote theme into ${cssPath}`);
  } catch (e) {
    logger.warn(`Could not fetch theme-${baseColor} (${e.message}). Skipping theme install.`);
  }
}

function ensureDir(d) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}
