/**
 * Curated example markup per component, rendered as the "Preview" pane on
 * the component docs page.
 *
 * The map is intentionally hand-curated rather than auto-generated so each
 * component shows a representative use case.
 *
 * Architecture note: examples for **Tier-1 class-helper components** (button,
 * card, badge, alert, etc.) use native HTML elements with the helper output
 * inlined as `class="..."`. Examples for **Tier-2 stateful custom elements**
 * (dialog, popover, tabs, etc.) use the `<ui-*>` tags directly.
 *
 * The helper-class strings below are kept in sync with the registry helpers
 * by importing them at module load and producing each example string fresh.
 */
import {
  buttonClass,
} from '../../../../components/ui/button.ts';
import {
  badgeClass,
} from '../../../../components/ui/badge.ts';
import {
  alertClass,
  alertTitleClass,
  alertDescriptionClass,
} from '../../../../components/ui/alert.ts';
import {
  cardClass,
  cardHeaderClass,
  cardTitleClass,
  cardDescriptionClass,
  cardContentClass,
  cardFooterClass,
} from '../../../../components/ui/card.ts';
import { inputClass } from '../../../../components/ui/input.ts';
import { labelClass } from '../../../../components/ui/label.ts';
import { textareaClass } from '../../../../components/ui/textarea.ts';
import { checkboxClass } from '../../../../components/ui/checkbox.ts';
import { radioClass, radioGroupClass } from '../../../../components/ui/radio-group.ts';
import { switchInputClass, switchTrackClass } from '../../../../components/ui/switch.ts';
import {
  nativeSelectWrapperClass,
  nativeSelectClass,
  nativeSelectIconClass,
} from '../../../../components/ui/native-select.ts';
import {
  avatarClass,
  avatarImageClass,
  avatarFallbackClass,
  avatarGroupClass,
} from '../../../../components/ui/avatar.ts';
import { separatorClass } from '../../../../components/ui/separator.ts';
import { skeletonClass } from '../../../../components/ui/skeleton.ts';
import { kbdClass, kbdGroupClass } from '../../../../components/ui/kbd.ts';
import {
  tableContainerClass,
  tableClass,
  tableHeaderClass,
  tableBodyClass,
  tableRowClass,
  tableHeadClass,
  tableCellClass,
} from '../../../../components/ui/table.ts';
import { toggleClass } from '../../../../components/ui/toggle.ts';
import {
  breadcrumbListClass,
  breadcrumbItemClass,
  breadcrumbLinkClass,
  breadcrumbPageClass,
  breadcrumbSeparatorClass,
} from '../../../../components/ui/breadcrumb.ts';
import {
  paginationClass,
  paginationContentClass,
  paginationLinkClass,
  paginationPreviousClass,
  paginationNextClass,
} from '../../../../components/ui/pagination.ts';
import {
  fieldClass,
  hintClass,
  stackClass,
} from '../../../../lib/utils.ts';
import {
  dialogHeaderClass,
  dialogTitleClass,
  dialogDescriptionClass,
  dialogFooterClass,
} from '../../../../components/ui/dialog.ts';
import {
  popoverHeaderClass,
  popoverTitleClass,
  popoverDescriptionClass,
} from '../../../../components/ui/popover.ts';
import {
  alertDialogHeaderClass,
  alertDialogTitleClass,
  alertDialogDescriptionClass,
  alertDialogFooterClass,
} from '../../../../components/ui/alert-dialog.ts';

// --------------------------------------------------------------------------
// Tier-1 examples (class-helper functions on native HTML)
// --------------------------------------------------------------------------

