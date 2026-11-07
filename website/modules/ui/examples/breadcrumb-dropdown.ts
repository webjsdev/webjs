import { html } from '@webjsdev/core';
import {
  breadcrumbListClass, breadcrumbItemClass, breadcrumbLinkClass, breadcrumbPageClass, breadcrumbSeparatorClass,
} from '#modules/ui/components/breadcrumb.ts';
import { ChevronDownIcon, DotIcon } from '#lib/ui/lucide.ts';

const separator = () => html`
  <li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" class=${breadcrumbSeparatorClass()}>${DotIcon()}</li>
`;

export default function BreadcrumbDropdown() {
  return html`
    <nav aria-label="breadcrumb" data-slot="breadcrumb">
      <ol data-slot="breadcrumb-list" class=${breadcrumbListClass()}>
        <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
          <a data-slot="breadcrumb-link" href="/" class=${breadcrumbLinkClass()}>Home</a>
        </li>
        ${separator()}
        <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
          <ui-dropdown-menu>
            <ui-dropdown-menu-trigger>
              <button type="button" class="flex items-center gap-1">
                Components
                ${ChevronDownIcon('size-3.5')}
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
          <span data-slot="breadcrumb-page" role="link" aria-disabled="true" aria-current="page" class=${breadcrumbPageClass()}>Breadcrumb</span>
        </li>
      </ol>
    </nav>
  `;
}
