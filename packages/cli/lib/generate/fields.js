/**
 * The field grammar of `webjs generate`, Rails' own:
 *
 *   name[:type][!][:uniq|:index]
 *
 * `type` defaults to `string`; `!` after the type (or the name) makes the
 * column NOT NULL, as in Rails 8; `:uniq` adds a unique constraint and
 * `:index` a plain index. `user:references` adds a `userId` foreign key to the
 * `users` table and a relation named `user`.
 *
 * Each field maps onto plain Drizzle column builders, per dialect, written the
 * way the scaffold's own `db/schema.server.ts` writes them.
 */
import { splitWords, pluralize } from './names.js';

/** Rails type names onto the kinds a generated form and column handle. */
const TYPES = {
  string: 'string',
  text: 'text',
  integer: 'integer',
  float: 'float',
  decimal: 'float',
  boolean: 'boolean',
  bool: 'boolean',
  datetime: 'datetime',
  timestamp: 'datetime',
  date: 'datetime',
  json: 'json',
  jsonb: 'json',
  references: 'references',
  belongs_to: 'references',
};

/** Columns every generated table already has. */
const RESERVED = new Set(['id', 'createdAt', 'updatedAt']);

/**
 * @typedef {object} Field
 * @property {string} name the column key (camelCase), e.g. `title`, `userId`
 * @property {string} label the form label, e.g. `Title`, `User`
 * @property {'string'|'text'|'integer'|'float'|'boolean'|'datetime'|'json'|'references'} kind
 * @property {boolean} notNull
 * @property {boolean} unique
 * @property {boolean} index
 * @property {{ table: string, relation: string }} [references] the target table export and the relation name
 */

const camel = (/** @type {string[]} */ w) => w[0] + w.slice(1).map((x) => x[0].toUpperCase() + x.slice(1)).join('');

/**
 * Parse one `name:type!:uniq` argument.
 * @param {string} arg
 * @returns {Field}
 */
export function parseField(arg) {
  const parts = arg.split(':');
  let rawName = parts[0];
  let rawType = parts[1] ?? 'string';
  const mods = parts.slice(2);
  let notNull = false;
  if (rawName.endsWith('!')) { notNull = true; rawName = rawName.slice(0, -1); }
  if (rawType.endsWith('!')) { notNull = true; rawType = rawType.slice(0, -1); }
  if (rawType === '') rawType = 'string';
  // `title:uniq` is Rails shorthand for a string with a unique index.
  if (rawType === 'uniq' || rawType === 'index') { mods.unshift(rawType); rawType = 'string'; }
  const words = splitWords(rawName);
  if (!words) throw new Error(`"${arg}": "${rawName}" is not a valid field name. Use letters and digits, starting with a letter.`);
  if (rawType === 'digest') {
    throw new Error(`"${arg}": a password field belongs to \`webjs generate authentication\`, which adds a hashed password to users.`);
  }
  const kind = TYPES[rawType];
  if (!kind) {
    throw new Error(`"${arg}": unknown type "${rawType}". Use one of: ${Object.keys(TYPES).join(', ')}.`);
  }
  let unique = false;
  let index = false;
  for (const m of mods) {
    if (m === 'uniq' || m === 'unique') unique = true;
    else if (m === 'index') index = true;
    else throw new Error(`"${arg}": unknown modifier "${m}". Use :uniq or :index.`);
  }
  const label = words.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
  if (kind === 'references') {
    const relation = camel(words);
    const table = camel([...words.slice(0, -1), pluralize(words[words.length - 1])]);
    return { name: relation + 'Id', label, kind, notNull, unique, index: index || !unique, references: { table, relation } };
  }
  const name = camel(words);
  if (RESERVED.has(name)) throw new Error(`"${arg}": ${name} is added to every generated table already.`);
  return { name, label, kind, notNull, unique, index };
}

/**
 * Parse every field argument, refusing a name given twice.
 * @param {string[]} args
 * @returns {Field[]}
 */
export function parseFields(args) {
  const fields = args.map(parseField);
  const seen = new Set();
  for (const f of fields) {
    if (seen.has(f.name)) throw new Error(`The field ${f.name} is given twice.`);
    seen.add(f.name);
  }
  return fields;
}

/**
 * The Drizzle column expression for a field, and the builders it imports.
 * @param {Field} f
 * @param {'sqlite'|'postgres'} dialect
 * @returns {{ code: string, imports: string[] }}
 */
export function columnFor(f, dialect) {
  const pg = dialect === 'postgres';
  let code;
  let imports;
  switch (f.kind) {
    case 'string':
    case 'text': code = 'text()'; imports = ['text']; break;
    case 'integer': code = 'integer()'; imports = ['integer']; break;
    case 'float': code = pg ? 'doublePrecision()' : 'real()'; imports = [pg ? 'doublePrecision' : 'real']; break;
    // A checkbox posts nothing when unchecked, so a boolean is never null.
    case 'boolean': return pg
      ? { code: 'boolean().notNull().default(false)' + (f.unique ? '.unique()' : ''), imports: ['boolean'] }
      : { code: "integer({ mode: 'boolean' }).notNull().default(false)" + (f.unique ? '.unique()' : ''), imports: ['integer'] };
    case 'datetime': code = pg ? 'timestamp({ withTimezone: true })' : "integer({ mode: 'timestamp_ms' })"; imports = [pg ? 'timestamp' : 'integer']; break;
    case 'json': code = pg ? 'jsonb().$type<unknown>()' : "text({ mode: 'json' }).$type<unknown>()"; imports = [pg ? 'jsonb' : 'text']; break;
    case 'references': {
      const ref = /** @type {NonNullable<Field['references']>} */ (f.references);
      code = `integer().references(() => ${ref.table}.id)`;
      imports = ['integer'];
      break;
    }
    default: throw new Error(`unhandled kind ${f.kind}`);
  }
  if (f.notNull) code += '.notNull()';
  if (f.unique) code += '.unique()';
  return { code, imports };
}

/**
 * The id, createdAt and updatedAt columns every generated table carries.
 * @param {'sqlite'|'postgres'} dialect
 * @returns {{ id: string, createdAt: string, updatedAt: string, imports: string[] }}
 */
export function baseColumns(dialect) {
  if (dialect === 'postgres') {
    return {
      id: 'serial().primaryKey()',
      createdAt: 'timestamp({ withTimezone: true }).notNull().defaultNow()',
      updatedAt: 'timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())',
      imports: ['serial', 'timestamp'],
    };
  }
  return {
    id: 'integer().primaryKey({ autoIncrement: true })',
    createdAt: "integer({ mode: 'timestamp_ms' }).notNull().defaultNow()",
    updatedAt: "integer({ mode: 'timestamp_ms' }).notNull().defaultNow().$onUpdate(() => new Date())",
    imports: ['integer'],
  };
}
