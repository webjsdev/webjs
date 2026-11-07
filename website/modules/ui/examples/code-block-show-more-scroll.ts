import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  codeBlockClass, codeBlockHeaderClass, codeBlockTitleClass, codeBlockActionsClass,
  codeBlockContentClass, codeBlockCodeClass, codeBlockFooterClass, codeBlockLines,
} from '#modules/ui/components/code-block.ts';
import { ChevronDownIcon } from '#lib/ui/lucide.ts';

const code = `"use client"

import * as React from "react"
import { useChat } from "@ai-sdk/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function Chat() {
  const [input, setInput] = React.useState("")
  const { messages, sendMessage, status } = useChat()

  return (
    <div className="flex flex-col gap-4">
      {messages.map((message) => (
        <div key={message.id}>
          {message.parts.map((part, index) =>
            part.type === "text" ? <p key={index}>{part.text}</p> : null
          )}
        </div>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          sendMessage({ text: input })
          setInput("")
        }}
      >
        <Input value={input} onChange={(event) => setInput(event.target.value)} />
        <Button disabled={status !== "ready"}>Send</Button>
      </form>
    </div>
  )
}`;

// Open, the cap rises from max-h-64 to max-h-96 and the content scrolls
// inside it, so a long file never takes over the page.
export default function CodeBlockShowMoreScroll() {
  return html`
    <div class="w-full max-w-md">
      <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
        <div data-slot="code-block-header" class=${codeBlockHeaderClass()}>
          <div data-slot="code-block-title" class=${codeBlockTitleClass()}>components/chat.tsx</div>
          <div data-slot="code-block-actions" class=${codeBlockActionsClass()}>
            <ui-code-block-copy-button value=${code}></ui-code-block-copy-button>
          </div>
        </div>
        <pre
          id="code-block-show-more-scroll"
          data-slot="code-block-content"
          data-numbered
          tabindex="0"
          dir="ltr"
          style="counter-reset: line 0"
          class=${cn(codeBlockContentClass(), 'max-h-64 scroll-fade-y overflow-y-hidden group-has-[details[open]]/code-block:max-h-96 group-has-[details[open]]/code-block:overflow-y-auto')}
        ><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${codeBlockLines(code)}</code></pre>
        <div data-slot="code-block-footer" class=${cn(codeBlockFooterClass(), 'justify-center')}>
          <details class="group/show-more">
            <summary
              aria-controls="code-block-show-more-scroll"
              data-slot="button"
              data-variant="ghost"
              data-size="xs"
              class=${cn(buttonClass({ variant: 'ghost', size: 'xs' }), 'list-none [&::-webkit-details-marker]:hidden')}
            >
              ${ChevronDownIcon('transition-transform group-open/show-more:rotate-180')}
              <span class="group-open/show-more:hidden">Show more</span>
              <span class="hidden group-open/show-more:inline">Show less</span>
            </summary>
          </details>
        </div>
      </div>
    </div>
  `;
}
