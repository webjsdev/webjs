import { WebComponent, html, signal } from '@webjsdev/core';
import { buttonClass } from '../../../components/ui/button.ts';
import { inputClass } from '../../../components/ui/input.ts';
import { labelClass } from '../../../components/ui/label.ts';
import { cardClass, cardContentClass } from '../../../components/ui/card.ts';
import { alertClass, alertDescriptionClass } from '../../../components/ui/alert.ts';
// Server action: dev server rewrites this import into an RPC stub for the
// browser. At type-check time TS resolves the real source so createPost's
// input + return types flow across the RPC boundary.
import { createPost } from '../actions/create-post.server.ts';

export class NewPost extends WebComponent {
  busy = signal(false);
  error = signal<string | null>(null);

  firstUpdated() {
    this.querySelector<HTMLInputElement>('input[name="title"]')?.focus();
  }

  async onSubmit(e: SubmitEvent) {
    e.preventDefault();
    // querySelector fallback: e.currentTarget can be null on some
    // re-render paths with light-DOM event delegation.
    const form = (e.currentTarget || this.querySelector('form')) as HTMLFormElement;
    if (!form) return;
    const data = new FormData(form);
    const title = String(data.get('title') || '');
    const body = String(data.get('body') || '');
    if (!title || !body) {
      this.error.set('Title and body are required');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const result = await createPost({ title, body });
      if (!result.success) {
        this.busy.set(false);
        this.error.set(result.error);
        return;
      }
      // TS knows result.data is PostFormatted here.
      location.href = `/blog/${result.data.slug}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.busy.set(false);
      this.error.set(msg);
    }
  }

  render() {
    const busy = this.busy.get();
    const error = this.error.get();
    return html`
      <div class=${cardClass()}>
        <div class=${cardContentClass()}>
          <form class="grid gap-5" @submit=${(e: SubmitEvent) => this.onSubmit(e)}>
            <div class="grid gap-2">
              <label class=${labelClass()} for="new-post-title">Title</label>
              <input class=${inputClass()}
                     id="new-post-title"
                     name="title"
                     placeholder="A bold title…"
                     required>
            </div>
            <div class="grid gap-2">
              <label class=${labelClass()} for="new-post-body">Body</label>
              <textarea id="new-post-body"
                        class="font-serif text-base leading-relaxed resize-y min-h-[220px] text-fg bg-transparent border border-border-strong rounded p-4 transition-all duration-150 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-tint)]"
                        name="body"
                        placeholder="Write your post: markdown not required."
                        required></textarea>
            </div>
            <button type="submit" class="${buttonClass()} justify-self-start" ?disabled=${busy}>${busy ? 'Publishing…' : 'Publish'}</button>
            ${error
              ? html`<div class=${alertClass({ variant: 'destructive' })}>
                  <div class=${alertDescriptionClass()}>${error}</div>
                </div>`
              : ''}
          </form>
        </div>
      </div>
    `;
  }
}
NewPost.register('new-post');
