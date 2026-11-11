/**
 * `webjs generate` (alias `webjs g`): Rails-style generators that write a
 * working, tested, conventional slice of an app in one command, so an agent
 * generates and then edits instead of writing ten files from memory.
 *
 * ```sh
 * webjs generate scaffold post title:string! body:text published:boolean
 * webjs generate model comment body:text! post:references
 * webjs generate authentication
 * ```
 *
 * Each generator returns a PLAN (files to create, edits to existing files,
 * notes to print) and this module applies it: it refuses to overwrite a file
 * that differs unless `--force` is given, prints every path the way Rails
 * does, then runs this CLI's own `db generate` so the migration exists.
 */
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { dialectOf } from './schema-edit.js';
import { planScaffold } from './scaffold.js';
import { planAuthentication } from './authentication.js';
import { planMigration } from './migration.js';
import { planController } from './controller.js';

const CLI_BIN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'webjs.js');

export const GENERATORS = ['scaffold', 'resource', 'model', 'migration', 'controller', 'authentication'];

/**
 * @typedef {object} Plan
 * @property {{ path: string, content: string }[]} files new files, relative to the app
 * @property {{ path: string, content: string }[]} edits whole new contents of existing files
 * @property {string[]} notes printed after the files, e.g. an edit to make by hand
 * @property {string} [migrationName] the `--name` handed to `db generate`
 * @property {string[]} [uiAdd] UI kit components to add with `webjs ui add`
 * @property {string[]} [summary] what was written, as names and signatures, so the
 *   agent that ran it does not have to open the files to learn them
 */

/**
 * @typedef {object} GenerateArgs
 * @property {string} [generator]
 * @property {string} [name]
 * @property {string[]} fields
 * @property {boolean} force
 * @property {boolean} pretend
 * @property {boolean} skipTests
 * @property {boolean} skipMigration
 * @property {string} [plural]
 */

/**
 * Parse the arguments after `generate`.
 * @param {string[]} argv
 * @returns {GenerateArgs}
 */
export function parseGenerateArgs(argv) {
  /** @type {GenerateArgs} */
  const out = { fields: [], force: false, pretend: false, skipTests: false, skipMigration: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force' || a === '-f') out.force = true;
    else if (a === '--pretend' || a === '-p') out.pretend = true;
    else if (a === '--skip-tests') out.skipTests = true;
    else if (a === '--skip-migration') out.skipMigration = true;
    else if (a === '--plural') out.plural = argv[++i];
    else if (a.startsWith('--plural=')) out.plural = a.slice('--plural='.length);
    else if (a.startsWith('-')) throw new Error(`Unknown option ${a}. Run \`webjs help generate\`.`);
    else positional.push(a);
  }
  out.generator = positional[0] === 'auth' ? 'authentication' : positional[0];
  if (out.generator === 'authentication') {
    if (positional.length > 1) throw new Error('The authentication generator takes no name or fields.');
  } else {
    out.name = positional[1];
    out.fields = positional.slice(2);
  }
  return out;
}

/**
 * What a generator needs to know about the app it writes into.
 * @typedef {object} AppContext
 * @property {string} appDir
 * @property {string} schema the text of db/schema.server.ts
 * @property {'sqlite'|'postgres'} dialect
 * @property {boolean} hasPages whether the app has a root layout (the api template has none)
 * @property {{ button: boolean, input: boolean, label: boolean, textarea: boolean, kit: boolean }} ui which UI kit helpers exist, and whether the kit is set up (components.json)
 * @property {boolean} skipTests
 */

/**
 * Build a generator's plan without touching the disk.
 * @param {string} appDir
 * @param {GenerateArgs} args
 * @returns {Plan}
 */
