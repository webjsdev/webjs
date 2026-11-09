// Next idiom: a dynamic route handler that throws `notFound()` and
// `redirect()` (Next's next/navigation helpers, imported from WebJs), and
// gets HEAD for free.
import { notFound, redirect } from '@webjsdev/core';

const ITEMS: Record<string, string> = { '1': 'Widget' };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === 'first') redirect('/api/items/1');
  const name = ITEMS[id];
  if (!name) notFound();
  return Response.json({ id, name });
}
