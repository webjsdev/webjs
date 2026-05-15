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
import { tabsListClass } from '../../../../components/ui/tabs.ts';
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
  alertDialogContentClass,
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
        <ui-dropdown-menu-sub>
          <ui-dropdown-menu-sub-trigger>Invite users</ui-dropdown-menu-sub-trigger>
          <ui-dropdown-menu-sub-content>
            <ui-dropdown-menu-item>Email</ui-dropdown-menu-item>
            <ui-dropdown-menu-item>Message</ui-dropdown-menu-item>
            <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
            <ui-dropdown-menu-item>More…</ui-dropdown-menu-item>
          </ui-dropdown-menu-sub-content>
        </ui-dropdown-menu-sub>
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

// ---------------------------------------------------------------------------
// Per-variant + per-size example snippets — one per key, used by the
// component docs page to render a stack of <ComponentPreview>-style cards
// under "Variants" and "Sizes" headings, mirroring shadcn's docs.
//
// Keys match COMPONENT_API[name].variants / .sizes in component-api.ts.
// Lookups go through getVariantExamples(name) / getSizeExamples(name)
// which also handles the hyphen-aliased keys (alert-dialog, etc.).
// ---------------------------------------------------------------------------

// 24x24 lucide-style settings cog used by the icon-size button samples.
const ICON_SETTINGS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

