import { WebComponent, html, signal } from '@webjsdev/core';

// Line numbers in this fixture are asserted by test/e2e/dev-source-locations.test.mjs.
// The <li> rows render only in the browser (after a click), so they prove the
// CLIENT render carries the annotation, not just the SSR markup.
const items = signal<string[]>([]);

class TodoList extends WebComponent({}) {
  render() {
    return html`<div class="todo">
      <button id="add" @click=${() => items.set([...items.get(), 'row ' + items.get().length])}>add</button>
      <ul id="rows">${items.get().map((t) =>
        html`<li class="row">${t}</li>`,
      )}</ul>
    </div>`;
  }
}
TodoList.register('todo-list');
