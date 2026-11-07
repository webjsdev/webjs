import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating, table } from './shared.ts';

/**
 * Chain of Thought, ported from shadcn's
 * content/docs/ai-elements/radix/chain-of-thought.mdx (#1666). shadcn's demo
 * streams a scripted chat through useChat. The demo here is the settled
 * conversation, and the open state of each row is the native details
 * element's own.
 */
export const title = 'Chain of Thought';
export const description = 'Displays a summary that expands into the steps an agent took.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('chain-of-thought-demo', RHEA)}
    <p>Chain of Thought is a summary line that expands into the steps an agent took. The summary says what happened, like "Researched in 3 steps". The steps sit inside it, each one a line of its own.</p>
    <p>Chain of Thought is built with a trace, with a trace collapsible for the summary.</p>

    ${await installation(toc, {
      prose: html`Chain of Thought is built with the <a href="/ui/docs/components/trace">Trace</a>, <a href="/ui/docs/components/code-block">Code Block</a> and <a href="/ui/docs/components/badge">Badge</a> components.`,
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
  <details data-slot="trace-collapsible" open class=\${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
    <summary data-slot="trace-collapsible-trigger" class=\${traceCollapsibleTriggerClass()}>
      <span data-slot="trace-line" class=\${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
          \${CircleCheckIcon()}
        </span>
        <span data-slot="trace-title" class=\${traceTitleClass()}>Researched in 3 steps</span>
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
          <span data-slot="trace-title" class=\${traceTitleClass()}>Read the build log for dpl_8Kx2</span>
        </span>
        <span data-slot="trace-line" class=\${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
            \${CircleCheckIcon()}
          </span>
          <span data-slot="trace-title" class=\${traceTitleClass()}>Searched the web for next.js image cache key</span>
        </span>
        <span data-slot="trace-line" class=\${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
            \${CircleCheckIcon()}
          </span>
          <span data-slot="trace-title" class=\${traceTitleClass()}>Searched the code for cacheKey</span>
        </span>
      </div>
    </div>
  </details>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Steps')}
    <p>Each step is a trace line. Set its <code>data-status</code> and write the title in the matching tense.</p>
    ${table(['Step', 'data-status', 'Title'], [
      ['Running', html`<code>"running"</code>`, 'Searching for …'],
      ['Done, with detail', 'none', 'Searched for …'],
      ['Done, links out', 'none', 'Read the Image component docs'],
      ['Failed', html`<code>"error"</code>`, 'Failed to search for …'],
    ])}

    ${heading(toc, 2, 'Search Results')}
    <p>When a step runs a web search, show the results as a badge for each hostname in the step's content.</p>
    ${codeFigure(`<div data-slot="trace-collapsible-content" class=\${cn(traceCollapsibleContentClass(), 'flex flex-wrap gap-1.5')}>
  \${results.map((result) => html\`
    <span data-slot="badge" data-variant="secondary" class=\${badgeClass({ variant: 'secondary' })}>
      \${new URL(result.url).hostname}
    </span>
  \`)}
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'AI SDK')}
    <p>Render each tool part as a step. <code>running</code> is true while tool parts stream and before the reply starts. Set the summary's status and title from the steps. The summary renders open while the steps run, as in <a href="/ui/docs/components/trace#open-state">Trace</a>. Because it is a native <code>&lt;details&gt;</code>, a person who opens or closes it keeps their choice until the component renders that row again. See <a href="/ui/docs/helpers/ai-sdk">AI SDK</a> for streaming the parts from a server action.</p>
    ${codeFigure(`const running = streaming && !answering;
const failed = steps.filter((part) => part.state === 'output-error').length;
const status = running ? 'running' : failed > 0 ? 'error' : null;

html\`<details data-slot="trace-collapsible" ?open=\${running} class=\${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
  <summary data-slot="trace-collapsible-trigger" class=\${traceCollapsibleTriggerClass()}>
    <span data-slot="trace-line" data-status=\${status} class=\${traceLineClass()}>
      <span data-slot="trace-title" class=\${traceTitleClass()}>
        \${running ? 'Researching' : \`Researched in \${steps.length} steps\`}
      </span>
    </span>
  </summary>
  <div data-slot="trace-collapsible-content" class=\${traceCollapsibleContentClass()}>
    <div data-slot="trace" class=\${traceClass()}>
      \${steps.map((part) => stepLine(part, streaming))}
    </div>
  </div>
</details>\``, { lineNumbers: true })}
    <p><code>stepLine</code> renders one tool part as a trace line, as in <a href="/ui/docs/ai-elements/tool#states">Tool</a>.</p>

    ${migrating(toc, {
      name: 'ChainOfThought',
      file: 'chain-of-thought.tsx',
      parts: [
        ['ChainOfThought', html`A trace with a trace collapsible. Open it while the steps run, as <code>?open=\${running}</code> above does.`],
        ['ChainOfThoughtHeader', html`The collapsible's <code>&lt;summary&gt;</code>, holding a trace line with an icon and a title, like "Researched in 3 steps".`],
        ['ChainOfThoughtContent', html`The trace collapsible content, holding a trace for the steps.`],
        ['ChainOfThoughtStep', html`A trace line. Its icon goes in a trace icon, its label in a trace title and its description in a trace description. Status "active" becomes <code>data-status="running"</code>, "pending" becomes <code>data-status="pending"</code>, and "complete" has no status.`],
        ['ChainOfThoughtSearchResults', html`A <code>flex flex-wrap gap-1.5</code> container.`],
        ['ChainOfThoughtSearchResult', html`A badge with <code>badgeClass({ variant: 'secondary' })</code>.`],
        ['ChainOfThoughtImage', html`A plain <code>&lt;img&gt;</code> inside the step's content.`],
      ],
    })}

    ${heading(toc, 2, 'API Reference')}
    <p>See <a href="/ui/docs/components/trace#api-reference">Trace</a>.</p>
  `;
}