const VARIANT_EXAMPLES: Record<string, Record<string, string>> = {
  button: {
    default: `<button class="${buttonClass({ variant: 'default' })}">Button</button>`,
    destructive: `<button class="${buttonClass({ variant: 'destructive' })}">Button</button>`,
    outline: `<button class="${buttonClass({ variant: 'outline' })}">Button</button>`,
    secondary: `<button class="${buttonClass({ variant: 'secondary' })}">Button</button>`,
    ghost: `<button class="${buttonClass({ variant: 'ghost' })}">Button</button>`,
    link: `<button class="${buttonClass({ variant: 'link' })}">Button</button>`,
  },
  badge: {
    default: `<span class="${badgeClass({ variant: 'default' })}">Badge</span>`,
    secondary: `<span class="${badgeClass({ variant: 'secondary' })}">Badge</span>`,
    destructive: `<span class="${badgeClass({ variant: 'destructive' })}">Badge</span>`,
    outline: `<span class="${badgeClass({ variant: 'outline' })}">Badge</span>`,
    ghost: `<span class="${badgeClass({ variant: 'ghost' })}">Badge</span>`,
    link: `<span class="${badgeClass({ variant: 'link' })}">Badge</span>`,
  },
  alert: {
    default: `
      <div class="${alertClass({ variant: 'default' })} max-w-md">
        <h5 class="${alertTitleClass()}">Heads up!</h5>
        <p class="${alertDescriptionClass()}">You can add components to your app using the CLI.</p>
      </div>
    `,
    destructive: `
      <div class="${alertClass({ variant: 'destructive' })} max-w-md">
        <h5 class="${alertTitleClass()}">Error</h5>
        <p class="${alertDescriptionClass()}">Your session has expired. Please log in again.</p>
      </div>
    `,
  },
  toggle: {
    default: `<button class="${toggleClass({ variant: 'default' })}" data-state="on" aria-pressed="true">B</button>`,
    outline: `<button class="${toggleClass({ variant: 'outline' })}" data-state="on" aria-pressed="true">B</button>`,
  },
  tabs: {
    default: `
      <ui-tabs value="account" class="w-full max-w-sm">
        <ui-tabs-list variant="default">
          <ui-tabs-trigger value="account">Account</ui-tabs-trigger>
          <ui-tabs-trigger value="password">Password</ui-tabs-trigger>
        </ui-tabs-list>
      </ui-tabs>
    `,
    underline: `
      <ui-tabs value="account" class="w-full max-w-sm">
        <ui-tabs-list variant="underline">
          <ui-tabs-trigger value="account">Account</ui-tabs-trigger>
          <ui-tabs-trigger value="password">Password</ui-tabs-trigger>
        </ui-tabs-list>
      </ui-tabs>
    `,
  },
  'radio-group': {
    vertical: `
      <div role="radiogroup" class="${radioGroupClass({ orientation: 'vertical' })}">
        <div class="flex items-center gap-2">
          <input type="radio" name="plan-v" id="plan-v-basic" data-slot="radio" class="${radioClass()}" checked>
          <label class="${labelClass()}" for="plan-v-basic">Basic</label>
        </div>
        <div class="flex items-center gap-2">
          <input type="radio" name="plan-v" id="plan-v-pro" data-slot="radio" class="${radioClass()}">
          <label class="${labelClass()}" for="plan-v-pro">Pro</label>
        </div>
        <div class="flex items-center gap-2">
          <input type="radio" name="plan-v" id="plan-v-enterprise" data-slot="radio" class="${radioClass()}">
          <label class="${labelClass()}" for="plan-v-enterprise">Enterprise</label>
        </div>
      </div>
    `,
    horizontal: `
      <div role="radiogroup" class="${radioGroupClass({ orientation: 'horizontal' })}">
        <div class="flex items-center gap-2">
          <input type="radio" name="plan-h" id="plan-h-basic" data-slot="radio" class="${radioClass()}" checked>
          <label class="${labelClass()}" for="plan-h-basic">Basic</label>
        </div>
        <div class="flex items-center gap-2">
          <input type="radio" name="plan-h" id="plan-h-pro" data-slot="radio" class="${radioClass()}">
          <label class="${labelClass()}" for="plan-h-pro">Pro</label>
        </div>
        <div class="flex items-center gap-2">
          <input type="radio" name="plan-h" id="plan-h-enterprise" data-slot="radio" class="${radioClass()}">
          <label class="${labelClass()}" for="plan-h-enterprise">Enterprise</label>
        </div>
      </div>
    `,
  },
  // dropdown-menu's variant lives on <ui-dropdown-menu-item>. Wrap a
  // single item in a popover-styled card so the colour difference
  // (default foreground vs destructive red) is visible without forcing
  // the reader to open a full menu.
  'dropdown-menu': {
    default: `
      <div class="rounded-md border bg-popover p-1 text-popover-foreground shadow-md min-w-[12rem]">
        <ui-dropdown-menu-item>Profile</ui-dropdown-menu-item>
      </div>
    `,
    destructive: `
      <div class="rounded-md border bg-popover p-1 text-popover-foreground shadow-md min-w-[12rem]">
        <ui-dropdown-menu-item variant="destructive">Sign out</ui-dropdown-menu-item>
      </div>
    `,
  },
  // toggle-group variant + size are root-level attributes that
  // propagate to items. Each card shows a full 3-item group so the
  // cascade is visible.
  'toggle-group': {
    default: `
      <ui-toggle-group type="single" variant="default" value="bold">
        <ui-toggle-group-item value="bold">B</ui-toggle-group-item>
        <ui-toggle-group-item value="italic">I</ui-toggle-group-item>
        <ui-toggle-group-item value="underline">U</ui-toggle-group-item>
      </ui-toggle-group>
    `,
    outline: `
      <ui-toggle-group type="single" variant="outline" value="bold">
        <ui-toggle-group-item value="bold">B</ui-toggle-group-item>
        <ui-toggle-group-item value="italic">I</ui-toggle-group-item>
        <ui-toggle-group-item value="underline">U</ui-toggle-group-item>
      </ui-toggle-group>
    `,
  },
  // separator's variants ARE orientations. Each card wraps the
  // separator in enough surrounding markup to make the axis obvious
  // (label above/below for horizontal, labels left/right for vertical).
  separator: {
    horizontal: `
      <div class="w-64">
        <div class="text-sm pb-2">Section A</div>
        <div class="${separatorClass({ orientation: 'horizontal' })}" role="separator"></div>
        <div class="text-sm pt-2">Section B</div>
      </div>
    `,
    vertical: `
      <div class="flex h-12 items-center gap-3">
        <div class="text-sm">Left</div>
        <div class="${separatorClass({ orientation: 'vertical' })}" role="separator"></div>
        <div class="text-sm">Right</div>
      </div>
    `,
  },
};

