/**
 * The `scaffold`, `resource` and `model` generators: Rails' trio, written the
 * way the scaffold's own `modules/users` example is (a feature module with
 * one function per file, plain Drizzle, `ActionResult` failures with
 * `fieldErrors` and `values`).
 *
 * - `model` adds the table and its type.
 * - `resource` adds the model plus queries, actions and JSON route handlers.
 * - `scaffold` adds the model plus queries, actions, the four pages with forms
 *   bound to the actions, and a test. In an app with no root layout (the
 *   `api` template) it writes the route handlers instead, as Rails' scaffold
 *   does in an API-only app.
 */
import { resourceNames } from './names.js';
import { parseFields, columnFor, baseColumns } from './fields.js';
import { coreModule, hasExport, addImports, insertBlock, registerTable, addOneRelations } from './schema-edit.js';
import { pageFiles } from './scaffold-pages.js';
import { apiFiles } from './scaffold-api.js';
import { testFile } from './scaffold-test.js';

/**
 * @typedef {import('./index.js').AppContext} AppContext
 * @typedef {import('./index.js').Plan} Plan
 * @typedef {import('./fields.js').Field} Field
 * @typedef {import('./names.js').ResourceNames} ResourceNames
 */

/**
 * @param {AppContext} ctx
 * @param {{ name: string, plural?: string, fields: string[], kind: 'scaffold'|'resource'|'model' }} opts
 * @returns {Plan}
 */