export function planGenerate(appDir, args) {
  if (!args.generator || !GENERATORS.includes(args.generator)) {
    throw new Error(`Pick a generator: ${GENERATORS.join(', ')}. Run \`webjs help generate\`.`);
  }
  const schemaPath = join(appDir, 'db', 'schema.server.ts');
  if (!existsSync(join(appDir, 'app')) || !existsSync(schemaPath)) {
    throw new Error('Run it inside a WebJs app (a directory with app/ and db/schema.server.ts).');
  }
  /** @type {AppContext} */
  const ctx = {
    appDir,
    schema: readFileSync(schemaPath, 'utf8'),
    dialect: dialectOf(readIfExists(join(appDir, 'drizzle.config.ts'))),
    hasPages: existsSync(join(appDir, 'app', 'layout.ts')) || existsSync(join(appDir, 'app', 'layout.js')),
    ui: {
      button: existsSync(join(appDir, 'components', 'ui', 'button.ts')),
      input: existsSync(join(appDir, 'components', 'ui', 'input.ts')),
      label: existsSync(join(appDir, 'components', 'ui', 'label.ts')),
      textarea: existsSync(join(appDir, 'components', 'ui', 'textarea.ts')),
      kit: existsSync(join(appDir, 'components.json')),
    },
    skipTests: args.skipTests,
  };
  if (args.generator === 'authentication') return planAuthentication(ctx);
  if (!args.name) throw new Error(`Name it, for example \`webjs generate ${args.generator} ${args.generator === 'migration' ? 'AddTitleToPosts title:string' : args.generator === 'controller' ? 'pages home about' : 'post title:string body:text'}\`.`);
  if (args.generator === 'controller') return planController(ctx, { name: args.name, actions: args.fields });
  if (args.generator === 'migration') {
    return planMigration(ctx, { name: args.name, fields: args.fields }, (c, o) => planScaffold(c, /** @type {any} */ (o)));
  }
  return planScaffold(ctx, {
    name: args.name,
    plural: args.plural,
    fields: args.fields,
    kind: /** @type {'scaffold'|'resource'|'model'} */ (args.generator),
  });
}

/** @param {string} p */
function readIfExists(p) {
  try { return readFileSync(p, 'utf8'); } catch { return ''; }
}

/**
 * Apply a plan: refuse on a conflicting file unless forced, then write.
 * @param {string} appDir
 * @param {Plan} plan
 * @param {{ force?: boolean, pretend?: boolean, log?: (line: string) => void }} [opts]
 * @returns {{ written: string[], conflicts: string[] }}
 */
export function applyPlan(appDir, plan, opts = {}) {
  const log = opts.log ?? ((l) => console.log(l));
  const status = plan.files.map((f) => {
    const abs = join(appDir, f.path);
    if (!existsSync(abs)) return 'create';
    return readFileSync(abs, 'utf8') === f.content ? 'identical' : 'conflict';
  });
  const conflicts = plan.files.filter((_, i) => status[i] === 'conflict').map((f) => f.path);
  if (conflicts.length && !opts.force) return { written: [], conflicts };
  const written = [];
  const verb = (/** @type {string} */ s) => (s === 'conflict' ? 'force' : s).padStart(12);
  for (const e of plan.edits) {
    log(`${'update'.padStart(12)}  ${e.path}`);
    if (!opts.pretend) writeFileSync(join(appDir, e.path), e.content);
    written.push(e.path);
  }
  plan.files.forEach((f, i) => {
    log(`${verb(status[i])}  ${f.path}`);
    if (status[i] === 'identical' || opts.pretend) return;
    mkdirSync(dirname(join(appDir, f.path)), { recursive: true });
    writeFileSync(join(appDir, f.path), f.content);
    written.push(f.path);
  });
  if (plan.uiAdd?.length) {
    log(`${'ui add'.padStart(12)}  ${plan.uiAdd.join(' ')}`);
    if (!opts.pretend) addUiComponents(appDir, plan.uiAdd);
  }
  return { written, conflicts: [] };
}

/**
 * Add UI kit components the way `webjs ui add` does, through the kit's own
 * CLI with the current runtime. The registry ships inside @webjsdev/ui, so
 * this makes no network call.
 * @param {string} appDir
 * @param {string[]} names
 */
