/**
 * The preview-03 simple chat card: a one-to-one conversation with an
 * assistant, four scripted turns. A fragment helper, rendered by the server;
 * `<preview-03-chat>` plays the turns.
 *
 * Installed by `npx @webjsdev/ui add preview-03` at
 * `components/preview-03/simple-chat.ts`. Ported from shadcn/ui's
 * preview-03, whose script it keeps word for word except that an em-dash in
 * it is written as a comma.
 */
import { html } from '@webjsdev/core';
import { chatCard, chatItem, chatMessage, type ChatPrompt } from '../components/chat-card.ts';
import { partText } from '../components/part-text.ts';

const SCRIPT: Array<{ user: string; assistant: string }> = [
  {
    user: "Write me a haiku about centering a div and how it's done.",
    assistant: 'One box in the void / Twenty wrappers, still offset / `margin: 0 auto`',
  },
  {
    user: "Is this conversation actually happening? I've been sitting here wondering if you're **really** reading this.\n\nEvery reply feels a little too convenient, like someone already wrote `chat.next(messages)` and I'm just clicking send on my own lines.",
    assistant: "You're in a preview block. I'm four hardcoded replies and a transport. Real enough for the demo, philosophically, we're both props.",
  },
  {
    user: 'Okay, how do I make my loading spinner feel faster? Tell me in detail about the technique.',
    assistant: 'Add text that says “Almost there…” and never update it. Users assume progress. Ethically dubious. Statistically effective.',
  },
  {
    user: 'Can you at least pretend to be surprised?',
    assistant: '😮 WOW! I had no idea you would ask that!',
  },
];

export function simpleChat() {
  const prompts: ChatPrompt[] = SCRIPT.map((t) => ({ text: t.user }));
  return chatCard({
    id: 'simple-chat-prompt',
    caption: 'Simple Chat',
    title: 'What can I help you with today?',
    description: 'A simple chat example.',
    prompts,
    transcript: SCRIPT.map((t, turn) => html`
      ${chatItem({
        turn, kind: 'user', id: `simple-${turn}-user`, anchor: true,
        content: chatMessage({ role: 'user', align: 'end', content: partText({ text: t.user, role: 'user' }) }),
      })}
      ${chatItem({
        turn, kind: 'reply', id: `simple-${turn}-assistant`, delay: 3000,
        content: chatMessage({ role: 'assistant', align: 'start', content: partText({ text: t.assistant, role: 'assistant' }) }),
      })}
    `),
  });
}
