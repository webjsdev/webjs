import { html } from '@webjsdev/core';
import { BookmarkIcon } from '#lib/ui/lucide.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      label: 'Bookmark',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      label: 'إشارة مرجعية',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      label: 'סימנייה',
    },
  },
};

// The provider is the dir attribute: the toggle styles itself with logical
// properties, so dir="rtl" on it flips the icon and the label.
export default function ToggleRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <ui-toggle aria-label="Toggle bookmark" size="sm" variant="outline" dir=${dir} lang=${lang}>
      ${BookmarkIcon('group-data-[state=on]/toggle:fill-foreground')}
      ${t.label}
    </ui-toggle>
  `;
}
