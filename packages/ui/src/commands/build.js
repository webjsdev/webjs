import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { registrySchema, registryItemSchema } from '../registry/schema.js';
import { logger } from '../utils/logger.js';

export const build = new Command()
  .name('build')
  .description('Build a custom registry — read registry.json, inline file contents, emit r/*.json')
  .argument('[file]', 'registry manifest path', 'registry.json')
  .option('-o, --output <dir>', 'output directory', './r')
  .option('-c, --cwd <cwd>', 'the working directory', process.cwd())
  .action((file, opts) => {
    const cwd = opts.cwd;
    const manifestPath = resolve(cwd, file);
    if (!existsSync(manifestPath)) {
      logger.error(`Manifest not found: ${manifestPath}`);
      process.exit(1);
    }

    const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const manifest = registrySchema.parse(raw);
    const outDir = resolve(cwd, opts.output);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    const flatIndex = [];
    for (const item of manifest.items) {
      const enriched = {
        $schema: 'https://ui.webjs.dev/schema/registry-item.json',
        ...item,
        files: (item.files || []).map((f) => ({
          ...f,
          content: f.content ?? readFileSync(resolve(dirname(manifestPath), f.path), 'utf8'),
        })),
      };
      registryItemSchema.parse(enriched);
      const outPath = join(outDir, `${item.name}.json`);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, JSON.stringify(enriched, null, 2) + '\n', 'utf8');
      flatIndex.push({ name: item.name, type: item.type, description: item.description });
      logger.success(`Built r/${item.name}.json`);
    }

    writeFileSync(join(outDir, 'index.json'), JSON.stringify(flatIndex, null, 2) + '\n', 'utf8');
    writeFileSync(join(outDir, 'registry.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    logger.success(`Built ${flatIndex.length} items → ${outDir}`);
  });
