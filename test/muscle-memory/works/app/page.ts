// Next idiom: a page with static `metadata`, rendering the Lit-idiom components.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import '../components/lit-counter.ts';
import '../components/shadow-card.ts';
import '../components/light-root.ts';
import '../components/user-card.ts';
import '../components/theme-provider.ts';
import '../components/theme-label.ts';
import '../components/fruit-list.ts';
import '../components/shout-text.ts';
import '../components/click-tally.ts';

export const metadata: Metadata = { title: 'Muscle memory' };

export default function Home() {
  return html`
    <main>
      <lit-counter count="3" step="2"></lit-counter>
      <shadow-card heading="Card"><p>Slotted</p></shadow-card>
      <light-root></light-root>
      <user-card user-id="7"></user-card>
      <theme-provider theme="dark"><theme-label></theme-label></theme-provider>
      <fruit-list items='["apple","pear"]' mode="short"></fruit-list>
      <shout-text text="hello"></shout-text>
      <click-tally></click-tally>
    </main>
  `;
}
