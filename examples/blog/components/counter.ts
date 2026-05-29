import { WebComponent, html } from '@webjsdev/core';

/**
 * `<my-counter>`: demo counter with the current design system.
 * Tabular monospace output; warm-accent focus ring.
 *
 * `count` is a reactive property because the value rides the `count`
 * attribute (`<my-counter count="3">`). The SSR pipeline applies the
 * attribute before first paint, so the server-rendered output already
 * shows the seeded value; click handlers re-render by assigning to the
 * property. Per AGENTS.md, attribute-backed values use `static
 * properties` + a `declare` field with the default set in the
 * constructor (not a class-field initializer, which would clobber the
 * reactive accessor).
 */
export class Counter extends WebComponent {
  static properties = { count: { type: Number } };
  declare count: number;

  constructor() {
    super();
    this.count = 0;
  }

  _bump(d: number) { this.count += d; }

  render() {
    const v = this.count;
    return html`
      <button
        class="w-8 h-8 rounded-full border-0 bg-transparent text-fg-muted font-sans font-semibold text-base leading-none cursor-pointer transition-all duration-150 hover:bg-bg-subtle hover:text-fg active:scale-[0.92] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-tint"
        aria-label="Decrement"
        @click=${() => this._bump(-1)}
      >−</button>
      <output class="min-w-[3ch] px-2 text-center font-mono font-semibold text-[15px] leading-none tabular-nums text-accent">${v}</output>
      <button
        class="w-8 h-8 rounded-full border-0 bg-transparent text-fg-muted font-sans font-semibold text-base leading-none cursor-pointer transition-all duration-150 hover:bg-bg-subtle hover:text-fg active:scale-[0.92] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-tint"
        aria-label="Increment"
        @click=${() => this._bump(1)}
      >+</button>
    `;
  }
}
Counter.register('my-counter');
