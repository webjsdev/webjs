import { Command } from 'commander';
import { getRegistryItem, DEFAULT_REGISTRY_URL, isDefaultRegistry } from '../registry/fetcher.js';
import { uiComponent, renderComponentText } from '../registry/extract.js';
import { logger } from '../utils/logger.js';

export const view = new Command()
  .name('view')
  .description("Print a registry item's source (and the paste-ready example) to stdout")
  .argument('<name>', 'component name')
  .option('--registry <url>', 'registry base URL', DEFAULT_REGISTRY_URL)
  .option('--source', 'print only the raw source, not the projected view')
  .action(async (name, opts) => {
    // For a local registry:ui component, lead with the projected view (helper
    // signatures + the paste-ready @example + deps). This is the human /
    // offline path to the example that `add` strips from the copied file, and
    // it shares ONE projector with the MCP `ui` tool (`registry/extract.js`).
    // The projection reads the LOCAL packaged registry, so it only applies to
    // the default registry (a custom --registry gets the raw fetched source).
    const projected = opts.source || !isDefaultRegistry(opts.registry) ? null : uiComponent(name);
    if (projected) {
      console.log(renderComponentText(projected));
      console.log('');
      logger.info(logger.dim('# --- full source ---'));
    }

    const item = await getRegistryItem(name, opts.registry);
    logger.info(logger.dim(`# ${item.name}: ${item.type}`));
    if (item.description) logger.info(logger.dim(`# ${item.description}`));
    for (const f of item.files || []) {
      logger.info('');
      logger.info(logger.dim(`# ${f.path}`));
      console.log(f.content || '');
    }
  });
