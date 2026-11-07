import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

type Source = {
  url: string;
  title: string;
  description: string;
};

const sources = {
  streaming: {
    url: 'https://nextjs.org/docs/app/getting-started/linking-and-navigating#streaming',
    title: 'Linking and Navigating',
    description: 'How the App Router streams a route to the browser.',
  },
  suspense: {
    url: 'https://react.dev/reference/react/Suspense',
    title: '<Suspense>',
    description: 'Display a fallback until its children have finished loading.',
  },
  serverComponents: {
    url: 'https://react.dev/reference/rsc/server-components',
    title: 'Server Components',
    description: 'Components that render ahead of time, on the server.',
  },
  loading: {
    url: 'https://nextjs.org/docs/app/api-reference/file-conventions/loading',
    title: 'loading.js',
    description: 'Show an instant loading state for a route segment.',
  },
  chunked: {
    url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Transfer-Encoding',
    title: 'Transfer-Encoding',
    description: 'Send a response as a series of chunks.',
  },
} satisfies Record<string, Source>;

function hostname(url: string) {
  return new URL(url).hostname.replace(/^www\./, '');
}

// The hover card and its trigger sit inline in the sentence, so both hosts
// are inline-block rather than the block a light-DOM host defaults to. Each
// paragraph is a div, since the card renders block elements and the HTML
// parser would close a p element at the first one.
function Citation(source: Source) {
  const host = hostname(source.url);
  return html`<ui-hover-card open-delay="10" close-delay="100" class="inline-block"><ui-hover-card-trigger class="inline-block *:inline-block"><button type="button" data-slot="button" data-variant="secondary" data-size="xs" class=${buttonClass({ variant: 'secondary', size: 'xs' })}>${host}</button></ui-hover-card-trigger><ui-hover-card-content class="flex w-64 flex-col gap-1">
    <div data-slot="hover-card-title" class="font-medium">${source.title}</div>
    <p class="text-muted-foreground">${source.description}</p>
    <a href=${source.url} target="_blank" rel="noreferrer" class="text-xs text-muted-foreground underline-offset-4 hover:underline">
      ${host}
      <span class="sr-only"> (opens in a new tab)</span>
    </a>
  </ui-hover-card-content></ui-hover-card>`;
}

export default function InlineCitationDemo() {
  return html`
    <div class="mx-auto flex max-w-sm flex-col gap-3 py-6 text-sm leading-relaxed">
      <div>
        Next.js streams a route in chunks, so the page shows up before every
        request finishes. ${Citation(sources.streaming)}
      </div>
      <div>
        Wrap a slow part of the page in a Suspense boundary and React sends the
        fallback first. When the data resolves, the finished HTML streams into
        the same response and replaces the fallback, with no extra request from
        the browser. ${Citation(sources.suspense)} Server Components
        help here, because their code never ships to the browser.
        ${Citation(sources.serverComponents)}
      </div>
      <div>
        A loading.tsx file does the same for a whole route segment.
        ${Citation(sources.loading)} It all runs over chunked transfer
        encoding, so there is nothing extra to set up.
        ${Citation(sources.chunked)}
      </div>
    </div>
  `;
}