const SIZE_EXAMPLES: Record<string, Record<string, string>> = {
  button: {
    default: `<button class="${buttonClass({ size: 'default' })}">Button</button>`,
    xs: `<button class="${buttonClass({ size: 'xs' })}">Button</button>`,
    sm: `<button class="${buttonClass({ size: 'sm' })}">Button</button>`,
    lg: `<button class="${buttonClass({ size: 'lg' })}">Button</button>`,
    icon: `<button class="${buttonClass({ size: 'icon' })}" aria-label="Settings">${ICON_SETTINGS}</button>`,
    'icon-xs': `<button class="${buttonClass({ size: 'icon-xs' })}" aria-label="Settings">${ICON_SETTINGS}</button>`,
    'icon-sm': `<button class="${buttonClass({ size: 'icon-sm' })}" aria-label="Settings">${ICON_SETTINGS}</button>`,
    'icon-lg': `<button class="${buttonClass({ size: 'icon-lg' })}" aria-label="Settings">${ICON_SETTINGS}</button>`,
  },
  avatar: {
    sm: `<span class="${avatarClass({ size: 'sm' })}" data-size="sm"><span class="${avatarFallbackClass()}">V</span></span>`,
    default: `<span class="${avatarClass({ size: 'default' })}" data-size="default"><span class="${avatarFallbackClass()}">V</span></span>`,
    lg: `<span class="${avatarClass({ size: 'lg' })}" data-size="lg"><span class="${avatarFallbackClass()}">V</span></span>`,
  },
  switch: {
    default: `
      <label class="inline-flex items-center gap-2">
        <input type="checkbox" data-slot="switch" class="${switchInputClass()}" checked>
        <span class="${switchTrackClass({ size: 'default' })}"></span>
        <span class="${labelClass()}">Default</span>
      </label>
    `,
    sm: `
      <label class="inline-flex items-center gap-2">
        <input type="checkbox" data-slot="switch" class="${switchInputClass()}" checked>
        <span class="${switchTrackClass({ size: 'sm' })}"></span>
        <span class="${labelClass()}">Small</span>
      </label>
    `,
  },
  toggle: {
    default: `<button class="${toggleClass({ size: 'default' })}" aria-pressed="false" data-state="off">Bold</button>`,
    sm: `<button class="${toggleClass({ size: 'sm' })}" aria-pressed="false" data-state="off">Bold</button>`,
    lg: `<button class="${toggleClass({ size: 'lg' })}" aria-pressed="false" data-state="off">Bold</button>`,
  },
  'native-select': {
    default: `
      <div class="${nativeSelectWrapperClass()}">
        <select class="${nativeSelectClass()}" data-size="default">
          <option>Default</option><option>Other</option>
        </select>
        <svg class="${nativeSelectIconClass()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    `,
    sm: `
      <div class="${nativeSelectWrapperClass()}">
        <select class="${nativeSelectClass()}" data-size="sm">
          <option>Small</option><option>Other</option>
        </select>
        <svg class="${nativeSelectIconClass()}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </div>
    `,
  },
  // toggle-group size attribute propagates to every item.
  'toggle-group': {
    default: `
      <ui-toggle-group type="single" size="default" value="bold">
        <ui-toggle-group-item value="bold">B</ui-toggle-group-item>
        <ui-toggle-group-item value="italic">I</ui-toggle-group-item>
        <ui-toggle-group-item value="underline">U</ui-toggle-group-item>
      </ui-toggle-group>
    `,
    sm: `
      <ui-toggle-group type="single" size="sm" value="bold">
        <ui-toggle-group-item value="bold">B</ui-toggle-group-item>
        <ui-toggle-group-item value="italic">I</ui-toggle-group-item>
        <ui-toggle-group-item value="underline">U</ui-toggle-group-item>
      </ui-toggle-group>
    `,
    lg: `
      <ui-toggle-group type="single" size="lg" value="bold">
        <ui-toggle-group-item value="bold">B</ui-toggle-group-item>
        <ui-toggle-group-item value="italic">I</ui-toggle-group-item>
        <ui-toggle-group-item value="underline">U</ui-toggle-group-item>
      </ui-toggle-group>
    `,
  },
  // alert-dialog size demos render the content panel statically — full
  // modal mechanics (overlay, focus trap, body scroll lock) would each
  // take over the entire viewport and stack badly. data-size="default"
  // /"sm" carries the same class hooks the live dialog uses, so the
  // panel widths render identically to a real open dialog.
  'alert-dialog': {
    default: `
      <div class="${alertDialogContentClass()}" data-size="default" style="position: relative; transform: none; top: 0; left: 0; max-width: 100%;">
        <div class="${alertDialogHeaderClass()}">
          <h2 class="${alertDialogTitleClass()}">Are you absolutely sure?</h2>
          <p class="${alertDialogDescriptionClass()}">This action cannot be undone. This will permanently delete your account.</p>
        </div>
        <div class="${alertDialogFooterClass()}">
          <button class="${buttonClass({ variant: 'outline' })}">Cancel</button>
          <button class="${buttonClass({ variant: 'destructive' })}">Delete</button>
        </div>
      </div>
    `,
    sm: `
      <div class="${alertDialogContentClass()}" data-size="sm" style="position: relative; transform: none; top: 0; left: 0; max-width: 100%;">
        <div class="${alertDialogHeaderClass()}">
          <h2 class="${alertDialogTitleClass()}">Delete file?</h2>
          <p class="${alertDialogDescriptionClass()}">Move "report.pdf" to trash?</p>
        </div>
        <div class="${alertDialogFooterClass()}">
          <button class="${buttonClass({ variant: 'outline' })}">Cancel</button>
          <button class="${buttonClass({ variant: 'destructive' })}">Delete</button>
        </div>
      </div>
    `,
  },
  // pagination size = forwarded ButtonSize on paginationLinkClass.
  // "icon" (the default) is square + compact; "default" gives padded
  // text buttons. Show a full mini-pagination per size so the cascade
  // through prev/page/next is clear.
  pagination: {
    icon: `
      <nav class="${paginationClass()}">
        <ul class="${paginationContentClass()}">
          <li><a class="${paginationPreviousClass()}" href="#">Previous</a></li>
          <li><a class="${paginationLinkClass({ size: 'icon' })}" href="#">1</a></li>
          <li><a class="${paginationLinkClass({ isActive: true, size: 'icon' })}" href="#">2</a></li>
          <li><a class="${paginationLinkClass({ size: 'icon' })}" href="#">3</a></li>
          <li><a class="${paginationNextClass()}" href="#">Next</a></li>
        </ul>
      </nav>
    `,
    default: `
      <nav class="${paginationClass()}">
        <ul class="${paginationContentClass()}">
          <li><a class="${paginationPreviousClass()}" href="#">Previous</a></li>
          <li><a class="${paginationLinkClass({ size: 'default' })}" href="#">1</a></li>
          <li><a class="${paginationLinkClass({ isActive: true, size: 'default' })}" href="#">2</a></li>
          <li><a class="${paginationLinkClass({ size: 'default' })}" href="#">3</a></li>
          <li><a class="${paginationNextClass()}" href="#">Next</a></li>
        </ul>
      </nav>
    `,
  },
};

