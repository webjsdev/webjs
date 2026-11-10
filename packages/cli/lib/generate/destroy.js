/**
 * `webjs destroy` (alias `webjs d`): the inverse of `webjs generate`, as
 * `rails destroy` is. It removes the files the same generator would write
 * (their paths depend only on the name, so no fields are needed), the table
 * the generator added to `db/schema.server.ts` with its type and its
 * `defineRelations` entries, then runs `db generate` for the migration that
 * drops the table.
 */
import { existsSync, readFileSync, writeFileSync, rmSync, readdirSync, rmdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseGenerateArgs, planGenerate, runDbGenerate } from './index.js';
import { resourceNames } from './names.js';

/**
 * Remove a table, its inferred type and its relations from a schema.
 * @param {string} src
 * @param {string} table the table's export name
 * @param {string} type the type's name
 * @returns {string | null} null when the schema has no such table
 */
export function removeTable(src, table, type) {
  const start = src.search(new RegExp(`^export const ${table}\\s*=\\s*\\w+Table\\(`, 'm'));
  if (start < 0) return null;
  // The statement ends at the first line that closes the table call.
  const close = /^(?:\}|\]|\}\s*,\s*\(t\)\s*=>\s*\[.*\])\);\s*$/m;
  const rest = src.slice(start);
  const m = rest.match(close);
  if (!m) return null;
  let end = start + /** @type {number} */ (m.index) + m[0].length;
  const typeLine = new RegExp(`^\\s*export type ${type} = typeof ${table}\\.\\$inferSelect;\\s*$`, 'm');
  const after = src.slice(end);
  const t = after.match(typeLine);
  if (t && after.slice(0, t.index).trim() === '') end += /** @type {number} */ (t.index) + t[0].length;
  let out = (src.slice(0, start).replace(/\n+$/, '\n') + '\n' + src.slice(end).replace(/^\n+/, '')).replace(/\n{3,}/g, '\n\n');
  // Its name in defineRelations({ ... }) and its own relations entry.
  out = out.replace(/(^export const \w+\s*=\s*defineRelations\(\s*\{)([^}]*)(\})/m, (_, a, names, b) => {
    const kept = names.split(',').map((s) => s.trim()).filter((s) => s && s !== table);
    return `${a} ${kept.join(', ')} ${b}`;
  });
  out = out.replace(new RegExp(`\\n  ${table}: \\{[^\\n]*\\},(?=\\n)`), '');
  out = out.replace(new RegExp(`\\n  ${table}: \\{\\n(?:    [^\\n]*\\n)*?  \\},(?=\\n)`), '');
  return out;
}

/** Remove a directory and its parents while they are empty, up to the app. */
function pruneEmpty(/** @type {string} */ dir, /** @type {string} */ appDir) {
  while (dir.startsWith(appDir) && dir !== appDir && existsSync(dir) && readdirSync(dir).length === 0) {
    rmdirSync(dir);
    dir = dirname(dir);
  }
}

/**
 * Run the command.
 * @param {string[]} argv the arguments after `destroy`
 * @param {{ cwd?: string, log?: (line: string) => void, error?: (line: string) => void }} [opts]
 * @returns {number} the exit code
 */
export function runDestroy(argv, opts = {}) {
  const appDir = opts.cwd ?? process.cwd();
  const log = opts.log ?? ((l) => console.log(l));
  const error = opts.error ?? ((l) => console.error(l));
  let args;
  let plan;
  try {
    args = parseGenerateArgs(argv);
    if (args.generator === 'authentication') throw new Error('Remove the authentication files by hand: it edits the users table that other code may use.');
    plan = planGenerate(appDir, { ...args, fields: [], skipTests: false });
  } catch (e) {
    error(`Destroy failed. ${/** @type {Error} */ (e).message}`);
    return 1;
  }
  const n = resourceNames(/** @type {string} */ (args.name), { plural: args.plural });
  const schemaPath = join(appDir, 'db', 'schema.server.ts');
  const schema = removeTable(readFileSync(schemaPath, 'utf8'), n.plural, n.Singular);
  if (schema !== null) {
    log(`${'update'.padStart(12)}  db/schema.server.ts`);
    if (!args.pretend) writeFileSync(schemaPath, schema);
  }
  for (const f of plan.files) {
    const abs = join(appDir, f.path);
    if (!existsSync(abs)) continue;
    log(`${'remove'.padStart(12)}  ${f.path}`);
    if (args.pretend) continue;
    rmSync(abs);
    pruneEmpty(dirname(abs), appDir);
  }
  if (args.pretend || args.skipMigration || schema === null) return 0;
  return runDbGenerate(appDir, `drop_${n.table}`, log, error);
}
