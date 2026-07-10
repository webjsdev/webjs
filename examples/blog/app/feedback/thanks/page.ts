import { html } from '@webjsdev/core';

export const metadata = { title: 'Thanks - WebJs Blog' };

// PRG target for a successful /feedback submission (#244 e2e fixture).
export default function ThanksPage() {
  return html`
    <div class="max-w-[460px] mt-6 mx-auto">
      <h1 id="thanks" class="font-serif text-2xl font-bold">Thanks for your feedback.</h1>
    </div>
  `;
}
