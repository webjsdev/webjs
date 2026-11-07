import { html } from '@webjsdev/core';
import { textareaClass } from '#modules/ui/components/textarea.ts';

export default function TextareaDemo() {
  return html`
    <textarea data-slot="textarea" placeholder="Type your message here." aria-label="Message" class=${textareaClass()}></textarea>
  `;
}
