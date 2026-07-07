// Demonstrates the WebComponent essentials: the declare-free reactive-prop
// factory, an instance signal for local state, a lifecycle hook, and a <slot>
// for content projection (works in light DOM, the default). This is the core
// component authoring shape. Styling is crafted Tailwind on the app's design
// tokens so it stays visually coherent with the rest of the app.
import { WebComponent, prop, signal, html } from '@webjsdev/core';

export class CounterCard extends WebComponent({
  // A reactive prop rides an HTML attribute / SSR hydration. Declared ONLY here
  // (no `static properties`, no class-field `label = ''` which would clobber the
  // accessor). Set defaults in the constructor.
  label: prop(String),
}) {
  private count = signal(0); // instance signal: component-local state

  constructor() {
    super();
    this.label = this.label || 'Clicks';
  }

  render() {
    return html`
      <div class="grid gap-4 p-5 rounded-2xl bg-bg-elev border border-border max-w-[320px]">
        <slot></slot>
        <div class="flex items-baseline gap-2">
          <span class="text-[2.5rem] font-bold tabular-nums leading-none text-fg">${this.count.get()}</span>
          <span class="text-sm text-fg-subtle">${this.label}</span>
        </div>
        <button @click=${() => this.count.set(this.count.get() + 1)}
          class="w-fit px-4 py-2 rounded-xl bg-accent text-accent-fg font-semibold text-sm border-0 cursor-pointer transition-all hover:bg-accent-hover active:scale-[0.97]">Increment</button>
      </div>
    `;
  }
}
CounterCard.register('counter-card');
