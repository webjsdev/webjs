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

## License

MIT
