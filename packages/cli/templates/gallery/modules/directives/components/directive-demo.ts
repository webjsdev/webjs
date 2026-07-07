// The lit-html directive set webjs re-exports (from '@webjsdev/core/directives').
// `repeat` keys a list so DOM nodes are REUSED across reorders instead of being
// recreated (use it for keyed lists that reorder; plain `.map()` is fine for
// static lists). `watch(signal)` does a fine-grained DOM swap of ONE node when
// the signal changes, without re-running the whole template.
import { WebComponent, signal, html } from '@webjsdev/core';
import { repeat, watch } from '@webjsdev/core/directives';

interface Item { id: number; label: string }

let nextId = 4;

export class DirectiveDemo extends WebComponent {
  private items = signal<Item[]>([
    { id: 1, label: 'Alpha' },
    { id: 2, label: 'Bravo' },
    { id: 3, label: 'Charlie' },
  ]);
  private ticks = signal(0);

  private reverse() {
    this.items.set(this.items.get().slice().reverse());
  }
  private add() {
    const id = nextId++;
    this.items.set([...this.items.get(), { id, label: 'Item ' + id }]);
  }

  render() {
    return html`
      <div class="grid gap-4 max-w-[420px]">
        <div class="flex gap-2">
          <button @click=${() => this.reverse()} class="px-3 py-1.5 rounded bg-accent text-accent-fg">Reverse</button>
          <button @click=${() => this.add()} class="px-3 py-1.5 rounded border border-border">Add</button>
        </div>
        <!-- repeat keyed by item.id: reversing reuses the existing <li> nodes. -->
        <ul class="grid gap-1 list-none m-0 p-0">
          ${repeat(this.items.get(), (it: Item) => it.id, (it: Item) => html`
            <li class="border border-border rounded px-3 py-1.5">#${it.id} ${it.label}</li>
          `)}
        </ul>
        <!-- watch(signal) swaps only this node when ticks changes. -->
        <button @click=${() => this.ticks.set(this.ticks.get() + 1)}
          class="text-sm underline underline-offset-4 w-fit">ticks: ${watch(this.ticks)}</button>
      </div>
    `;
  }
}
DirectiveDemo.register('directive-demo');
