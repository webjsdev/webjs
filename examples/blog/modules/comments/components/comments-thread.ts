import { WebComponent, html, repeat, connectWS, signal } from '@webjskit/core';
import '../../../components/muted-text.ts';
import { inputClass } from '../../../components/ui/input.ts';
import { buttonClass } from '../../../components/ui/button.ts';
import type { CommentFormatted } from '../types.ts';

/**
 * `<comments-thread>`: live thread. Editorial card list, mono meta,
 * warm accent CTA, empty-state hint.
 */
export class CommentsThread extends WebComponent {
  static properties = {
    postId:   { type: String },
    initial:  { type: Object },
    signedIn: { type: Boolean },
  };
  declare postId: string;
  declare initial: CommentFormatted[];
  declare signedIn: boolean;
  comments = signal<CommentFormatted[]>([]);
  busy = signal(false);
  error = signal<string | null>(null);
  _conn: ReturnType<typeof connectWS> | null = null;

  constructor() {
    super();
    this.postId = '';
    this.initial = [];
    this.signedIn = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this.comments.set(Array.isArray(this.initial) ? this.initial : []);
    this._conn = connectWS(`/api/comments/${this.postId}`, {
      onMessage: (msg: CommentFormatted) => {
        const cur = this.comments.get();
        if (cur.some((c) => c.id === msg.id)) return;
        this.comments.set([...cur, msg]);
      },
    });
  }
  disconnectedCallback() { this._conn?.close(); }

  async onSubmit(e: SubmitEvent) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const input = form.querySelector('input') as HTMLInputElement;
    const body = input.value.trim();
    if (!body) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const r = await fetch(`/api/comments/${this.postId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `${r.status}`);
      }
      const created: CommentFormatted = await r.json();
      const cur = this.comments.get();
      if (!cur.some((c) => c.id === created.id)) {
        this.comments.set([...cur, created]);
      }
      this.busy.set(false);
      input.value = '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.busy.set(false);
      this.error.set(msg);
    }
  }

  render() {
    const comments = this.comments.get();
    const busy = this.busy.get();
    const error = this.error.get();
    return html`
      ${comments.length === 0
        ? html`<div class="p-6 text-center text-fg-subtle font-serif text-sm leading-relaxed italic border border-dashed border-border rounded-xl mb-5">No comments yet: be the first.</div>`
        : html`<ul class="list-none p-0 m-0 mb-5 grid gap-4">${repeat(comments, (c) => c.id, (c) => html`
            <li class="p-4 px-5 bg-bg-elev border border-border rounded">
              <div class="flex gap-2 items-baseline font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-fg-subtle mb-1.5">
                <strong class="text-fg font-bold tracking-[0.08em]">${c.authorName}</strong>
                <span class="text-fg-subtle">·</span>
                <span>${new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <div class="font-serif text-[15px] leading-relaxed text-fg">${c.body}</div>
            </li>`)}
          </ul>`}

      ${this.signedIn
        ? html`<form class="flex gap-2 p-3 bg-bg-elev border border-border rounded" @submit=${(e: SubmitEvent) => this.onSubmit(e)}>
            <input class="${inputClass()} flex-1"
                   placeholder="Add a comment…" ?disabled=${busy} autocomplete="off">
            <button class=${buttonClass({ size: 'sm' })} type="submit" ?disabled=${busy}>Post</button>
          </form>
          ${error ? html`<p class="mt-2 text-accent font-mono text-xs leading-snug">${error}</p>` : ''}`
        : html`<p class="p-5 text-fg-muted bg-bg-subtle border border-dashed border-border rounded text-center font-serif text-sm leading-relaxed italic">
            <a class="text-accent font-semibold no-underline not-italic hover:underline hover:underline-offset-[3px]" href=${signinHref()}>Sign in</a> to comment.
          </p>`}
    `;
  }
}
CommentsThread.register('comments-thread');

function signinHref() {
  if (typeof location !== 'undefined') {
    return `/login?then=${encodeURIComponent(location.pathname)}`;
  }
  return '/login';
}
