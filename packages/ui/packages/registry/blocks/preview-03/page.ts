/**
 * The preview-03 block's page: four AI chat cards side by side, a simple
 * chat, a group chat, a reasoning trace and a file review, each a scripted
 * conversation you can step through with the send button.
 *
 * Installed by `npx @webjsdev/ui add preview-03` at `app/preview-03/page.ts`.
 * It is app code you own, so edit it freely, and point each card's prompt
 * input at your own chat endpoint. Ported from shadcn/ui's preview-03.
 */
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import { spinner } from '../../components/spinner.ts';
import { filesChat } from './cards/files-chat.ts';
import { groupChat } from './cards/group-chat.ts';
import { reasoningChat } from './cards/reasoning-chat.ts';
import { simpleChat } from './cards/simple-chat.ts';

export const metadata: Metadata = { title: 'Preview 03' };

const COLUMN = 'flex h-full min-h-0 flex-1 flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]';

export default function Preview03Page() {
  return html`
    <div class="flex h-screen min-h-0 flex-col overflow-x-auto overflow-y-hidden bg-muted contain-[paint] [--gap:--spacing(4)] 3xl:[--gap:--spacing(12)] md:[--gap:--spacing(10)] dark:bg-background style-lyra:md:[--gap:--spacing(6)] style-mira:md:[--gap:--spacing(6)]">
      <div class="flex min-h-0 w-full min-w-max flex-1 justify-center">
        <div
          class="grid min-h-0 w-[2400px] grid-cols-7 items-start gap-(--gap) bg-muted p-(--gap) md:w-[3000px] dark:bg-background style-lyra:md:w-[2600px] style-mira:md:w-[2600px] *:[div]:gap-(--gap)"
          data-slot="capture-target"
        >
          <div class=${COLUMN}>${simpleChat()}</div>
          <div class=${COLUMN}>${groupChat()}</div>
          <div class=${COLUMN}>${reasoningChat()}</div>
          <div class=${COLUMN}>${filesChat()}</div>
        </div>
      </div>
      <div class="sr-only">${spinner()}</div>
    </div>
  `;
}
