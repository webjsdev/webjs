import { redirect } from '@webjsdev/core';

/** /ui/charts opens on the first chart type, as shadcn's /charts does. */
export default function ChartsPage() {
  redirect('/ui/charts/area');
}
