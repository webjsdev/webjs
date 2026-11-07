import type { Metadata, PageProps } from '@webjsdev/core';
import { examplesShell } from '#lib/ui/examples-shell.ts';
import { tasksExample } from '#modules/ui/example-apps/tasks/tasks.ts';
import { TASKS } from '#modules/ui/example-apps/tasks/tasks-data.ts';
import { parseState } from '#modules/ui/example-apps/tasks/state.ts';
// The interactive parts. A page never hydrates, so it imports the elements
// its markup uses to register them.
import '#modules/ui/components/dropdown-menu.ts';
import '#modules/ui/components/command.ts';
import '#modules/ui/components/select.ts';
import '#modules/ui/example-apps/tasks/tasks-table.ts';
import '#components/theme-selector.ts';

/**
 * /ui/examples/tasks, shadcn/ui's apps/v4/app/(app)/examples/tasks (#1666):
 * a task tracker over a data table, inside the examples frame. The table's
 * filters, sort, hidden columns and page are the query string, applied on the
 * server, so the whole table works with JavaScript off.
 */

export const metadata: Metadata = {
  title: 'Tasks | WebJs UI',
  description: 'A task and issue tracker built using the components.',
};

export default function TasksExample({ url }: Pick<PageProps, 'url'>) {
  const u = new URL(url);
  return examplesShell(u, 'tasks', tasksExample(TASKS, parseState(u.searchParams)));
}
