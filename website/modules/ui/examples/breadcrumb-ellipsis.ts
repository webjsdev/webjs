import { html } from '@webjsdev/core';
import {
  breadcrumbListClass, breadcrumbItemClass, breadcrumbLinkClass, breadcrumbPageClass,
  breadcrumbSeparatorClass, breadcrumbEllipsisClass,
} from '#modules/ui/components/breadcrumb.ts';
import { ChevronRightIcon, MoreHorizontalIcon } from '#lib/ui/lucide.ts';

const separator = () => html`
  <li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" class=${breadcrumbSeparatorClass()}>${ChevronRightIcon('cn-rtl-flip')}</li>
`;

export default function BreadcrumbEllipsisDemo() {
  return html`
    <nav aria-label="breadcrumb" data-slot="breadcrumb">
      <ol data-slot="breadcrumb-list" class=${breadcrumbListClass()}>
        <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
          <a data-slot="breadcrumb-link" href="/" class=${breadcrumbLinkClass()}>Home</a>
        </li>
        ${separator()}
        <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
          <span data-slot="breadcrumb-ellipsis" role="presentation" aria-hidden="true" class=${breadcrumbEllipsisClass()}>
            ${MoreHorizontalIcon()}
            <span class="sr-only">More</span>
          </span>
        </li>
        ${separator()}
        <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
          <a data-slot="breadcrumb-link" href="/docs/components" class=${breadcrumbLinkClass()}>Components</a>
        </li>
        ${separator()}
        <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
          <span data-slot="breadcrumb-page" role="link" aria-disabled="true" aria-current="page" class=${breadcrumbPageClass()}>Breadcrumb</span>
        </li>
      </ol>
    </nav>
  `;
}
