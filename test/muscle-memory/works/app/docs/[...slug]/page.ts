// Next idiom: a catch-all route whose param is an array of segments.
import { html } from '@webjsdev/core';

export default async function Docs({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return html`<p>Path: ${slug.join(' / ')}</p>`;
}
