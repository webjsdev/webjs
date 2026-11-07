import { html } from '@webjsdev/core';
import {
  codeBlockClass, codeBlockHeaderClass, codeBlockTitleClass, codeBlockActionsClass,
  codeBlockContentClass, codeBlockCodeClass, codeBlockLines,
} from '#modules/ui/components/code-block.ts';

const files = [
  {
    id: 'route',
    title: 'app/api/chat/route.ts',
    code: `import { streamText } from "ai"

export async function POST(request: Request) {
  const { messages } = await request.json()
  const result = streamText({ model: "anthropic/claude-sonnet-4.5", messages })

  return result.toUIMessageStreamResponse()
}`,
  },
  {
    id: 'chat',
    title: 'components/chat.tsx',
    code: `"use client"

import { useChat } from "@ai-sdk/react"

export function Chat() {
  const { messages } = useChat()

  return <MessageList messages={messages} />
}`,
  },
  {
    id: 'env',
    title: '.env.local',
    code: 'AI_GATEWAY_API_KEY=your-api-key',
  },
];

export default function CodeBlockTabs() {
  return html`
    <ui-tabs value="route" class="w-full max-w-md">
      <ui-tabs-list>
        ${files.map((file) => html`
          <ui-tabs-trigger value=${file.id}>${file.title.split('/').at(-1)}</ui-tabs-trigger>
        `)}
      </ui-tabs-list>
      ${files.map((file) => html`
        <ui-tabs-content value=${file.id}>
          <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
            <div data-slot="code-block-header" class=${codeBlockHeaderClass()}>
              <div data-slot="code-block-title" class=${codeBlockTitleClass()}>${file.title}</div>
              <div data-slot="code-block-actions" class=${codeBlockActionsClass()}>
                <ui-code-block-copy-button value=${file.code}></ui-code-block-copy-button>
              </div>
            </div>
            <pre data-slot="code-block-content" data-numbered tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${codeBlockLines(file.code)}</code></pre>
          </div>
        </ui-tabs-content>
      `)}
    </ui-tabs>
  `;
}
