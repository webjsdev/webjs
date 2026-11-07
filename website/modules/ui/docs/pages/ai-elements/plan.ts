import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating } from './shared.ts';

/**
 * Plan, ported from shadcn's content/docs/ai-elements/radix/plan.mdx (#1666).
 * shadcn's demo streams the plan step by step through useChat. The demo here
 * is the finished plan, and the open state is the native details element's
 * own.
 */
export const title = 'Plan';
export const description = 'Displays the steps the agent plans to take, and how far it has got.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('plan-demo', RHEA)}
    <p>Plan is the list of steps the agent decides on before it starts, such as the steps of a migration. Each step is done, running or pending, and the title counts how many are done.</p>
    <p>Plan is built with a trace, with a trace collapsible for the plan.</p>
    <p>When the steps are not known up front, use <a href="/ui/docs/ai-elements/task#task-or-plan">Task</a> instead.</p>

    ${await installation(toc, {
      prose: html`Plan is built with the <a href="/ui/docs/components/trace">Trace</a> component.`,
      add: 'trace',
      source: 'trace',
    })}

    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  traceClass,
  traceCollapsibleClass,
  traceCollapsibleContentClass,
  traceCollapsibleTriggerClass,
  traceDescriptionClass,
  traceIconClass,
  traceLineClass,
  traceTitleClass,
} from '#components/ui/trace.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="trace" class=\${traceClass()}>
  <details data-slot="trace-collapsible" open class=\${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
    <summary data-slot="trace-collapsible-trigger" class=\${traceCollapsibleTriggerClass()}>
      <span data-slot="trace-line" data-status="running" class=\${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
          \${RouteIcon()}
        </span>
        <span data-slot="trace-title" class=\${traceTitleClass()}>Plan: migrate to Base UI</span>
        <span data-slot="trace-description" class=\${traceDescriptionClass()}>2 of 5 done</span>
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
          <span data-slot="trace-title" class=\${traceTitleClass()}>Replace the Radix imports</span>
        </span>
        <span data-slot="trace-line" data-status="running" class=\${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
            \${CircleDotIcon()}
          </span>
          <span data-slot="trace-title" class=\${traceTitleClass()}>Rename asChild to render</span>
        </span>
        <span data-slot="trace-line" data-status="pending" class=\${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
            \${CircleIcon()}
          </span>
          <span data-slot="trace-title" class=\${traceTitleClass()}>Run the type checker</span>
        </span>
      </div>
    </div>
  </details>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Details')}
    <p>Put a description above the steps, inside the trace collapsible content.</p>
    ${await componentPreview('plan-description', RHEA)}

    ${heading(toc, 2, 'AI SDK')}
    <p>Stream the plan as a data part with a fixed <code>id</code>, from the <code>'use server'</code> action that streams the reply. Each time the plan changes, yield it again with the same <code>id</code>, and keep the latest part for each <code>id</code> where your component collects the parts, so it updates in place.</p>
    ${codeFigure(`yield { type: 'data-plan', id: 'plan', data: { title, steps } };`, { title: 'modules/chat/actions/chat.server.ts', lineNumbers: true })}
    ${codeFigure(`const plan = message.parts.find((part) => part.type === 'data-plan');`, { lineNumbers: true })}
    <p>See <a href="/ui/docs/helpers/ai-sdk">AI SDK</a> for streaming the parts to a component.</p>

    ${migrating(toc, {
      name: 'Plan',
      file: 'plan.tsx',
      parts: [
        ['Plan', html`A trace with a trace collapsible, in place of a Card. Keep <code>isStreaming</code> in your component.`],
        ['PlanHeader', html`The collapsible's <code>&lt;summary&gt;</code>, holding a trace line. Set <code>data-status="running"</code> on the line while it streams, in place of the Shimmer.`],
        ['PlanTitle, PlanDescription', html`A trace title, and a trace description like "2 of 4 done".`],
        ['PlanContent', html`The trace collapsible content, holding a trace for the steps.`],
        ['PlanTrigger', html`Nothing of its own, since the whole summary opens the plan.`],
        ['PlanAction', html`A button next to the trace collapsible, not inside its <code>&lt;summary&gt;</code>, since a button cannot sit inside the trigger.`],
        ['PlanFooter', html`A plain container.`],
      ],
    })}

    ${heading(toc, 2, 'API Reference')}
    <p>See <a href="/ui/docs/components/trace#api-reference">Trace</a>.</p>
  `;
}
