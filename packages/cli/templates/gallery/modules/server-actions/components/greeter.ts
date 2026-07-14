// Calls the 'use server' action via a normal import (the RPC stub). Never
// hand-write fetch(); importing the action IS the API.
import { WebComponent, signal, html } from '@webjsdev/core';
import { greet } from '../actions/greet.server.ts';

export class Greeter extends WebComponent {
  private msg = signal('');
  // Drives the requireAuth middleware on the action: when true the request is
  // treated as signed-out, so the middleware 401s BEFORE greet() runs.
  private signedOut = signal(false);

  async run(e: SubmitEvent) {
    e.preventDefault();
    const name = String(new FormData(e.target as HTMLFormElement).get('name') ?? '');
    const r = await greet({ name, signedOut: this.signedOut.get() });
    // Narrow on r.success so TS knows `data` (success) vs `error` (failure). A
    // middleware short-circuit arrives here as a normal failure envelope.
    this.msg.set(r.success ? (r.data?.message ?? '') : (r.error ?? 'error'));
  }
  render() {
    return html`
      <div class="grid gap-3 max-w-[420px]">
        <form @submit=${(e: SubmitEvent) => this.run(e)}
          class="flex items-center gap-2 p-2 pl-4 rounded-2xl bg-card border border-border">
          <input name="name" placeholder="your name" autocomplete="off"
            class="flex-1 min-w-0 bg-transparent border-0 outline-none text-foreground text-[15px] placeholder:text-muted-foreground py-1.5" />
          <button type="submit"
            class="shrink-0 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm border-0 cursor-pointer transition-all hover:bg-primary/90 active:scale-[0.97]">Greet</button>
        </form>
        <label class="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" @change=${(e: Event) => this.signedOut.set((e.target as HTMLInputElement).checked)} />
          Simulate a signed-out visitor (the middleware 401s before the action runs)
        </label>
        ${this.msg.get() ? html`<p class="m-0 font-semibold text-foreground">${this.msg.get()}</p>` : ''}
      </div>
    `;
  }
}
Greeter.register('server-greeter');
