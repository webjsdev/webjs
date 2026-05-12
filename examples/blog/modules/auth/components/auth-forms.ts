import { WebComponent, html } from '@webjskit/core';
import '../../../components/ui/button.ts';
import '../../../components/ui/input.ts';
import '../../../components/ui/label.ts';
import '../../../components/ui/card.ts';
import '../../../components/ui/alert.ts';

/**
 * `<auth-forms>` — tabbed sign-in / sign-up.
 *
 * Migrated to `@webjskit/ui` primitives:
 *  - <ui-card> + <ui-card-header>/<ui-card-content> wraps the whole form
 *  - <ui-label> + <ui-input> replaces hand-rolled label/input pairs
 *  - <ui-button> replaces the submit button
 *  - <ui-alert variant="destructive"> shows server-side errors
 *
 * The tab switcher (Sign in / Create account) is intentionally kept as
 * a custom pill control — `<ui-tabs>` is structured for separate tab
 * panels, whereas here both tabs share the same form fields with only
 * a `mode` toggle, so the custom switcher remains a better fit.
 */
type Mode = 'login' | 'signup';
type State = { busy: boolean; error: string | null };

export class AuthForms extends WebComponent {
  // `mode` is a reactive property so the parent page can pick which tab
  // loads initially via `<auth-forms mode="signup">` — see login/page.ts
  // which flips to signup when the URL has `?tab=signup`.
  static properties = {
    then: { type: String },
    mode: { type: String },
  };
  declare then: string;
  declare mode: Mode;
  declare state: State;

  constructor() {
    super();
    this.then = '/dashboard';
    this.mode = 'login';
    this.state = { busy: false, error: null };
  }

  async onSubmit(e: SubmitEvent) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget as HTMLFormElement));
    this.setState({ busy: true, error: null });
    try {
      const url = this.mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `${r.status}`);
      }
      location.href = this.then || '/dashboard';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setState({ busy: false, error: msg });
    }
  }

  render() {
    const mode = this.mode;
    const { busy, error } = this.state;
    const submitLabel = busy ? '…' : (mode === 'login' ? 'Sign in' : 'Create account');
    return html`
      <ui-card>
        <ui-card-header>
          <div class="grid grid-cols-2 p-1 rounded-full bg-bg-subtle border border-border" role="tablist">
            <button role="tab"
                    class="${mode === 'login'
                      ? 'py-2.5 px-3 font-sans text-xs font-semibold tracking-[0.02em] border-0 rounded-full cursor-pointer transition-all duration-150 bg-bg-elev text-fg shadow-sm'
                      : 'py-2.5 px-3 font-sans text-xs font-semibold tracking-[0.02em] border-0 rounded-full cursor-pointer transition-all duration-150 bg-transparent text-fg-muted'}"
                    @click=${() => { this.mode = 'login'; this.setState({ error: null }); }}>Sign in</button>
            <button role="tab"
                    class="${mode === 'signup'
                      ? 'py-2.5 px-3 font-sans text-xs font-semibold tracking-[0.02em] border-0 rounded-full cursor-pointer transition-all duration-150 bg-bg-elev text-fg shadow-sm'
                      : 'py-2.5 px-3 font-sans text-xs font-semibold tracking-[0.02em] border-0 rounded-full cursor-pointer transition-all duration-150 bg-transparent text-fg-muted'}"
                    @click=${() => { this.mode = 'signup'; this.setState({ error: null }); }}>Create account</button>
          </div>
        </ui-card-header>
        <ui-card-content>
          <form class="grid gap-4" @submit=${(e: SubmitEvent) => this.onSubmit(e)}>
            ${mode === 'signup'
              ? html`<div class="grid gap-1.5">
                  <ui-label for="auth-name">Name (optional)</ui-label>
                  <ui-input id="auth-name" name="name" autocomplete="name"></ui-input>
                </div>`
              : ''}
            <div class="grid gap-1.5">
              <ui-label for="auth-email">Email</ui-label>
              <ui-input id="auth-email" type="email" name="email" autocomplete="email" required></ui-input>
            </div>
            <div class="grid gap-1.5">
              <ui-label for="auth-password">Password</ui-label>
              <ui-input id="auth-password"
                        type="password"
                        name="password"
                        autocomplete=${mode === 'login' ? 'current-password' : 'new-password'}
                        required></ui-input>
            </div>
            <ui-button type="submit" variant="default" ?disabled=${busy} class="mt-2">${submitLabel}</ui-button>
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
AuthForms.register('auth-forms');
