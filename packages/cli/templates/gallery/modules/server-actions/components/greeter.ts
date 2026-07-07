// Calls the 'use server' action via a normal import (the RPC stub). Never
// hand-write fetch(); importing the action IS the API.
import { WebComponent, signal, html } from '@webjsdev/core';
import { greet } from '../actions/greet.server.ts';

export class Greeter extends WebComponent {
  private msg = signal('');
  async run(e: SubmitEvent) {
    e.preventDefault();
    const name = String(new FormData(e.target as HTMLFormElement).get('name') ?? '');
    const r = await greet({ name });
    // Narrow on r.success so TS knows `data` (success) vs `error` (failure).
    this.msg.set(r.success ? (r.data?.message ?? '') : (r.error ?? 'error'));
  }
  render() {
    return html`
      <form @submit=${(e: SubmitEvent) => this.run(e)} class="flex gap-2">
        <input name="name" placeholder="your name" class="border border-border rounded px-3 py-2" />
        <button type="submit" class="px-3 py-2 rounded bg-accent text-accent-fg">Greet</button>
      </form>
      <p class="mt-3 font-semibold">${this.msg.get()}</p>
    `;
  }
}
Greeter.register('server-greeter');
