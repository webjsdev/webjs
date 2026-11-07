import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  breadcrumbListClass, breadcrumbItemClass, breadcrumbLinkClass, breadcrumbPageClass,
  breadcrumbSeparatorClass, breadcrumbEllipsisClass,
} from '#modules/ui/components/breadcrumb.ts';
import { ChevronRightIcon, MoreHorizontalIcon } from '#lib/ui/lucide.ts';

const separator = () => html`
  <li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" class=${breadcrumbSeparatorClass()}>${ChevronRightIcon('cn-rtl-flip')}</li>
`;

export default function BreadcrumbDemo() {
  return html`
    <nav aria-label="breadcrumb" data-slot="breadcrumb">
      <ol data-slot="breadcrumb-list" class=${breadcrumbListClass()}>
        <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
          <a data-slot="breadcrumb-link" href="#" class=${breadcrumbLinkClass()}>Home</a>
        </li>
        ${separator()}
        <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
          <ui-dropdown-menu>
            <ui-dropdown-menu-trigger>
              <button type="button" data-slot="button" data-variant="ghost" data-size="icon-sm" class=${buttonClass({ variant: 'ghost', size: 'icon-sm' })}>
                <span data-slot="breadcrumb-ellipsis" role="presentation" aria-hidden="true" class=${breadcrumbEllipsisClass()}>
                  ${MoreHorizontalIcon()}
                  <span class="sr-only">More</span>
                </span>
                <span class="sr-only">Toggle menu</span>
              </button>
            </ui-dropdown-menu-trigger>
            <ui-dropdown-menu-content align="start">
              <ui-dropdown-menu-group>
                <ui-dropdown-menu-item>Documentation</ui-dropdown-menu-item>
                <ui-dropdown-menu-item>Themes</ui-dropdown-menu-item>
                <ui-dropdown-menu-item>GitHub</ui-dropdown-menu-item>
              </ui-dropdown-menu-group>
            </ui-dropdown-menu-content>
          </ui-dropdown-menu>
        </li>
        ${separator()}
        <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
          <a data-slot="breadcrumb-link" href="#" class=${breadcrumbLinkClass()}>Components</a>
        </li>
        ${separator()}
        <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
          <span data-slot="breadcrumb-page" role="link" aria-disabled="true" aria-current="page" class=${breadcrumbPageClass()}>Breadcrumb</span>
        </li>
      </ol>
    </nav>
  `;
}
