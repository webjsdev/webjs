import { html } from '@webjsdev/core';
import {
  breadcrumbListClass, breadcrumbItemClass, breadcrumbLinkClass, breadcrumbPageClass, breadcrumbSeparatorClass,
} from '#modules/ui/components/breadcrumb.ts';
import { ChevronDownIcon, DotIcon } from '#lib/ui/lucide.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      home: 'Home',
      components: 'Components',
      documentation: 'Documentation',
      themes: 'Themes',
      github: 'GitHub',
      breadcrumb: 'Breadcrumb',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      home: 'الرئيسية',
      components: 'المكونات',
      documentation: 'التوثيق',
      themes: 'السمات',
      github: 'جيت هاب',
      breadcrumb: 'مسار التنقل',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      home: 'בית',
      components: 'רכיבים',
      documentation: 'תיעוד',
      themes: 'ערכות נושא',
      github: 'גיטהאב',
      breadcrumb: 'פירורי לחם',
    },
  },
};

const separator = () => html`
  <li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" class=${breadcrumbSeparatorClass()}>${DotIcon()}</li>
`;

export default function BreadcrumbRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <nav aria-label="breadcrumb" data-slot="breadcrumb" dir=${dir} lang=${lang}>
      <ol data-slot="breadcrumb-list" class=${breadcrumbListClass()}>
        <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
          <a data-slot="breadcrumb-link" href="/" class=${breadcrumbLinkClass()}>${t.home}</a>
        </li>
        ${separator()}
        <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
          <ui-dropdown-menu>
            <ui-dropdown-menu-trigger>
              <button type="button" class="flex items-center gap-1">
                ${t.components}
                ${ChevronDownIcon('size-3.5')}
              </button>
            </ui-dropdown-menu-trigger>
            <ui-dropdown-menu-content data-lang=${lang}>
              <ui-dropdown-menu-group>
                <ui-dropdown-menu-item>${t.documentation}</ui-dropdown-menu-item>
                <ui-dropdown-menu-item>${t.themes}</ui-dropdown-menu-item>
                <ui-dropdown-menu-item>${t.github}</ui-dropdown-menu-item>
              </ui-dropdown-menu-group>
            </ui-dropdown-menu-content>
          </ui-dropdown-menu>
        </li>
        ${separator()}
        <li data-slot="breadcrumb-item" class=${breadcrumbItemClass()}>
          <span data-slot="breadcrumb-page" role="link" aria-disabled="true" aria-current="page" class=${breadcrumbPageClass()}>${t.breadcrumb}</span>
        </li>
      </ol>
    </nav>
  `;
}
