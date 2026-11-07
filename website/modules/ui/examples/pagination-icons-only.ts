import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import {
  paginationClass, paginationContentClass, paginationLinkClass,
} from '#modules/ui/components/pagination.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';
import { ChevronLeftIcon, ChevronRightIcon } from '#lib/ui/lucide.ts';

export default function PaginationIconsOnly() {
  return html`
    <div class="flex items-center justify-between gap-4">
      <div role="group" data-slot="field" data-orientation="horizontal" class=${cn(fieldClass({ orientation: 'horizontal' }), 'w-fit')}>
        <label data-slot="field-label" for="select-rows-per-page" class=${fieldLabelClass()}>Rows per page</label>
        <ui-select>
          <select id="select-rows-per-page" class=${cn(selectTriggerClass(), 'w-20')}>
            <option value="10">10</option>
            <option value="25" selected>25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </ui-select>
      </div>
      <nav role="navigation" aria-label="pagination" data-slot="pagination" class=${cn(paginationClass(), 'mx-0 w-auto')}>
        <ul data-slot="pagination-content" class=${paginationContentClass()}>
          <li data-slot="pagination-item">
            <a href="#" aria-label="Go to previous page" data-slot="pagination-link" data-active="false" class=${cn(paginationLinkClass({ size: 'default' }), 'pl-1.5!')}>
              ${ChevronLeftIcon()}
              <span class="hidden sm:block">Previous</span>
            </a>
          </li>
          <li data-slot="pagination-item">
            <a href="#" aria-label="Go to next page" data-slot="pagination-link" data-active="false" class=${cn(paginationLinkClass({ size: 'default' }), 'pr-1.5!')}>
              <span class="hidden sm:block">Next</span>
              ${ChevronRightIcon()}
            </a>
          </li>
        </ul>
      </nav>
    </div>
  `;
}
