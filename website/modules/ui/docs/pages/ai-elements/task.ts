import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating, table } from './shared.ts';

/**
 * Task, ported from shadcn's content/docs/ai-elements/radix/task.mdx (#1666).
 * shadcn's demo streams a scripted chat through useChat; the demo here is
 * the settled conversation, with both tasks done and closed.
 */
export const title = 'Task';
export const description = 'Displays the steps the agent takes, as it takes them.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('task-demo', RHEA)}
    <p>Task is a piece of work the agent is doing, such as finding the project files or updating a page. Each step, like a search, a read or an edit, appears under the task when the agent takes it.</p>
    <p>Task is built with a trace, with a trace collapsible for each task.</p>

    ${heading(toc, 2, 'Task or Plan')}
    <p>Both are a list of steps under a collapsible line. The difference is when the steps are known.</p>
    <p>Use <a href="/ui/docs/ai-elements/plan">Plan</a> when the agent decides the steps before it starts. Use Task when the steps come from the work itself, and the agent only knows the next one once it has taken the last.</p>
    ${table(['', 'Plan', 'Task'], [
      ['Steps', 'Every step, from the start', 'Each step, once the agent takes it'],
      ['Pending steps', 'Yes, waiting their turn', 'None'],
      ['Title', 'The goal, with progress: "2 of 4 done"', 'What the agent is doing, then what it did'],
      ['Per reply', 'One plan', 'One or more tasks, each closing when it is done'],
    ])}

    ${await installation(toc, {
      prose: html`Task is built with the <a href="/ui/docs/components/trace">Trace</a> component.`,
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
        <span data-slot="trace-title" class=\${traceTitleClass()}>Found the project files</span>
      </span>
      <span data-slot="trace-icon" aria-hidden="true" class=\${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>
        \${ChevronRightIcon()}
      </span>
    </summary>
    <div data-slot="trace-collapsible-content" class=\${traceCollapsibleContentClass()}>
      <div data-slot="trace" class=\${traceClass()}>
        <span data-slot="trace-line" class=\${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>\${SearchIcon()}</span>
          <span data-slot="trace-title" class=\${traceTitleClass()}>Searched for app/page.tsx</span>
        </span>
        <a href="/files/app/page.tsx">
          <span data-slot="trace-line" class=\${traceLineClass()}>
            <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>\${FileTextIcon()}</span>
            <span data-slot="trace-title" class=\${traceTitleClass()}>Read app/page.tsx</span>
          </span>
        </a>
      </div>
    </div>
  </details>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Status')}
    <p>Set the task's status from its steps. Write the title in the present tense while the task runs, and in the past tense once it is done.</p>
    ${table(['Steps', 'data-status', 'Title'], [
      ['A step is still running', html`<code>"running"</code>`, 'Updating the page metadata'],
      ['A step failed', html`<code>"error"</code>`, 'Failed to update the page metadata'],
      ['Every step is done', 'none', 'Updated the page metadata'],
    ])}
    <p>Put several tasks in one trace. Keep the running task open with <code>?open=\${running}</code>, and it renders closed once it is done.</p>

    ${heading(toc, 2, 'AI SDK')}
    <p>Stream each task as a data part with its own <code>id</code>, writing the task again with each new step. Where your component collects the parts, keep the latest part for each <code>id</code>, so a task updates in place instead of repeating. See <a href="/ui/docs/helpers/ai-sdk">AI SDK</a> for streaming the parts from a <code>'use server'</code> action.</p>
    ${codeFigure(`yield { type: 'data-task', id: 'update', data: { title, steps } };`, { lineNumbers: true, title: 'modules/chat/actions/chat.server.ts' })}
    ${codeFigure(`const tasks = message.parts.filter((part) => part.type === 'data-task');`, { lineNumbers: true })}

    ${migrating(toc, {
      name: 'Task',
      file: 'task.tsx',
      parts: [
        ['Task', html`A trace with a trace collapsible.`],
        ['TaskTrigger', html`The collapsible's <code>&lt;summary&gt;</code>, holding a trace line and a trace title with the title.`],
        ['TaskContent', html`The trace collapsible content, holding a trace for the steps.`],
        ['TaskItem', html`A trace line with a trace title.`],
        ['TaskItemFile', html`No kit part. Keep it as markup of your own inside the trace title.`],
      ],
    })}

    ${heading(toc, 2, 'API Reference')}
    <p>See <a href="/ui/docs/components/trace#api-reference">Trace</a>.</p>
  `;
}
