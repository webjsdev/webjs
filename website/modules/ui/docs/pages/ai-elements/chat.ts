import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { installation, migrating } from './shared.ts';

/**
 * Chat, ported from shadcn's content/docs/ai-elements/radix/chat.mdx (#1666).
 * shadcn's demo streams a scripted chat through useChat; the demo here is
 * the thread once every scripted turn has been sent, on the kit's
 * <ui-message-scroller>, so the scrolling is live.
 */
export const title = 'Chat';
export const description = 'The thread. Message Scroller keeps your place while the reply streams.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('chat-demo', {
      style: 'rhea',
      className: 'rounded-[34px] sm:rounded-4xl',
      previewClass: 'h-auto theme-blue p-4 min-[480px]:p-8 min-[560px]:p-10 sm:px-10 sm:pt-16 sm:pb-8',
    })}
    <p>Chat is the thread of a conversation with the agent. Each turn is a <a href="/ui/docs/ai-elements/message">Message</a> inside <a href="/ui/docs/components/message-scroller">Message Scroller</a>. The person's message is the scroll anchor, so a new question settles near the top and the reply streams in under it. The field is a <a href="/ui/docs/ai-elements/prompt-input">Prompt Input</a>.</p>

    ${await installation(toc, {
      prose: html`Chat is built with the <a href="/ui/docs/components/message-scroller">Message Scroller</a>, <a href="/ui/docs/components/message">Message</a>, <a href="/ui/docs/components/bubble">Bubble</a>, and <a href="/ui/docs/components/input-group">Input Group</a> components.`,
      add: 'message-scroller message bubble input-group',
      source: 'message-scroller',
      dependencies: ['message-scroller', 'message', 'bubble', 'input-group'],
    })}

    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`<ui-message-scroller auto-scroll>
  <ui-message-scroller-viewport>
    <ui-message-scroller-content aria-label="Conversation">
      <ui-message-scroller-item message-id=\${id} scroll-anchor>
        <div data-slot="message" data-align="end" class=\${messageClass()}>
          <div data-slot="message-content" class=\${messageContentClass()}>
            <div data-slot="bubble" data-variant="muted" data-align="end" class=\${bubbleClass({ variant: 'muted' })}>
              <div data-slot="bubble-content" class=\${bubbleContentClass()}>\${text}</div>
            </div>
          </div>
        </div>
      </ui-message-scroller-item>
    </ui-message-scroller-content>
  </ui-message-scroller-viewport>
  <ui-message-scroller-button></ui-message-scroller-button>
</ui-message-scroller>`, { lineNumbers: true })}
    <p><code>scroll-anchor</code> goes on the person's turn. <code>auto-scroll</code> follows the reply while the person stays at the live edge.</p>
    <p>See <a href="/ui/docs/components/message-scroller">Message Scroller</a>.</p>

    ${heading(toc, 2, 'AI SDK Helper')}
    <p>To build without a model, script the conversation in a <code>'use server'</code> action that streams each turn as parts: reasoning, a tool call and a reply. Your chat component appends the parts as they arrive and renders them in the thread. See <a href="/ui/docs/helpers/ai-sdk">AI SDK</a>.</p>
    ${codeFigure(`'use server';

export async function* scriptedReply(question: string) {
  yield { type: 'reasoning', text: 'I need to know how themes are set up first.' };
  yield { type: 'tool-runCommand', input: { command: 'rg -l ThemeProvider app' }, output: { stdout: 'app/layout.tsx' } };
  yield { type: 'text', text: 'next-themes is already set up, so I added a ModeToggle.' };
}`, { lineNumbers: true })}
    ${codeFigure(`for await (const part of await scriptedReply(question)) {
  this.parts.set([...this.parts.get(), part]);
}`, { lineNumbers: true })}

    ${migrating(toc, {
      name: 'Conversation',
      file: 'conversation.tsx',
      parts: [
        ['Conversation', html`<code>&lt;ui-message-scroller auto-scroll&gt;</code>, in place of StickToBottom.`],
        ['ConversationContent', html`<code>&lt;ui-message-scroller-viewport&gt;</code> around <code>&lt;ui-message-scroller-content&gt;</code>.`],
        ['ConversationScrollButton', html`<code>&lt;ui-message-scroller-button&gt;</code>.`],
        ['ConversationEmptyState', html`An <a href="/ui/docs/components/empty">Empty</a> in place of the scroller while there are no messages.`],
        ['each message', html`A <code>&lt;ui-message-scroller-item&gt;</code> with its <code>message-id</code>, and <code>scroll-anchor</code> on the person's messages.`],
      ],
    })}
  `;
}
