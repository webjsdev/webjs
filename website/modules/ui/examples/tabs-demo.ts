import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass, cardContentClass,
} from '#modules/ui/components/card.ts';

export default function TabsDemo() {
  return html`
    <ui-tabs value="overview" class="w-[400px]">
      <ui-tabs-list>
        <ui-tabs-trigger value="overview">Overview</ui-tabs-trigger>
        <ui-tabs-trigger value="analytics">Analytics</ui-tabs-trigger>
        <ui-tabs-trigger value="reports">Reports</ui-tabs-trigger>
        <ui-tabs-trigger value="settings">Settings</ui-tabs-trigger>
      </ui-tabs-list>
      <ui-tabs-content value="overview">
        <div data-slot="card" data-size="default" class=${cardClass()}>
          <div data-slot="card-header" class=${cardHeaderClass()}>
            <div data-slot="card-title" class=${cardTitleClass()}>Overview</div>
            <div data-slot="card-description" class=${cardDescriptionClass()}>
              View your key metrics and recent project activity. Track progress
              across all your active projects.
            </div>
          </div>
          <div data-slot="card-content" class=${cn(cardContentClass(), 'text-sm text-muted-foreground')}>
            You have 12 active projects and 3 pending tasks.
          </div>
        </div>
      </ui-tabs-content>
      <ui-tabs-content value="analytics">
        <div data-slot="card" data-size="default" class=${cardClass()}>
          <div data-slot="card-header" class=${cardHeaderClass()}>
            <div data-slot="card-title" class=${cardTitleClass()}>Analytics</div>
            <div data-slot="card-description" class=${cardDescriptionClass()}>
              Track performance and user engagement metrics. Monitor trends and
              identify growth opportunities.
            </div>
          </div>
          <div data-slot="card-content" class=${cn(cardContentClass(), 'text-sm text-muted-foreground')}>
            Page views are up 25% compared to last month.
          </div>
        </div>
      </ui-tabs-content>
      <ui-tabs-content value="reports">
        <div data-slot="card" data-size="default" class=${cardClass()}>
          <div data-slot="card-header" class=${cardHeaderClass()}>
            <div data-slot="card-title" class=${cardTitleClass()}>Reports</div>
            <div data-slot="card-description" class=${cardDescriptionClass()}>
              Generate and download your detailed reports. Export data in
              multiple formats for analysis.
            </div>
          </div>
          <div data-slot="card-content" class=${cn(cardContentClass(), 'text-sm text-muted-foreground')}>
            You have 5 reports ready and available to export.
          </div>
        </div>
      </ui-tabs-content>
      <ui-tabs-content value="settings">
        <div data-slot="card" data-size="default" class=${cardClass()}>
          <div data-slot="card-header" class=${cardHeaderClass()}>
            <div data-slot="card-title" class=${cardTitleClass()}>Settings</div>
            <div data-slot="card-description" class=${cardDescriptionClass()}>
              Manage your account preferences and options. Customize your
              experience to fit your needs.
            </div>
          </div>
          <div data-slot="card-content" class=${cn(cardContentClass(), 'text-sm text-muted-foreground')}>
            Configure notifications, security, and themes.
          </div>
        </div>
      </ui-tabs-content>
    </ui-tabs>
  `;
}
