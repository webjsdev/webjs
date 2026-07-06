import { WebComponent, html } from '@webjsdev/core';
import { greet } from '../modules/greet/actions/greet.server.ts';
// A real component that imports a 'use server' action: the #806 headline case.
// The harness must serve this .ts stripped AND rewrite the action import to an
// RPC stub, or the module fails to load in the browser.
class Greeter extends WebComponent({}) {
  render() { return html`<button @click=${() => greet('x')}>hi ${typeof greet}</button>`; }
}
Greeter.register('greeter-el');
