import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  navigationMenuLinkClass, navigationMenuTriggerStyle,
} from '#modules/ui/components/navigation-menu.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      gettingStarted: 'Getting started',
      introduction: 'Introduction',
      introductionDesc: 'Re-usable components built with Tailwind CSS.',
      installation: 'Installation',
      installationDesc: 'How to install dependencies and structure your app.',
      typography: 'Typography',
      typographyDesc: 'Styles for headings, paragraphs, lists...etc',
      components: 'Components',
      alertDialog: 'Alert Dialog',
      alertDialogDesc:
        'A modal dialog that interrupts the user with important content and expects a response.',
      hoverCard: 'Hover Card',
      hoverCardDesc:
        'For sighted users to preview content available behind a link.',
      progress: 'Progress',
      progressDesc:
        'Displays an indicator showing the completion progress of a task, typically displayed as a progress bar.',
      scrollArea: 'Scroll-area',
      scrollAreaDesc: 'Visually or semantically separates content.',
      tabs: 'Tabs',
      tabsDesc:
        'A set of layered sections of content, known as tab panels, that are displayed one at a time.',
      tooltip: 'Tooltip',
      tooltipDesc:
        'A popup that displays information related to an element when the element receives keyboard focus or the mouse hovers over it.',
      docs: 'Docs',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      gettingStarted: 'البدء',
      introduction: 'مقدمة',
      introductionDesc:
        'مكونات قابلة لإعادة الاستخدام مبنية باستخدام Tailwind CSS.',
      installation: 'التثبيت',
      installationDesc: 'كيفية تثبيت التبعيات وتنظيم تطبيقك.',
      typography: 'الطباعة',
      typographyDesc: 'أنماط للعناوين والفقرات والقوائم...إلخ',
      components: 'المكونات',
      alertDialog: 'حوار التنبيه',
      alertDialogDesc: 'حوار نافذة يقطع المستخدم بمحتوى مهم ويتوقع استجابة.',
      hoverCard: 'بطاقة التحويم',
      hoverCardDesc: 'للمستخدمين المبصرين لمعاينة المحتوى المتاح خلف الرابط.',
      progress: 'التقدم',
      progressDesc:
        'يعرض مؤشرًا يوضح تقدم إتمام المهمة، عادةً يتم عرضه كشريط تقدم.',
      scrollArea: 'منطقة التمرير',
      scrollAreaDesc: 'يفصل المحتوى بصريًا أو دلاليًا.',
      tabs: 'التبويبات',
      tabsDesc:
        'مجموعة من أقسام المحتوى المتعددة الطبقات، المعروفة بألواح التبويب، التي يتم عرضها واحدة في كل مرة.',
      tooltip: 'تلميح',
      tooltipDesc:
        'نافذة منبثقة تعرض معلومات متعلقة بعنصر عندما يتلقى العنصر التركيز على لوحة المفاتيح أو عند تحويم الماوس فوقه.',
      docs: 'الوثائق',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      gettingStarted: 'התחלה',
      introduction: 'הקדמה',
      introductionDesc: 'רכיבים לשימוש חוזר שנבנו עם Tailwind CSS.',
      installation: 'התקנה',
      installationDesc: 'כיצד להתקין תלויות ולבנות את האפליקציה שלך.',
      typography: 'טיפוגרפיה',
      typographyDesc: "סגנונות לכותרות, פסקאות, רשימות...וכו'",
      components: 'רכיבים',
      alertDialog: 'דיאלוג התראה',
      alertDialogDesc: 'דיאלוג מודאלי שמפריע למשתמש עם תוכן חשוב ומצפה לתגובה.',
      hoverCard: 'כרטיס ריחוף',
      hoverCardDesc:
        'למשתמשים רואים כדי להציג תצוגה מקדימה של תוכן זמין מאחורי קישור.',
      progress: 'התקדמות',
      progressDesc:
        'מציג אינדיקטור המציג את התקדמות ההשלמה של משימה, בדרך כלל מוצג כסרגל התקדמות.',
      scrollArea: 'אזור גלילה',
      scrollAreaDesc: 'מפריד תוכן חזותית או סמנטית.',
      tabs: 'כרטיסיות',
      tabsDesc:
        'קבוצה של חלקי תוכן מרובדים, המכונים לוחות כרטיסיות, המוצגים אחד בכל פעם.',
      tooltip: 'טולטיפ',
      tooltipDesc:
        'חלון קופץ המציג מידע הקשור לאלמנט כאשר האלמנט מקבל מיקוד מקלדת או כאשר העכבר מרחף מעליו.',
      docs: 'תיעוד',
    },
  },
};

type Key = keyof typeof translations.en.values;

const components: { titleKey: Key; descriptionKey: Key; href: string }[] = [
  { titleKey: 'alertDialog', descriptionKey: 'alertDialogDesc', href: '/docs/primitives/alert-dialog' },
  { titleKey: 'hoverCard', descriptionKey: 'hoverCardDesc', href: '/docs/primitives/hover-card' },
  { titleKey: 'progress', descriptionKey: 'progressDesc', href: '/docs/primitives/progress' },
  { titleKey: 'scrollArea', descriptionKey: 'scrollAreaDesc', href: '/docs/primitives/scroll-area' },
  { titleKey: 'tabs', descriptionKey: 'tabsDesc', href: '/docs/primitives/tabs' },
  { titleKey: 'tooltip', descriptionKey: 'tooltipDesc', href: '/docs/primitives/tooltip' },
];

const ListItem = (href: string, title: string, body: string) => html`
  <li>
    <ui-navigation-menu-link href=${href}>
      <div class="flex flex-col gap-1 text-sm">
        <div class="leading-none font-medium">${title}</div>
        <div class="line-clamp-2 text-muted-foreground">${body}</div>
      </div>
    </ui-navigation-menu-link>
  </li>
`;

// The provider is the dir attribute: the panels stay inside the nav, so they
// inherit dir="rtl" from the root.
export default function NavigationMenuRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <ui-navigation-menu dir=${dir} lang=${lang}>
      <ui-navigation-menu-list>
        <ui-navigation-menu-item>
          <ui-navigation-menu-trigger>${t.gettingStarted}</ui-navigation-menu-trigger>
          <ui-navigation-menu-content>
            <ul class="w-96">
              ${ListItem('/docs', t.introduction, t.introductionDesc)}
              ${ListItem('/docs/installation', t.installation, t.installationDesc)}
              ${ListItem('/docs/primitives/typography', t.typography, t.typographyDesc)}
            </ul>
          </ui-navigation-menu-content>
        </ui-navigation-menu-item>
        <ui-navigation-menu-item class="hidden md:flex">
          <ui-navigation-menu-trigger>${t.components}</ui-navigation-menu-trigger>
          <ui-navigation-menu-content>
            <ul class="grid w-[400px] gap-2 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
              ${components.map((component) => ListItem(component.href, t[component.titleKey], t[component.descriptionKey]))}
            </ul>
          </ui-navigation-menu-content>
        </ui-navigation-menu-item>
        <ui-navigation-menu-item>
          <a href="/docs" data-slot="navigation-menu-link" class=${cn(navigationMenuLinkClass(), navigationMenuTriggerStyle())}>${t.docs}</a>
        </ui-navigation-menu-item>
      </ui-navigation-menu-list>
    </ui-navigation-menu>
  `;
}
