/**
 * The `model` generator, Rails' `rails g model`: the table in the app's own
 * `db/schema.server.ts`, its row type beside it, any relations its
 * `references` fields name, and the migration. No module folder, since a
 * child table (a poll's options, its votes) belongs to its parent's feature.
 */
import { resourceNames } from './names.js';
import { parseFields, columnFor, baseColumns } from './fields.js';
import { coreModule, hasExport, addImports, insertBlock, registerTable, addOneRelations } from './schema-edit.js';

/**
 * @typedef {import('./index.js').AppContext} AppContext
 * @typedef {import('./index.js').Plan} Plan
 * @typedef {import('./fields.js').Field} Field
 * @typedef {import('./names.js').ResourceNames} ResourceNames
 */

/**
 * @param {AppContext} ctx
 * @param {{ name: string, plural?: string, fields: string[] }} opts
 * @returns {Plan}
 */
export function planModel(ctx, opts) {
  const n = resourceNames(opts.name, { plural: opts.plural });
  const fields = parseFields(opts.fields);
  /** @type {Plan} */
  const plan = { files: [], edits: [], notes: [] };
  for (const f of fields) {
    if (f.references && f.references.table !== n.plural && !hasExport(ctx.schema, f.references.table)) {
      // A --pretend chain (`g model room ... -p && g model booking room:references! -p`)
      // previews models whose referenced table is itself only a preview, so a
      // dry run notes the order instead of stopping the chain.
      if (ctx.pretend) {
        plan.notes.push(`        note  ${f.references.table} is not in db/schema.server.ts yet, so generate it before this model.`);
        continue;
      }
      throw new Error(`${f.references.relation}:references needs a ${f.references.table} table in db/schema.server.ts. Generate it first.`);
    }
  }
  const schema = schemaEdit(ctx, n, fields, plan.notes);
  if (schema !== null) {
    plan.edits.push({ path: 'db/schema.server.ts', content: schema });
    plan.migrationName = `create_${n.table}`;
  }
  // What the agent would otherwise read back from the schema.
  plan.summary = modelSummary(n, fields);
  return plan;
}

/** The TypeScript type a field's column reads as. */
function tsType(/** @type {Field} */ f) {
  const base = { string: 'string', text: 'string', integer: 'number', float: 'number', references: 'number', boolean: 'boolean', datetime: 'Date', json: 'unknown' }[f.kind];
  return f.notNull || f.kind === 'boolean' || f.kind === 'json' ? base : `${base} | null`;
}

/**
 * What the agent would otherwise open the schema to learn: the table's export,
 * its row type column by column, the relations and the import line. Printed
 * after the generator runs, so the generated files need not be read back.
 * @param {ResourceNames} n
 * @param {Field[]} fields
 * @returns {string[]}
 */
export function modelSummary(n, fields) {
  const cols = ['id: number', ...fields.map((f) => `${f.name}: ${tsType(f)}`), 'createdAt: Date', 'updatedAt: Date'];
  const lines = [
    `table ${n.plural} ('${n.table}'), row type ${n.Singular}:`,
    `  { ${cols.join('; ')} }`,
    `import { ${n.plural}, type ${n.Singular} } from '#db/schema.server.ts';`,
  ];
  const rels = fields.filter((f) => f.references);
  if (rels.length) {
    lines.push(`relations: ${rels.map((f) => `${n.singular}.${f.references?.relation} -> ${f.references?.table}`).join(', ')}`
      + ` (db.query.${n.plural}.findMany({ with: { ${rels[0].references?.relation}: true } }))`);
  }
  return lines;
}

/**
 * The schema with the table added, or null when it already has one.
 * @param {AppContext} ctx
 * @param {ResourceNames} n
 * @param {Field[]} fields
 * @param {string[]} notes
 * @returns {string | null}
 */
function schemaEdit(ctx, n, fields, notes) {
  if (hasExport(ctx.schema, n.plural)) {
    notes.push(`        skip  db/schema.server.ts already defines ${n.plural}, so it is left as it is.`);
    return null;
  }
  const base = baseColumns(ctx.dialect);
  const imports = new Set(base.imports);
  const cols = [`  id: ${base.id},`];
  for (const f of fields) {
    const c = columnFor(f, ctx.dialect);
    c.imports.forEach((i) => imports.add(i));
    cols.push(`  ${f.name}: ${c.code},`);
  }
  cols.push(`  createdAt: ${base.createdAt},`, `  updatedAt: ${base.updatedAt},`);
  const indexed = fields.filter((f) => f.index && !f.unique);
  if (indexed.length) imports.add('index');
  const tableFn = ctx.dialect === 'postgres' ? 'pgTable' : 'sqliteTable';
  imports.add(tableFn);
  const extra = indexed.length
    ? `, (t) => [\n${indexed.map((f) => `  index('${n.table}_${snake(f.name)}_idx').on(t.${f.name}),`).join('\n')}\n]`
    : '';
  const block = `export const ${n.plural} = ${tableFn}('${n.table}', {\n${cols.join('\n')}\n}${extra});\n`
    + (new RegExp(`^export type ${n.Singular}\\b`, 'm').test(ctx.schema) ? '' : `export type ${n.Singular} = typeof ${n.plural}.$inferSelect;\n`);

  let src = addImports(ctx.schema, coreModule(ctx.dialect), [...imports]);
  src = insertBlock(src, block);
  const registered = registerTable(src, n.plural);
  if (registered === null) {
    notes.push(`        note  Add ${n.plural} to the defineRelations call in db/schema.server.ts to query it with db.query.`);
  } else {
    src = registered;
  }
  const rels = fields.filter((f) => f.references).map((f) => ({
    relation: /** @type {NonNullable<Field['references']>} */ (f.references).relation,
    target: /** @type {NonNullable<Field['references']>} */ (f.references).table,
    column: f.name,
    notNull: f.notNull,
  }));
  if (rels.length) {
    const withRels = registered === null ? null : addOneRelations(src, n.plural, rels);
    if (withRels === null) {
      notes.push(`        note  Add the ${rels.map((r) => r.relation).join(', ')} relation to defineRelations in db/schema.server.ts.`);
    } else {
      src = withRels;
      for (const r of rels) {
        notes.push(`        note  For ${r.target} to list its ${n.humanPlural}, add ${n.plural}: r.many.${n.plural}() under ${r.target} in defineRelations.`);
      }
    }
  }
  return src;
}

const snake = (/** @type {string} */ s) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
