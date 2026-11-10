/**
 * JSON route handlers for a resource, the `resource` generator's output and
 * the scaffold's in an app with no pages (the `api` template), as Rails'
 * scaffold writes API controllers in an API-only app.
 *
 *   GET    /api/<plural>        list
 *   POST   /api/<plural>        create (201, or 422 with fieldErrors)
 *   GET    /api/<plural>/<id>   show (404 when missing)
 *   PATCH  /api/<plural>/<id>   update
 *   DELETE /api/<plural>/<id>   destroy (204)
 */

/** @typedef {import('./names.js').ResourceNames} ResourceNames */

/**
 * @param {ResourceNames} n
 * @returns {{ path: string, content: string }[]}
 */
export function apiFiles(n) {
  const mod = `#modules/${n.kebabPlural}`;
  const collection = `import { list${n.Plural} } from '${mod}/queries/list-${n.kebabPlural}.server.ts';
import { create${n.Singular} } from '${mod}/actions/create-${n.kebab}.server.ts';

// A thin handler: the queries and the validation live in modules/${n.kebabPlural}/.
export async function GET() {
  return Response.json(await list${n.Plural}());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Send a JSON object.' }, { status: 400 });
  const result = await create${n.Singular}(body);
  if (!result.success) return Response.json(result, { status: result.status ?? 422 });
  return Response.json(result.data, { status: 201 });
}
`;
  const member = `import { get${n.Singular} } from '${mod}/queries/get-${n.kebab}.server.ts';
import { update${n.Singular} } from '${mod}/actions/update-${n.kebab}.server.ts';
import { delete${n.Singular} } from '${mod}/actions/delete-${n.kebab}.server.ts';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const ${n.singular} = await get${n.Singular}(Number((await params).id));
  if (!${n.singular}) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(${n.singular});
}

export async function PATCH(request: Request, { params }: Context) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Send a JSON object.' }, { status: 400 });
  const result = await update${n.Singular}(body, Number((await params).id));
  if (!result.success) return Response.json(result, { status: result.status ?? 422 });
  return Response.json(result.data);
}

export async function DELETE(_request: Request, { params }: Context) {
  await delete${n.Singular}(Number((await params).id));
  return new Response(null, { status: 204 });
}
`;
  return [
    { path: `app/api/${n.kebabPlural}/route.ts`, content: collection },
    { path: `app/api/${n.kebabPlural}/[id]/route.ts`, content: member },
  ];
}
