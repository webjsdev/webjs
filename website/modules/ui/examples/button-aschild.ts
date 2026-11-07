import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

// shadcn's asChild renders the child element with the button's classes.
// A class helper does the same with no wrapper: put it on the link.
export default function ButtonAsChild() {
  return html`<a href="/login" data-slot="button" class=${buttonClass()}>Login</a>`;
}
