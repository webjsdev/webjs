// Next idiom: reading a server env var that `.env.local` overrides, and an
// image from `public/` at the site root.
import { html } from '@webjsdev/core';

export default function Greeting() {
  return html`<p>Greeting: ${process.env.MM_GREETING ?? 'unset'}</p><img src="/logo.svg" alt="Logo" width="32" height="32">`;
}
