/**
 * Curated example markup per component, rendered as the "Preview" pane on
 * the component docs page (shadcn-style playground).
 *
 * The map is intentionally hand-curated rather than auto-generated so each
 * component shows a representative use case — not just `<ui-button>Button
 * </ui-button>`.
 *
 * Each entry returns plain HTML string; webjs renders it into the page,
 * the custom-element registrations import the corresponding component at
 * page load, and the browser upgrades the tags client-side.
 */
export const EXAMPLES: Record<string, string> = {
  button: `
    <div class="flex flex-wrap items-center gap-3">
      <ui-button variant="default">Default</ui-button>
      <ui-button variant="secondary">Secondary</ui-button>
      <ui-button variant="outline">Outline</ui-button>
      <ui-button variant="ghost">Ghost</ui-button>
      <ui-button variant="destructive">Destructive</ui-button>
      <ui-button variant="link">Link</ui-button>
    </div>
  `,

  badge: `
    <div class="flex flex-wrap items-center gap-2">
      <ui-badge>Default</ui-badge>
      <ui-badge variant="secondary">Secondary</ui-badge>
      <ui-badge variant="outline">Outline</ui-badge>
      <ui-badge variant="destructive">Destructive</ui-badge>
    </div>
  `,

  alert: `
    <ui-alert>
      <ui-alert-title>Heads up!</ui-alert-title>
      <ui-alert-description>You can add components to your app using the cli.</ui-alert-description>
    </ui-alert>
  `,

  card: `
    <ui-card class="w-full max-w-sm">
      <ui-card-header>
        <ui-card-title>Create project</ui-card-title>
        <ui-card-description>Deploy your new project in one-click.</ui-card-description>
      </ui-card-header>
      <ui-card-content>
        <div class="flex flex-col gap-2">
          <ui-label for="name">Name</ui-label>
          <ui-input id="name" placeholder="Name of your project"></ui-input>
        </div>
      </ui-card-content>
      <ui-card-footer class="flex gap-2 justify-end">
        <ui-button variant="outline">Cancel</ui-button>
        <ui-button>Deploy</ui-button>
      </ui-card-footer>
    </ui-card>
  `,

  input: `
    <div class="flex w-full max-w-sm flex-col gap-3">
      <ui-input type="email" placeholder="Email"></ui-input>
      <ui-input type="password" placeholder="Password"></ui-input>
      <ui-input disabled placeholder="Disabled"></ui-input>
    </div>
  `,

  label: `
    <div class="flex items-center gap-2">
      <ui-input id="terms" type="checkbox"></ui-input>
      <ui-label for="terms">Accept terms and conditions</ui-label>
    </div>
  `,

  textarea: `
    <ui-textarea placeholder="Type your message here." class="w-full max-w-sm"></ui-textarea>
  `,

  separator: `
    <div class="w-full max-w-sm">
      <div class="text-sm font-medium">Account</div>
      <p class="text-sm text-muted-foreground">Manage your account.</p>
      <ui-separator class="my-4"></ui-separator>
      <div class="flex h-5 items-center gap-4 text-sm">
        <div>Blog</div><ui-separator orientation="vertical"></ui-separator>
        <div>Docs</div><ui-separator orientation="vertical"></ui-separator>
        <div>Source</div>
      </div>
    </div>
  `,

  skeleton: `
    <div class="flex flex-col gap-2 w-full max-w-sm">
      <ui-skeleton class="h-4 w-[250px]"></ui-skeleton>
      <ui-skeleton class="h-4 w-[200px]"></ui-skeleton>
      <ui-skeleton class="h-4 w-[150px]"></ui-skeleton>
    </div>
  `,

  switch: `
    <div class="flex items-center gap-2">
      <ui-switch id="airplane"></ui-switch>
      <ui-label for="airplane">Airplane mode</ui-label>
    </div>
  `,

  checkbox: `
    <div class="flex items-center gap-2">
      <ui-checkbox id="agree"></ui-checkbox>
      <ui-label for="agree">I agree to the terms and conditions</ui-label>
    </div>
  `,

  avatar: `
    <div class="flex items-center gap-4">
      <ui-avatar>
        <ui-avatar-image src="https://github.com/shadcn.png" alt="@shadcn"></ui-avatar-image>
        <ui-avatar-fallback>CN</ui-avatar-fallback>
      </ui-avatar>
      <ui-avatar>
        <ui-avatar-fallback>VS</ui-avatar-fallback>
      </ui-avatar>
    </div>
  `,

  spinner: `<ui-spinner></ui-spinner>`,

  kbd: `<div>Press <ui-kbd>⌘</ui-kbd><ui-kbd>K</ui-kbd> to open the search bar.</div>`,

  progress: `<ui-progress value="60" class="w-full max-w-sm"></ui-progress>`,

  alert_dialog: `
    <ui-alert-dialog>
      <ui-alert-dialog-trigger>
        <ui-button variant="outline">Show Dialog</ui-button>
      </ui-alert-dialog-trigger>
      <ui-alert-dialog-content>
        <ui-alert-dialog-header>
          <ui-alert-dialog-title>Are you absolutely sure?</ui-alert-dialog-title>
          <ui-alert-dialog-description>
            This action cannot be undone. This will permanently delete your account.
          </ui-alert-dialog-description>
        </ui-alert-dialog-header>
        <ui-alert-dialog-footer>
          <ui-alert-dialog-cancel>Cancel</ui-alert-dialog-cancel>
          <ui-alert-dialog-action>Continue</ui-alert-dialog-action>
        </ui-alert-dialog-footer>
      </ui-alert-dialog-content>
    </ui-alert-dialog>
  `,

  dialog: `
    <ui-dialog>
      <ui-dialog-trigger><ui-button variant="outline">Edit Profile</ui-button></ui-dialog-trigger>
      <ui-dialog-content>
        <ui-dialog-header>
          <ui-dialog-title>Edit profile</ui-dialog-title>
          <ui-dialog-description>Make changes to your profile here. Click save when you're done.</ui-dialog-description>
        </ui-dialog-header>
        <div class="flex flex-col gap-3 py-4">
          <ui-label for="name2">Name</ui-label>
          <ui-input id="name2" placeholder="Pedro Duarte"></ui-input>
        </div>
        <ui-dialog-footer>
          <ui-button>Save changes</ui-button>
        </ui-dialog-footer>
      </ui-dialog-content>
    </ui-dialog>
  `,

  accordion: `
    <ui-accordion type="single" class="w-full max-w-md">
      <ui-accordion-item value="item-1">
        <ui-accordion-trigger>Is it accessible?</ui-accordion-trigger>
        <ui-accordion-content>Yes. It adheres to the WAI-ARIA design pattern.</ui-accordion-content>
      </ui-accordion-item>
      <ui-accordion-item value="item-2">
        <ui-accordion-trigger>Is it styled?</ui-accordion-trigger>
        <ui-accordion-content>Yes. It comes with default styles you can override.</ui-accordion-content>
      </ui-accordion-item>
    </ui-accordion>
  `,

  tabs: `
    <ui-tabs value="account" class="w-full max-w-md">
      <ui-tabs-list>
        <ui-tabs-trigger value="account">Account</ui-tabs-trigger>
        <ui-tabs-trigger value="password">Password</ui-tabs-trigger>
      </ui-tabs-list>
      <ui-tabs-content value="account" class="text-sm text-muted-foreground mt-3">
        Make changes to your account here.
      </ui-tabs-content>
      <ui-tabs-content value="password" class="text-sm text-muted-foreground mt-3">
        Change your password.
      </ui-tabs-content>
    </ui-tabs>
  `,

  toggle: `<ui-toggle>Bold</ui-toggle>`,

  slider: `<ui-slider value="50" max="100" class="w-full max-w-sm"></ui-slider>`,

  radio_group: `
    <ui-radio-group value="comfortable" class="flex flex-col gap-2">
      <div class="flex items-center gap-2"><ui-radio-group-item id="default" value="default"></ui-radio-group-item><ui-label for="default">Default</ui-label></div>
      <div class="flex items-center gap-2"><ui-radio-group-item id="comfortable" value="comfortable"></ui-radio-group-item><ui-label for="comfortable">Comfortable</ui-label></div>
      <div class="flex items-center gap-2"><ui-radio-group-item id="compact" value="compact"></ui-radio-group-item><ui-label for="compact">Compact</ui-label></div>
    </ui-radio-group>
  `,

  breadcrumb: `
    <ui-breadcrumb>
      <ui-breadcrumb-list>
        <ui-breadcrumb-item><ui-breadcrumb-link href="#">Home</ui-breadcrumb-link></ui-breadcrumb-item>
        <ui-breadcrumb-separator></ui-breadcrumb-separator>
        <ui-breadcrumb-item><ui-breadcrumb-link href="#">Components</ui-breadcrumb-link></ui-breadcrumb-item>
        <ui-breadcrumb-separator></ui-breadcrumb-separator>
        <ui-breadcrumb-item><ui-breadcrumb-page>Breadcrumb</ui-breadcrumb-page></ui-breadcrumb-item>
      </ui-breadcrumb-list>
    </ui-breadcrumb>
  `,

  pagination: `
    <ui-pagination>
      <ui-pagination-content>
        <ui-pagination-item><ui-pagination-previous href="#"></ui-pagination-previous></ui-pagination-item>
        <ui-pagination-item><ui-pagination-link href="#">1</ui-pagination-link></ui-pagination-item>
        <ui-pagination-item><ui-pagination-link href="#" is-active>2</ui-pagination-link></ui-pagination-item>
        <ui-pagination-item><ui-pagination-link href="#">3</ui-pagination-link></ui-pagination-item>
        <ui-pagination-item><ui-pagination-next href="#"></ui-pagination-next></ui-pagination-item>
      </ui-pagination-content>
    </ui-pagination>
  `,
};

// Some component names in the registry use hyphens; the map uses underscores
// to avoid conflicts with TS identifier rules. Map both forms.
const HYPHENATED_ALIASES: Record<string, string> = {
  'alert-dialog': 'alert_dialog',
  'radio-group': 'radio_group',
};

export function getExample(name: string): string | null {
  const key = HYPHENATED_ALIASES[name] || name;
  return EXAMPLES[key] || null;
}
