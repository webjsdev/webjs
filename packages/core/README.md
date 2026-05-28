# @webjsdev/core

Isomorphic core runtime for [webjs](https://github.com/webjsdev/webjs), the
AI-first, web-components-first, no-build web framework.

This package ships the tagged-template `html` / `css` helpers, the
`WebComponent` base class, the client and server renderers (with Declarative
Shadow DOM support), directives, context protocol, the `Task` controller, and
the client-side navigation router.

Not intended for direct install. You'll usually get it as a transitive dep
when you scaffold an app with [`@webjsdev/cli`](https://www.npmjs.com/package/@webjsdev/cli).

## Install

```sh
npm install @webjsdev/core
```

## Use

```js
import { html, css, WebComponent } from '@webjsdev/core';

class Counter extends WebComponent {
  static properties = { count: { type: Number } };
  static styles = css`button { padding: 8px 12px; }`;

  render() {
    return html`<button @click=${() => this.count++}>${this.count}</button>`;
  }
}
Counter.register('x-counter');
```

`Class.register('tag-name')` is the webjs idiom. It calls
`customElements.define()` under the hood and adds tag validation,
registry bookkeeping (needed for lazy-loading), and a dev-time
double-register warning. Plain `customElements.define('x-counter',
Counter)` works identically.

Side-channel imports for optional features:

```js
import '@webjsdev/core/client-router';            // SPA-style link interception
import { unsafeHTML } from '@webjsdev/core/directives';
import { createContext } from '@webjsdev/core/context';
import { Task } from '@webjsdev/core/task';
```

See the full framework docs at https://github.com/webjsdev/webjs.

## Layout in the tarball

The tarball ships both `src/` and `dist/`. The browser fetches the
`dist/webjs-core-*.js` bundles (one per subpath, plus shared chunks)
so a page does one request per subpath instead of waterfalling
through 15+ source files. SSR imports the same bundles via the
package `exports` field. The readable `src/` stays on disk so AI
agents can grep it directly.

The bundle is built ONCE at `npm publish` time on the author's
machine via esbuild as a publish-time devDependency. User installs
never invoke a bundler. If you install the package via a git
dependency (`npm install github:webjsdev/webjs`), the `prepare`
lifecycle runs on your machine to produce the bundle; esbuild is
in `devDependencies` so it's available for that case.

## License

MIT
