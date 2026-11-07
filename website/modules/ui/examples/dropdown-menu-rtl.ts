import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { CreditCardIcon, SettingsIcon, UserIcon } from '#lib/ui/lucide.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      open: 'Open',
      account: 'Account',
      profile: 'Profile',
      billing: 'Billing',
      settings: 'Settings',
      logout: 'Log out',
      team: 'Team',
      inviteUsers: 'Invite users',
      email: 'Email',
      message: 'Message',
      more: 'More',
      calendar: 'Calendar',
      chat: 'Chat',
      webhook: 'Webhook',
      advanced: 'Advanced...',
      newTeam: 'New Team',
      view: 'View',
      statusBar: 'Status Bar',
      activityBar: 'Activity Bar',
      panel: 'Panel',
      position: 'Position',
      top: 'Top',
      bottom: 'Bottom',
      right: 'Right',
      left: 'Left',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      open: 'افتح القائمة',
      account: 'الحساب',
      profile: 'الملف الشخصي',
      billing: 'الفوترة',
      settings: 'الإعدادات',
      logout: 'تسجيل الخروج',
      team: 'الفريق',
      inviteUsers: 'دعوة المستخدمين',
      email: 'البريد الإلكتروني',
      message: 'رسالة',
      more: 'المزيد',
      calendar: 'تقويم',
      chat: 'دردشة',
      webhook: 'خطاف ويب',
      advanced: 'متقدم...',
      newTeam: 'فريق جديد',
      view: 'عرض',
      statusBar: 'شريط الحالة',
      activityBar: 'شريط النشاط',
      panel: 'اللوحة',
      position: 'الموضع',
      top: 'أعلى',
      bottom: 'أسفل',
      right: 'يمين',
      left: 'يسار',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      open: 'פתח תפריט',
      account: 'חשבון',
      profile: 'פרופיל',
      billing: 'חיוב',
      settings: 'הגדרות',
      logout: 'התנתק',
      team: 'הצוות',
      inviteUsers: 'הזמן משתמשים',
      email: 'אימייל',
      message: 'הודעה',
      more: 'עוד',
      calendar: 'יומן',
      chat: "צ'אט",
      webhook: 'Webhook',
      advanced: 'מתקדם...',
      newTeam: 'צוות חדש',
      view: 'תצוגה',
      statusBar: 'שורת סטטוס',
      activityBar: 'שורת פעילות',
      panel: 'לוח',
      position: 'מיקום',
      top: 'למעלה',
      bottom: 'למטה',
      right: 'ימין',
      left: 'שמאל',
    },
  },
};

export default function DropdownMenuRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div dir=${dir} lang=${lang}>
      <ui-dropdown-menu>
        <ui-dropdown-menu-trigger>
          <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>${t.open}</button>
        </ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content class="w-36" data-lang=${lang}>
          <ui-dropdown-menu-group>
            <ui-dropdown-menu-sub>
              <ui-dropdown-menu-sub-trigger>${t.account}</ui-dropdown-menu-sub-trigger>
              <ui-dropdown-menu-sub-content data-lang=${lang}>
                <ui-dropdown-menu-group>
                  <ui-dropdown-menu-item>
                    ${UserIcon()}
                    ${t.profile}
                  </ui-dropdown-menu-item>
                  <ui-dropdown-menu-item>
                    ${CreditCardIcon()}
                    ${t.billing}
                  </ui-dropdown-menu-item>
                  <ui-dropdown-menu-item>
                    ${SettingsIcon()}
                    ${t.settings}
                  </ui-dropdown-menu-item>
                </ui-dropdown-menu-group>
              </ui-dropdown-menu-sub-content>
            </ui-dropdown-menu-sub>
          </ui-dropdown-menu-group>
          <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
          <ui-dropdown-menu-group>
            <ui-dropdown-menu-label>${t.team}</ui-dropdown-menu-label>
            <ui-dropdown-menu-item>${t.team}</ui-dropdown-menu-item>
            <ui-dropdown-menu-sub>
              <ui-dropdown-menu-sub-trigger>${t.inviteUsers}</ui-dropdown-menu-sub-trigger>
              <ui-dropdown-menu-sub-content data-lang=${lang}>
                <ui-dropdown-menu-item>${t.email}</ui-dropdown-menu-item>
                <ui-dropdown-menu-item>${t.message}</ui-dropdown-menu-item>
                <ui-dropdown-menu-sub>
                  <ui-dropdown-menu-sub-trigger>${t.more}</ui-dropdown-menu-sub-trigger>
                  <ui-dropdown-menu-sub-content data-lang=${lang}>
                    <ui-dropdown-menu-item>${t.calendar}</ui-dropdown-menu-item>
                    <ui-dropdown-menu-item>${t.chat}</ui-dropdown-menu-item>
                    <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                    <ui-dropdown-menu-item>${t.webhook}</ui-dropdown-menu-item>
                  </ui-dropdown-menu-sub-content>
                </ui-dropdown-menu-sub>
                <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                <ui-dropdown-menu-item>${t.advanced}</ui-dropdown-menu-item>
              </ui-dropdown-menu-sub-content>
            </ui-dropdown-menu-sub>
            <ui-dropdown-menu-item>
              ${t.newTeam}
              <ui-dropdown-menu-shortcut>⌘+T</ui-dropdown-menu-shortcut>
            </ui-dropdown-menu-item>
          </ui-dropdown-menu-group>
          <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
          <ui-dropdown-menu-group>
            <ui-dropdown-menu-label>${t.view}</ui-dropdown-menu-label>
            <ui-dropdown-menu-item type="checkbox" value="status-bar" checked>${t.statusBar}</ui-dropdown-menu-item>
            <ui-dropdown-menu-item type="checkbox" value="activity-bar">${t.activityBar}</ui-dropdown-menu-item>
            <ui-dropdown-menu-item type="checkbox" value="panel">${t.panel}</ui-dropdown-menu-item>
          </ui-dropdown-menu-group>
          <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
          <ui-dropdown-menu-group>
            <ui-dropdown-menu-label>${t.position}</ui-dropdown-menu-label>
            <ui-dropdown-menu-group aria-label=${t.position}>
              <ui-dropdown-menu-item type="radio" value="top">${t.top}</ui-dropdown-menu-item>
              <ui-dropdown-menu-item type="radio" value="bottom" checked>${t.bottom}</ui-dropdown-menu-item>
              <ui-dropdown-menu-item type="radio" value="right">${t.right}</ui-dropdown-menu-item>
              <ui-dropdown-menu-item type="radio" value="left">${t.left}</ui-dropdown-menu-item>
            </ui-dropdown-menu-group>
          </ui-dropdown-menu-group>
          <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
          <ui-dropdown-menu-group>
            <ui-dropdown-menu-item variant="destructive">${t.logout}</ui-dropdown-menu-item>
          </ui-dropdown-menu-group>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    </div>
  `;
}
