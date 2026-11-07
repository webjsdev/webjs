import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating, table } from './shared.ts';

/**
 * Subagent, ported from shadcn's content/docs/ai-elements/radix/subagent.mdx
 * (#1666). shadcn's demo streams a scripted chat through useChat; the demo
 * here is the settled conversation, with the subagent's run left open.
 */
export const title = 'Subagent';
export const description = 'Displays a subagent run, with its tool calls and result.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('subagent-demo', RHEA)}
    <p>Subagent is a line for work the agent hands to a subagent. The run is the title, like "Ran the research agent". Open it for the tool calls the subagent made and what it found.</p>
    <p>Subagent is built with a trace, with a trace collapsible for the run and a nested trace for its tool calls.</p>

    ${await installation(toc, {
      prose: html`Subagent is built with the <a href="/ui/docs/components/trace">Trace</a>, <a href="/ui/docs/components/code-block">Code Block</a> and <a href="/ui/docs/components/badge">Badge</a> components.`,
      add: 'trace code-block badge',
      source: 'trace',
      dependencies: ['code-block', 'badge'],
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
  <details data-slot="trace-collapsible" class=\${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
    <summary data-slot="trace-collapsible-trigger" class=\${traceCollapsibleTriggerClass()}>
      <span data-slot="trace-line" class=\${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
          \${CircleCheckIcon()}
        </span>
        <span data-slot="trace-title" class=\${traceTitleClass()}>Ran the research agent</span>
      </span>
      <span data-slot="trace-icon" aria-hidden="true" class=\${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>
        \${ChevronRightIcon()}
      </span>
    </summary>
    <div data-slot="trace-collapsible-content" class=\${cn(traceCollapsibleContentClass(), 'flex flex-col gap-3')}>
      <div data-slot="trace" class=\${traceClass()}>
        <span data-slot="trace-line" class=\${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
            \${CircleCheckIcon()}
          </span>
          <span data-slot="trace-title" class=\${traceTitleClass()}>Ran grep -rn cacheKey scripts</span>
        </span>
      </div>
      <p>The cache is keyed on the commit SHA.</p>
    </div>
  </details>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Running')}
    <p>While the subagent runs, the line has <code>data-status="running"</code> and its content shows the tool calls so far. Add the result when the subagent finishes.</p>
    ${await componentPreview('subagent-running', RHEA)}

    ${heading(toc, 2, 'Details')}
    <p>Put the task the subagent was given at the top of the content, with its model and tools as <a href="/ui/docs/components/badge">Badge</a> items. Show how long it ran in a trace description after the title.</p>
    ${await componentPreview('subagent-details', RHEA)}

    ${heading(toc, 2, 'AI SDK')}
    <p>With the AI SDK, a subagent is a tool whose <code>execute</code> yields the subagent's <code>UIMessage</code> as it streams. Render the tool part as the line and <code>part.output.parts</code> as the nested trace. Map each nested tool part as in <a href="/ui/docs/ai-elements/tool#states">Tool</a>, and see <a href="/ui/docs/helpers/ai-sdk">AI SDK</a> for streaming the parts from a <code>'use server'</code> action.</p>
    <p>Each yield is a preliminary output: the part is <code>output-available</code> with <code>preliminary: true</code>. The final output replaces it, so check <code>preliminary</code> before you show "Ran".</p>
    ${table(['Tool part state', 'Trace line data-status', 'Title'], [
      [html`<code>input-streaming</code>, <code>input-available</code>`, html`<code>"running"</code> while the chat streams`, 'Running …'],
      [html`<code>output-available</code> with <code>preliminary: true</code>`, html`<code>"running"</code> while the chat streams`, 'Running …'],
      [html`<code>output-available</code>`, 'none', 'Ran …'],
      [html`<code>output-error</code>, or a running state after the chat stops`, html`<code>"error"</code>`, 'Failed to run …'],
    ])}
    ${codeFigure(`function subagentRow(part: SubagentToolPart, streaming: boolean) {
  const done = part.state === 'output-available' && !part.preliminary;
  const running = !done && part.state !== 'output-error' && streaming;
  const parts = part.state === 'output-available' ? part.output.parts : [];

  return html\`<details data-slot="trace-collapsible" open class=\${traceCollapsibleClass()}>
    <summary data-slot="trace-collapsible-trigger" class=\${traceCollapsibleTriggerClass()}>
      <span data-slot="trace-line" data-status=\${done ? null : running ? 'running' : 'error'} class=\${traceLineClass()}>
        <span data-slot="trace-title" class=\${traceTitleClass()}>\${done ? 'Ran' : running ? 'Running' : 'Failed to run'} the research agent</span>
      </span>
    </summary>
    <div data-slot="trace-collapsible-content" class=\${traceCollapsibleContentClass()}>
      <div data-slot="trace" class=\${traceClass()}>\${parts.map((nested) => toolRow(nested, running))}</div>
    </div>
  </details>\`;
}`, { lineNumbers: true })}

    ${migrating(toc, {
      name: 'Agent',
      file: 'agent.tsx',
      parts: [
        ['Agent', html`A trace with a trace collapsible.`],
        ['AgentHeader', html`The collapsible's <code>&lt;summary&gt;</code>, holding a trace line, a trace icon and a trace title with the name, like "Ran the research agent". Show the model in a badge.`],
        ['AgentContent', html`The trace collapsible content.`],
        ['AgentTools, AgentTool', html`A trace, with a trace line for each tool call, instead of an Accordion.`],
        ['AgentInstructions', html`A paragraph at the top of the content.`],
        ['AgentOutput', html`A Code Block with <code>data-size="sm"</code>.`],
      ],
    })}

    ${heading(toc, 2, 'API Reference')}
    <p>See <a href="/ui/docs/components/trace#api-reference">Trace</a>.</p>
  `;
}
