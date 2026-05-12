import { html } from '@webjskit/core';

// Demonstration page for @webjskit/ui components. After scaffolding,
// users would run:
//
//   webjs ui init
//   webjs ui add button card dialog input label form badge alert
//
// The components are written into `components/ui/`. This page assumes
// they're there; if you haven't run `webjs ui add` yet, the custom-element
// tags will render as bare HTML (un-upgraded).
//
// Side-effect imports register the custom elements. Edit when components are added.
try { await import('../../components/ui/button.ts' as any); } catch {}
try { await import('../../components/ui/card.ts' as any); } catch {}
try { await import('../../components/ui/badge.ts' as any); } catch {}
try { await import('../../components/ui/alert.ts' as any); } catch {}
try { await import('../../components/ui/input.ts' as any); } catch {}
try { await import('../../components/ui/label.ts' as any); } catch {}

export const metadata = {
  title: 'UI Demo · webjs',
  description: 'A showcase of @webjskit/ui components — shadcn for web components.',
};

export default function UiDemo() {
  return html`
    <section class="mx-auto max-w-3xl py-16 px-6">
      <h1 class="text-4xl font-bold tracking-tight mb-2">@webjskit/ui demo</h1>
      <p class="text-fg-muted mb-8">
        Sample showcase. To activate the components, run from the blog directory:
        <code class="font-mono text-sm bg-bg-subtle px-2 py-0.5 rounded">webjs ui init</code>
        then
        <code class="font-mono text-sm bg-bg-subtle px-2 py-0.5 rounded">webjs ui add button card alert badge input label</code>.
      </p>

      <ui-card>
        <ui-card-header>
          <ui-card-title>Sign in</ui-card-title>
          <ui-card-description>Enter your email to receive a magic link.</ui-card-description>
        </ui-card-header>
        <ui-card-content class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <ui-label for="email">Email</ui-label>
            <ui-input id="email" type="email" placeholder="you@example.com"></ui-input>
          </div>
          <ui-alert variant="default">
            <ui-alert-title>Heads up</ui-alert-title>
            <ui-alert-description>Magic link expires in 10 minutes.</ui-alert-description>
          </ui-alert>
        </ui-card-content>
        <ui-card-footer class="gap-2">
          <ui-button variant="default">Send link</ui-button>
          <ui-button variant="outline">Cancel</ui-button>
          <ui-badge variant="secondary">Beta</ui-badge>
        </ui-card-footer>
      </ui-card>

      <p class="mt-12 text-sm text-fg-subtle">
        The tags above (<code>ui-card</code>, <code>ui-button</code>, etc.) are
        framework-agnostic standards-compliant custom elements. They work in
        webjs natively and in any other framework that supports custom elements
        (Next, Astro, Vite, SvelteKit, Lit, vanilla HTML, …). Source lives in
        <code>components/ui/</code>; edit freely.
      </p>
    </section>
  `;
}
