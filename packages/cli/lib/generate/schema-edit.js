/**
 * Edits to the app's own `db/schema.server.ts`, which the user has usually
 * changed since `webjs create`. Every edit is an insertion at a recognisable
 * anchor (the dialect import, the `defineRelations` call); nothing the user
 * wrote is rewritten. When an anchor is missing, the edit is skipped and the
 * caller prints what to add by hand, the way Rails prints a route it could not
 * place.
 */

/**
 * The SQL dialect the app's `drizzle.config.ts` declares.
 * @param {string} config the file's text, or '' when it is missing
 * @returns {'sqlite'|'postgres'}
 */
export function dialectOf(config) {
  return /dialect:\s*['"]postgresql['"]/.test(config) ? 'postgres' : 'sqlite';
}

/** @param {'sqlite'|'postgres'} dialect */
export const coreModule = (dialect) => (dialect === 'postgres' ? 'drizzle-orm/pg-core' : 'drizzle-orm/sqlite-core');

/**
 * Whether the schema already exports a binding with this name.
 * @param {string} src
 * @param {string} name
 */
export function hasExport(src, name) {
  return new RegExp(`^export const ${name}\\s*=`, 'm').test(src);
}

/**
 * Add named imports from a module, merging into an existing import of it.
 * @param {string} src
 * @param {string} from
 * @param {string[]} names
 * @returns {string}
 */
export function addImports(src, from, names) {
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${from.replace(/[/.-]/g, '\\$&')}['"];?`);
  const m = src.match(re);
  if (m) {
    const have = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    const add = names.filter((n) => !have.includes(n));
    if (add.length === 0) return src;
    return src.replace(re, `import { ${[...have, ...add].join(', ')} } from '${from}';`);
  }
  const line = `import { ${[...new Set(names)].join(', ')} } from '${from}';\n`;
  // After the last import, so the file's import block stays together.
  const imports = [...src.matchAll(/^import[^;]*;\s*$/gm)];
  if (imports.length === 0) return line + src;
  const last = imports[imports.length - 1];
  const at = /** @type {number} */ (last.index) + last[0].length;
  return src.slice(0, at) + '\n' + line.trimEnd() + src.slice(at);
}

const RELATIONS_RE = /^export const \w+\s*=\s*defineRelations\(/m;

/**
 * Insert a table definition before the schema's `defineRelations` call (so
 * the call can name it), or at the end when there is none.
 * @param {string} src
 * @param {string} block
 * @returns {string}
 */
export function insertBlock(src, block) {
  const m = src.match(RELATIONS_RE);
  if (!m) return src.trimEnd() + '\n\n' + block.trimEnd() + '\n';
  // Also before the comment block directly above the call, which describes it.
  let at = /** @type {number} */ (m.index);
  const before = src.slice(0, at);
  const comment = before.match(/(?:^\/\/[^\n]*\n)+$/m);
  if (comment) at -= comment[0].length;
  return src.slice(0, at).replace(/\n*$/, '\n\n') + block.trimEnd() + '\n\n' + src.slice(at);
}

/**
 * Name a table in `defineRelations({ ... }, ...)`'s first argument.
 * @param {string} src
 * @param {string} table
 * @returns {string | null} null when the call or its object literal is not found
 */
export function registerTable(src, table) {
  const re = /(^export const \w+\s*=\s*defineRelations\(\s*\{)([^}]*)(\})/m;
  const m = src.match(re);
  if (!m) return null;
  const names = m[2].split(',').map((s) => s.trim()).filter(Boolean);
  if (names.includes(table)) return src;
  return src.replace(re, `$1 ${[...names, table].join(', ')} $3`);
}

/**
 * Add a new table's `one` relations (one per foreign key) to the
 * `defineRelations` callback: `posts: { author: r.one.users({ from:
 * r.posts.authorId, to: r.users.id }) }`.
 * @param {string} src
 * @param {string} table the new table's export name
 * @param {{ relation: string, target: string, column: string }[]} rels
 * @returns {string | null} null when the callback shape is not recognised
 */
export function addOneRelations(src, table, rels) {
  const re = /(^export const \w+\s*=\s*defineRelations\(\s*\{[^}]*\}\s*,\s*)(?:\(\s*\)|\(\s*(\w+)\s*\)|(\w+))(\s*=>\s*\(\{)/m;
  const m = src.match(re);
  if (!m) return null;
  const r = m[2] || m[3] || 'r';
  const body = rels
    .map((x) => `${x.relation}: ${r}.one.${x.target}({ from: ${r}.${table}.${x.column}, to: ${r}.${x.target}.id })`)
    .join(',\n    ');
  const entry = rels.length === 1 ? `\n  ${table}: { ${body} },` : `\n  ${table}: {\n    ${body},\n  },`;
  // An empty `({})` gets its closing brace on a line of its own.
  const at = /** @type {number} */ (m.index) + m[0].length;
  const close = /^\s*\}/.test(src.slice(at)) && !/^\n/.test(src.slice(at)) ? '\n' : '';
  return src.slice(0, m.index) + `${m[1]}(${r})${m[4]}${entry}${close}` + src.slice(at);
}
