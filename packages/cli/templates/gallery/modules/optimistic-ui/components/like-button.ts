// The IMPERATIVE optimistic() form for a simple flip: set the signal to the new
// value instantly, run the action, and roll back automatically if it rejects.
// Use optimistic UI where the client can PREDICT the result (likes, toggles,
// reorders, renames). Skip it where it hurts: unpredictable / server-computed
// results, side-effectful or OAuth / payment mutations, and destructive
// irreversible actions (confirm-first is better there).
//
// This is the simple-flip API. For a LIST mutation (add / remove with rollback)
// see the declarative optimistic(host, { source, update }) + .add() form in the
// /examples/todo app.
import { WebComponent, signal, optimistic, html } from '@webjsdev/core';
import { likePost } from '../actions/like-post.server.ts';

export class LikeButton extends WebComponent {
  private liked = signal(false);

  private async toggle() {
    const next = !this.liked.get();
    // optimistic(signal, value, action) flips `liked` to `next` immediately,
    // runs the action, and restores the old value if the action rejects.
    await optimistic(this.liked, next, () => likePost({ liked: next }));
  }

  render() {
    const liked = this.liked.get();
    return html`
      <button @click=${() => this.toggle()} aria-pressed=${liked ? 'true' : 'false'}
        class="px-4 py-2 rounded-full border font-semibold ${liked ? 'bg-accent text-accent-fg border-accent' : 'border-border'}">
        ${liked ? 'Liked' : 'Like'}
      </button>
    `;
  }
}
LikeButton.register('like-button');
