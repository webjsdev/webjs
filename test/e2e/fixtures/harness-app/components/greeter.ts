import { WebComponent, html, signal } from '@webjsdev/core';
import { greet } from '../modules/greet/actions/greet.server.ts';
// A real component that CALLS a 'use server' action. The harness must (a) serve
// this .ts stripped, (b) rewrite the greet import to an RPC stub, and (c) route
// the stub's POST /__webjs/action/... through the middleware to the handler, or
// clicking the button would not round-trip. (#806)
const out = signal('');
class Greeter extends WebComponent({}) {
  async fire() {
    const r = await greet('world');       // fires the RPC POST through the harness
    out.set(r && r.ok ? `greeted ${r.name}` : 'failed');
  }
  render() {
    return html`<button @click=${() => this.fire()}>hi</button><span id="out">${out.get()}</span>`;
  }
}
Greeter.register('greeter-el');
