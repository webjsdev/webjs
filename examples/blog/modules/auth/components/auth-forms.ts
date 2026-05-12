import { WebComponent, html } from '@webjskit/core';
import { buttonClass } from '../../../components/ui/button.ts';
import { inputClass } from '../../../components/ui/input.ts';
import { labelClass } from '../../../components/ui/label.ts';
import {
  cardClass,
  cardHeaderClass,
  cardContentClass,
} from '../../../components/ui/card.ts';
import { alertClass, alertDescriptionClass } from '../../../components/ui/alert.ts';

/**
 * `<auth-forms>` — tabbed sign-in / sign-up.
 *
 * Uses the Webjs UI two-tier composition:
 *  - Tier-1 helpers (cardClass, inputClass, labelClass, buttonClass,
 *    alertClass) spread onto native <div>, <input>, <label>, <button>.
 *  - The Sign in / Create account switcher is hand-rolled (two pill
 *    buttons toggling a `mode` property). `<ui-tabs>` would also work
 *    but is designed for separate panels — both modes here share a
 *    single form with only the field set differing, so a custom switcher
 *    is the better fit.
 */
type Mode = 'login' | 'signup';
type State = { busy: boolean; error: string | null };

export class AuthForms extends WebComponent {
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
    const pillBase =
      'py-2.5 px-3 font-sans text-xs font-semibold tracking-[0.02em] border-0 rounded-full cursor-pointer transition-all duration-150';
    const pillActive = `${pillBase} bg-bg-elev text-fg shadow-sm`;
    const pillInactive = `${pillBase} bg-transparent text-fg-muted`;
    return html`
      <div class=${cardClass()}>
        <div class=${cardHeaderClass()}>
          <div class="grid grid-cols-2 p-1 rounded-full bg-bg-subtle border border-border" role="tablist">
            <button role="tab"
                    class=${mode === 'login' ? pillActive : pillInactive}
                    @click=${() => { this.mode = 'login'; this.setState({ error: null }); }}>Sign in</button>
            <button role="tab"
                    class=${mode === 'signup' ? pillActive : pillInactive}
                    @click=${() => { this.mode = 'signup'; this.setState({ error: null }); }}>Create account</button>
          </div>
        </div>
        <div class=${cardContentClass()}>
          <form class="grid gap-4" @submit=${(e: SubmitEvent) => this.onSubmit(e)}>
            ${mode === 'signup'
              ? html`<div class="grid gap-1.5">
                  <label class=${labelClass()} for="auth-name">Name (optional)</label>
                  <input class=${inputClass()} id="auth-name" name="name" autocomplete="name">
                </div>`
              : ''}
            <div class="grid gap-1.5">
              <label class=${labelClass()} for="auth-email">Email</label>
              <input class=${inputClass()} id="auth-email" type="email" name="email" autocomplete="email" required>
            </div>
            <div class="grid gap-1.5">
              <label class=${labelClass()} for="auth-password">Password</label>
              <input class=${inputClass()}
                     id="auth-password"
                     type="password"
                     name="password"
                     autocomplete=${mode === 'login' ? 'current-password' : 'new-password'}
                     required>
            </div>
            <button type="submit" class="${buttonClass()} mt-2" ?disabled=${busy}>${submitLabel}</button>
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
AuthForms.register('auth-forms');
