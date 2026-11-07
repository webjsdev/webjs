import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  emptyClass, emptyHeaderClass, emptyMediaClass, emptyTitleClass,
  emptyDescriptionClass, emptyContentClass,
} from '#modules/ui/components/empty.ts';
import { IconFolderCode } from '#lib/ui/tabler.ts';
import { ArrowUpRightIcon } from '#lib/ui/lucide.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      title: 'No Projects Yet',
      description:
        "You haven't created any projects yet. Get started by creating your first project.",
      createProject: 'Create Project',
      importProject: 'Import Project',
      learnMore: 'Learn More',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      title: 'لا توجد مشاريع بعد',
      description: 'لم تقم بإنشاء أي مشاريع بعد. ابدأ بإنشاء مشروعك الأول.',
      createProject: 'إنشاء مشروع',
      importProject: 'استيراد مشروع',
      learnMore: 'تعرف على المزيد',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      title: 'אין פרויקטים עדיין',
      description:
        'עדיין לא יצרת פרויקטים. התחל על ידי יצירת הפרויקט הראשון שלך.',
      createProject: 'צור פרויקט',
      importProject: 'ייבא פרויקט',
      learnMore: 'למד עוד',
    },
  },
};

export default function EmptyRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div data-slot="empty" dir=${dir} lang=${lang} class=${emptyClass()}>
      <div data-slot="empty-header" class=${emptyHeaderClass()}>
        <div data-slot="empty-icon" data-variant="icon" class=${emptyMediaClass({ variant: 'icon' })}>
          ${IconFolderCode()}
        </div>
        <div data-slot="empty-title" class=${emptyTitleClass()}>${t.title}</div>
        <div data-slot="empty-description" class=${emptyDescriptionClass()}>${t.description}</div>
      </div>
      <div data-slot="empty-content" class=${cn(emptyContentClass(), 'flex-row justify-center gap-2')}>
        <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>${t.createProject}</button>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>${t.importProject}</button>
      </div>
      <a href="#" data-slot="button" data-variant="link" data-size="sm" class=${cn(buttonClass({ variant: 'link', size: 'sm' }), 'text-muted-foreground')}>
        ${t.learnMore} ${ArrowUpRightIcon('rtl:rotate-270')}
      </a>
    </div>
  `;
}
