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
          <button @click=${() => this.reverse()}
            class="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm border-0 cursor-pointer transition-all hover:bg-primary/90 active:scale-[0.97]">Reverse</button>
          <button @click=${() => this.add()}
            class="px-3.5 py-1.5 rounded-xl bg-card border border-border text-foreground font-medium text-sm cursor-pointer transition-colors hover:border-border-strong">Add</button>
        </div>
        <!-- repeat keyed by item.id: reversing reuses the existing <li> nodes. -->
        <ul class="grid gap-2 list-none m-0 p-0">
          ${repeat(this.items.get(), (it: Item) => it.id, (it: Item) => html`
            <li class="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border text-[15px] text-foreground">
              <span class="text-muted-foreground/70 tabular-nums text-[13px]">#${it.id}</span>${it.label}
            </li>
          `)}
        </ul>
        <!-- watch(signal) swaps only this node when ticks changes. -->
        <button @click=${() => this.ticks.set(this.ticks.get() + 1)}
          class="w-fit text-sm text-muted-foreground cursor-pointer transition-colors hover:text-foreground underline decoration-dotted underline-offset-4">ticks: ${watch(this.ticks)}</button>
      </div>
    `;
  }
}
DirectiveDemo.register('directive-demo');
