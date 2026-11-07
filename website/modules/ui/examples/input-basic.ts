import { html } from '@webjsdev/core';
import { inputClass } from '#modules/ui/components/input.ts';

export default function InputBasic() {
  return html`<input data-slot="input" placeholder="Enter text" aria-label="Text" class=${inputClass()}>`;
}
