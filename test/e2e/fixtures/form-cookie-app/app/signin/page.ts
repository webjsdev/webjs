import { html } from '@webjsdev/core';
import { signIn } from '#modules/auth.server.ts';

export default function SignIn() {
  return html`
    <h1 id="page">Sign in</h1>
    <form action=${signIn}>
      <input id="email" name="email" value="ada@example.com">
      <button id="signin-btn" type="submit">Sign in</button>
    </form>
  `;
}
