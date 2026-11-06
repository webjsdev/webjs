import { html } from '@webjsdev/core';
import { tokenize, tokenClass, trimBlock } from '#lib/utils/highlight.ts';

/**
 * A /ui docs code block in the markup shadcn's rehype-pretty-code emits
 * (#1666): a `figure[data-rehype-pretty-code-figure]`, an optional title,
 * and a `pre` whose `code` holds one `span[data-line]` per line, so the
 * figure, line-number and highlighted-line rules ported into
 * public/ui-input.css apply unchanged. Tokens are coloured on the server by
 * the site's one highlighter (lib/utils/highlight.ts).
 */

type Line = { cls: string; v: string }[];

/** Split highlighted tokens into lines, cutting a token that spans a newline. */
function lines(code: string): Line[] {
  const out: Line[] = [[]];
  for (const tok of tokenize(trimBlock(code))) {
    const cls = tokenClass(tok.t);
    const parts = tok.v.split('\n');
    parts.forEach((part, i) => {
      if (i > 0) out.push([]);
      if (part) out[out.length - 1].push({ cls, v: part });
    });
  }
  return out;
}

export function codeFigure(code: string, opts: { title?: string; lineNumbers?: boolean; lang?: string } = {}) {
  const lang = opts.lang ?? 'ts';
  const body = lines(code).map((line) => html`<span data-line>${line.map((t) => (t.cls ? html`<span class=${t.cls}>${t.v}</span>` : t.v))}</span>${'\n'}`);
  return html`<figure data-rehype-pretty-code-figure data-not-typeset>
    ${opts.title ? html`<figcaption data-rehype-pretty-code-title data-language=${lang} class="flex items-center gap-2 text-code-foreground">${opts.title}</figcaption>` : ''}
    <pre tabindex="0" data-language=${lang} data-not-typeset class="no-scrollbar min-w-0 overflow-x-auto overflow-y-auto overscroll-x-contain overscroll-y-auto px-4 py-3.5 outline-none has-data-highlighted-line:px-0 has-data-line-numbers:px-0"><code data-language=${lang} data-line-numbers=${opts.lineNumbers ? '' : null}>${body}</code></pre>
  </figure>`;
}
