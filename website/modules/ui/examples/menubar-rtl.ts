import { html } from '@webjsdev/core';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      file: 'File',
      newTab: 'New Tab',
      newWindow: 'New Window',
      newIncognitoWindow: 'New Incognito Window',
      share: 'Share',
      emailLink: 'Email link',
      messages: 'Messages',
      notes: 'Notes',
      print: 'Print...',
      edit: 'Edit',
      undo: 'Undo',
      redo: 'Redo',
      find: 'Find',
      searchTheWeb: 'Search the web',
      findItem: 'Find...',
      findNext: 'Find Next',
      findPrevious: 'Find Previous',
      cut: 'Cut',
      copy: 'Copy',
      paste: 'Paste',
      view: 'View',
      bookmarksBar: 'Bookmarks Bar',
      fullUrls: 'Full URLs',
      reload: 'Reload',
      forceReload: 'Force Reload',
      toggleFullscreen: 'Toggle Fullscreen',
      hideSidebar: 'Hide Sidebar',
      profiles: 'Profiles',
      andy: 'Andy',
      benoit: 'Benoit',
      luis: 'Luis',
      editProfile: 'Edit...',
      addProfile: 'Add Profile...',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      file: 'ملف',
      newTab: 'علامة تبويب جديدة',
      newWindow: 'نافذة جديدة',
      newIncognitoWindow: 'نافذة التصفح المتخفي الجديدة',
      share: 'مشاركة',
      emailLink: 'رابط البريد الإلكتروني',
      messages: 'الرسائل',
      notes: 'الملاحظات',
      print: 'طباعة...',
      edit: 'تعديل',
      undo: 'تراجع',
      redo: 'إعادة',
      find: 'بحث',
      searchTheWeb: 'البحث على الويب',
      findItem: 'بحث...',
      findNext: 'البحث التالي',
      findPrevious: 'البحث السابق',
      cut: 'قص',
      copy: 'نسخ',
      paste: 'لصق',
      view: 'عرض',
      bookmarksBar: 'شريط الإشارات المرجعية',
      fullUrls: 'عناوين URL الكاملة',
      reload: 'إعادة تحميل',
      forceReload: 'إعادة تحميل قسري',
      toggleFullscreen: 'تبديل وضع ملء الشاشة',
      hideSidebar: 'إخفاء الشريط الجانبي',
      profiles: 'الملفات الشخصية',
      andy: 'Andy',
      benoit: 'Benoit',
      luis: 'Luis',
      editProfile: 'تعديل...',
      addProfile: 'إضافة ملف شخصي...',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      file: 'קובץ',
      newTab: 'כרטיסייה חדשה',
      newWindow: 'חלון חדש',
      newIncognitoWindow: 'חלון גלישה בסתר חדש',
      share: 'שתף',
      emailLink: 'קישור אימייל',
      messages: 'הודעות',
      notes: 'הערות',
      print: 'הדפס...',
      edit: 'ערוך',
      undo: 'בטל',
      redo: 'בצע שוב',
      find: 'מצא',
      searchTheWeb: 'חפש באינטרנט',
      findItem: 'מצא...',
      findNext: 'מצא הבא',
      findPrevious: 'מצא הקודם',
      cut: 'גזור',
      copy: 'העתק',
      paste: 'הדבק',
      view: 'תצוגה',
      bookmarksBar: 'סרגל סימניות',
      fullUrls: 'כתובות URL מלאות',
      reload: 'רענן',
      forceReload: 'רענן בכוח',
      toggleFullscreen: 'החלף מסך מלא',
      hideSidebar: 'הסתר סרגל צד',
      profiles: 'פרופילים',
      andy: 'Andy',
      benoit: 'Benoit',
      luis: 'Luis',
      editProfile: 'ערוך...',
      addProfile: 'הוסף פרופיל...',
    },
  },
};

