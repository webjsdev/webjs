import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import {
  ChevronRightIcon, CircleCheckIcon, CircleDotIcon, CircleIcon, ListChecksIcon, ListTodoIcon,
} from '#lib/ui/lucide.ts';

type Todo = { content: string; status: 'pending' | 'in_progress' | 'completed' };

// The last todo list the agent wrote: every todo is done.
const todos: Todo[] = [
  'Add a dark variant to the theme tokens',
  'Read the theme from a cookie',
  'Add a toggle to the settings page',
  'Check contrast on the charts',
].map((content) => ({ content, status: 'completed' }));

function todoLine(todo: Todo) {
  const icon = todo.status === 'completed'
    ? CircleCheckIcon()
    : todo.status === 'in_progress' ? CircleDotIcon() : CircleIcon();
  return html`<span data-slot="trace-line" class=${traceLineClass()}>
    <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${icon}</span>
    <span data-slot="trace-title" class=${traceTitleClass()}>${todo.content}</span>
  </span>`;
}

function section(icon: unknown, title: string, items: Todo[]) {
  return html`
    <details data-slot="trace-collapsible" open class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
      <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
        <span data-slot="trace-line" class=${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${icon}</span>
          <span data-slot="trace-title" class=${traceTitleClass()}>${title}</span>
        </span>
        <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>${ChevronRightIcon()}</span>
      </summary>
      <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
        <div data-slot="trace" class=${traceClass()}>${items.map(todoLine)}</div>
      </div>
    </details>
  `;
}

// The conversation once the agent has finished. A section shows only while it
// holds a todo, so with everything done only Completed is left.
export default function QueueDemo() {
  const pending = todos.filter((todo) => todo.status !== 'completed');
  const completed = todos.filter((todo) => todo.status === 'completed');
  return html`
    <div class="flex min-h-72 w-full max-w-sm flex-col gap-4 py-6 text-sm">
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="muted" data-align="end" class=${bubbleClass({ variant: 'muted' })}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>Add dark mode to the settings page.</div>
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-content" class=${cn(messageContentClass(), 'gap-4')}>
          <div data-slot="trace" class=${traceClass()}>
            ${pending.length > 0 ? section(ListTodoIcon(), `${pending.length} to do`, pending) : ''}
            ${completed.length > 0 ? section(ListChecksIcon(), `${completed.length} completed`, completed) : ''}
          </div>
          <p>Dark mode is in. The toggle is under Settings, Appearance.</p>
        </div>
      </div>
      <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'mt-auto self-start')}>
        Replay
      </button>
    </div>
  `;
}
