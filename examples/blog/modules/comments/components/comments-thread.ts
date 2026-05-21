import { WebComponent, html, repeat, connectWS } from '@webjskit/core';
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
    comments: { type: Object, state: true },
    busy:     { type: Boolean, state: true },
    error:    { type: String, state: true },
  };
  declare postId: string;
  declare initial: CommentFormatted[];
  declare signedIn: boolean;
  declare comments: CommentFormatted[];
  declare busy: boolean;
  declare error: string | null;
  _conn: ReturnType<typeof connectWS> | null = null;

  constructor() {
    super();
    this.postId = '';
    this.initial = [];
    this.signedIn = false;
    this.comments = [];
    this.busy = false;
    this.error = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.comments = Array.isArray(this.initial) ? this.initial : [];
    this._conn = connectWS(`/api/comments/${this.postId}`, {
      onMessage: (msg: CommentFormatted) => {
        if (this.comments.some((c) => c.id === msg.id)) return;
        this.comments = [...this.comments, msg];
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
    this.busy = true;
    this.error = null;
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
      if (!this.comments.some((c) => c.id === created.id)) {
        this.comments = [...this.comments, created];
      }
      this.busy = false;
      input.value = '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.busy = false;
      this.error = msg;
    }
  }

  render() {
    const { comments, busy, error } = this;
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
