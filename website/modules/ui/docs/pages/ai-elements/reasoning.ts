import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating } from './shared.ts';

/**
 * Reasoning, ported from shadcn's content/docs/ai-elements/radix/reasoning.mdx
 * (#1666). shadcn's demo streams a scripted chat through useChat; the demo
 * here is the settled conversation, and the open state is the native
 * details element's own.
 */
export const title = 'Reasoning';
export const description = "Displays the agent's thinking as it streams.";

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('reasoning-demo', RHEA)}
    <p>Reasoning is a line for the agent's thinking. It reads "Thinking" and opens while the model thinks, then reads "Thought" and closes when it is done. The thinking itself sits inside, and the line can show how long it took.</p>
    <p>Reasoning is built with a trace, with a trace collapsible for the thinking.</p>

    ${await installation(toc, {
      prose: html`Reasoning is built with the <a href="/ui/docs/components/trace">Trace</a> component.`,
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
  <details data-slot="trace-collapsible" class=\${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
    <summary data-slot="trace-collapsible-trigger" class=\${traceCollapsibleTriggerClass()}>
      <span data-slot="trace-line" class=\${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
          \${CircleCheckIcon()}
        </span>
        <span data-slot="trace-title" class=\${traceTitleClass()}>Thought</span>
      </span>
      <span data-slot="trace-icon" aria-hidden="true" class=\${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>
        \${ChevronRightIcon()}
      </span>
    </summary>
    <div data-slot="trace-collapsible-content" class=\${cn(traceCollapsibleContentClass(), 'whitespace-pre-wrap')}>
      \${text}
    </div>
  </details>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Duration')}
    <p>Models do not time their reasoning. Measure it on the server, send it along with the message, and show it in a trace description after the title.</p>
    ${await componentPreview('reasoning-duration', RHEA)}
    ${codeFigure(`<span data-slot="trace-line" class=\${traceLineClass()}>
  <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
    \${CircleCheckIcon()}
  </span>
  <span data-slot="trace-title" class=\${traceTitleClass()}>Thought</span>
  <span data-slot="trace-description" class=\${traceDescriptionClass()}>\${seconds}s</span>
</span>`, { lineNumbers: true })}

    ${heading(toc, 2, 'AI SDK')}
    <p>Render each <code>reasoning</code> part as a line. It starts as a plain trace line and becomes a trace collapsible once text arrives, so there is nothing to open before the model has written anything. It is open while the model thinks and renders closed once it finishes. Because the row is a native <code>&lt;details&gt;</code>, a person who opens or closes it keeps their choice until the component renders that row again. See <a href="/ui/docs/components/trace#open-state">Open State</a>, and <a href="/ui/docs/helpers/ai-sdk">AI SDK</a> for streaming the parts from a server action.</p>
    ${codeFigure(`function reasoningLine(text: string, running: boolean) {
  const line = html\`<span data-slot="trace-line" data-status=\${running ? 'running' : nothing} class=\${traceLineClass()}>
    <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
      \${running ? LoaderCircleIcon('animate-spin') : CircleCheckIcon()}
    </span>
    <span data-slot="trace-title" class=\${traceTitleClass()}>\${running ? 'Thinking' : 'Thought'}</span>
  </span>\`;

  if (text.length === 0) return line;

  return html\`<details data-slot="trace-collapsible" ?open=\${running} class=\${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
    <summary data-slot="trace-collapsible-trigger" class=\${traceCollapsibleTriggerClass()}>\${line}</summary>
    <div data-slot="trace-collapsible-content" class=\${cn(traceCollapsibleContentClass(), 'whitespace-pre-wrap')}>\${text}</div>
  </details>\`;
}`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="trace" class=\${traceClass()}>
  \${message.parts
    .filter((part) => part.type === 'reasoning')
    .map((part) => reasoningLine(part.text, streaming && part.state === 'streaming'))}
</div>`, { lineNumbers: true })}
    <p>Some models send several reasoning parts in one message. Each one is a line in the same trace.</p>

    ${migrating(toc, {
      name: 'Reasoning',
      file: 'reasoning.tsx',
      parts: [
        ['Reasoning', html`A trace with a trace collapsible. Open it while the reply streams, as <code>?open=\${running}</code> above does.`],
        ['ReasoningTrigger', html`The collapsible's <code>&lt;summary&gt;</code>, holding a trace line with an icon and a title. Set <code>data-status="running"</code> while it streams, in place of the Shimmer; the title reads "Thinking", then the duration, like "Thought for 5s".`],
        ['ReasoningContent', html`The trace collapsible content, holding the text.`],
      ],
    })}

    ${heading(toc, 2, 'API Reference')}
    <p>See <a href="/ui/docs/components/trace#api-reference">Trace</a>.</p>
  `;
}
