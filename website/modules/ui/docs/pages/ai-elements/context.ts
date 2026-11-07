import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating } from './shared.ts';

/**
 * Context, ported from shadcn's content/docs/ai-elements/radix/context.mdx
 * (#1666). The hover card is the kit's <ui-hover-card>.
 */
export const title = 'Context';
export const description = 'How much of the context window the conversation has used.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('context-demo', RHEA)}
    <p>Context shows how much of the model's context window the conversation has used. It is a <a href="/ui/docs/components/hover-card">Hover Card</a> with a <a href="/ui/docs/components/progress">Progress</a> bar.</p>

    ${await installation(toc, {
      prose: html`Context is built with the <a href="/ui/docs/components/hover-card">Hover Card</a> and <a href="/ui/docs/components/progress">Progress</a> components.`,
      add: 'hover-card progress',
      source: 'hover-card',
      dependencies: ['hover-card', 'progress'],
    })}

    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`<ui-hover-card open-delay="10" close-delay="100">
  <ui-hover-card-trigger>
    <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=\${buttonClass({ variant: 'outline', size: 'sm' })}>
      \${percent}% context
    </button>
  </ui-hover-card-trigger>
  <ui-hover-card-content class="flex w-64 flex-col gap-3">
    <div class="flex items-center justify-between gap-3 text-sm">
      <span data-slot="hover-card-title" class="font-medium">Context</span>
      <span class="text-muted-foreground">\${used} / \${limit}</span>
    </div>
    <progress data-slot="progress" value=\${percent} max="100" aria-label="Context used" class=\${progressClass()}></progress>
  </ui-hover-card-content>
</ui-hover-card>`, { lineNumbers: true })}
    <p>The class on <code>&lt;ui-hover-card-content&gt;</code> lands on the card panel.</p>

    ${heading(toc, 2, 'AI SDK')}
    <p>Read usage from the metadata on the agent's message. In the <code>'use server'</code> action that streams the reply, <code>messageMetadata</code> runs when the stream finishes.</p>
    ${codeFigure(`'use server';
import { streamText } from 'ai';

export async function* chat(messages: ModelMessage[]) {
  const result = streamText({ model, messages });
  yield* result.toUIMessageStream({
    messageMetadata: ({ part }) => {
      if (part.type === 'finish') return { usage: part.totalUsage };
    },
  });
}`, { title: 'modules/chat/actions/chat.server.ts', lineNumbers: true })}
    ${codeFigure(`const usage = message.metadata?.usage;
const used = (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);
const percent = Math.round((used / limit) * 100);`, { lineNumbers: true })}
    <p><code>limit</code> is the model's context window. The AI SDK does not send it, so set it from the model you use. See <a href="/ui/docs/helpers/ai-sdk">AI SDK</a> for streaming the parts to a component.</p>

    ${migrating(toc, {
      name: 'Context',
      file: 'context.tsx',
      parts: [
        ['Context', html`A <code>&lt;ui-hover-card open-delay close-delay&gt;</code>. Keep the used and max tokens, the usage and the model id in your component.`],
        ['ContextTrigger', html`A <code>&lt;ui-hover-card-trigger&gt;</code> holding a button with <code>buttonClass({ variant: 'outline', size: 'sm' })</code>, showing the percent used.`],
        ['ContextContent', html`A <code>&lt;ui-hover-card-content&gt;</code>.`],
        ['ContextContentHeader', html`The used and max tokens, and a <code>&lt;progress&gt;</code> with <code>progressClass()</code> and <code>aria-label="Context used"</code>.`],
        ['ContextContentBody, ContextContentFooter and the usage parts', html`Plain rows inside the card, as the demo's Input, Output and Reasoning rows.`],
      ],
    })}
  `;
}
