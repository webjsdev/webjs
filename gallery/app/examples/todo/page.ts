// A thin route adapter (app/ is routing only): it awaits the 'use server'
// query on the server and renders the interactive component. The logic, and
// the action the component's forms bind to, live in modules/todo/.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core'; // Metadata is a @webjsdev/core type
import { pageHeading } from '#lib/utils/ui.ts';
import { listTodos } from '#modules/todo/queries/list-todos.server.ts';
import '#modules/todo/components/todo-app.ts';

export const metadata: Metadata = { title: 'Todo (optimistic UI) | examples' };

export default async function TodoExample() {
  // Handed down as a property, so the first paint carries the real list.
  const todos = await listTodos();
  return html`
    ${pageHeading('Optimistic todo')}
    <todo-app .todos=${todos}></todo-app>
  `;
}
