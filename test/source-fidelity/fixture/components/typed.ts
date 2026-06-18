import { WebComponent, html } from '@webjsdev/core';

// Interactive (@click) so it ships, and carries TypeScript type
// annotations so the served bytes exercise the position-preserving strip.
export class TypedComp extends WebComponent({ count: Number }) {
  constructor() {
    super();
    this.count = 0;
  }

  _inc(by: number): void {
    this.count = this.count + by;
  }

  render() {
    return html`<button @click=${() => this._inc(1)}>${this.count}</button>`;
  }
}
TypedComp.register('typed-comp');
