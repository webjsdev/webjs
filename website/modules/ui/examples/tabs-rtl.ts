import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass, cardContentClass,
} from '#modules/ui/components/card.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      overview: 'Overview',
      analytics: 'Analytics',
      reports: 'Reports',
      settings: 'Settings',
      overviewTitle: 'Overview',
      overviewDesc:
        'View your key metrics and recent project activity. Track progress across all your active projects.',
      overviewContent: 'You have 12 active projects and 3 pending tasks.',
      analyticsTitle: 'Analytics',
      analyticsDesc:
        'Track performance and user engagement metrics. Monitor trends and identify growth opportunities.',
      analyticsContent: 'Page views are up 25% compared to last month.',
      reportsTitle: 'Reports',
      reportsDesc:
        'Generate and download your detailed reports. Export data in multiple formats for analysis.',
      reportsContent: 'You have 5 reports ready and available to export.',
      settingsTitle: 'Settings',
      settingsDesc:
        'Manage your account preferences and options. Customize your experience to fit your needs.',
      settingsContent: 'Configure notifications, security, and themes.',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      overview: 'نظرة عامة',
      analytics: 'التحليلات',
      reports: 'التقارير',
      settings: 'الإعدادات',
      overviewTitle: 'نظرة عامة',
      overviewDesc:
        'عرض مقاييسك الرئيسية وأنشطة المشروع الأخيرة. تتبع التقدم عبر جميع مشاريعك النشطة.',
      overviewContent: 'لديك ١٢ مشروعًا نشطًا و٣ مهام معلقة.',
      analyticsTitle: 'التحليلات',
      analyticsDesc:
        'تتبع مقاييس الأداء ومشاركة المستخدمين. راقب الاتجاهات وحدد فرص النمو.',
      analyticsContent: 'زادت مشاهدات الصفحة بنسبة ٢٥٪ مقارنة بالشهر الماضي.',
      reportsTitle: 'التقارير',
      reportsDesc:
        'إنشاء وتنزيل تقاريرك التفصيلية. تصدير البيانات بتنسيقات متعددة للتحليل.',
      reportsContent: 'لديك ٥ تقارير جاهزة ومتاحة للتصدير.',
      settingsTitle: 'الإعدادات',
      settingsDesc:
        'إدارة تفضيلات حسابك وخياراته. تخصيص تجربتك لتناسب احتياجاتك.',
      settingsContent: 'تكوين الإشعارات والأمان والسمات.',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      overview: 'סקירה כללית',
      analytics: 'אנליטיקה',
      reports: 'דוחות',
      settings: 'הגדרות',
      overviewTitle: 'סקירה כללית',
      overviewDesc:
        'הצג את המדדים העיקריים שלך ופעילות הפרויקט האחרונה. עקוב אחר התקדמות בכל הפרויקטים הפעילים שלך.',
      overviewContent: 'יש לך 12 פרויקטים פעילים ו-3 משימות ממתינות.',
      analyticsTitle: 'אנליטיקה',
      analyticsDesc:
        'עקוב אחר ביצועים ומדדי מעורבות משתמשים. עקוב אחר מגמות וזהה הזדמנויות צמיחה.',
      analyticsContent: 'צפיות בדף עלו ב-25% בהשוואה לחודש שעבר.',
      reportsTitle: 'דוחות',
      reportsDesc:
        'צור והורד את הדוחות המפורטים שלך. ייצא נתונים בפורמטים מרובים לניתוח.',
      reportsContent: 'יש לך 5 דוחות מוכנים וזמינים לייצוא.',
      settingsTitle: 'הגדרות',
      settingsDesc:
        'נהל את העדפות החשבון והאפשרויות שלך. התאם אישית את החוויה שלך כך שתתאים לצרכים שלך.',
      settingsContent: 'הגדר התראות, אבטחה וערכות נושא.',
    },
  },
};

function panel(value: string, title: string, description: string, content: string) {
  return html`
    <ui-tabs-content value=${value}>
      <div data-slot="card" data-size="default" class=${cardClass()}>
        <div data-slot="card-header" class=${cardHeaderClass()}>
          <div data-slot="card-title" class=${cardTitleClass()}>${title}</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>${description}</div>
        </div>
        <div data-slot="card-content" class=${cn(cardContentClass(), 'text-sm text-muted-foreground')}>${content}</div>
      </div>
    </ui-tabs-content>
  `;
}

// The provider is the dir attribute: the tabs style themselves with logical
// properties, so dir="rtl" on the root flips the whole layout.
export default function TabsRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <ui-tabs value="overview" dir=${dir} lang=${lang} class="w-full max-w-sm">
      <ui-tabs-list>
        <ui-tabs-trigger value="overview">${t.overview}</ui-tabs-trigger>
        <ui-tabs-trigger value="analytics">${t.analytics}</ui-tabs-trigger>
        <ui-tabs-trigger value="reports">${t.reports}</ui-tabs-trigger>
        <ui-tabs-trigger value="settings">${t.settings}</ui-tabs-trigger>
      </ui-tabs-list>
      ${panel('overview', t.overviewTitle, t.overviewDesc, t.overviewContent)}
      ${panel('analytics', t.analyticsTitle, t.analyticsDesc, t.analyticsContent)}
      ${panel('reports', t.reportsTitle, t.reportsDesc, t.reportsContent)}
      ${panel('settings', t.settingsTitle, t.settingsDesc, t.settingsContent)}
    </ui-tabs>
  `;
}
