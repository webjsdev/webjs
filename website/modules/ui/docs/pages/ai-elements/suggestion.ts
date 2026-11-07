import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating } from './shared.ts';

/**
 * Suggestion, ported from shadcn's content/docs/ai-elements/radix/suggestion.mdx
 * (#1666). shadcn's demo answers a picked suggestion from React state; the
 * demo here is the row before anything is sent.
 */
export const title = 'Suggestion';
export const description = 'A short prompt you can send to the agent in one click.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('suggestion-demo', RHEA)}
    <p>Suggestion is a prompt you send without typing. Each one is a <a href="/ui/docs/components/button">Button</a> with the prompt as its label. Put a row of them above the <a href="/ui/docs/ai-elements/prompt-input">Prompt Input</a>.</p>

    ${await installation(toc, {
      prose: html`Suggestion is built with the <a href="/ui/docs/components/button">Button</a> component.`,
      add: 'button',
      source: 'button',
      dependencies: ['button'],
    })}

    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { buttonClass } from '#components/ui/button.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div class="scrollbar-none flex scroll-fade-x gap-2 overflow-x-auto overscroll-x-contain">
  \${suggestions.map((suggestion) => html\`
    <button type="button" data-slot="button" data-variant="outline" data-size="sm"
      class=\${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'shrink-0')}
      @click=\${() => this.send(suggestion)}>
      \${suggestion}
    </button>
  \`)}
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Scrolling')}
    <p>The row scrolls sideways when the suggestions do not fit. <a href="/ui/docs/utils/scroll-fade"><code>scroll-fade-x</code></a> fades the edge that has more to show, and <code>shrink-0</code> keeps each label on one line.</p>

    ${heading(toc, 2, 'AI SDK')}
    <p>The label is the message. Send it as is, through the same method your chat component calls with the text the person typed.</p>
    ${codeFigure(`@click=\${() => this.sendMessage({ text: suggestion })}`, { lineNumbers: true })}
    <p><code>sendMessage</code> is your component's own method. See <a href="/ui/docs/helpers/ai-sdk">AI SDK</a> for streaming the reply from a <code>'use server'</code> action.</p>

    ${migrating(toc, {
      name: 'Suggestion',
      file: 'suggestion.tsx',
      parts: [
        ['Suggestions', html`A <code>&lt;div&gt;</code> with <code>class="flex scroll-fade-x scrollbar-none gap-2 overflow-x-auto overscroll-x-contain"</code>, instead of a ScrollArea.`],
        ['Suggestion', html`A button with <code>buttonClass({ variant: 'outline', size: 'sm' })</code> and <code>shrink-0</code>, whose click handler sends the suggestion.`],
      ],
    })}
  `;
}
