// The lit-html directive set webjs re-exports (from '@webjsdev/core/directives').
// `repeat` keys a list so DOM nodes are REUSED across reorders instead of being
// recreated (use it for keyed lists that reorder; plain `.map()` is fine for
// static lists). `watch(signal)` does a fine-grained DOM swap of ONE node when
// the signal changes, without re-running the whole template. The second card
// shows more of the set: `live` (a controlled input), `ref` + `createRef` (a
// handle to a DOM node), `until` (a pending fallback for a promise),
// `unsafeHTML` (trusted raw HTML, NEVER user input), and `keyed` (force a fresh
// subtree when a key changes).
import { WebComponent, signal, html } from '@webjsdev/core';
import { repeat, watch, live, until, keyed, unsafeHTML, ref, createRef } from '@webjsdev/core/directives';

interface Item { id: number; label: string }

let nextId = 4;

export class DirectiveDemo extends WebComponent {
  private items = signal<Item[]>([
    { id: 1, label: 'Alpha' },
    { id: 2, label: 'Bravo' },
    { id: 3, label: 'Charlie' },
  ]);
  private ticks = signal(0);
  // A controlled value (for `live`) and a key (for `keyed`).
  private text = signal('type here');
  private variant = signal(0);
  // A handle to the input node, attached by `ref` in the browser.
  private inputRef = createRef<HTMLInputElement>();
  // Created ONCE (not per render), so `until` keeps the resolved value across
  // re-renders instead of flashing back to the fallback each time.
  private asyncValue: Promise<string> = this.later();

  private reverse() {
    this.items.set(this.items.get().slice().reverse());
  }
  private add() {
    const id = nextId++;
    this.items.set([...this.items.get(), { id, label: 'Item ' + id }]);
  }
  private focusInput() {
    this.inputRef.value?.focus();
  }
  // A promise that resolves after a tick, so `until` shows its fallback first.
  private later(): Promise<string> {
    return new Promise((resolve) => setTimeout(() => resolve('resolved!'), 400));
  }

  render() {
    const variant = this.variant.get();
    return html`
      <div class="grid gap-6 max-w-[420px]">
        <div class="grid gap-4">
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

        <div class="grid gap-3 border-t border-border pt-4">
          <!-- live keeps the input's DOM value tracking the signal even after the
               user edits it, so it stays a controlled input. ref hands you the
               node via inputRef.value once it is attached in the browser. -->
          <div class="flex gap-2">
            <input
              ${ref(this.inputRef)}
              class="flex-1 px-3 py-1.5 rounded-xl bg-card border border-border text-[15px] text-foreground"
              .value=${live(this.text.get())}
              @input=${(e: Event) => this.text.set((e.target as HTMLInputElement).value)}>
            <button @click=${() => this.focusInput()}
              class="px-3.5 py-1.5 rounded-xl bg-card border border-border text-foreground text-sm cursor-pointer transition-colors hover:border-border-strong">Focus</button>
          </div>
          <!-- until shows the fallback until the promise resolves. -->
          <p class="text-sm text-muted-foreground">async: ${until(this.asyncValue, 'loading...')}</p>
          <!-- keyed discards and rebuilds this subtree when the key changes;
               unsafeHTML injects trusted, author-written HTML (NEVER user input). -->
          <button @click=${() => this.variant.set(variant + 1)}
            class="w-fit text-sm text-muted-foreground cursor-pointer transition-colors hover:text-foreground underline decoration-dotted underline-offset-4">rekey</button>
          ${keyed(variant, html`<div class="text-[15px] text-foreground">${unsafeHTML('<em>fresh subtree</em>')} #${variant}</div>`)}
        </div>
      </div>
    `;
  }
}
DirectiveDemo.register('directive-demo');
