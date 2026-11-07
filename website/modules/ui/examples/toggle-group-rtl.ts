import { html } from '@webjsdev/core';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      list: 'List',
      grid: 'Grid',
      cards: 'Cards',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      list: 'قائمة',
      grid: 'شبكة',
      cards: 'بطاقات',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      list: 'רשימה',
      grid: 'רשת',
      cards: 'כרטיסים',
    },
  },
};

// The provider is the dir attribute: the group styles itself with logical
// properties, so dir="rtl" on it flips the item order.
export default function ToggleGroupRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <ui-toggle-group variant="outline" type="single" value="list" dir=${dir} lang=${lang}>
      <ui-toggle-group-item value="list" aria-label=${t.list}>
        ${t.list}
      </ui-toggle-group-item>
      <ui-toggle-group-item value="grid" aria-label=${t.grid}>
        ${t.grid}
      </ui-toggle-group-item>
      <ui-toggle-group-item value="cards" aria-label=${t.cards}>
        ${t.cards}
      </ui-toggle-group-item>
    </ui-toggle-group>
  `;
}
