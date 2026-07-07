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
        class="inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm border cursor-pointer transition-all active:scale-[0.97] ${liked ? 'bg-accent text-accent-foreground border-accent' : 'bg-card text-foreground border-border hover:border-border-strong'}">
        <svg viewBox="0 0 24 24" class="w-4 h-4 ${liked ? 'fill-current stroke-none' : 'fill-none stroke-current'}" style="stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>
        ${liked ? 'Liked' : 'Like'}
      </button>
    `;
  }
}
LikeButton.register('like-button');
