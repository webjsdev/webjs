import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  paginationClass, paginationContentClass, paginationLinkClass,
} from '#modules/ui/components/pagination.ts';
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from '#lib/ui/lucide.ts';

// shadcn's demo switches language with a selector; the page shows its
// default, Arabic, with Arabic numerals. Its RTL build turns the padding
// logical and flips the chevrons, which the classes here do by hand.
const translations = {
  en: { dir: 'ltr', values: { previous: 'Previous', next: 'Next' } },
  ar: { dir: 'rtl', values: { previous: 'السابق', next: 'التالي' } },
  he: { dir: 'rtl', values: { previous: 'הקודם', next: 'הבא' } },
};

const ARABIC_NUMERALS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const toArabicNumerals = (num: number) =>
  num.toString().split('').map((digit) => ARABIC_NUMERALS[Number(digit)]).join('');

export default function PaginationRtl() {
  const { dir, values: t } = translations.ar;
  return html`
    <nav role="navigation" aria-label="pagination" dir=${dir} data-slot="pagination" class=${paginationClass()}>
      <ul data-slot="pagination-content" class=${paginationContentClass()}>
        <li data-slot="pagination-item">
          <a href="#" aria-label="Go to previous page" data-slot="pagination-link" data-active="false" class=${cn(paginationLinkClass({ size: 'default' }), 'ps-1.5!')}>
            ${ChevronLeftIcon('rtl:rotate-180')}
            <span class="hidden sm:block">${t.previous}</span>
          </a>
        </li>
        <li data-slot="pagination-item">
          <a href="#" data-slot="pagination-link" data-active="false" class=${paginationLinkClass()}>${toArabicNumerals(1)}</a>
        </li>
        <li data-slot="pagination-item">
          <a href="#" aria-current="page" data-slot="pagination-link" data-active="true" class=${paginationLinkClass({ isActive: true })}>
            ${toArabicNumerals(2)}
          </a>
        </li>
        <li data-slot="pagination-item">
          <a href="#" data-slot="pagination-link" data-active="false" class=${paginationLinkClass()}>${toArabicNumerals(3)}</a>
        </li>
        <li data-slot="pagination-item">
          <span aria-hidden="true" data-slot="pagination-ellipsis" class="flex size-8 items-center justify-center [&_svg:not([class*='size-'])]:size-4">
            ${MoreHorizontalIcon()}
            <span class="sr-only">More pages</span>
          </span>
        </li>
        <li data-slot="pagination-item">
          <a href="#" aria-label="Go to next page" data-slot="pagination-link" data-active="false" class=${cn(paginationLinkClass({ size: 'default' }), 'pe-1.5!')}>
            <span class="hidden sm:block">${t.next}</span>
            ${ChevronRightIcon('rtl:rotate-180')}
          </a>
        </li>
      </ul>
    </nav>
  `;
}
