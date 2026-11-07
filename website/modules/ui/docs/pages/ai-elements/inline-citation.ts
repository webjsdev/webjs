import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating } from './shared.ts';

/**
 * Inline Citation, ported from shadcn's
 * content/docs/ai-elements/radix/inline-citation.mdx (#1666). The hover card
 * is the kit's <ui-hover-card>, made inline-block so it sits in the sentence.
 */
export const title = 'Inline Citation';
export const description = 'A source in the sentence that opens on hover.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('inline-citation-demo', RHEA)}
    <p>Inline Citation is a source that sits in the sentence it supports. It is a <a href="/ui/docs/components/hover-card">Hover Card</a> on a <a href="/ui/docs/components/button">Button</a>.</p>
    <p>To show a list of sources after the reply, use <a href="/ui/docs/ai-elements/sources">Sources</a>.</p>

    ${await installation(toc, {
      prose: html`Inline Citation is built with the <a href="/ui/docs/components/hover-card">Hover Card</a> and <a href="/ui/docs/components/button">Button</a> components.`,
      add: 'hover-card button',
      source: 'hover-card',
      dependencies: ['hover-card', 'button'],
    })}

    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`<ui-hover-card open-delay="10" close-delay="100" class="inline-block">
  <ui-hover-card-trigger class="inline-block *:inline-block">
    <button type="button" data-slot="button" data-variant="secondary" data-size="xs" class=\${buttonClass({ variant: 'secondary', size: 'xs' })}>
      \${hostname}
    </button>
  </ui-hover-card-trigger>
  <ui-hover-card-content class="flex w-64 flex-col gap-1">
    <div data-slot="hover-card-title" class="font-medium">\${title}</div>
    <a href=\${url} target="_blank" rel="noreferrer">
      \${hostname}
      <span class="sr-only"> (opens in a new tab)</span>
    </a>
  </ui-hover-card-content>
</ui-hover-card>`, { lineNumbers: true })}
    <p>A light-DOM host renders as a block, so the card and its trigger take <code>inline-block</code> to stay in the line of text. Write the sentence in a <code>&lt;div&gt;</code> rather than a <code>&lt;p&gt;</code>, since the card holds block elements and the HTML parser closes a paragraph at the first one.</p>

    ${heading(toc, 2, 'AI SDK')}
    <p>A <code>source-url</code> part is the citation. Set <code>sendSources: true</code> on <code>toUIMessageStream()</code> in the <code>'use server'</code> action that streams the reply, or yield the part yourself.</p>
    ${codeFigure(`yield {
  type: 'source-url',
  sourceId: 'webjs-ui',
  url: 'https://webjs.dev/ui',
  title: 'WebJs UI',
};`, { title: 'modules/chat/actions/chat.server.ts', lineNumbers: true })}
    ${codeFigure(`const sources = message.parts.filter((part) => part.type === 'source-url');`, { lineNumbers: true })}
    <p><code>title</code> is optional. Fall back to the URL's hostname. See <a href="/ui/docs/helpers/ai-sdk">AI SDK</a> for streaming the parts to a component.</p>

    ${migrating(toc, {
      name: 'Inline Citation',
      file: 'inline-citation.tsx',
      parts: [
        ['InlineCitationCard', html`A <code>&lt;ui-hover-card open-delay="10" close-delay="100"&gt;</code>.`],
        ['InlineCitationCardTrigger', html`A <code>&lt;ui-hover-card-trigger&gt;</code> holding a button with <code>buttonClass({ variant: 'secondary', size: 'xs' })</code> in place of a Badge, so it can take keyboard focus.`],
        ['InlineCitationCardBody', html`A <code>&lt;ui-hover-card-content&gt;</code>.`],
        ['InlineCitationSource', html`The title and a link to the URL that opens in a new tab, with "(opens in a new tab)" in an <code>sr-only</code> span.`],
        ['InlineCitation, InlineCitationText, InlineCitationQuote', html`Plain inline markup around the cited text, as they are.`],
        ['The carousel parts', html`The kit's <a href="/ui/docs/components/carousel">Carousel</a> inside the card, for several sources in one place.`],
      ],
    })}
  `;
}
