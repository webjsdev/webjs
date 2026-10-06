import { html } from '@webjsdev/core';
import '#components/todo-list.ts';

// Line numbers in this fixture are asserted by test/e2e/dev-source-locations.test.mjs.
export default function Page() {
  return html`
    <section id="intro">
      <todo-list></todo-list>
    </section>
  `;
}
