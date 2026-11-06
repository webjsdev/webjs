import { Command } from 'commander';
import { getRegistryItem, DEFAULT_REGISTRY_URL, isDefaultRegistry } from '../registry/fetcher.js';
import { uiComponent, renderComponentText, itemKind, projectBlock, renderBlockText } from '../registry/extract.js';
import { logger } from '../utils/logger.js';
import { getConfig } from '../utils/get-config.js';
import { bakeForStyle } from '../registry/style-bake.js';

/**
 * The style to bake with: `--style`, else the project's components.json, else
 * the default. Outside a project (no components.json) there is no config to
 * read, which is not an error for `view`.
 */
function styleFor(opts) {
  if (opts.style) return opts.style;
  try { return getConfig(process.cwd())?.style; } catch { return undefined; }
}

export const view = new Command()
  .name('view')
  .description("Print a registry item's source (and the paste-ready example) to stdout")
  .argument('<name>', 'component, block or chart name')
  .option('--registry <url>', 'registry base URL', DEFAULT_REGISTRY_URL)
  .option('--source', 'print only the raw source, not the projected view')
  .option('--style <name>', 'the style to bake the source with (default: components.json, else new-york)')
  .option('--json', 'a block or chart: print the projection as one JSON document')
  .option('--files-only', 'a block or chart: print the file list and stop before the sources')
  .action(async (name, opts) => {
    const style = styleFor(opts);

    // A block or chart (D18) prints what it is, how to install it and where
    // its files land, then the sources, all from the projector the MCP `ui`
    // tool shares. Resolved first, since a block has no component projection.
    const item = await getRegistryItem(name, opts.registry);
    const kind = itemKind(item);
    if (kind === 'block' || kind === 'chart') {
      const block = projectBlock(item, { style, source: !opts.filesOnly });
      console.log(opts.json ? JSON.stringify(block, null, 2) : renderBlockText(block));
      return;
    }
    // For a local registry:ui component, lead with the projected view (helper
    // signatures + the paste-ready @example + deps). This is the human /
    // offline path to the example that `add` strips from the copied file, and
    // it shares ONE projector with the MCP `ui` tool (`registry/extract.js`).
    // The projection reads the LOCAL packaged registry, so it only applies to
    // the default registry (a custom --registry gets the raw fetched source).
    const projected = opts.source || !isDefaultRegistry(opts.registry) ? null : uiComponent(name, { style });
    if (projected) {
      console.log(renderComponentText(projected));
      console.log('');
      logger.info(logger.dim('# --- full source ---'));
    }

    logger.info(logger.dim(`# ${item.name}: ${item.type}`));
    if (item.description) logger.info(logger.dim(`# ${item.description}`));
    for (const f of item.files || []) {
      logger.info('');
      logger.info(logger.dim(`# ${f.path}`));
      // Baked, so the printed source is the plain Tailwind `add` would write
      // (#1666). A custom registry's file with no cn-* name passes unchanged.
      console.log(bakeForStyle(f.content || '', style));
    }
  });
