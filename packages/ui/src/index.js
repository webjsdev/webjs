import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { init } from './commands/init.js';
import { add } from './commands/add.js';
import { list } from './commands/list.js';
import { view } from './commands/view.js';
import { diff } from './commands/diff.js';
import { info } from './commands/info.js';
import { build } from './commands/build.js';

const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'));

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

const program = new Command()
  .name('webjsui')
  .description('AI-first component library: class helpers + custom elements, copied into your project so you own the code')
  .version(pkg.version, '-v, --version', 'display the version number');

program
  .addCommand(init)
  .addCommand(add)
  .addCommand(list)
  .addCommand(view)
  .addCommand(diff)
  .addCommand(info)
  .addCommand(build);

program.parse();
