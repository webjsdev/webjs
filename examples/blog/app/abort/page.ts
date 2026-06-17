import { html } from '@webjsdev/core';
import '#/components/abort-demo.ts';

export const metadata = {
  title: 'Abort demo · webjs blog',
  description: 'A superseded async-render fetch is aborted (#492).',
};

export default function Abort() {
  return html`<section class="mb-8"><h1 class="font-serif text-display font-bold m-0 mb-4">Abort demo</h1><abort-demo></abort-demo></section>`;
}
