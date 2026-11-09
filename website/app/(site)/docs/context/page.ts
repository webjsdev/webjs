import { html } from '@webjsdev/core';

export const metadata = { title: 'Context Protocol | WebJs' };

export default function Context() {
  return html`
    <h1>Context Protocol</h1>
    <p>The context protocol lets you share data across deeply nested components without threading attributes through every intermediate element. It uses DOM events under the hood, which means it works across shadow DOM boundaries, so a provider at the top of the tree can reach consumers buried many levels deep.</p>

    <p>It is a port of Lit's <code>@lit/context</code>, which implements the Web Components Community Group context protocol: <code>createContext</code>, <code>ContextProvider</code>, <code>ContextConsumer</code>, <code>ContextRequestEvent</code>, <code>ContextProviderEvent</code> and <code>ContextRoot</code> take the same arguments and behave the same way, so Lit context code runs unchanged once its import points at <code>@webjsdev/core/context</code>. The <code>@provide</code> and <code>@consume</code> decorators are the one part with no WebJs form, because WebJs TypeScript is erasable and has no decorators: construct the controllers as fields instead, as every example below does.</p>

    <code-block>import { createContext, ContextProvider, ContextConsumer, ContextRoot } from '@webjsdev/core/context';</code-block>

    <h2>When to Use Context</h2>
    <p>Context is the right tool when:</p>
    <ul>
      <li><strong>Theme / dark mode</strong>: a setting at the app root that dozens of components read.</li>
      <li><strong>Auth state</strong>: the current user object needed by nav bars, comment forms, profile widgets, etc.</li>
      <li><strong>Locale / i18n</strong>: language preference that affects every text-rendering component.</li>
      <li><strong>Feature flags</strong>: runtime configuration that controls conditional rendering deep in the tree.</li>
    </ul>

    <p>Context is <strong>not</strong> the right tool when:</p>
    <ul>
      <li>Data changes on every render. Use component state instead.</li>
      <li>Only one component needs the data. Pass it as an attribute or property.</li>
      <li>Data is page-level. Use an async page function to fetch it on the server.</li>
    </ul>

    <h2>Creating a Context</h2>
    <p><code>createContext(key)</code> returns the key itself, typed with the value it carries. The KEY is the identity: <code>createContext('theme')</code> in two modules is the same context, and a provider of one answers a consumer of the other. When a context must never collide with another one of the same name, use a <code>Symbol</code> as the key and export it from one module.</p>

    <code-block>// contexts/theme.ts (or .js)
import { createContext } from '@webjsdev/core/context';

export type Theme = 'light' | 'dark' | 'system';
export const themeContext = createContext&lt;Theme&gt;('theme');

// Collision-proof: only code importing this binding can reach it.
export const sessionIdContext = createContext&lt;string&gt;(Symbol('session-id'));</code-block>

    <p>The type argument is what flows into <code>provider.value</code>, <code>consumer.value</code> and the callbacks.</p>

    <h2>Providing a Value</h2>
    <p><code>ContextProvider</code> is a reactive controller that provides a value to all descendants. Attach it to any component:</p>

    <code-block>import { WebComponent, html, css } from '@webjsdev/core';
import { ContextProvider } from '@webjsdev/core/context';
import { themeContext } from '#contexts/theme.ts';

class AppShell extends WebComponent {
  static shadow = true;
  static styles = css\`
    :host { display: block; }
  \`;

  #theme = new ContextProvider(this, {
    context: themeContext,
    initialValue: 'light',
  });

  toggleTheme() {
    const next = this.#theme.value === 'light' ? 'dark' : 'light';
    this.#theme.setValue(next);  // updates all subscribers
  }

  render() {
    return html\`
      &lt;header&gt;
        &lt;button @click=\${() =&gt; this.toggleTheme()}&gt;
          Toggle theme (current: \${this.#theme.value})
        &lt;/button&gt;
      &lt;/header&gt;
      &lt;main&gt;&lt;slot&gt;&lt;/slot&gt;&lt;/main&gt;
    \`;
  }
}
AppShell.register('app-shell');</code-block>

    <p>When you call <code>provider.setValue(newValue)</code> (or assign <code>provider.value = newValue</code>), every subscribed consumer is notified and its host component re-renders automatically. Setting the same value again notifies nobody; <code>setValue(value, true)</code> forces the notification, which is how you announce an object you mutated in place.</p>

    <p>The provider listens for requests from the moment it is constructed, and it never answers its own host: a component that provides a context and also consumes the same one reads the value from an ancestor. The positional form <code>new ContextProvider(this, themeContext, 'light')</code> is equivalent to the options object.</p>

    <h2>Consuming a Value</h2>
    <p><code>ContextConsumer</code> is a reactive controller that reads the nearest provider's value. Attach it to any descendant component:</p>

    <code-block>import { WebComponent, html, css } from '@webjsdev/core';
import { ContextConsumer } from '@webjsdev/core/context';
import { themeContext } from '#contexts/theme.ts';

class ThemedCard extends WebComponent {
  static shadow = true;
  static styles = css\`
    :host { display: block; padding: 16px; border-radius: 8px; }
    :host(.dark) { background: #1a1a2e; color: #eee; }
    :host(.light) { background: #fff; color: #222; border: 1px solid #ddd; }
  \`;

  #theme = new ContextConsumer(this, {
    context: themeContext,
    subscribe: true,  // re-render when the provider's value changes
  });

  render() {
    // Apply the theme as a class on the host element
    this.className = this.#theme.value ?? 'light';

    return html\`
      &lt;h3&gt;&lt;slot name="title"&gt;Card&lt;/slot&gt;&lt;/h3&gt;
      &lt;p&gt;&lt;slot&gt;&lt;/slot&gt;&lt;/p&gt;
    \`;
  }
}
ThemedCard.register('themed-card');</code-block>

    <h2>Subscribe vs One-Shot Mode</h2>
    <p>The <code>subscribe</code> option controls whether the consumer receives ongoing updates. It defaults to <code>false</code>, as in Lit, so pass <code>subscribe: true</code> whenever the value can change.</p>

    <h3>subscribe: true</h3>
    <p>The consumer re-renders whenever the provider calls <code>setValue()</code>. This is what you want for live data like theme, auth state, or locale.</p>

    <code-block>// Consumer re-renders every time the provider's value changes
#theme = new ContextConsumer(this, {
  context: themeContext,
  subscribe: true,
});</code-block>

    <h3>subscribe: false (the default, one-shot)</h3>
    <p>The consumer reads the provider's value each time its host connects and never updates in between. This is useful for configuration that is set once and never changes, like a base URL:</p>

    <code-block>// Consumer reads the value once and ignores future changes
#apiBase = new ContextConsumer(this, { context: apiBaseContext });</code-block>

    <p>With <code>subscribe: false</code>, calling <code>provider.setValue()</code> does not notify this consumer.</p>

    <h3>The callback option</h3>
    <p>Pass <code>callback</code> to run code when a value arrives: once for a one-shot consumer, on every change for a subscribing one. The positional form is <code>new ContextConsumer(this, context, callback, subscribe)</code>.</p>

    <code-block>#locale = new ContextConsumer(this, {
  context: localeContext,
  subscribe: true,
  callback: (locale) =&gt; document.documentElement.lang = locale,
});</code-block>

    <h2>How It Works Under the Hood</h2>
    <p>The context protocol uses standard DOM events:</p>

    <ol>
      <li>When a consumer connects, it dispatches a <code>ContextRequestEvent(context, contextTarget, callback, subscribe)</code> that bubbles up through the DOM (including across shadow DOM boundaries, since it is composed). <code>contextTarget</code> is the requesting element.</li>
      <li>The nearest ancestor with a matching <code>ContextProvider</code> intercepts the event and stops it.</li>
      <li>If <code>subscribe</code> is true, the provider stores the callback and calls it, with an unsubscribe function, whenever the value changes.</li>
      <li>Otherwise the provider calls back once with the current value.</li>
      <li>When a provider connects it dispatches a <code>ContextProviderEvent</code>. A provider of the same context further up re-sends its subscribers' requests, so a consumer that now sits below a nearer provider moves to it.</li>
    </ol>

    <p>You can dispatch a request yourself for a one-time read:</p>

    <code-block>this.dispatchEvent(new ContextRequestEvent(themeContext, this, (theme) =&gt; {
  console.log('current theme', theme);
}));</code-block>

    <p>This means context works with any DOM tree structure (including components from different libraries) as long as they follow the same context protocol. There is no framework-specific wiring.</p>

    <h2>Multiple Contexts</h2>
    <p>A single component can provide or consume multiple contexts:</p>

    <code-block>import { createContext, ContextProvider } from '@webjsdev/core/context';

const themeContext = createContext('theme');
const localeContext = createContext('locale');
const authContext = createContext('auth');

class AppRoot extends WebComponent {

  #theme = new ContextProvider(this, {
    context: themeContext,
    initialValue: 'light',
  });

  #locale = new ContextProvider(this, {
    context: localeContext,
    initialValue: 'en',
  });

  #auth = new ContextProvider(this, {
    context: authContext,
    initialValue: null,
  });

  login(user) {
    this.#auth.setValue(user);
  }

  render() {
    return html\`&lt;slot&gt;&lt;/slot&gt;\`;
  }
}
AppRoot.register('app-root');</code-block>

    <h2>Nested Providers</h2>
    <p>Providers can be nested. A consumer resolves to the nearest ancestor provider with a matching context key:</p>

    <code-block>&lt;app-root&gt;                  &lt;!-- provides theme: 'light' --&gt;
  &lt;themed-card&gt;             &lt;!-- consumes theme: 'light' --&gt;
  &lt;/themed-card&gt;

  &lt;dark-section&gt;             &lt;!-- provides theme: 'dark' (overrides) --&gt;
    &lt;themed-card&gt;           &lt;!-- consumes theme: 'dark' --&gt;
    &lt;/themed-card&gt;
  &lt;/dark-section&gt;
&lt;/app-root&gt;</code-block>

    <p>This mirrors how CSS custom properties cascade. Inner values shadow outer ones.</p>

    <h2>Late Providers: ContextRoot</h2>
    <p>A request that reaches the top of the tree unanswered is lost, which happens when a consumer connects before its provider's element has upgraded (a lazily loaded provider, or a consumer defined first). <code>ContextRoot</code> buffers subscribing requests at the root and replays them when a provider for that context connects. Attach it once, early, before your components load:</p>

    <code-block>import { ContextRoot } from '@webjsdev/core/context';

new ContextRoot().attach(document.body);</code-block>

    <p>Only subscribing consumers are replayed, as in Lit; a one-shot request that found no provider stays unanswered.</p>

    <p>A provider rendered by a layout needs no <code>ContextRoot</code>. A page boots its modules in nesting order, the outermost layout first and the page last, so an element a layout renders is defined before one its page renders, and a page's consumer finds the layout's provider when it first connects. A header control that sets a value the page reads therefore works with each element imported only by the route module that renders it, provided the provider wraps both: put it in the root layout around the header and <code>\${children}</code>.</p>

    <h2>Server Rendering</h2>
    <p>Context is a client-side protocol. During server rendering no element is connected, so a consumer's value is <code>undefined</code> in the first paint and arrives when the page hydrates. Render a sensible fallback (<code>this.#theme.value ?? 'light'</code>), or pass first-paint data down as attributes from the page.</p>

    <h2>Full Example: Auth Context</h2>
    <p>A complete provider + consumer pair for authentication state:</p>

    <code-block>// contexts/auth.ts
import { createContext } from '@webjsdev/core/context';
export type Auth = { user: { name: string } | null; loading: boolean };
export const authContext = createContext&lt;Auth&gt;(Symbol('auth'));

// components/auth-provider.ts
import { WebComponent, html } from '@webjsdev/core';
import { ContextProvider } from '@webjsdev/core/context';
import { authContext } from '#contexts/auth.ts';

class AuthProvider extends WebComponent {

  #auth = new ContextProvider(this, {
    context: authContext,
    initialValue: { user: null, loading: true },
  });

  async connectedCallback() {
    super.connectedCallback();
    try {
      const res = await fetch('/api/me');
      const user = res.ok ? await res.json() : null;
      this.#auth.setValue({ user, loading: false });
    } catch {
      this.#auth.setValue({ user: null, loading: false });
    }
  }

  render() {
    return html\`&lt;slot&gt;&lt;/slot&gt;\`;
  }
}
AuthProvider.register('auth-provider');

// components/user-menu.ts
import { WebComponent, html } from '@webjsdev/core';
import { ContextConsumer } from '@webjsdev/core/context';
import { authContext } from '#contexts/auth.ts';

class UserMenu extends WebComponent {

  #auth = new ContextConsumer(this, {
    context: authContext,
    subscribe: true,
  });

  render() {
    const { user, loading } = this.#auth.value ?? {};
    if (loading) return html\`&lt;span&gt;...&lt;/span&gt;\`;
    if (!user) return html\`&lt;a href="/login"&gt;Sign in&lt;/a&gt;\`;
    return html\`&lt;span&gt;Hi, \${user.name}&lt;/span&gt;\`;
  }
}
UserMenu.register('user-menu');</code-block>

    <h2>Next Steps</h2>
    <ul>
      <li><a href="/docs/controllers">Reactive Controllers</a>: the general pattern that ContextProvider and ContextConsumer are built on</li>
      <li><a href="/docs/task">Task Controller</a>: async data fetching with loading/error states</li>
      <li><a href="/docs/components">Components</a>: the full component API</li>
    </ul>
  `;
}
