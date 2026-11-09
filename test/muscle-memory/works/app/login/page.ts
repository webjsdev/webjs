// Next idiom: reading a cookie with `(await cookies()).get(name)?.value`.
import { html } from '@webjsdev/core';
import { cookies } from '@webjsdev/server';

export default async function Login() {
  const session = (await cookies()).get('session')?.value;
  return html`<h1>Log in</h1><p>Session: ${session ?? 'none'}</p>`;
}
