import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating } from './shared.ts';

/**
 * Message, ported from shadcn's content/docs/ai-elements/radix/message.mdx
 * (#1666). shadcn's demo keeps the copied and feedback state in React; the
 * demo here is the turn before anyone presses an action.
 */
export const title = 'Message';
export const description = "One turn. The person's message, and the agent's reply with its actions.";

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('message-pattern', RHEA)}
    <p>Use Message for one turn in a thread. The person's text is a <a href="/ui/docs/components/bubble">Bubble</a> on a <a href="/ui/docs/components/message">Message</a> with <code>data-align="end"</code>. The agent's reply is markdown on a Message, with actions under it. A thread of these turns is <a href="/ui/docs/ai-elements/chat">Chat</a>.</p>

    ${await installation(toc, {
      prose: html`Message is built with the <a href="/ui/docs/components/message">Message</a>, <a href="/ui/docs/components/bubble">Bubble</a>, and <a href="/ui/docs/components/tooltip">Tooltip</a> components.`,
      add: 'message bubble tooltip',
      source: 'message',
      dependencies: ['message', 'bubble', 'tooltip'],
    })}

    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { bubbleClass, bubbleContentClass } from '#components/ui/bubble.ts';
import { buttonClass } from '#components/ui/button.ts';
import { messageClass, messageContentClass, messageFooterClass } from '#components/ui/message.ts';
import '#components/ui/tooltip.ts';
import { CopyIcon } from '#lib/utils/icons.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="message" data-align="end" class=\${messageClass()}>
  <div data-slot="message-content" class=\${messageContentClass()}>
    <div data-slot="bubble" data-variant="muted" data-align="end" class=\${bubbleClass({ variant: 'muted' })}>
      <div data-slot="bubble-content" class=\${bubbleContentClass()}>How do I add a settings dialog?</div>
    </div>
  </div>
</div>
<div data-slot="message" data-align="start" class=\${messageClass()}>
  <div data-slot="message-content" class=\${cn(messageContentClass(), 'gap-2')}>
    <p>Install Dialog, then open it from the gear button.</p>
    <div data-slot="message-footer" class=\${messageFooterClass()}>
      <button type="button" data-slot="button" data-variant="ghost" data-size="icon-sm" aria-label="Copy" class=\${buttonClass({ variant: 'ghost', size: 'icon-sm' })}>
        \${CopyIcon()}
      </button>
    </div>
  </div>
</div>`, { lineNumbers: true })}
    <p>See <a href="/ui/docs/components/message">Message</a>.</p>

    ${heading(toc, 2, 'Actions')}
    <p>Put actions in the message footer. It follows the message alignment, so on the person's turn the actions sit on the right. Use ghost icon buttons with a <code>&lt;ui-tooltip&gt;</code> for each, and give each button its own <code>aria-label</code>, since the tip describes the button rather than naming it.</p>
    <ul>
      <li><strong>Copy</strong> writes the reply to the clipboard and swaps to a check for two seconds. That is a click handler in a component of your own.</li>
      <li><strong>Good response</strong> and <strong>Bad response</strong> are toggles. Set <code>aria-pressed</code> so screen readers announce the state.</li>
      <li><strong>Retry</strong> runs the turn again.</li>
      <li><strong>Edit</strong> on the person's turn puts the text back in the field.</li>
    </ul>

    ${heading(toc, 2, 'Markdown')}
    <p>The reply streams as markdown. The kit does not parse Markdown, so render it with the Markdown library you already use and route fenced code to a <a href="/ui/docs/components/code-block#markdown">Code Block</a>, so code in the reply gets line numbers and a copy button.</p>

    ${heading(toc, 2, 'AI SDK')}
    <p>Branch on the message role. The person's turn is the bubble. The agent's turn is the reply, with a Retry button that asks your server to run the turn again. See <a href="/ui/docs/helpers/ai-sdk">AI SDK</a> for streaming the reply from a <code>'use server'</code> action.</p>
    ${codeFigure(`function turn(message: ChatMessage) {
  const text = message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('');

  if (message.role === 'user') {
    return html\`<div data-slot="message" data-align="end" class=\${messageClass()}>
      <div data-slot="message-content" class=\${messageContentClass()}>
        <div data-slot="bubble" data-variant="muted" data-align="end" class=\${bubbleClass({ variant: 'muted' })}>
          <div data-slot="bubble-content" class=\${bubbleContentClass()}>\${text}</div>
        </div>
      </div>
    </div>\`;
  }

  return html\`<div data-slot="message" data-align="start" class=\${messageClass()}>
    <div data-slot="message-content" class=\${cn(messageContentClass(), 'gap-2')}>
      \${markdown(text)}
      <div data-slot="message-footer" class=\${messageFooterClass()}>
        <button type="button" data-slot="button" data-variant="ghost" data-size="icon-sm" aria-label="Retry"
          class=\${buttonClass({ variant: 'ghost', size: 'icon-sm' })}
          @click=\${() => this.retry(message.id)}>
          \${RefreshCcwIcon()}
        </button>
      </div>
    </div>
  </div>\`;
}`, { lineNumbers: true })}
    <p>Call <code>turn</code> for each message in your chat component's <code>render()</code>. <code>markdown</code> stands for your Markdown renderer, and <code>retry</code> for a method that calls your action again for that message.</p>

    ${migrating(toc, {
      name: 'Message',
      file: 'message.tsx',
      parts: [
        ['Message', html`A message, with <code>data-align="end"</code> on the person's turn.`],
        ['MessageContent', html`The message content. On the person's turn it holds a bubble with <code>data-variant="muted"</code> and <code>data-align="end"</code>.`],
        ['MessageActions', html`The message footer.`],
        ['MessageAction', html`A ghost <code>icon-sm</code> button inside a <code>&lt;ui-tooltip&gt;</code>, with its label as the <code>aria-label</code> and the tip.`],
        ['MessageResponse', html`The reply, rendered by your Markdown library with fenced code routed to a Code Block.`],
        ['MessageBranch, MessageToolbar', html`No kit part. Keep them as markup of your own, laid out with the message footer.`],
      ],
    })}
  `;
}
