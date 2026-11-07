import { html } from '@webjsdev/core';
import { separatorClass } from '#modules/ui/components/separator.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      title: 'WebJs UI',
      subtitle: 'The Foundation for your Design System',
      description:
        'A set of beautifully designed components that you can customize, extend, and build on.',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      title: 'WebJs UI',
      subtitle: 'الأساس لنظام التصميم الخاص بك',
      description:
        'مجموعة من المكونات المصممة بشكل جميل يمكنك تخصيصها وتوسيعها والبناء عليها.',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      title: 'WebJs UI',
      subtitle: 'הבסיס למערכת העיצוב שלך',
      description:
        'סט של רכיבים מעוצבים בצורה יפה שאתה יכול להתאים אישית, להרחיב ולבנות עליהם.',
    },
  },
};

export default function SeparatorRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div class="flex max-w-sm flex-col gap-4 text-sm" dir=${dir} lang=${lang}>
      <div class="flex flex-col gap-1.5">
        <div class="leading-none font-medium">${t.title}</div>
        <div class="text-muted-foreground">${t.subtitle}</div>
      </div>
      <div role="none" data-slot="separator" data-orientation="horizontal" class=${separatorClass()}></div>
      <div>${t.description}</div>
    </div>
  `;
}
