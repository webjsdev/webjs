/**
 * The preview-03 reasoning chat card: an assistant whose replies show their
 * reasoning steps above the answer, across two scripted turns. A fragment
 * helper, rendered by the server; `<preview-03-chat>` plays the turns.
 *
 * Installed by `npx @webjsdev/ui add preview-03` at
 * `components/preview-03/reasoning-chat.ts`. Ported from shadcn/ui's
 * preview-03, whose script it keeps except that an em-dash is written as a
 * comma.
 */
import { html } from '@webjsdev/core';
import { chatCard, chatItem, chatMessage, type ChatPrompt } from '../components/chat-card.ts';
import { getReasoningLevelLabel, partReasoning } from '../components/part-reasoning.ts';
import { partText } from '../components/part-text.ts';

const SCRIPT: Array<{ user: string; reasoning: string[]; text: string }> = [
  {
    user: 'Explain why the dashboard feels slow even though the API is fast.',
    reasoning: [
      `The user is separating perceived performance from backend latency. They likely measured API response times and found them acceptable, but users still complain about slowness.

I should avoid jumping straight to server-side optimizations and instead frame the answer around what people actually experience.`,
      `Perceived slowness usually lives in the gap between user action and visible feedback:

- input latency before the request fires
- loading state placement and timing
- layout shifts when data arrives
- whether optimistic UI gives immediate acknowledgment

For a dashboard, I should also consider chart re-renders, independent card fetches, and skeleton dimensions that do not match the final layout.`,
      `Ranking likely bottlenecks for this scenario:

1. No immediate feedback on filter or refresh actions
2. Skeleton cards that collapse or expand when data lands
3. Waterfall requests where each widget fetches on its own
4. Empty-state flashes because stale data is not shown while revalidating

The answer should stay practical and ordered by impact, not by how technical each fix sounds.`,
    ],
    text: `The API can be fast while the interface still **feels** slow.

Start by checking:

- whether the button gives immediate feedback
- whether skeletons match the final layout
- whether any reflow happens after data arrives
- whether the loading state appears near the content it replaces`,
  },
  {
    user: 'What should I fix first?',
    reasoning: [
      `The user wants prioritization, not another diagnostic list.

Given the dashboard context, immediate feedback and layout stability usually beat micro-optimizations. I should recommend one fix with a clear way to measure success.`,
    ],
    text: `Fix **immediate feedback** first.

When someone clicks "Refresh", the button should disable and show a spinner within one frame, before the network round trip. That single change often cuts perceived latency in half.

Measure it with a screen recording and count frames between click and visual response.`,
  },
];

export function reasoningChat() {
  const prompts: ChatPrompt[] = SCRIPT.map((t) => ({ text: t.user }));
  return chatCard({
    id: 'reasoning-chat-prompt',
    caption: 'Reasoning',
    title: 'Reasoning trace',
    description: 'Layered reasoning traces across multiple assistant turns.',
    prompts,
    transcript: SCRIPT.map((t, turn) => html`
      ${chatItem({
        turn, kind: 'user', id: `reasoning-${turn}-user`, anchor: true,
        content: chatMessage({ role: 'user', align: 'end', contentClass: 'flex-col items-end gap-2', content: partText({ text: t.user, variant: 'bubble' }) }),
      })}
      ${chatItem({
        turn, kind: 'reply', id: `reasoning-${turn}-assistant`, delay: 1000,
        content: chatMessage({
          role: 'assistant',
          align: 'start',
          contentClass: 'flex-col items-start gap-2',
          content: html`${t.reasoning.map((r, i) => partReasoning({ text: r, label: getReasoningLevelLabel(i) }))}${partText({ text: t.text, variant: 'default' })}`,
        }),
      })}
    `),
  });
}