const EXAMPLES: Record<string, string> = {
  button: `
    <div class="flex flex-wrap items-center gap-3">
      <button class="${buttonClass()}">Default</button>
      <button class="${buttonClass({ variant: 'secondary' })}">Secondary</button>
      <button class="${buttonClass({ variant: 'outline' })}">Outline</button>
      <button class="${buttonClass({ variant: 'ghost' })}">Ghost</button>
      <button class="${buttonClass({ variant: 'destructive' })}">Destructive</button>
      <button class="${buttonClass({ variant: 'link' })}">Link</button>
    </div>
  `,

  badge: `
    <div class="flex flex-wrap items-center gap-2">
      <span class="${badgeClass()}">Default</span>
      <span class="${badgeClass({ variant: 'secondary' })}">Secondary</span>
      <span class="${badgeClass({ variant: 'outline' })}">Outline</span>
      <span class="${badgeClass({ variant: 'destructive' })}">Destructive</span>
    </div>
  `,

  alert: `
    <div role="alert" class="${alertClass()}">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <div data-slot="alert-title" class="${alertTitleClass()}">Heads up!</div>
      <div data-slot="alert-description" class="${alertDescriptionClass()}">You can add components to your app using the cli.</div>
    </div>
  `,

  card: `
    <div class="${cardClass()} w-full max-w-sm">
      <div class="${cardHeaderClass()}">
        <div class="${cardTitleClass()}">Create project</div>
        <div class="${cardDescriptionClass()}">Deploy your new project in one-click.</div>
      </div>
      <div class="${cardContentClass()}">
        <div class="${fieldClass()}">
          <label class="${labelClass()}" for="card-name">Name</label>
          <input class="${inputClass()}" id="card-name" placeholder="Name of your project">
        </div>
      </div>
      <div class="${cardFooterClass()} justify-end gap-2">
        <button class="${buttonClass({ variant: 'outline' })}">Cancel</button>
        <button class="${buttonClass()}">Deploy</button>
      </div>
    </div>
  `,

  input: `
    <div class="${fieldClass()} max-w-sm w-full">
      <label class="${labelClass()}" for="email">Email</label>
      <input class="${inputClass()}" id="email" name="email" type="email" placeholder="you@example.com" aria-describedby="email-hint">
      <p class="${hintClass()}" id="email-hint">We'll never share it.</p>
    </div>
  `,

  textarea: `
    <div class="${fieldClass()} max-w-md w-full">
      <label class="${labelClass()}" for="message">Message</label>
      <textarea class="${textareaClass()}" id="message" name="message" rows="4" placeholder="Tell us how it's going…"></textarea>
    </div>
  `,

  label: `
    <div class="${fieldClass()}">
      <label class="${labelClass()}" for="lbl-demo">Accept terms</label>
      <input type="checkbox" id="lbl-demo" class="${checkboxClass()}" data-slot="checkbox">
    </div>
  `,

  checkbox: `
    <div class="flex items-center gap-2">
      <input type="checkbox" id="cb-1" class="${checkboxClass()}" data-slot="checkbox" checked>
      <label class="${labelClass()}" for="cb-1">Subscribe to newsletter</label>
    </div>
  `,

  switch: `
    <label class="flex items-center gap-2">
      <input type="checkbox" role="switch" class="${switchInputClass()}" name="notify" checked>
      <span class="${switchTrackClass()}"></span>
      <span class="${labelClass()}">Notifications</span>
    </label>
  `,

  radio_group: `
    <div role="radiogroup" class="${radioGroupClass()}">
      <div class="flex items-center gap-2">
        <input type="radio" name="plan" value="basic" id="plan-basic" class="${radioClass()}" data-slot="radio" checked>
        <label class="${labelClass()}" for="plan-basic">Basic</label>
      </div>
      <div class="flex items-center gap-2">
        <input type="radio" name="plan" value="pro" id="plan-pro" class="${radioClass()}" data-slot="radio">
        <label class="${labelClass()}" for="plan-pro">Pro</label>
      </div>
    </div>
  `,

  'native-select': `
    <div class="${nativeSelectWrapperClass()}">
      <select class="${nativeSelectClass()}" name="plan">
        <option>Basic</option>
        <option>Pro</option>
        <option>Enterprise</option>
      </select>
      <svg class="${nativeSelectIconClass()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </div>
  `,

  avatar: `
    <div class="flex items-center gap-3">
      <span class="${avatarClass()}" data-size="default" data-slot="avatar">
        <img class="${avatarImageClass()}" src="https://github.com/shadcn.png" alt="">
        <span class="${avatarFallbackClass()}">SC</span>
      </span>
      <div class="${avatarGroupClass()}">
        <span class="${avatarClass()}" data-size="default" data-slot="avatar">
          <span class="${avatarFallbackClass()}">A</span>
        </span>
        <span class="${avatarClass()}" data-size="default" data-slot="avatar">
          <span class="${avatarFallbackClass()}">B</span>
        </span>
        <span class="${avatarClass()}" data-size="default" data-slot="avatar">
          <span class="${avatarFallbackClass()}">C</span>
        </span>
      </div>
    </div>
  `,

  separator: `
    <div class="w-64">
      <div>Above</div>
      <div role="none" class="${separatorClass()} my-3" data-orientation="horizontal"></div>
      <div>Below</div>
    </div>
  `,

  skeleton: `
    <div class="flex flex-col gap-3 w-full max-w-sm">
      <div class="${skeletonClass()} h-4 w-3/4"></div>
      <div class="${skeletonClass()} h-4 w-1/2"></div>
      <div class="${skeletonClass()} h-4 w-2/3"></div>
    </div>
  `,

  'aspect-ratio': `
    <div class="aspect-[16/9] w-full max-w-md rounded-md bg-muted flex items-center justify-center text-muted-foreground">
      16:9
    </div>
  `,

  kbd: `
    <div class="${kbdGroupClass()}">
      <kbd class="${kbdClass()}">⌘</kbd>
      <kbd class="${kbdClass()}">Shift</kbd>
      <kbd class="${kbdClass()}">P</kbd>
    </div>
  `,

  progress: `
    <div class="w-64">
      <ui-progress value="42"></ui-progress>
    </div>
  `,

  table: `
    <div class="${tableContainerClass()} max-w-md w-full">
      <table class="${tableClass()}">
        <thead class="${tableHeaderClass()}">
          <tr class="${tableRowClass()}">
            <th class="${tableHeadClass()}">Invoice</th>
            <th class="${tableHeadClass()}">Status</th>
            <th class="${tableHeadClass()} text-right">Amount</th>
          </tr>
        </thead>
        <tbody class="${tableBodyClass()}">
          <tr class="${tableRowClass()}">
            <td class="${tableCellClass()}">INV001</td>
            <td class="${tableCellClass()}">Paid</td>
            <td class="${tableCellClass()} text-right">$250.00</td>
          </tr>
          <tr class="${tableRowClass()}">
            <td class="${tableCellClass()}">INV002</td>
            <td class="${tableCellClass()}">Pending</td>
            <td class="${tableCellClass()} text-right">$150.00</td>
          </tr>
        </tbody>
      </table>
    </div>
  `,

  toggle: `
    <ui-toggle aria-label="Toggle italic">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
    </ui-toggle>
  `,

  'toggle-group': `
    <ui-toggle-group type="single" value="center">
      <ui-toggle-group-item value="left" aria-label="Left">L</ui-toggle-group-item>
      <ui-toggle-group-item value="center" aria-label="Center">C</ui-toggle-group-item>
      <ui-toggle-group-item value="right" aria-label="Right">R</ui-toggle-group-item>
    </ui-toggle-group>
  `,

  breadcrumb: `
    <nav aria-label="breadcrumb" data-slot="breadcrumb">
      <ol class="${breadcrumbListClass()}">
        <li class="${breadcrumbItemClass()}"><a class="${breadcrumbLinkClass()}" href="#">Home</a></li>
        <li class="${breadcrumbSeparatorClass()}" role="presentation" aria-hidden="true">/</li>
        <li class="${breadcrumbItemClass()}"><a class="${breadcrumbLinkClass()}" href="#">Docs</a></li>
        <li class="${breadcrumbSeparatorClass()}" role="presentation" aria-hidden="true">/</li>
        <li class="${breadcrumbItemClass()}"><span class="${breadcrumbPageClass()}" aria-current="page">Components</span></li>
      </ol>
    </nav>
  `,

  pagination: `
    <nav role="navigation" aria-label="pagination" class="${paginationClass()}">
      <ul class="${paginationContentClass()}">
        <li><a class="${paginationPreviousClass()}" href="#">‹ Previous</a></li>
        <li><a class="${paginationLinkClass()}" href="#">1</a></li>
        <li><a class="${paginationLinkClass({ isActive: true })}" aria-current="page">2</a></li>
        <li><a class="${paginationLinkClass()}" href="#">3</a></li>
        <li><a class="${paginationNextClass()}" href="#">Next ›</a></li>
      </ul>
    </nav>
  `,

  // ------------------------------------------------------------------------
  // Tier-2 examples (custom elements)
  // ------------------------------------------------------------------------

  dialog: `
    <ui-dialog>
      <ui-dialog-trigger>
        <button class="${buttonClass({ variant: 'outline' })}">Open dialog</button>
      </ui-dialog-trigger>
      <ui-dialog-content>
        <div class="${dialogHeaderClass()}">
          <h2 class="${dialogTitleClass()}">Edit profile</h2>
          <p class="${dialogDescriptionClass()}">Make changes to your profile here.</p>
        </div>
        <div class="${fieldClass()}">
          <label class="${labelClass()}" for="dlg-name">Name</label>
          <input class="${inputClass()}" id="dlg-name" placeholder="Your name">
        </div>
        <div class="${dialogFooterClass()}">
          <ui-dialog-close><button class="${buttonClass({ variant: 'outline' })}">Cancel</button></ui-dialog-close>
          <button class="${buttonClass()}">Save</button>
        </div>
      </ui-dialog-content>
    </ui-dialog>
  `,

  alert_dialog: `
    <ui-alert-dialog>
      <ui-alert-dialog-trigger>
        <button class="${buttonClass({ variant: 'destructive' })}">Delete account</button>
      </ui-alert-dialog-trigger>
      <ui-alert-dialog-content>
        <div class="${alertDialogHeaderClass()}">
          <h2 class="${alertDialogTitleClass()}">Are you sure?</h2>
          <p class="${alertDialogDescriptionClass()}">This action cannot be undone.</p>
        </div>
        <div class="${alertDialogFooterClass()}">
          <ui-alert-dialog-cancel><button class="${buttonClass({ variant: 'outline' })}">Cancel</button></ui-alert-dialog-cancel>
          <ui-alert-dialog-action><button class="${buttonClass({ variant: 'destructive' })}">Yes, delete</button></ui-alert-dialog-action>
        </div>
      </ui-alert-dialog-content>
    </ui-alert-dialog>
  `,

  popover: `
    <ui-popover>
      <ui-popover-trigger>
        <button class="${buttonClass({ variant: 'outline' })}">Open popover</button>
      </ui-popover-trigger>
      <ui-popover-content side="bottom" align="start">
        <div class="${popoverHeaderClass()}">
          <h3 class="${popoverTitleClass()}">Filter</h3>
          <p class="${popoverDescriptionClass()}">Tag and status.</p>
        </div>
        <div class="${stackClass('sm')} mt-3">
          <label class="${labelClass()}">Status</label>
          <select class="${nativeSelectClass()}"><option>Open</option><option>Closed</option></select>
        </div>
      </ui-popover-content>
    </ui-popover>
  `,

  tooltip: `
    <ui-tooltip delay-duration="200">
      <ui-tooltip-trigger>
        <button class="${buttonClass({ variant: 'outline', size: 'icon' })}" aria-label="Help">?</button>
      </ui-tooltip-trigger>
      <ui-tooltip-content side="top">Helpful tip appears on hover</ui-tooltip-content>
    </ui-tooltip>
  `,

  'hover-card': `
    <ui-hover-card open-delay="300" close-delay="200">
      <ui-hover-card-trigger>
        <a class="${buttonClass({ variant: 'link' })}" href="#">@vivek</a>
      </ui-hover-card-trigger>
      <ui-hover-card-content>
        <div class="flex gap-3">
          <span class="${avatarClass()}" data-size="default">
            <span class="${avatarFallbackClass()}">V</span>
          </span>
          <div>
            <h4 class="font-semibold">@vivek</h4>
            <p class="text-sm text-muted-foreground">Building webjs.</p>
          </div>
        </div>
      </ui-hover-card-content>
    </ui-hover-card>
  `,

  tabs: `
    <ui-tabs value="account" class="w-full max-w-md">
      <ui-tabs-list>
        <ui-tabs-trigger value="account">Account</ui-tabs-trigger>
        <ui-tabs-trigger value="password">Password</ui-tabs-trigger>
      </ui-tabs-list>
      <ui-tabs-content value="account" class="${cardClass()} mt-3 p-6">
        <h3 class="${cardTitleClass()}">Account</h3>
        <p class="${cardDescriptionClass()} mt-1">Manage your account settings.</p>
      </ui-tabs-content>
      <ui-tabs-content value="password" class="${cardClass()} mt-3 p-6">
        <h3 class="${cardTitleClass()}">Password</h3>
        <p class="${cardDescriptionClass()} mt-1">Change your password here.</p>
      </ui-tabs-content>
    </ui-tabs>
  `,

  accordion: `
    <ui-accordion type="single" collapsible class="w-full max-w-md">
      <ui-accordion-item value="item-1">
        <ui-accordion-trigger>Is it accessible?</ui-accordion-trigger>
        <ui-accordion-content>Yes — uses the WAI-ARIA accordion pattern.</ui-accordion-content>
      </ui-accordion-item>
      <ui-accordion-item value="item-2">
        <ui-accordion-trigger>Is it styled?</ui-accordion-trigger>
        <ui-accordion-content>Yes — matches shadcn's design tokens.</ui-accordion-content>
      </ui-accordion-item>
    </ui-accordion>
  `,

  collapsible: `
    <ui-collapsible class="w-full max-w-md">
      <ui-collapsible-trigger>
        <button class="${buttonClass({ variant: 'outline' })}">Show / Hide details</button>
      </ui-collapsible-trigger>
      <ui-collapsible-content class="mt-3 rounded-md border p-4 text-sm">
        Hidden content revealed on trigger click. Real content, real DOM — no animation in v1.
      </ui-collapsible-content>
    </ui-collapsible>
  `,

  'dropdown-menu': `
    <ui-dropdown-menu>
      <ui-dropdown-menu-trigger>
        <button class="${buttonClass({ variant: 'outline' })}">Open menu</button>
      </ui-dropdown-menu-trigger>
      <ui-dropdown-menu-content align="start">
        <ui-dropdown-menu-label>My Account</ui-dropdown-menu-label>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-item>Profile</ui-dropdown-menu-item>
        <ui-dropdown-menu-item>Billing</ui-dropdown-menu-item>
        <ui-dropdown-menu-item>Settings</ui-dropdown-menu-item>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-item variant="destructive">Sign out</ui-dropdown-menu-item>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  `,

  sonner: `
    <div class="flex flex-col items-center gap-3">
      <ui-sonner position="bottom-right"></ui-sonner>
      <button class="${buttonClass({ variant: 'outline' })}" onclick="import('/components/ui/sonner.ts').then(m => m.toast.success('Saved!', {description: 'Your changes were saved.'}))">Show toast</button>
    </div>
  `,
};

// Aliases — registry uses hyphens; some keys use underscores to avoid TS
// reserved-word collisions in the JSON file.
const HYPHENATED_ALIASES: Record<string, string> = {
  'alert-dialog': 'alert_dialog',
  'radio-group': 'radio_group',
};

export function getExample(name: string): string | null {
  const key = HYPHENATED_ALIASES[name] || name;
  return EXAMPLES[key] || null;
}
