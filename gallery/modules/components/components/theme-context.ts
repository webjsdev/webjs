// The context API: pass a value down to descendant components WITHOUT threading
// it through every level as an attribute. It is Lit's `@lit/context` API.
// `createContext<T>(key)` returns the key itself, typed with the value type, so
// the KEY is the identity (the same string in two modules is the same
// context); a `ContextProvider` on an ancestor holds the value; a
// `ContextConsumer` on any descendant reads it (once by default, and on every
// change with `subscribe: true`). Under the hood a consumer dispatches a
// `ContextRequestEvent` that bubbles up to the nearest provider, which is the
// low-level protocol the two controllers automate. All light DOM, so the
// provider's <slot> projects its children normally.
import { WebComponent, html, signal } from '@webjsdev/core';
import { buttonClass } from '#modules/gallery/ui/button.ts';
import { cardClass } from '#modules/gallery/ui/card.ts';
import { createContext, ContextProvider, ContextConsumer, ContextRequestEvent } from '@webjsdev/core/context';

type Theme = 'light' | 'dark';

// One shared key. Descendants that read `themeContext` get the provider's value.
// A Symbol key would keep it from colliding with any other 'demo-theme'.
export const themeContext = createContext<Theme>('demo-theme');

export class ThemeProvider extends WebComponent {
  // The provider holds the value. setValue() pushes it to every subscribing
  // consumer in one shot.
  private provider = new ContextProvider(this, { context: themeContext, initialValue: 'light' });

  private toggle() {
    this.provider.setValue(this.provider.value === 'light' ? 'dark' : 'light');
    this.requestUpdate(); // re-render the provider's own button label too
  }

  render() {
    return html`
      <div class=${cardClass('grid gap-3 p-3 max-w-[420px]')}>
        <button @click=${() => this.toggle()}
          class="${buttonClass({ size: 'sm' })} w-fit">
          provider theme: ${this.provider.value} (toggle)
        </button>
        <slot></slot>
      </div>
    `;
  }
}
ThemeProvider.register('theme-provider');

export class ThemeConsumer extends WebComponent {
  // subscribe: true re-renders this element whenever the provider calls setValue.
  private consumer = new ContextConsumer(this, { context: themeContext, subscribe: true });
  readonly #lastRead = signal<Theme | 'not read yet'>('not read yet');

  // The imperative escape hatch: dispatch a ContextRequestEvent yourself to
  // grab the current value ONCE without subscribing. Its arguments are the
  // context, the requesting element, the callback, and `subscribe` (false by
  // default). It bubbles up to the nearest provider, which answers via the
  // callback.
  private readOnce() {
    this.dispatchEvent(
      new ContextRequestEvent(themeContext, this, (value) => this.#lastRead.set(value)),
    );
  }

  render() {
    const theme = this.consumer.value ?? 'light';
    return html`
      <div class="flex items-center gap-3 text-[15px] text-foreground">
        <span>child sees: <strong>${theme}</strong></span>
        <button @click=${() => this.readOnce()}
          class=${buttonClass({ variant: 'secondary', size: 'xs' })}>read once</button>
        <span class="text-muted-foreground text-sm">last one-shot: ${this.#lastRead.get()}</span>
      </div>
    `;
  }
}
ThemeConsumer.register('theme-consumer');