export function planScaffold(ctx, opts) {
  const n = resourceNames(opts.name, { plural: opts.plural });
  const fields = parseFields(opts.fields);
  for (const f of fields) {
    if (f.references && f.references.table !== n.plural && !hasExport(ctx.schema, f.references.table)) {
      throw new Error(`${f.references.relation}:references needs a ${f.references.table} table in db/schema.server.ts. Generate it first.`);
    }
  }
  /** @type {Plan} */
  const plan = { files: [], edits: [], notes: [], uiAdd: [] };
  const schema = schemaEdit(ctx, n, fields, plan.notes);
  if (schema !== null) {
    plan.edits.push({ path: 'db/schema.server.ts', content: schema });
    plan.migrationName = `create_${n.table}`;
  }
  const mod = `modules/${n.kebabPlural}`;
  // A model is the table and its migration, as `rails g model` is: no module
  // folder, since a child table (a poll's options, its votes) belongs to its
  // parent's feature module, and the row type is exported beside the table.
  if (opts.kind === 'model') return plan;
  plan.files.push({ path: `${mod}/types.ts`, content: typesFile(n) });

  plan.files.push(
    { path: `${mod}/queries/list-${n.kebabPlural}.server.ts`, content: listQuery(n) },
    { path: `${mod}/queries/get-${n.kebab}.server.ts`, content: getQuery(n) },
    { path: `${mod}/read-${n.kebab}-input.server.ts`, content: readInput(n, fields) },
  );
  const pages = opts.kind === 'scaffold' && ctx.hasPages;
  plan.files.push(...actionFiles(n, fields, pages));
  if (pages) {
    const ui = pageFiles(ctx, n, fields);
    plan.files.push(...ui.files);
    plan.uiAdd.push(...ui.uiAdd);
  } else {
    plan.files.push(...apiFiles(n));
  }
  if (!ctx.skipTests) plan.files.push(testFile(n, fields, pages ? 'pages' : 'api'));
  return plan;
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

/** @param {ResourceNames} n */
function typesFile(n) {
  return `// The ${n.human} feature's types, derived from the schema rather than written by hand.
export type { ${n.Singular} } from '#db/schema.server.ts';
`;
}

/** @param {ResourceNames} n */
function listQuery(n) {
  return `import { desc } from 'drizzle-orm';
import { db } from '#db/connection.server.ts';
import { ${n.plural} } from '#db/schema.server.ts';
import type { ${n.Singular} } from '../types.ts';

// A query: server-only code (a .server.ts file with no 'use server'), called
// from a page or a route handler. Newest first. One function per file.
export async function list${n.Plural}(): Promise<${n.Singular}[]> {
  return db.select().from(${n.plural}).orderBy(desc(${n.plural}.id));
}
`;
}

/** @param {ResourceNames} n */
function getQuery(n) {
  return `import { eq } from 'drizzle-orm';
import { db } from '#db/connection.server.ts';
import { ${n.plural} } from '#db/schema.server.ts';
import type { ${n.Singular} } from '../types.ts';

// One ${n.human} by id, or undefined. The id comes from a URL, so anything that
// is not a whole number finds nothing.
export async function get${n.Singular}(id: number): Promise<${n.Singular} | undefined> {
  if (!Number.isInteger(id)) return undefined;
  const [${n.singular}] = await db.select().from(${n.plural}).where(eq(${n.plural}.id, id)).limit(1);
  return ${n.singular};
}
`;
}

/**
 * The validation shared by create and update, the way a Rails model's
 * validations are. Reads a form submission or a JSON body.
 * @param {ResourceNames} n
 * @param {Field[]} fields
 */
function readInput(n, fields) {
  const lines = [];
  const data = [];
  for (const f of fields) {
    const k = f.name;
    const req = `fieldErrors.${k} = '${f.label} is required.';`;
    switch (f.kind) {
      case 'string':
      case 'text':
        lines.push(`  const ${k} = text('${k}');`);
        if (f.notNull) lines.push(`  if (!${k}) ${req}`);
        data.push(f.notNull ? k : `${k}: ${k} || null`);
        break;
      case 'integer':
      case 'references':
      case 'float': {
        const check = f.kind === 'float' ? 'Number.isFinite' : 'Number.isInteger';
        const msg = f.kind === 'float' ? 'a number' : 'a whole number';
        lines.push(`  const ${k}Text = text('${k}');`, `  const ${k} = ${k}Text === '' ? null : Number(${k}Text);`);
        lines.push(f.notNull
          ? `  if (${k} === null) ${req}\n  else if (!${check}(${k})) fieldErrors.${k} = '${f.label} must be ${msg}.';`
          : `  if (${k} !== null && !${check}(${k})) fieldErrors.${k} = '${f.label} must be ${msg}.';`);
        data.push(f.notNull ? `${k}: ${k} as number` : k);
        break;
      }
      case 'boolean':
        lines.push(`  const ${k}Raw = raw('${k}');`, `  const ${k} = ${k}Raw === true || ${k}Raw === 'on' || ${k}Raw === 'true';`, `  values.${k} = ${k} ? 'on' : '';`);
        data.push(k);
        break;
      case 'datetime':
        lines.push(`  const ${k}Text = text('${k}');`, `  const ${k} = ${k}Text === '' ? null : new Date(${k}Text);`);
        lines.push(f.notNull
          ? `  if (${k} === null) ${req}\n  else if (Number.isNaN(${k}.getTime())) fieldErrors.${k} = '${f.label} must be a date and time.';`
          : `  if (${k} !== null && Number.isNaN(${k}.getTime())) fieldErrors.${k} = '${f.label} must be a date and time.';`);
        data.push(f.notNull ? `${k}: ${k} as Date` : k);
        break;
      case 'json':
        lines.push(`  const ${k}Text = text('${k}');`, `  let ${k}: unknown = null;`);
        lines.push(`  if (${k}Text !== '') {\n    try { ${k} = JSON.parse(${k}Text); } catch { fieldErrors.${k} = '${f.label} must be valid JSON.'; }\n  }${f.notNull ? ` else ${req}` : ''}`);
        data.push(k);
        break;
    }
  }
  return `import type { ${n.plural} } from '#db/schema.server.ts';

export type ${n.Singular}Input = Omit<typeof ${n.plural}.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;

export type Read${n.Singular}Result =
  | { ok: true; data: ${n.Singular}Input; values: Record<string, string> }
  | { ok: false; fieldErrors: Record<string, string>; values: Record<string, string> };

// Reads and validates a ${n.human}'s fields from a form submission (FormData) or
// a JSON body (a plain object), for both create${n.Singular} and update${n.Singular}.
// values echoes what was typed, so a failed form re-renders with it.
export function read${n.Singular}Input(input: FormData | Record<string, unknown>): Read${n.Singular}Result {
  const values: Record<string, string> = {};
  const fieldErrors: Record<string, string> = {};
  const raw = (name: string): unknown => (input instanceof FormData ? input.get(name) : input[name]);
  const text = (name: string): string => {
    const v = raw(name);
    const s = v == null ? '' : typeof v === 'object' && !(v instanceof File) ? JSON.stringify(v) : String(v).trim();
    values[name] = s;
    return s;
  };

${lines.join('\n')}

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors, values };
  return { ok: true, data: { ${data.join(', ')} }, values };
}
`;
}

/**
 * The create, update and delete actions. Bound to forms they redirect on
 * success (a 303); called from a route handler they return the record.
 * @param {ResourceNames} n
 * @param {Field[]} fields
 * @param {boolean} forms
 */
function actionFiles(n, fields, forms) {
  const unique = fields.filter((f) => f.unique && f.kind !== 'boolean');
  const dir = `modules/${n.kebabPlural}/actions`;
  const uniqueChecks = (/** @type {boolean} */ update) => unique.map((f) => `  if (input.data.${f.name} != null) {
    const [taken] = await db.select({ id: ${n.plural}.id }).from(${n.plural})
      .where(${update ? `and(eq(${n.plural}.${f.name}, input.data.${f.name}), ne(${n.plural}.id, id))` : `eq(${n.plural}.${f.name}, input.data.${f.name})`}).limit(1);
    if (taken) return { success: false, fieldErrors: { ${f.name}: '${f.label} is already taken.' }, values: input.values, status: 422 };
  }
`).join('');
  const ops = (/** @type {boolean} */ update) => ['eq', ...(update && unique.length ? ['and', 'ne'] : [])].join(', ');
  const head = (/** @type {string} */ ops) => `'use server';

import { ${ops} } from 'drizzle-orm';
import { ${forms ? 'redirect, revalidatePath' : 'revalidatePath'} } from '@webjsdev/server';
import type { ActionResult } from '@webjsdev/server';
import { db } from '#db/connection.server.ts';
import { ${n.plural} } from '#db/schema.server.ts';
`;
  const back = `revalidatePath('/${n.kebabPlural}');`;
  const createHead = head(ops(false)).replace(`import { eq } from 'drizzle-orm';\n`, unique.length ? `import { eq } from 'drizzle-orm';\n` : '');
  const create = `${createHead}import { read${n.Singular}Input } from '../read-${n.kebab}-input.server.ts';
import type { ${n.Singular} } from '../types.ts';

// ${forms ? `Bound by app/${n.kebabPlural}/new/page.ts as <form action=\${create${n.Singular}}>, so it works
// with JavaScript off. A failure re-renders the page with this result on
// actionData; a success redirects to the new ${n.human} (a 303 from a form).` : `Called by the POST handler in app/api/${n.kebabPlural}/route.ts.`} One function per file.
export async function create${n.Singular}(form: FormData | Record<string, unknown>): Promise<ActionResult<${n.Singular}>> {
  const input = read${n.Singular}Input(form);
  if (!input.ok) return { success: false, fieldErrors: input.fieldErrors, values: input.values, status: 422 };
${uniqueChecks(false)}  const [${n.singular}] = await db.insert(${n.plural}).values(input.data).returning();
  ${back}
  ${forms ? `redirect('/${n.kebabPlural}/' + ${n.singular}.id);` : `return { success: true, data: ${n.singular} };`}
}
`;
  const update = `${head(ops(true))}import { read${n.Singular}Input } from '../read-${n.kebab}-input.server.ts';
import type { ${n.Singular} } from '../types.ts';

// ${forms ? `Bound by app/${n.kebabPlural}/[id]/edit/page.ts, which sends the id in a hidden
// field. A failure re-renders the edit page with this result on actionData.` : `Called by the PATCH handler in app/api/${n.kebabPlural}/[id]/route.ts.`}
export async function update${n.Singular}(form: FormData | Record<string, unknown>${forms ? '' : ', id: number'}): Promise<ActionResult<${n.Singular}>> {
${forms ? `  const id = Number(form instanceof FormData ? form.get('id') : form.id);\n` : ''}  const input = read${n.Singular}Input(form);
  if (!input.ok) return { success: false, fieldErrors: input.fieldErrors, values: input.values, status: 422 };
${uniqueChecks(true)}  const [${n.singular}] = await db.update(${n.plural}).set(input.data).where(eq(${n.plural}.id, id)).returning();
  if (!${n.singular}) return { success: false, error: 'That ${n.human} no longer exists.', status: 404 };
  ${back}
  ${forms ? `redirect('/${n.kebabPlural}/' + ${n.singular}.id);` : `return { success: true, data: ${n.singular} };`}
}
`;
  const del = `${head('eq')}
// ${forms ? `Bound by the Delete button on app/${n.kebabPlural}/[id]/page.ts, which sends the id in
// a hidden field. Redirects to the list.` : `Called by the DELETE handler in app/api/${n.kebabPlural}/[id]/route.ts.`}
export async function delete${n.Singular}(${forms ? 'form: FormData' : 'id: number'}): Promise<ActionResult> {
${forms ? `  const id = Number(form.get('id'));\n` : ''}  await db.delete(${n.plural}).where(eq(${n.plural}.id, id));
  ${back}
  ${forms ? `redirect('/${n.kebabPlural}');` : 'return { success: true };'}
}
`;
  return [
    { path: `${dir}/create-${n.kebab}.server.ts`, content: create },
    { path: `${dir}/update-${n.kebab}.server.ts`, content: update },
    { path: `${dir}/delete-${n.kebab}.server.ts`, content: del },
  ];
}