// The provider is the dir attribute: the menus open in the top layer but stay
// in the document, so they inherit dir="rtl" from the bar.
export default function MenubarRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <ui-menubar class="w-72" dir=${dir} lang=${lang}>
      <ui-menubar-menu>
        <ui-menubar-trigger>${t.file}</ui-menubar-trigger>
        <ui-menubar-content>
          <ui-menubar-group>
            <ui-menubar-item>
              ${t.newTab} <ui-menubar-shortcut>⌘T</ui-menubar-shortcut>
            </ui-menubar-item>
            <ui-menubar-item>
              ${t.newWindow} <ui-menubar-shortcut>⌘N</ui-menubar-shortcut>
            </ui-menubar-item>
            <ui-menubar-item data-disabled>${t.newIncognitoWindow}</ui-menubar-item>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-group>
            <ui-menubar-sub>
              <ui-menubar-sub-trigger>${t.share}</ui-menubar-sub-trigger>
              <ui-menubar-sub-content>
                <ui-menubar-group>
                  <ui-menubar-item>${t.emailLink}</ui-menubar-item>
                  <ui-menubar-item>${t.messages}</ui-menubar-item>
                  <ui-menubar-item>${t.notes}</ui-menubar-item>
                </ui-menubar-group>
              </ui-menubar-sub-content>
            </ui-menubar-sub>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-group>
            <ui-menubar-item>
              ${t.print} <ui-menubar-shortcut>⌘P</ui-menubar-shortcut>
            </ui-menubar-item>
          </ui-menubar-group>
        </ui-menubar-content>
      </ui-menubar-menu>
      <ui-menubar-menu>
        <ui-menubar-trigger>${t.edit}</ui-menubar-trigger>
        <ui-menubar-content>
          <ui-menubar-group>
            <ui-menubar-item>
              ${t.undo} <ui-menubar-shortcut>⌘Z</ui-menubar-shortcut>
            </ui-menubar-item>
            <ui-menubar-item>
              ${t.redo} <ui-menubar-shortcut>⇧⌘Z</ui-menubar-shortcut>
            </ui-menubar-item>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-group>
            <ui-menubar-sub>
              <ui-menubar-sub-trigger>${t.find}</ui-menubar-sub-trigger>
              <ui-menubar-sub-content>
                <ui-menubar-group>
                  <ui-menubar-item>${t.searchTheWeb}</ui-menubar-item>
                </ui-menubar-group>
                <ui-menubar-separator></ui-menubar-separator>
                <ui-menubar-group>
                  <ui-menubar-item>${t.findItem}</ui-menubar-item>
                  <ui-menubar-item>${t.findNext}</ui-menubar-item>
                  <ui-menubar-item>${t.findPrevious}</ui-menubar-item>
                </ui-menubar-group>
              </ui-menubar-sub-content>
            </ui-menubar-sub>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-group>
            <ui-menubar-item>${t.cut}</ui-menubar-item>
            <ui-menubar-item>${t.copy}</ui-menubar-item>
            <ui-menubar-item>${t.paste}</ui-menubar-item>
          </ui-menubar-group>
        </ui-menubar-content>
      </ui-menubar-menu>
      <ui-menubar-menu>
        <ui-menubar-trigger>${t.view}</ui-menubar-trigger>
        <ui-menubar-content class="w-44">
          <ui-menubar-group>
            <ui-menubar-item type="checkbox">${t.bookmarksBar}</ui-menubar-item>
            <ui-menubar-item type="checkbox" checked>${t.fullUrls}</ui-menubar-item>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-group>
            <ui-menubar-item inset>
              ${t.reload} <ui-menubar-shortcut>⌘R</ui-menubar-shortcut>
            </ui-menubar-item>
            <ui-menubar-item data-disabled inset>
              ${t.forceReload} <ui-menubar-shortcut>⇧⌘R</ui-menubar-shortcut>
            </ui-menubar-item>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-group>
            <ui-menubar-item inset>${t.toggleFullscreen}</ui-menubar-item>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-group>
            <ui-menubar-item inset>${t.hideSidebar}</ui-menubar-item>
          </ui-menubar-group>
        </ui-menubar-content>
      </ui-menubar-menu>
      <ui-menubar-menu>
        <ui-menubar-trigger>${t.profiles}</ui-menubar-trigger>
        <ui-menubar-content>
          <ui-menubar-group aria-label=${t.profiles}>
            <ui-menubar-item type="radio" value="andy">${t.andy}</ui-menubar-item>
            <ui-menubar-item type="radio" value="benoit" checked>${t.benoit}</ui-menubar-item>
            <ui-menubar-item type="radio" value="Luis">${t.luis}</ui-menubar-item>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-group>
            <ui-menubar-item inset>${t.editProfile}</ui-menubar-item>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-group>
            <ui-menubar-item inset>${t.addProfile}</ui-menubar-item>
          </ui-menubar-group>
        </ui-menubar-content>
      </ui-menubar-menu>
    </ui-menubar>
  `;
}
