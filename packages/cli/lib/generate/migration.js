/**
 * The `migration` generator with Rails' naming: the name says what changes.
 *
 *   AddPublishedAtToPosts published_at:datetime   adds columns to posts
 *   RemoveViewsFromPosts views                     removes columns from posts
 *   CreateTags name:string!                        a new table (the model generator)
 *
 * Drizzle derives the SQL from the schema, so the generator edits the table
 * in `db/schema.server.ts` and `db generate --name=<snake_name>` writes the
 * migration. As in Rails, the forms and validation are not touched; the notes
 * say where to add a new column.
 */
import { splitWords } from './names.js';
import { parseFields, columnFor } from './fields.js';
import { coreModule, addImports } from './schema-edit.js';

/**
 * @typedef {import('./index.js').AppContext} AppContext
 * @typedef {import('./index.js').Plan} Plan
 */

const camel = (/** @type {string[]} */ w) => w[0] + w.slice(1).map((x) => x[0].toUpperCase() + x.slice(1)).join('');

/**
 * The body of a table's definition: from its declaration to the line that
 * closes its columns object.
 * @param {string} src
 * @param {string} table
 */
function tableBounds(src, table) {
  const start = src.search(new RegExp(`^export const ${table}\\s*=\\s*\\w+Table\\(`, 'm'));
  if (start < 0) return null;
  const close = src.slice(start).match(/^\}(?:\);|\s*,)/m);
  if (!close) return null;
  return { start, end: start + /** @type {number} */ (close.index) };
}

/**
 * @param {AppContext} ctx
 * @param {{ name: string, fields: string[] }} opts
 * @param {(ctx: AppContext, opts: object) => Plan} planModel the model generator, for Create<Table>
 * @returns {Plan}
 */
export function planMigration(ctx, opts, planModel) {
  const words = splitWords(opts.name);
  if (!words) throw new Error(`"${opts.name}" is not a valid migration name. Use a Rails name such as AddPublishedToPosts.`);
  const snake = words.join('_');
  const m = /^(add|remove)_(.+)_(to|from)_(.+)$/.exec(snake);
  if (words[0] === 'create' && words.length > 1) {
    return planModel(ctx, { name: words.slice(1).join('_'), fields: opts.fields, kind: 'model' });
  }
  if (!m || (m[1] === 'add') !== (m[3] === 'to')) {
    throw new Error(`Name the change the Rails way: AddXToTable, RemoveXFromTable or CreateTable (got ${opts.name}). For any other change, edit db/schema.server.ts and run \`webjs db generate --name=${snake}\`.`);
  }
  const table = camel(m[4].split('_'));
  const bounds = tableBounds(ctx.schema, table);
  if (!bounds) throw new Error(`db/schema.server.ts has no ${table} table.`);
  if (opts.fields.length === 0) throw new Error(`List the columns, for example \`webjs generate migration ${opts.name} title:string\`.`);
  /** @type {Plan} */
  const plan = { files: [], edits: [], notes: [], migrationName: snake };
  const body = ctx.schema.slice(bounds.start, bounds.end);

  if (m[1] === 'add') {
    const fields = parseFields(opts.fields);
    const imports = new Set();
    const lines = [];
    for (const f of fields) {
      if (new RegExp(`^\\s*${f.name}\\s*:`, 'm').test(body)) throw new Error(`${table} already has ${f.name}.`);
      if (f.index && !f.unique && !f.references) plan.notes.push(`        note  Add an index on ${f.name} in the ${table} table's third argument by hand.`);
      const c = columnFor(f, ctx.dialect);
      c.imports.forEach((i) => imports.add(i));
      lines.push(`  ${f.name}: ${c.code},\n`);
    }
    let src = ctx.schema.slice(0, bounds.end) + lines.join('') + ctx.schema.slice(bounds.end);
    src = addImports(src, coreModule(ctx.dialect), [...imports]);
    plan.edits.push({ path: 'db/schema.server.ts', content: src });
    plan.notes.push(`        note  Add ${fields.map((f) => f.name).join(', ')} to the forms and validation that write ${table}, if any.`);
    return plan;
  }

  let out = body;
  for (const arg of opts.fields) {
    const w = splitWords(arg.split(':')[0].replace(/!$/, ''));
    if (!w) throw new Error(`"${arg}" is not a valid column name.`);
    const name = camel(w);
    const line = new RegExp(`^[ \\t]*${name}\\s*:[^\\n]*\\n`, 'm');
    if (!line.test(out)) throw new Error(`${table} has no ${name} column on a line of its own.`);
    out = out.replace(line, '');
    plan.notes.push(`        note  Remove ${name} from the code that reads or writes ${table}.`);
  }
  plan.edits.push({ path: 'db/schema.server.ts', content: ctx.schema.slice(0, bounds.start) + out + ctx.schema.slice(bounds.end) });
  return plan;
}
