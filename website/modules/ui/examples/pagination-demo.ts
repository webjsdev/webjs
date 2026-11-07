import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  paginationClass, paginationContentClass, paginationLinkClass,
} from '#modules/ui/components/pagination.ts';
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from '#lib/ui/lucide.ts';

export default function PaginationDemo() {
  return html`
    <nav role="navigation" aria-label="pagination" data-slot="pagination" class=${paginationClass()}>
      <ul data-slot="pagination-content" class=${paginationContentClass()}>
        <li data-slot="pagination-item">
          <a href="#" aria-label="Go to previous page" data-slot="pagination-link" data-active="false" class=${cn(paginationLinkClass({ size: 'default' }), 'pl-1.5!')}>
            ${ChevronLeftIcon('cn-rtl-flip')}
            <span class="hidden sm:block">Previous</span>
          </a>
        </li>
        <li data-slot="pagination-item">
          <a href="#" data-slot="pagination-link" data-active="false" class=${paginationLinkClass()}>1</a>
        </li>
        <li data-slot="pagination-item">
          <a href="#" aria-current="page" data-slot="pagination-link" data-active="true" class=${paginationLinkClass({ isActive: true })}>
            2
          </a>
        </li>
        <li data-slot="pagination-item">
          <a href="#" data-slot="pagination-link" data-active="false" class=${paginationLinkClass()}>3</a>
        </li>
        <li data-slot="pagination-item">
          <span aria-hidden="true" data-slot="pagination-ellipsis" class="flex size-8 items-center justify-center [&_svg:not([class*='size-'])]:size-4">
            ${MoreHorizontalIcon()}
            <span class="sr-only">More pages</span>
          </span>
        </li>
        <li data-slot="pagination-item">
          <a href="#" aria-label="Go to next page" data-slot="pagination-link" data-active="false" class=${cn(paginationLinkClass({ size: 'default' }), 'pr-1.5!')}>
            <span class="hidden sm:block">Next</span>
            ${ChevronRightIcon('cn-rtl-flip')}
          </a>
        </li>
      </ul>
    </nav>
  `;
}
