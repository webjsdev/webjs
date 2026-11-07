/**
 * The preview-03 group chat card: several people planning a dinner, with
 * join, leave and typing notices between their messages, and an assistant
 * the group calls with `@chat,`. Your own messages sit at the end in a
 * tinted bubble; everyone else's carry their name. A fragment helper,
 * rendered by the server; `<preview-03-chat>` plays the turns, one message
 * each, and the notices on their own timing.
 *
 * Installed by `npx @webjsdev/ui add preview-03` at
 * `components/preview-03/group-chat.ts`. Ported from shadcn/ui's preview-03,
 * whose script it keeps except that its em-dashes are written as commas.
 */
import { html } from '@webjsdev/core';
import { messageHeaderClass } from '../../../components/message.ts';
import { chatCard, chatItem, chatMarker, chatMessage, type ChatPrompt } from '../components/chat-card.ts';
import { partText } from '../components/part-text.ts';

interface GroupMessage {
  /** Absent for your own messages. */
  name?: string;
  text: string;
}

const MESSAGES: GroupMessage[] = [
  { text: 'Hey everyone, dinner this Saturday? I was thinking something casual at my place.' },
  { name: 'Stella', text: "I'm in! Should we do potluck or does someone want to cook the whole thing?" },
  { name: 'Marcus', text: 'Potluck sounds good. I can handle appetizers and drinks.' },
  { text: 'Alright! Aleena?' },
  { name: 'Aleena', text: "Can't make it. I'm out of town. 😭" },
  { name: 'Aleena', text: "Sorry guys, let's catch up another time. Bye." },
  { text: '@chat, can you suggest a menu and split up what each of us should bring?' },
];

const REPLY = `Here's a simple **Saturday potluck** for the three of you:

**Who brings what**
- **You:** main, salmon or mushroom risotto
- **Stella:** salad + bread
- **Marcus:** appetizers + drinks
- **Chat:** dessert ideas below

**Menu**
- **Starter:** caprese skewers or whipped ricotta crostini
- **Main:** lemon-herb salmon with roasted asparagus *(or risotto for vegetarians)*
- **Side:** arugula salad with shaved parmesan
- **Dessert:** berry crisp or pistachio gelato

**Timing:** aim for **6:30 PM** so Marcus can set up apps while you finish the main.

Want me to scale this for **6 guests** or swap the main for something vegetarian-only?`;

/** The notices, each shown after message `turn`, `delay` milliseconds after it. */
const EVENTS: Array<{ type: 'user-joined' | 'user-left' | 'user-typing'; name: string; turn: number; delay: number }> = [
  { type: 'user-joined', name: 'Stella', turn: 0, delay: 2000 },
  { type: 'user-typing', name: 'Stella', turn: 0, delay: 4000 },
  { type: 'user-joined', name: 'Marcus', turn: 1, delay: 2000 },
  { type: 'user-typing', name: 'Marcus', turn: 1, delay: 4000 },
  { type: 'user-joined', name: 'Aleena', turn: 2, delay: 0 },
  { type: 'user-typing', name: 'Aleena', turn: 3, delay: 0 },
  { type: 'user-left', name: 'Aleena', turn: 5, delay: 2000 },
];

function eventText(e: (typeof EVENTS)[number]): string {
  if (e.type === 'user-joined') return `${e.name} joined the chat`;
  if (e.type === 'user-left') return `${e.name} left the chat`;
  return `${e.name} is typing...`;
}

export function groupChat() {
  const prompts: ChatPrompt[] = MESSAGES.map((m) => ({ text: m.text, sender: m.name ?? 'You' }));
  const transcript = MESSAGES.map((m, turn) => {
    const own = m.name === undefined;
    const message = chatItem({
      turn, kind: 'user', id: `group-${turn}`, anchor: m.text.trim().toLowerCase().startsWith('@chat,'),
      content: chatMessage({
        role: 'user',
        align: own ? 'end' : 'start',
        header: own ? '' : html`<div data-slot="message-header" class=${messageHeaderClass()}>${m.name}</div>`,
        content: partText({ text: m.text, variant: 'bubble', tinted: own }),
      }),
    });
    const events = EVENTS.filter((e) => e.turn === turn).map((e) => chatItem({
      turn,
      kind: e.type === 'user-typing' ? 'typing' : 'event',
      name: e.name,
      delay: e.delay,
      content: chatMarker({ text: eventText(e), variant: e.type === 'user-typing' ? 'default' : 'separator', status: e.type === 'user-typing' }),
    }));
    const reply = turn === MESSAGES.length - 1
      ? chatItem({
        turn, kind: 'reply', id: 'group-reply', delay: 1000,
        content: chatMessage({
          role: 'assistant',
          align: 'start',
          header: html`<div data-slot="message-header" class=${messageHeaderClass()}>Chat</div>`,
          content: partText({ text: REPLY, variant: 'default' }),
        }),
      })
      : '';
    return html`${message}${events}${reply}`;
  });

  return chatCard({
    id: 'group-chat-prompt',
    caption: 'Group Chat',
    title: 'Saturday dinner plans',
    description: 'A group chat with multiple users. Includes tinted bubbles for user messages.',
    descriptionClass: 'leading-relaxed',
    prompts,
    transcript,
    footerClass: 'flex-col items-stretch gap-2',
    footerTop: html`<p class="px-1 text-xs text-muted-foreground">Posting as <span data-chat-sender>You</span>.</p>`,
  });
}
