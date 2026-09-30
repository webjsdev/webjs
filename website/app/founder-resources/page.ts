import { html } from '@webjsdev/core';
import { READING } from '#lib/design/recipes.ts';
import { pageHeader } from '#lib/ui/page-header.ts';

/**
 * /founder-resources
 *
 * Outside services worth pointing a founder at. UNLISTED on purpose: the page
 * is reached by someone who was handed the URL, so nothing on the site links
 * here. It is absent from the header, the footer, app/sitemap.ts, and
 * /llms.txt, and test/ssr/founder-resources-page.test.ts holds all four. Do not "fix"
 * the missing sitemap entry.
 *
 * Unlisted is not hidden. The page stays indexable (no robots metadata) and
 * each entry is a plain followed link, with no rel=nofollow, sponsored or ugc,
 * because a followed link is what the page is for.
 *
 * An entry is the link with its description on the line below, so adding one
 * is a new object in RESOURCES and nothing else.
 */

export const metadata = {
  title: 'Founder resources · WebJs',
  description: 'Outside services for founders building a company around their software, starting with where to find investors.',
};

const RESOURCES = [
  {
    section: 'Fundraising',
    name: 'Investorlist.com',
    href: 'https://www.investorlist.com',
    desc: 'Downloadable, curated lists of active startup investors, angels, VCs, and family offices.',
  },
];

export default function Resources() {
  return html`
    <main id="main" tabindex="-1" class="${READING} py-12 focus:outline-none">
      ${pageHeader('Founder resources', 'Outside services for founders building a company around their software.')}

      ${RESOURCES.map((r) => html`
        <section class="mb-8">
          <h2 class="font-serif text-section leading-[1.15] tracking-tight text-fg m-0 mb-4">${r.section}</h2>
          <article class="border border-border rounded-xl bg-bg-elev p-5 sm:p-6 shadow-sm">
            <a href=${r.href} class="font-semibold text-accent hover:text-accent-hover underline underline-offset-4">${r.name}</a>
            <p class="text-fg text-sm leading-relaxed m-0 mt-2">${r.desc}</p>
          </article>
        </section>
      `)}
    </main>
  `;
}
