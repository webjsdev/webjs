import { html } from '@webjsdev/core';
import '../components/typed.ts';
import '../components/plain.ts';
import '../components/badge.ts';

export default function Page() {
  return html`
    <typed-comp count="1"></typed-comp>
    <plain-comp></plain-comp>
    <display-badge></display-badge>
  `;
}
