import { WebComponent, html } from '@webjskit/core';
import '../../../components/ui/button.ts';
import '../../../components/ui/input.ts';
import '../../../components/ui/label.ts';
import '../../../components/ui/card.ts';
import '../../../components/ui/alert.ts';
// Server action — dev server rewrites this import into an RPC stub for the
// browser. At type-check time TS resolves the real source so createPost's
// input + return types flow across the RPC boundary.
import { createPost } from '../actions/create-post.server.ts';

type State = { busy: boolean; error: string | null };

export class NewPost extends WebComponent {

  declare state: State;

  constructor() {
    super();
    this.state = { busy: false, error: null };
  }

  firstUpdated() {
    // Walk into the <ui-input> wrapper to focus the real <input>.
    const wrapper = this.querySelector('ui-input[name="title"]');
    const titleInput = wrapper?.querySelector<HTMLInputElement>('input');
    titleInput?.focus();
  }

  async onSubmit(e: SubmitEvent) {
    e.preventDefault();
    // Use querySelector as a fallback — e.currentTarget can be null in
    // some re-render scenarios with light DOM event delegation.
    const form = (e.currentTarget || this.querySelector('form')) as HTMLFormElement;
    if (!form) return;
    const data = new FormData(form);
    const title = String(data.get('title') || '');
    const body = String(data.get('body') || '');
    if (!title || !body) {
      this.setState({ error: 'Title and body are required' });
      return;
    }
    this.setState({ busy: true, error: null });
    try {
      const result = await createPost({ title, body });
      if (!result.success) {
        this.setState({ busy: false, error: result.error });
        return;
      }
      // TS knows result.data is PostFormatted here.
      location.href = `/blog/${result.data.slug}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setState({ busy: false, error: msg });
    }
  }

  render() {
    const { busy, error } = this.state;
    return html`
      <ui-card>
        <ui-card-content>
          <form class="grid gap-5" @submit=${(e: SubmitEvent) => this.onSubmit(e)}>
            <div class="grid gap-2">
              <ui-label for="new-post-title">Title</ui-label>
              <ui-input id="new-post-title"
                        name="title"
                        placeholder="A bold title…"
                        required></ui-input>
            </div>
            <div class="grid gap-2">
              <ui-label for="new-post-body">Body</ui-label>
              <textarea id="new-post-body"
                        class="font-serif text-base leading-relaxed resize-y min-h-[220px] text-fg bg-transparent border border-border-strong rounded p-4 transition-all duration-150 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-tint)]"
                        name="body"
                        placeholder="Write your post — markdown not required."
                        required></textarea>
            </div>
            <ui-button type="submit" variant="default" ?disabled=${busy} class="justify-self-start">${busy ? 'Publishing…' : 'Publish'}</ui-button>
            ${error
              ? html`<ui-alert variant="destructive">
                  <ui-alert-description>${error}</ui-alert-description>
                </ui-alert>`
              : ''}
          </form>
        </ui-card-content>
      </ui-card>
    `;
  }
}
NewPost.register('new-post');
