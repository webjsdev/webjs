import { html } from '@webjsdev/core';
import {
  breadcrumbListClass, breadcrumbItemClass, breadcrumbLinkClass, breadcrumbPageClass, breadcrumbSeparatorClass,
} from '#modules/ui/components/breadcrumb.ts';
import { DotIcon } from '#lib/ui/lucide.ts';

// A custom separator is whatever the separator item holds.
const separator = () => html`
  <li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" class=${breadcrumbSeparatorClass()}>${DotIcon()}</li>
`;

export default function BreadcrumbSeparatorDemo() {
  return html`
    <nav aria-label="breadcrumb" data-slot="breadcrumb">
      <ol data-slot="breadcrumb-list" class=${breadcrumbListClass()}>
        <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
          <a data-slot="breadcrumb-link" href="/" class=${breadcrumbLinkClass()}>Home</a>
        </li>
        ${separator()}
        <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
          <a data-slot="breadcrumb-link" href="/components" class=${breadcrumbLinkClass()}>Components</a>
        </li>
        ${separator()}
        <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
          <span data-slot="breadcrumb-page" role="link" aria-disabled="true" aria-current="page" class=${breadcrumbPageClass()}>Breadcrumb</span>
        </li>
      </ol>
    </nav>
  `;
}
