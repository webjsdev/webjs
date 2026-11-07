import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating, table } from './shared.ts';

/**
 * Queue, ported from shadcn's content/docs/ai-elements/radix/queue.mdx
 * (#1666). shadcn's demo streams the todo list through useChat. The demo here
 * is the list once the agent has finished.
 */
export const title = 'Queue';
export const description = "Displays the agent's todo list, split into what is left and what is done.";

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('queue-demo', RHEA)}
    <p>Queue is the agent's todo list. Todos sit in two sections, To do and Completed, and the icon on each todo shows its status. The agent updates the list as it works, so a todo moves from one section to the other when it is done.</p>
    <p>Queue is built with a trace, with a trace collapsible for each section.</p>

    ${await installation(toc, {
      prose: html`Queue is built with the <a href="/ui/docs/components/trace">Trace</a> component.`,
      add: 'trace',
      source: 'trace',
    })}

    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  traceClass,
  traceCollapsibleClass,
  traceCollapsibleContentClass,
  traceCollapsibleTriggerClass,
  traceIconClass,
  traceLineClass,
  traceTitleClass,
} from '#components/ui/trace.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="trace" class=\${traceClass()}>
  <details data-slot="trace-collapsible" open class=\${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
    <summary data-slot="trace-collapsible-trigger" class=\${traceCollapsibleTriggerClass()}>
      <span data-slot="trace-line" class=\${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
          \${ListTodoIcon()}
        </span>
        <span data-slot="trace-title" class=\${traceTitleClass()}>2 to do</span>
      </span>
      <span data-slot="trace-icon" aria-hidden="true" class=\${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>
        \${ChevronRightIcon()}
      </span>
    </summary>
    <div data-slot="trace-collapsible-content" class=\${traceCollapsibleContentClass()}>
      <div data-slot="trace" class=\${traceClass()}>
        <span data-slot="trace-line" class=\${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
            \${CircleIcon()}
          </span>
          <span data-slot="trace-title" class=\${traceTitleClass()}>Update the registry snapshots</span>
        </span>
        <span data-slot="trace-line" class=\${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
            \${CircleIcon()}
          </span>
          <span data-slot="trace-title" class=\${traceTitleClass()}>Add tests for the combobox</span>
        </span>
      </div>
    </div>
  </details>
  <details data-slot="trace-collapsible" class=\${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
    <summary data-slot="trace-collapsible-trigger" class=\${traceCollapsibleTriggerClass()}>
      <span data-slot="trace-line" class=\${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
          \${ListChecksIcon()}
        </span>
        <span data-slot="trace-title" class=\${traceTitleClass()}>1 completed</span>
      </span>
      <span data-slot="trace-icon" aria-hidden="true" class=\${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>
        \${ChevronRightIcon()}
      </span>
    </summary>
    <div data-slot="trace-collapsible-content" class=\${traceCollapsibleContentClass()}>
      <div data-slot="trace" class=\${traceClass()}>
        <span data-slot="trace-line" class=\${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
            \${CircleCheckIcon()}
          </span>
          <span data-slot="trace-title" class=\${traceTitleClass()}>Add a changeset</span>
        </span>
      </div>
    </div>
  </details>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Descriptions')}
    <p>A todo with a description is a trace collapsible that opens to show it. A todo without one stays a trace line.</p>
    ${await componentPreview('queue-descriptions', RHEA)}
    ${codeFigure(`<details data-slot="trace-collapsible" class=\${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
  <summary data-slot="trace-collapsible-trigger" class=\${traceCollapsibleTriggerClass()}>
    <span data-slot="trace-line" class=\${traceLineClass()}>
      <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
        \${CircleIcon()}
      </span>
      <span data-slot="trace-title" class=\${traceTitleClass()}>Fix the focus ring on the select trigger</span>
    </span>
    <span data-slot="trace-icon" aria-hidden="true" class=\${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>
      \${ChevronRightIcon()}
    </span>
  </summary>
  <div data-slot="trace-collapsible-content" class=\${traceCollapsibleContentClass()}>
    It is clipped by overflow-hidden on the field.
  </div>
</details>`, { lineNumbers: true })}

    ${heading(toc, 2, 'AI SDK')}
    <p>The agent writes its todos with a tool, <code>writeTodos</code> in this example. Each call sends the whole list, so render the last call and skip one whose input is still streaming. See <a href="/ui/docs/helpers/ai-sdk">AI SDK</a> for streaming the parts from a server action.</p>
    ${codeFigure(`const todos = message.parts
  .filter((part) => part.type === 'tool-writeTodos')
  .filter((part) => part.state !== 'input-streaming')
  .at(-1)?.input?.todos;`, { lineNumbers: true })}
    <p>Map each todo status to a section, an icon and a trace line status. Set <code>"running"</code> on the todo in progress only while the chat streams, so its title stops shimmering when the agent stops.</p>
    ${table(['Todo status', 'Section', 'Icon', 'Trace line data-status'], [
      [html`<code>pending</code>`, 'To do', html`<code>CircleIcon</code>`, 'none'],
      [html`<code>in_progress</code>`, 'To do', html`<code>CircleDotIcon</code>`, html`<code>"running"</code> while the chat streams`],
      [html`<code>completed</code>`, 'Completed', html`<code>CircleCheckIcon</code>`, 'none'],
    ])}

    ${migrating(toc, {
      name: 'Queue',
      file: 'queue.tsx',
      parts: [
        ['Queue', html`A trace.`],
        ['QueueSection, QueueSectionTrigger, QueueSectionContent', html`A trace collapsible, its <code>&lt;summary&gt;</code> and its content.`],
        ['QueueSectionLabel', html`A trace line with a trace icon and a trace title, like "2 to do".`],
        ['QueueList', html`A trace. Drop the ScrollArea.`],
        ['QueueItem', html`A trace line. QueueItemIndicator is a trace icon, QueueItemContent a trace title, and QueueItemDescription a trace description.`],
        ['QueueItemActions, QueueItemAction and the attachment parts', html`Plain markup next to the line, as they are.`],
      ],
    })}

    ${heading(toc, 2, 'API Reference')}
    <p>See <a href="/ui/docs/components/trace#api-reference">Trace</a>.</p>
  `;
}
