import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { textareaClass } from '#modules/ui/components/textarea.ts';

export default function TextareaButton() {
  return html`
    <div class="grid w-full gap-2">
      <textarea data-slot="textarea" placeholder="Type your message here." aria-label="Message" class=${textareaClass()}></textarea>
      <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Send message</button>
    </div>
  `;
}
