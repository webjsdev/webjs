import { html } from '@webjsdev/core';

export const metadata = { title: 'Embed home' };

export default function Home() {
  return html`<h1 id="home">home</h1><a id="to-about" href="/about">about</a>`;
}
