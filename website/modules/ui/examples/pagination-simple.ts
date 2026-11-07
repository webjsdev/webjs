import { html } from '@webjsdev/core';
import {
  paginationClass, paginationContentClass, paginationLinkClass,
} from '#modules/ui/components/pagination.ts';

export default function PaginationSimple() {
  return html`
    <nav role="navigation" aria-label="pagination" data-slot="pagination" class=${paginationClass()}>
      <ul data-slot="pagination-content" class=${paginationContentClass()}>
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
          <a href="#" data-slot="pagination-link" data-active="false" class=${paginationLinkClass()}>4</a>
        </li>
        <li data-slot="pagination-item">
          <a href="#" data-slot="pagination-link" data-active="false" class=${paginationLinkClass()}>5</a>
        </li>
      </ul>
    </nav>
  `;
}
