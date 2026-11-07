import { html } from '@webjsdev/core';
import { ArrowLeftIcon, ArrowRightIcon, RotateCwIcon } from '#lib/ui/lucide.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      rightClick: 'Right click here',
      longPress: 'Long press here',
      navigation: 'Navigation',
      back: 'Back',
      forward: 'Forward',
      reload: 'Reload',
      moreTools: 'More Tools',
      savePage: 'Save Page...',
      createShortcut: 'Create Shortcut...',
      nameWindow: 'Name Window...',
      developerTools: 'Developer Tools',
      delete: 'Delete',
      showBookmarks: 'Show Bookmarks',
      showFullUrls: 'Show Full URLs',
      people: 'People',
      pedro: 'Pedro Duarte',
      colm: 'Colm Tuite',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      rightClick: 'انقر بزر الماوس الأيمن هنا',
      longPress: 'اضغط مطولاً هنا',
      navigation: 'التنقل',
      back: 'رجوع',
      forward: 'تقدم',
      reload: 'إعادة تحميل',
      moreTools: 'المزيد من الأدوات',
      savePage: 'حفظ الصفحة...',
      createShortcut: 'إنشاء اختصار...',
      nameWindow: 'تسمية النافذة...',
      developerTools: 'أدوات المطور',
      delete: 'حذف',
      showBookmarks: 'إظهار الإشارات المرجعية',
      showFullUrls: 'إظهار عناوين URL الكاملة',
      people: 'الأشخاص',
      pedro: 'Pedro Duarte',
      colm: 'Colm Tuite',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      rightClick: 'לחץ לחיצה ימנית כאן',
      longPress: 'לחץ לחיצה ארוכה כאן',
      navigation: 'ניווט',
      back: 'חזור',
      forward: 'קדימה',
      reload: 'רענן',
      moreTools: 'כלים נוספים',
      savePage: 'שמור עמוד...',
      createShortcut: 'צור קיצור דרך...',
      nameWindow: 'שם חלון...',
      developerTools: 'כלי מפתח',
      delete: 'מחק',
      showBookmarks: 'הצג סימניות',
      showFullUrls: 'הצג כתובות URL מלאות',
      people: 'אנשים',
      pedro: 'Pedro Duarte',
      colm: 'Colm Tuite',
    },
  },
};

// The provider is the dir attribute: every part styles itself with logical
// properties, so dir="rtl" on the menu flips its panels.
export default function ContextMenuRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <ui-context-menu dir=${dir} class="w-full max-w-xs">
      <ui-context-menu-trigger>
        <div tabindex="0" class="flex aspect-video w-full max-w-xs items-center justify-center rounded-xl border border-dashed text-sm">
          <span class="hidden pointer-fine:inline-block">${t.rightClick}</span>
          <span class="hidden pointer-coarse:inline-block">${t.longPress}</span>
        </div>
      </ui-context-menu-trigger>
      <ui-context-menu-content class="w-48" data-lang=${dir === 'rtl' ? lang : null}>
        <ui-context-menu-group>
          <ui-context-menu-sub>
            <ui-context-menu-sub-trigger>${t.navigation}</ui-context-menu-sub-trigger>
            <ui-context-menu-sub-content class="w-44" data-lang=${dir === 'rtl' ? lang : null}>
              <ui-context-menu-group>
                <ui-context-menu-item>
                  ${ArrowLeftIcon()}
                  ${t.back}
                  <ui-context-menu-shortcut>⌘[</ui-context-menu-shortcut>
                </ui-context-menu-item>
                <ui-context-menu-item data-disabled>
                  ${ArrowRightIcon()}
                  ${t.forward}
                  <ui-context-menu-shortcut>⌘]</ui-context-menu-shortcut>
                </ui-context-menu-item>
                <ui-context-menu-item>
                  ${RotateCwIcon()}
                  ${t.reload}
                  <ui-context-menu-shortcut>⌘R</ui-context-menu-shortcut>
                </ui-context-menu-item>
              </ui-context-menu-group>
            </ui-context-menu-sub-content>
          </ui-context-menu-sub>
          <ui-context-menu-sub>
            <ui-context-menu-sub-trigger>${t.moreTools}</ui-context-menu-sub-trigger>
            <ui-context-menu-sub-content class="w-44" data-lang=${dir === 'rtl' ? lang : null}>
              <ui-context-menu-group>
                <ui-context-menu-item>${t.savePage}</ui-context-menu-item>
                <ui-context-menu-item>${t.createShortcut}</ui-context-menu-item>
                <ui-context-menu-item>${t.nameWindow}</ui-context-menu-item>
              </ui-context-menu-group>
              <ui-context-menu-separator></ui-context-menu-separator>
              <ui-context-menu-group>
                <ui-context-menu-item>${t.developerTools}</ui-context-menu-item>
              </ui-context-menu-group>
              <ui-context-menu-separator></ui-context-menu-separator>
              <ui-context-menu-group>
                <ui-context-menu-item variant="destructive">${t.delete}</ui-context-menu-item>
              </ui-context-menu-group>
            </ui-context-menu-sub-content>
          </ui-context-menu-sub>
        </ui-context-menu-group>
        <ui-context-menu-separator></ui-context-menu-separator>
        <ui-context-menu-group>
          <ui-context-menu-item type="checkbox" checked>${t.showBookmarks}</ui-context-menu-item>
          <ui-context-menu-item type="checkbox">${t.showFullUrls}</ui-context-menu-item>
        </ui-context-menu-group>
        <ui-context-menu-separator></ui-context-menu-separator>
        <ui-context-menu-group aria-label=${t.people}>
          <ui-context-menu-label>${t.people}</ui-context-menu-label>
          <ui-context-menu-item type="radio" value="pedro" checked>${t.pedro}</ui-context-menu-item>
          <ui-context-menu-item type="radio" value="colm">${t.colm}</ui-context-menu-item>
        </ui-context-menu-group>
      </ui-context-menu-content>
    </ui-context-menu>
  `;
}
