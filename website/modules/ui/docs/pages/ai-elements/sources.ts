import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating } from './shared.ts';

/**
 * Sources, ported from shadcn's content/docs/ai-elements/radix/sources.mdx
 * (#1666). shadcn's demo streams the reply through useChat. The demo here is
 * the settled conversation with the list open.
 */
export const title = 'Sources';
export const description = 'Displays the links the agent used for a reply.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('sources-demo', RHEA)}
    <p>Sources is a line that lists the links the agent used for a reply. It says how many there are, like "Used 3 sources", and opens into a link for each one.</p>
    <p>Sources is built with a trace, with a trace collapsible for the list.</p>

    ${await installation(toc, {
      prose: html`Sources is built with the <a href="/ui/docs/components/trace">Trace</a> component.`,
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
          \${GlobeIcon()}
        </span>
        <span data-slot="trace-title" class=\${traceTitleClass()}>Used \${sources.length} sources</span>
      </span>
      <span data-slot="trace-icon" aria-hidden="true" class=\${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>
        \${ChevronRightIcon()}
      </span>
    </summary>
    <div data-slot="trace-collapsible-content" class=\${traceCollapsibleContentClass()}>
      <div data-slot="trace" class=\${traceClass()}>
        \${sources.map((source) => html\`
          <a href=\${source.url} target="_blank" rel="noreferrer">
            <span data-slot="trace-line" class=\${traceLineClass()}>
              <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
                \${GlobeIcon()}
              </span>
              <span data-slot="trace-title" class=\${traceTitleClass()}>
                \${source.title ?? new URL(source.url).hostname}
                <span class="sr-only"> (opens in a new tab)</span>
              </span>
              <span data-slot="trace-icon" aria-hidden="true" class=\${traceIconClass()}>
                \${ArrowUpRightIcon()}
              </span>
            </span>
          </a>
        \`)}
      </div>
    </div>
  </details>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'AI SDK')}
    <p>Collect the <code>source-url</code> parts of a message and render them after the text. The agent can cite the same page more than once, so dedupe them by <code>url</code>.</p>
    ${codeFigure(`const sources = message.parts
  .filter((part) => part.type === 'source-url')
  .filter(
    (part, index, all) =>
      all.findIndex((other) => other.url === part.url) === index,
  );`, { lineNumbers: true })}
    <p><code>title</code> is optional on a <code>source-url</code> part. Fall back to the hostname of the URL. See <a href="/ui/docs/helpers/ai-sdk">AI SDK</a> for streaming the parts from a server action.</p>

    ${heading(toc, 2, 'Accessibility')}
    <p>Each source is a plain link inside the list.</p>
    <ul>
      <li>Links open in a new tab. Add <code>sr-only</code> text, like "(opens in a new tab)", so screen readers announce it.</li>
      <li>The arrow icon is decorative. The title is the name of the link.</li>
      <li>The count in the trigger, like "Used 3 sources", tells the person what opens before they open it.</li>
    </ul>

    ${migrating(toc, {
      name: 'Sources',
      file: 'sources.tsx',
      parts: [
        ['Sources', html`A trace with a trace collapsible.`],
        ['SourcesTrigger', html`The collapsible's <code>&lt;summary&gt;</code>, holding a trace line with a trace icon and a trace title that uses the count, like "Used 3 sources".`],
        ['SourcesContent', html`The trace collapsible content, holding a trace for the links.`],
        ['Source', html`A link that wraps a trace line, with a trace icon and a trace title for its title, and "(opens in a new tab)" in an <code>sr-only</code> span.`],
      ],
    })}

    ${heading(toc, 2, 'API Reference')}
    <p>See <a href="/ui/docs/components/trace#api-reference">Trace</a>.</p>
  `;
}
