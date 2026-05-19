import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, basename, relative as relPath } from 'node:path';
import prompts from 'prompts';
import { execSync } from 'node:child_process';
import { getConfig } from '../utils/get-config.js';
import { logger } from '../utils/logger.js';
import { resolveTree, collectNpmDeps } from '../registry/resolver.js';
import { DEFAULT_REGISTRY_URL } from '../registry/fetcher.js';

export const add = new Command()
  .name('add')
  .description('Add one or more components to your project')
  .argument('[components...]', 'component names (e.g. button card dialog)')
  .option('-c, --cwd <cwd>', 'the working directory', process.cwd())
  .option('-y, --yes', 'skip overwrite prompts', false)
  .option('-o, --overwrite', 'overwrite existing files without asking', false)
  .option('--no-deps', 'skip installing npm dependencies')
  .option('--registry <url>', 'registry base URL', DEFAULT_REGISTRY_URL)
  .action(async (components, opts) => {
    const cwd = opts.cwd;
    const config = getConfig(cwd);
    if (!config) {
      logger.error(`No ${logger.cyan('components.json')} found in ${cwd}.`);
      logger.info(`Run ${logger.cyan('npx webjsui init')} first.`);
      process.exit(1);
    }

    if (!components || components.length === 0) {
      logger.error('No components specified.');
      logger.info(`Try ${logger.cyan('npx webjsui add button')} or ${logger.cyan('npx webjsui list')}.`);
      process.exit(1);
    }

    const tree = await resolveTree(components, opts.registry);
    logger.info(`Installing ${logger.bold(components.join(', '))}…`);

    for (const item of tree) {
      for (const file of item.files || []) {
        await writeRegistryFile(cwd, config, item, file, opts);
      }
    }

    if (opts.deps !== false) {
      const { dependencies, devDependencies } = collectNpmDeps(tree);
      // @webjskit/core is always a runtime dep
      if (!dependencies.includes('@webjskit/core')) dependencies.push('@webjskit/core');

      if (dependencies.length) await installDeps(cwd, dependencies, false);
      if (devDependencies.length) await installDeps(cwd, devDependencies, true);
    }

    logger.success('Done.');
  });

async function writeRegistryFile(cwd, config, item, file, opts) {
  const target = resolveTarget(cwd, config, item, file);
  ensureDir(dirname(target));

  if (existsSync(target) && !opts.overwrite && !opts.yes) {
    const r = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: `Overwrite ${basename(target)}?`,
      initial: false,
    });
    if (!r.overwrite) {
      logger.info(`Skipped ${basename(target)}`);
      return;
    }
  }

  const content = rewriteUtilsImport(file.content || '', target, config);
  writeFileSync(target, content, 'utf8');
  logger.success(`Wrote ${relative(cwd, target)}`);
}

/**
 * Rewrite the registry-relative `'../lib/utils.ts'` import to the path
 * that resolves correctly from the file's target location to the user's
 * cn() helper.
 *
 * The registry source assumes its own layout (`<registry>/components/<x>.ts`
 * imports `'../lib/utils.ts'`). When that file lands in the user's
 * components/ui/<x>.ts, the literal `'../lib/utils.ts'` resolves to
 * `components/lib/utils.ts`, which doesn't exist. We compute the actual
 * relative path from the target directory to `config.resolvedPaths.utils`
 * (an absolute path the user has already configured via components.json's
 * aliases.utils) and substitute it in.
 *
 * @param {string} content raw file content from the registry
 * @param {string} target absolute path where the file will be written
 * @param {{ resolvedPaths: { utils: string } }} config parsed components.json
 */
export function rewriteUtilsImport(content, target, config) {
  if (!content.includes('../lib/utils.ts')) return content;
  const utilsAbs = config?.resolvedPaths?.utils;
  if (!utilsAbs) return content;
  let rel = relPath(dirname(target), utilsAbs).split(/[\\/]/).join('/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return content
    .replaceAll("'../lib/utils.ts'", `'${rel}'`)
    .replaceAll('"../lib/utils.ts"', `"${rel}"`);
}

function resolveTarget(cwd, config, item, file) {
  // explicit `target` wins
  if (file.target) return join(cwd, file.target);

  const fileName = basename(file.path);
  const aliases = config.aliases;

  switch (file.type) {
    case 'registry:ui':
      return join(cwd, (aliases.ui || 'components/ui').replace(/^@\//, ''), fileName);
    case 'registry:component':
      return join(cwd, aliases.components.replace(/^@\//, ''), fileName);
    case 'registry:lib':
      return join(cwd, (aliases.lib || 'lib').replace(/^@\//, ''), fileName);
    case 'registry:hook':
      return join(cwd, 'hooks', fileName);
    default:
      return join(cwd, fileName);
  }
}

function relative(cwd, p) {
  return p.startsWith(cwd) ? p.slice(cwd.length + 1) : p;
}

function ensureDir(d) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

async function installDeps(cwd, deps, dev) {
  const manager = detectPackageManager(cwd);
  const flag = dev ? '-D' : '';
  const cmd = `${manager.exec} ${manager.add} ${flag} ${deps.join(' ')}`.replace(/\s+/g, ' ').trim();
  logger.info(`${logger.dim('$')} ${cmd}`);
  try {
    execSync(cmd, { cwd, stdio: 'inherit' });
  } catch (e) {
    logger.warn(`Dependency install failed. Run manually: ${logger.cyan(cmd)}`);
  }
}

function detectPackageManager(cwd) {
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return { exec: 'pnpm', add: 'add' };
  if (existsSync(join(cwd, 'yarn.lock'))) return { exec: 'yarn', add: 'add' };
  if (existsSync(join(cwd, 'bun.lockb'))) return { exec: 'bun', add: 'add' };
  return { exec: 'npm', add: 'install' };
}
