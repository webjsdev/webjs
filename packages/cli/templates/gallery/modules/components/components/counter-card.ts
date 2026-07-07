// Demonstrates the WebComponent essentials: the declare-free reactive-prop
// factory, an instance signal for local state, a lifecycle hook, and a <slot>
// for content projection (works in light DOM, the default). This is the core
// component authoring shape.
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
      <div class="border border-border rounded-xl p-4 grid gap-2">
        <slot></slot>
        <p class="font-semibold">${this.label}: ${this.count.get()}</p>
        <button @click=${() => this.count.set(this.count.get() + 1)}
          class="px-3 py-1.5 rounded-lg bg-accent text-accent-fg w-fit">Increment</button>
      </div>
    `;
  }
}
CounterCard.register('counter-card');