// Variant examples for sonner are TYPE demos — each card fires the
// matching imperative API so the user sees the icon + colour treatment
// for that toast type. <ui-sonner> is mounted once inside each card;
// each Show button triggers one toast. Position is intentionally
// excluded from card previews (every <ui-sonner> is viewport-pinned).
VARIANT_EXAMPLES.sonner = (() => {
  const make = (type: 'default' | 'success' | 'error' | 'info' | 'warning' | 'loading') => `
    <div class="flex items-center gap-3">
      <ui-sonner position="top-center"></ui-sonner>
      <button class="${buttonClass({ variant: 'outline' })}" onclick="import('/components/ui/sonner.ts').then(m => m.toast${type === 'default' ? '' : '.' + type}('${type[0].toUpperCase() + type.slice(1)} toast', { description: 'Example ${type} toast.' }))">Show ${type}</button>
    </div>
  `;
  return {
    default: make('default'),
    success: make('success'),
    error: make('error'),
    info: make('info'),
    warning: make('warning'),
    loading: make('loading'),
  };
})();

export function getVariantExamples(name: string): Record<string, string> | null {
  const key = HYPHENATED_ALIASES[name] || name;
  return VARIANT_EXAMPLES[key] || VARIANT_EXAMPLES[name] || null;
}

export function getSizeExamples(name: string): Record<string, string> | null {
  // SIZE_EXAMPLES keyed by the hyphenated component name (no underscore
  // aliasing needed since none of the keys here are TS reserved words).
  return SIZE_EXAMPLES[name] || null;
}
