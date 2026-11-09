// Lit idiom (@lit/task): a `Task` field whose task function destructures the
// args ARRAY and takes `{ signal }`, a renamed attribute, and `task.render()`
// with `initial` / `pending` / `complete` / `error` callbacks.
import { WebComponent, html } from '@webjsdev/core';
import { Task } from '@webjsdev/core/task';

export class UserCard extends WebComponent {
  static properties = {
    userId: { type: Number, attribute: 'user-id' },
  };

  declare userId: number;

  private _user = new Task(this, {
    task: async ([id]: [number], { signal }: { signal: AbortSignal }) => {
      await Promise.resolve();
      signal.throwIfAborted();
      return `user-${id}`;
    },
    args: () => [this.userId],
  });

  constructor() {
    super();
    this.userId = 0;
  }

  render() {
    return this._user.render({
      initial: () => html`<p>Waiting</p>`,
      pending: () => html`<p>Loading</p>`,
      complete: (name: string) => html`<p>${name}</p>`,
      error: () => html`<p>Failed</p>`,
    });
  }
}

customElements.define('user-card', UserCard);
