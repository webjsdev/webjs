import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import {
  ChevronRightIcon, CircleCheckIcon, CircleIcon, ListChecksIcon, ListTodoIcon,
} from '#lib/ui/lucide.ts';

type Todo = { title: string; description?: string; done: boolean };

const todos: Todo[] = [
  {
    title: 'Write the migration guide',
    description: 'Cover the renamed props and the new data attributes.',
    done: true,
  },
  { title: 'Add a changeset', done: true },
  {
    title: 'Fix the focus ring on the select trigger',
    description: 'It is clipped by overflow-hidden on the field.',
    done: false,
  },
  { title: 'Update the registry snapshots', done: false },
  {
    title: 'Add tests for the combobox',
    description: 'Typing, clearing and keyboard selection.',
    done: false,
  },
];

// A trace collapsible: a native <details> whose summary holds the line and a
// chevron that turns while it is open.
function collapsible(line: unknown, content: unknown, open = false) {
  return html`
    <details data-slot="trace-collapsible" ?open=${open} class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
      <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
        ${line}
        <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>${ChevronRightIcon()}</span>
      </summary>
      <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>${content}</div>
    </details>
  `;
}

function line(icon: unknown, title: string) {
  return html`<span data-slot="trace-line" class=${traceLineClass()}>
    <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${icon}</span>
    <span data-slot="trace-title" class=${traceTitleClass()}>${title}</span>
  </span>`;
}

// A todo with a description opens to show it. One without stays a line.
function todoRow(todo: Todo) {
  const row = line(todo.done ? CircleCheckIcon() : CircleIcon(), todo.title);
  return todo.description ? collapsible(row, todo.description) : row;
}

export default function QueueDescriptions() {
  const pending = todos.filter((todo) => !todo.done);
  const completed = todos.filter((todo) => todo.done);
  return html`
    <div data-slot="trace" class=${cn(traceClass(), 'max-w-sm')}>
      ${collapsible(
        line(ListTodoIcon(), `${pending.length} to do`),
        html`<div data-slot="trace" class=${traceClass()}>${pending.map(todoRow)}</div>`,
        true,
      )}
      ${collapsible(
        line(ListChecksIcon(), `${completed.length} completed`),
        html`<div data-slot="trace" class=${traceClass()}>${completed.map(todoRow)}</div>`,
      )}
    </div>
  `;
}
