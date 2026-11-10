/**
 * The scaffold's test, written against the real request handler: pages are
 * requested and forms submitted the way a browser with JavaScript off submits
 * them (`submitForm`), or the JSON routes called (`testRequest`). It runs on
 * the database `webjs test` prepares from the migrations.
 */

/**
 * @typedef {import('./fields.js').Field} Field
 * @typedef {import('./names.js').ResourceNames} ResourceNames
 */

/**
 * A valid submitted value per field, as a form posts it (strings) or a JSON
 * body carries it.
 * @param {Field} f
 * @param {boolean} json
 */
function sample(f, json) {
  switch (f.kind) {
    case 'string': return `'${f.label} ' + stamp`;
    case 'text': return `'Some ${f.label.toLowerCase()} ' + stamp`;
    case 'integer': return json ? '42' : "'42'";
    case 'float': return json ? '1.5' : "'1.5'";
    case 'boolean': return json ? 'true' : "'on'";
    case 'datetime': return "'2026-01-02T03:04'";
    case 'json': return json ? '{ hello: \'world\' }' : `'{"hello":"world"}'`;
    case 'references': return f.notNull ? (json ? `${f.references?.relation}.id` : `String(${f.references?.relation}.id)`) : (json ? 'null' : "''");
    default: return "''";
  }
}

/**
 * @param {ResourceNames} n
 * @param {Field[]} fields
 * @param {'pages'|'api'} mode
 * @returns {{ path: string, content: string }}
 */
export function testFile(n, fields, mode) {
  const json = mode === 'api';
  const parents = fields.filter((f) => f.kind === 'references' && f.notNull);
  const required = fields.find((f) => f.notNull && f.kind !== 'boolean' && f.kind !== 'references');
  const changed = fields.find((f) => f.kind === 'string' || f.kind === 'text');
  const valid = `{ ${fields.map((f) => `${f.name}: ${sample(f, json)}`).join(', ')} }`;
  const parentLookup = parents.map((f) => {
    const r = /** @type {NonNullable<Field['references']>} */ (f.references);
    return `  const [${r.relation}] = await db.select({ id: ${r.table}.id }).from(${r.table}).limit(1);
  if (!${r.relation}) return t.skip('Add a ${r.relation} row first: ${f.name} must point at one.');
`;
  }).join('');
  const dbImports = parents.length
    ? `import { db } from '#db/connection.server.ts';\nimport { ${[...new Set(parents.map((f) => f.references?.table))].join(', ')} } from '#db/schema.server.ts';\n`
    : '';
  const t = parents.length ? 't' : '';
  const header = `// The ${n.humanPlural} ${mode === 'pages' ? 'scaffold' : 'routes'}' test, against the real request handler and the
// test database \`webjs test\` prepares from db/migrations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { ${mode === 'pages' ? 'submitForm, testRequest' : 'testRequest'} } from '@webjsdev/server/testing';
${dbImports}import { get${n.Singular} } from '#modules/${n.kebabPlural}/queries/get-${n.kebab}.server.ts';

const app = await createRequestHandler({ appDir: fileURLToPath(new URL('../..', import.meta.url)), dev: true });
const stamp = String(Date.now());
`;

  if (mode === 'pages') {
    const invalid = required ? `
test('a ${n.human} with no ${required.label.toLowerCase()} re-renders the form with a message', async (${t}) => {
${parentLookup}  const res = await submitForm(app.handle, '/${n.kebabPlural}/new', { ...${valid}, ${required.name}: '' });
  assert.equal(res.status, 422);
  assert.match(await res.text(), /${required.label} is required/);
});
` : '';
    return {
      path: `test/${n.kebabPlural}/${n.kebabPlural}.test.ts`,
      content: `${header}
test('the ${n.humanPlural} index renders', async () => {
  const res = await testRequest(app.handle, '/${n.kebabPlural}');
  assert.equal(res.status, 200);
});
${invalid}
test('create, show, edit and delete a ${n.human} through its forms', async (${t}) => {
${parentLookup}  const valid = ${valid};
  const created = await submitForm(app.handle, '/${n.kebabPlural}/new', valid);
  assert.equal(created.status, 303);
  const path = new URL(created.headers.get('location') ?? '', 'http://localhost').pathname;
  const id = Number(path.split('/').pop());
  assert.ok(await get${n.Singular}(id), 'the ${n.human} was saved');

  assert.equal((await testRequest(app.handle, path)).status, 200);
  assert.equal((await testRequest(app.handle, path + '/edit')).status, 200);

  // The edit form posts the record's id in a hidden field, as a browser does.
  const updated = await submitForm(app.handle, path + '/edit', { ...valid, id: String(id)${changed ? `, ${changed.name}: 'Changed'` : ''} });
  assert.equal(updated.status, 303);
${changed ? `  assert.equal((await get${n.Singular}(id))?.${changed.name}, 'Changed');\n` : ''}
  const deleted = await submitForm(app.handle, path, { id: String(id) });
  assert.equal(deleted.status, 303);
  assert.equal(await get${n.Singular}(id), undefined);
});
`,
    };
  }

  const send = (/** @type {string} */ method, /** @type {string} */ body) =>
    `{ method: '${method}', headers: { 'content-type': 'application/json' }, body: JSON.stringify(${body}) }`;
  const invalid = required ? `
test('POST /api/${n.kebabPlural} with no ${required.label.toLowerCase()} answers 422 with the field error', async (${t}) => {
${parentLookup}  const res = await testRequest(app.handle, '/api/${n.kebabPlural}', ${send('POST', `{ ...${valid}, ${required.name}: '' }`)});
  assert.equal(res.status, 422);
  assert.match((await res.json()).fieldErrors.${required.name}, /required/);
});
` : '';
  return {
    path: `test/${n.kebabPlural}/${n.kebabPlural}.test.ts`,
    content: `${header}${invalid}
test('create, read, update and delete a ${n.human} over JSON', async (${t}) => {
${parentLookup}  const valid = ${valid};
  const created = await testRequest(app.handle, '/api/${n.kebabPlural}', ${send('POST', 'valid')});
  assert.equal(created.status, 201);
  const { id } = await created.json();

  assert.equal((await testRequest(app.handle, '/api/${n.kebabPlural}')).status, 200);
  assert.equal((await testRequest(app.handle, '/api/${n.kebabPlural}/' + id)).status, 200);

  const updated = await testRequest(app.handle, '/api/${n.kebabPlural}/' + id, ${send('PATCH', `{ ...valid${changed ? `, ${changed.name}: 'Changed'` : ''} }`)});
  assert.equal(updated.status, 200);
${changed ? `  assert.equal((await get${n.Singular}(id))?.${changed.name}, 'Changed');\n` : ''}
  assert.equal((await testRequest(app.handle, '/api/${n.kebabPlural}/' + id, { method: 'DELETE' })).status, 204);
  assert.equal(await get${n.Singular}(id), undefined);
});
`,
  };
}
