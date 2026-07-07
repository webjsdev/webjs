// The interactive surface. Demonstrates: the WebComponent factory + reactive
// prop, the DECLARATIVE optimistic() API (instant update, auto-rollback), and
// progressive enhancement (each mutation is a <form> posting to the page action,
// intercepted by JS for the optimistic path). All interactivity lives in a
// component; a page/layout cannot be interactive in its own markup.
import { WebComponent, prop, optimistic, html } from '@webjsdev/core';
import { createTodo } from '../actions/create-todo.server.ts';
import { toggleTodo } from '../actions/toggle-todo.server.ts';
import { deleteTodo } from '../actions/delete-todo.server.ts';
import type { Todo } from '../types.ts';

type Op =
  | { kind: 'add'; tempId: string; title: string }
  | { kind: 'toggle'; id: string; completed: boolean }
  | { kind: 'delete'; id: string };

export class TodoApp extends WebComponent({
  // A reactive prop: the SSR'd list arrives via `.todos=${todos}` and hydrates.
  todos: prop<Todo[]>(Array),
}) {
  // One optimistic store, three ops. `.add(payload, promise)` applies `update`
  // instantly and auto-releases when the promise settles (resolve OR reject),
  // so there is no manual try-catch / rollback / temp-id bookkeeping.
  private store = optimistic(this, {
    source: () => this.todos ?? [],
    update: (state: Todo[], op: Op): Todo[] => {
      if (op.kind === 'add') return [{ id: op.tempId, title: op.title, completed: false, createdAt: new Date(), pending: true }, ...state];
      if (op.kind === 'toggle') return state.map((t) => (t.id === op.id ? { ...t, completed: op.completed } : t));
      return state.filter((t) => t.id !== op.id);
    },
  });

  async add(e: SubmitEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const title = String(new FormData(form).get('title') ?? '').trim();
    if (!title) return;
    form.reset();
    const tempId = crypto.randomUUID();
    const promise = createTodo({ title });
    this.store.add({ kind: 'add', tempId, title }, promise);
    const r = await promise;
    if (r.success && r.data) this.todos = [r.data, ...(this.todos ?? [])];
  }

  async toggle(e: Event, todo: Todo) {
    e.preventDefault();
    if (todo.pending) return;
    const completed = !todo.completed;
    const promise = toggleTodo({ id: todo.id, completed });
    this.store.add({ kind: 'toggle', id: todo.id, completed }, promise);
    const r = await promise;
    if (r.success && r.data) { const d = r.data; this.todos = (this.todos ?? []).map((t) => (t.id === todo.id ? d : t)); }
  }

  // NOT named `remove`: Element.remove() is a built-in DOM method, so a method
  // named `remove` with a different signature would clash (TS2416).
  async removeTodo(e: Event, todo: Todo) {
    e.preventDefault();
    if (todo.pending) return;
    const promise = deleteTodo({ id: todo.id });
    this.store.add({ kind: 'delete', id: todo.id }, promise);
    const r = await promise;
    if (r.success) this.todos = (this.todos ?? []).filter((t) => t.id !== todo.id);
  }

  render() {
    const list = this.store.value;
    return html`
      <section class="grid gap-4 max-w-[520px]">
        <!-- Add: a real <form> so it works with JS off (posts to the page action);
             with JS, @submit intercepts and runs the optimistic path. -->
        <form method="post" action="" @submit=${(e: SubmitEvent) => this.add(e)} class="flex gap-2">
          <input type="hidden" name="intent" value="create" />
          <input name="title" required placeholder="What needs doing?" class="flex-1 border border-border rounded-lg px-3 py-2" />
          <button type="submit" class="px-4 py-2 rounded-lg bg-accent text-accent-fg font-semibold">Add</button>
        </form>
        <ul class="list-none m-0 p-0 grid gap-2">
          ${list.map((todo) => html`
            <li>
              <form method="post" action="" class="flex items-center gap-3 border border-border rounded-lg px-3 py-2 ${todo.pending ? 'opacity-50' : ''}">
                <input type="hidden" name="id" value=${todo.id} />
                <!-- Toggle is a submit button (degrades to a form POST no-JS); with JS
                     @click intercepts for the optimistic toggle. -->
                <button id="t-${todo.id}" type="submit" name="intent" value="toggle"
                  aria-pressed=${todo.completed ? 'true' : 'false'}
                  @click=${(e: Event) => this.toggle(e, todo)}
                  class="w-5 h-5 rounded-full border-2 ${todo.completed ? 'bg-accent border-accent' : 'border-border'}">✓</button>
                <!-- The title is a <label for> the toggle: clicking the text toggles
                     the task (works on JS and no-JS paths, and screen readers). -->
                <label for="t-${todo.id}" class="flex-1 cursor-pointer ${todo.completed ? 'line-through opacity-60' : ''}">${todo.title}</label>
                <button type="submit" name="intent" value="delete" aria-label="Delete"
                  @click=${(e: Event) => this.removeTodo(e, todo)} class="text-fg-subtle">x</button>
              </form>
            </li>
          `)}
        </ul>
      </section>
    `;
  }
}
TodoApp.register('todo-app');