function addUiComponents(appDir, names) {
  const require = createRequire(import.meta.url);
  let dir = dirname(require.resolve('@webjsdev/ui'));
  while (!existsSync(join(dir, 'package.json')) && dirname(dir) !== dir) dir = dirname(dir);
  const r = spawnSync(process.execPath, [join(dir, 'bin', 'webjsui.js'), 'add', ...names, '--cwd', appDir, '--yes', '--no-deps'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`Could not add ${names.join(', ')} from the UI kit: ${(r.stderr || r.stdout || '').trim()}`);
}

/**
 * Run the command.
 * @param {string[]} argv the arguments after `generate`
 * @param {{ cwd?: string, log?: (line: string) => void, error?: (line: string) => void }} [opts]
 * @returns {number} the exit code
 */
export function runGenerate(argv, opts = {}) {
  const appDir = opts.cwd ?? process.cwd();
  const log = opts.log ?? ((l) => console.log(l));
  const error = opts.error ?? ((l) => console.error(l));
  let args;
  let plan;
  try {
    args = parseGenerateArgs(argv);
    plan = planGenerate(appDir, args);
  } catch (e) {
    error(`Generate failed. ${/** @type {Error} */ (e).message}`);
    return 1;
  }
  const { conflicts } = applyPlan(appDir, plan, { force: args.force, pretend: args.pretend, log });
  if (conflicts.length) {
    error('These files already exist and differ, so nothing was written:');
    for (const c of conflicts) error(`  ${c}`);
    error('Pass --force to overwrite them.');
    return 1;
  }
  if (plan.summary?.length) {
    log('');
    log(`${'summary'.padStart(12)}  ${plan.summary[0]}`);
    for (const line of plan.summary.slice(1)) log(`${''.padStart(12)}  ${line}`);
  }
  for (const n of plan.notes) log(n);
  if (args.pretend || args.skipMigration || !plan.migrationName) return 0;
  return runDbGenerate(appDir, plan.migrationName, log, error);
}

/**
 * The `YYYYMMDDHHmmss` UTC stamp drizzle-kit prefixes a migration folder with.
 * @param {Date} date
 */
export function migrationStamp(date) {
  return date.toISOString().replace(/\D/g, '').slice(0, 14);
}

/**
 * Wait until a new migration's stamp sorts after every existing one. The
 * migrator applies folders in name order and the stamp has one-second
 * resolution, so two generators run within a second (`create_posts`, then
 * `add_published_at_to_posts`) would share a stamp and apply alphabetically:
 * the ALTER before the CREATE. Waits a second at most, and not at all when the
 * last migration is older than this second.
 * @param {string} appDir
 */
export function waitForNextMigrationSecond(appDir) {
  let latest = '';
  try {
    for (const entry of readdirSync(join(appDir, 'db', 'migrations'))) {
      const m = /^(\d{14})_/.exec(entry);
      if (m && m[1] > latest) latest = m[1];
    }
  } catch {
    return;
  }
  const deadline = Date.now() + 2000;
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  while (migrationStamp(new Date()) <= latest && Date.now() < deadline) Atomics.wait(sleeper, 0, 0, 50);
}

/**
 * Run this CLI's own `db generate` with the current runtime (no npx), as
 * `webjs test` prepares its database. The migration is applied on the next
 * `webjs dev`, `webjs start` or `webjs test`.
 * @param {string} appDir
 * @param {string} name the migration's name
 * @param {(line: string) => void} log
 * @param {(line: string) => void} error
 * @returns {number} the exit code
 */
export function runDbGenerate(appDir, name, log, error) {
  waitForNextMigrationSecond(appDir);
  log(`${'migration'.padStart(12)}  webjs db generate --name=${name}`);
  const r = spawnSync(process.execPath, [CLI_BIN, 'db', 'generate', `--name=${name}`], {
    cwd: appDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    error((r.stdout || '') + (r.stderr || ''));
    error('The files are written, but `webjs db generate` failed. Fix the schema and run it again.');
    return 1;
  }
  return 0;
}
