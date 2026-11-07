import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { blockPreview } from '#lib/ui/block-viewer.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';
import { cn } from '#lib/utils/cn.ts';
import { ExternalLinkIcon } from '#lib/ui/lucide.ts';
import { buttonClass } from '#modules/ui/components/button.ts';

/**
 * The Sidebar docs page, ported from shadcn's
 * content/docs/components/radix/sidebar.mdx (#1666). shadcn's page has no
 * component demo: it leads with a whole block, `<ComponentPreview
 * type="block">`, the sidebar that collapses to icons. Here that is the
 * sidebar-07 block, the same sidebar, shown in its /ui/view frame.
 *
 * The sections follow shadcn's, each written for the kit: the provider, the
 * sidebar, the trigger, the rail and the inset are elements, and every part
 * inside is a class helper on native markup. shadcn's two sketches (the
 * sidebar's structure and a menu's) name React components, so they are drawn
 * here as markup diagrams naming the kit's parts instead.
 */

/** The block preview and the paragraphs shadcn puts above Installation. */
export function intro(_toc: TocEntry[]) {
  return html`
    ${blockPreview('sidebar-07', { caption: 'A sidebar that collapses to icons.' })}
    <p>Sidebars are one of the most complex components to build. They are central to any application and often contain a lot of moving parts.</p>
    <p>We now have a solid foundation to build on top of. Composable. Themeable. Customizable.</p>
    <p><a href="/ui/blocks">Browse the Blocks Library</a>.</p>
  `;
}

const table = (head: string[], rows: unknown[][]) => html`
  <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
    <table>
      <thead><tr>${head.map((h) => html`<th>${h}</th>`)}</tr></thead>
      <tbody>${rows.map((r) => html`<tr>${r.map((c) => html`<td>${c}</td>`)}</tr>`)}</tbody>
    </table>
  </div>`;

const steps = 'steps mb-0 pt-2 [counter-reset:step] md:ml-4 md:border-l md:pl-8 [&>h3]:step';

// A labelled box in a diagram: shadcn's sketch colours, kept readable in dark mode.
const part = (label: string, note: string, tone: string, extra = '') => html`
  <div class=${`flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-3 py-4 text-center ${tone} ${extra}`}>
    <code class="bg-transparent! text-xs font-medium text-foreground">${label}</code>
    ${note ? html`<span class="text-xs text-muted-foreground">${note}</span>` : ''}
  </div>`;
const BLUE = 'border-sky-500/70 bg-sky-500/15';
const GREEN = 'border-emerald-500/70 bg-emerald-500/15';
const YELLOW = 'border-dashed border-amber-500/70 bg-amber-400/20';
const RED = 'border-rose-500/70 bg-rose-500/15';

/** The sidebar's regions, in place of shadcn's sidebar-structure sketch. */
function structureDiagram() {
  return html`
    <figure aria-label="Sidebar structure" class="not-typeset mt-6 flex w-full justify-center overflow-hidden rounded-2xl border bg-background p-8">
      <div class="flex w-64 flex-col gap-2 rounded-2xl border-2 border-foreground/60 p-2">
        <code class="self-center bg-transparent! text-xs font-medium text-foreground">&lt;ui-sidebar&gt;</code>
        ${part('sidebarHeaderClass()', '(Sticky)', BLUE)}
        <div class=${`flex flex-col gap-2 rounded-xl border-2 p-2 ${GREEN}`}>
          <code class="self-center bg-transparent! text-xs font-medium text-foreground">sidebarContentClass()</code>
          <span class="self-center text-xs text-muted-foreground">(Scrollable)</span>
          ${part('sidebarGroupClass()', '', YELLOW, 'py-8')}
          ${part('sidebarGroupClass()', '', YELLOW, 'py-8')}
        </div>
        ${part('sidebarFooterClass()', '(Sticky)', RED)}
      </div>
    </figure>`;
}

/** A menu's parts, in place of shadcn's sidebar-menu sketch. */
function menuDiagram() {
  const row = html`
    <div class=${`flex items-center gap-2 rounded-xl border-2 p-1.5 ${BLUE.replace('border-', 'border-dashed border-')}`}>
      <div class=${`flex-1 rounded-lg border-2 border-dotted px-3 py-2 ${RED}`}><code class="bg-transparent! text-xs text-foreground">sidebarMenuButtonClass()</code></div>
      <div class=${`size-9 shrink-0 rounded-lg border-2 border-dotted ${YELLOW}`} title="sidebarMenuActionClass()"></div>
    </div>`;
  return html`
    <figure aria-label="Sidebar menu" class="not-typeset mt-6 flex w-full justify-center overflow-hidden rounded-2xl border bg-background p-8">
      <div class="flex w-80 flex-col gap-2">
        <div class="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span><code class="text-foreground">sidebarMenuClass()</code> on the <code>&lt;ul&gt;</code></span>
          <span><code class="text-foreground">sidebarMenuItemClass()</code> on each <code>&lt;li&gt;</code></span>
        </div>
        <div class="flex flex-col gap-2 rounded-2xl border-2 border-foreground/60 p-2">${row}${row}${row}${row}</div>
        <span class="self-end text-xs text-muted-foreground">the square: <code class="text-foreground">sidebarMenuActionClass()</code></span>
      </div>
    </figure>`;
}

/** Everything after Installation. */
export default function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { html } from '@webjsdev/core';
import type { LayoutProps } from '@webjsdev/core';
import { appSidebar } from '#components/app-sidebar.ts';
// Registers the sidebar's elements.
import '#components/ui/sidebar.ts';

export default function Layout({ children }: LayoutProps) {
  return html\`
    <ui-sidebar-provider>
      \${appSidebar()}
      <ui-sidebar-inset>
        <ui-sidebar-trigger></ui-sidebar-trigger>
        \${children}
      </ui-sidebar-inset>
    </ui-sidebar-provider>
  \`;
}`, { title: 'app/layout.ts', lineNumbers: true })}
    ${codeFigure(`import { html } from '@webjsdev/core';
import {
  sidebarContentClass,
  sidebarFooterClass,
  sidebarGroupClass,
  sidebarHeaderClass,
} from '#components/ui/sidebar.ts';

export function appSidebar() {
  return html\`
    <ui-sidebar>
      <div data-slot="sidebar-header" data-sidebar="header" class=\${sidebarHeaderClass()}></div>
      <div data-slot="sidebar-content" data-sidebar="content" class=\${sidebarContentClass()}>
        <div data-slot="sidebar-group" data-sidebar="group" class=\${sidebarGroupClass()}></div>
        <div data-slot="sidebar-group" data-sidebar="group" class=\${sidebarGroupClass()}></div>
      </div>
      <div data-slot="sidebar-footer" data-sidebar="footer" class=\${sidebarFooterClass()}></div>
    </ui-sidebar>
  \`;
}`, { title: 'components/app-sidebar.ts', lineNumbers: true })}
    <p><code>appSidebar()</code> is a fragment helper rather than an element, so the server renders the whole sidebar into the page and a reader without JavaScript still gets every link.</p>

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a sidebar layout:</p>
    ${codeFigure(`<ui-sidebar-provider>
├── <ui-sidebar>
│   ├── sidebarHeaderClass()
│   ├── sidebarContentClass()
│   │   ├── sidebarGroupClass()
│   │   │   ├── sidebarGroupLabelClass()
│   │   │   ├── sidebarGroupActionClass()
│   │   │   ├── sidebarGroupContentClass()
│   │   │   └── sidebarMenuClass()
│   │   │       ├── sidebarMenuItemClass()
│   │   │       │   ├── sidebarMenuButtonClass()
│   │   │       │   ├── sidebarMenuActionClass()
│   │   │       │   └── sidebarMenuBadgeClass()
│   │   │       └── sidebarMenuItemClass()
│   │   │           ├── sidebarMenuButtonClass()
│   │   │           └── sidebarMenuSubClass()
│   │   │               ├── sidebarMenuSubItemClass()
│   │   │               └── sidebarMenuSubItemClass()
│   │   └── sidebarGroupClass()
│   │       └── sidebarMenuClass()
│   │           ├── sidebarMenuItemClass()
│   │           └── sidebarMenuItemClass()
│   ├── sidebarFooterClass()
│   └── <ui-sidebar-rail>
├── <ui-sidebar-inset>
└── <ui-sidebar-trigger>`, { lang: 'text' })}

    ${heading(toc, 2, 'Structure')}
    <ul>
      <li><strong><code>&lt;ui-sidebar-provider&gt;</code></strong> holds the open state, the cookie and the keyboard shortcut, and every part inside reads it.</li>
      <li><strong><code>&lt;ui-sidebar&gt;</code></strong> is the main collapsible sidebar panel.</li>
      <li><strong><code>sidebarHeaderClass()</code></strong> styles the header, sticky at the top. Use it for branding, titles, or workspace switchers.</li>
      <li><strong><code>sidebarFooterClass()</code></strong> styles the footer, sticky at the bottom. Use it for user menus, settings, or actions.</li>
      <li><strong><code>sidebarContentClass()</code></strong> styles the scrollable region between the header and footer.</li>
      <li><strong><code>sidebarGroupClass()</code></strong> groups related navigation with an optional label, action, and content area.</li>
      <li><strong><code>sidebarMenuClass()</code></strong> / <strong><code>sidebarMenuItemClass()</code></strong> build the menu structure for links, badges, actions, and nested submenus.</li>
      <li><strong><code>&lt;ui-sidebar-rail&gt;</code></strong> is a thin strip along the sidebar's edge that toggles it.</li>
      <li><strong><code>&lt;ui-sidebar-inset&gt;</code></strong> wraps the main content when using the <code>inset</code> variant, and is the page's <code>main</code> landmark.</li>
      <li><strong><code>&lt;ui-sidebar-trigger&gt;</code></strong> is a button that toggles the sidebar open or collapsed.</li>
    </ul>
    ${structureDiagram()}

    ${heading(toc, 2, 'SidebarProvider')}
    <p>The <code>&lt;ui-sidebar-provider&gt;</code> element holds the sidebar's state for every part inside it. You should always wrap your application in a <code>&lt;ui-sidebar-provider&gt;</code>.</p>

    ${heading(toc, 3, 'Props', 'sidebarprovider-props')}
    ${table(['Name', 'Type', 'Description'], [
      [html`<code>default-open</code>`, html`<code>"true"</code> or <code>"false"</code>`, html`Default open state of the sidebar. Render it from the <code>sidebar_state</code> cookie on the server so the first paint matches the reader's last choice.`],
      [html`<code>open</code>`, html`<code>boolean</code>`, 'Open state of the sidebar. Written as an attribute it wins over default-open; set as a property it opens or closes the sidebar.'],
      [html`<code>ui-open-change</code>`, html`<code>CustomEvent&lt;{ open: boolean }&gt;</code>`, 'Fired on the provider when the sidebar opens or closes.'],
    ])}

    ${heading(toc, 3, 'Width')}
    <p>If you have a single sidebar in your application, the widths are set where the provider and the phone sheet render, in <code>components/ui/sidebar.ts</code>. Edit them there.</p>
    ${codeFigure(`// The provider's wrapper: the desktop width and the collapsed icon width.
style="--sidebar-width: 16rem; --sidebar-width-icon: 3rem"

// The sheet content on a phone: --sidebar-width-mobile, else 18rem.
style="--sidebar-width: var(--sidebar-width-mobile, 18rem)"`, { title: 'components/ui/sidebar.ts', lineNumbers: true })}
    <p>For multiple sidebars in your application, set <code>--sidebar-width</code> and <code>--sidebar-width-mobile</code> in the <code>style</code> of each <code>&lt;ui-sidebar&gt;</code>. The sidebar's gap and panel read the first, and the phone sheet the second. <code>--sidebar-width-mobile</code> can also go on the provider, for every sidebar inside it.</p>
    ${codeFigure(`<ui-sidebar-provider>
  <ui-sidebar style="--sidebar-width: 20rem; --sidebar-width-mobile: 20rem"></ui-sidebar>
</ui-sidebar-provider>`, { lineNumbers: true })}

    ${heading(toc, 3, 'Keyboard Shortcut')}
    <p>To trigger the sidebar, you use the <code>cmd+b</code> keyboard shortcut on Mac and <code>ctrl+b</code> on Windows. The key is in the provider's keydown handler.</p>
    ${codeFigure(`_onKeyDown = (e: KeyboardEvent): void => {
  if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    this.toggle();
  }
};`, { title: 'components/ui/sidebar.ts', lineNumbers: true })}

    ${heading(toc, 2, 'Sidebar')}
    <p>The main <code>&lt;ui-sidebar&gt;</code> element renders a collapsible sidebar. Below 768px it opens as a sheet from its side instead.</p>

    ${heading(toc, 3, 'Props', 'sidebar-props')}
    ${table(['Attribute', 'Type', 'Description'], [
      [html`<code>side</code>`, html`<code>left</code> or <code>right</code>`, 'The side of the sidebar.'],
      [html`<code>variant</code>`, html`<code>sidebar</code>, <code>floating</code>, or <code>inset</code>`, 'The variant of the sidebar.'],
      [html`<code>collapsible</code>`, html`<code>offcanvas</code>, <code>icon</code>, or <code>none</code>`, 'Collapsible state of the sidebar.'],
    ])}
    ${table(['Value', 'Description'], [
      [html`<code>offcanvas</code>`, 'A collapsible sidebar that slides in from the left or right.'],
      [html`<code>icon</code>`, 'A sidebar that collapses to icons.'],
      [html`<code>none</code>`, 'A non-collapsible sidebar.'],
    ])}
    ${callout(html`<strong>Note:</strong> If you use the <code>inset</code> variant, remember to wrap your main content in a <code>&lt;ui-sidebar-inset&gt;</code> element.`)}
    ${codeFigure(`<ui-sidebar-provider>
  <ui-sidebar variant="inset"></ui-sidebar>
  <ui-sidebar-inset>
    \${children}
  </ui-sidebar-inset>
</ui-sidebar-provider>`, { lineNumbers: true })}

    ${heading(toc, 2, 'useSidebar')}
    <p>There is no hook: the provider element is the sidebar's state. From a component inside it, reach it with <code>closest()</code> and read or call the members below.</p>
    ${codeFigure(`import type { UiSidebarProvider } from '#components/ui/sidebar.ts';

const sidebar = this.closest<UiSidebarProvider>('ui-sidebar-provider');
const { state, open, openMobile, isMobile } = sidebar;
sidebar.setOpen(false);
sidebar.setOpenMobile(true);
sidebar.toggle();`, { lineNumbers: true })}
    ${table(['Member', 'Type', 'Description'], [
      [html`<code>state</code>`, html`<code>expanded</code> or <code>collapsed</code>`, 'The current state of the sidebar.'],
      [html`<code>open</code>`, html`<code>boolean</code>`, 'Whether the sidebar is open.'],
      [html`<code>setOpen</code>`, html`<code>(open: boolean) =&gt; void</code>`, 'Sets the open state of the sidebar, keeps it in the cookie and fires ui-open-change.'],
      [html`<code>openMobile</code>`, html`<code>boolean</code>`, 'Whether the sidebar is open on mobile.'],
      [html`<code>setOpenMobile</code>`, html`<code>(open: boolean) =&gt; void</code>`, 'Sets the open state of the sidebar on mobile.'],
      [html`<code>isMobile</code>`, html`<code>boolean</code>`, 'Whether the sidebar is on mobile.'],
      [html`<code>toggle</code>`, html`<code>() =&gt; void</code>`, 'Toggles the sidebar. Desktop and mobile.'],
    ])}

    ${heading(toc, 2, 'SidebarHeader')}
    <p>Use <code>sidebarHeaderClass()</code> to add a sticky header to the sidebar.</p>
    ${codeFigure(`<ui-sidebar>
  <div data-slot="sidebar-header" data-sidebar="header" class=\${sidebarHeaderClass()}>
    <ul data-slot="sidebar-menu" data-sidebar="menu" class=\${sidebarMenuClass()}>
      <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=\${sidebarMenuItemClass()}>
        <ui-dropdown-menu>
          <ui-dropdown-menu-trigger>
            <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" class=\${sidebarMenuButtonClass()}>
              Select Workspace
              \${ChevronDownIcon('ml-auto')}
            </button>
          </ui-dropdown-menu-trigger>
          <ui-dropdown-menu-content class="w-(--radix-dropdown-menu-trigger-width)">
            <ui-dropdown-menu-item>
              <span>Acme Inc</span>
            </ui-dropdown-menu-item>
          </ui-dropdown-menu-content>
        </ui-dropdown-menu>
      </li>
    </ul>
  </div>
</ui-sidebar>`, { title: 'components/app-sidebar.ts', lineNumbers: true })}

    ${heading(toc, 2, 'SidebarFooter')}
    <p>Use <code>sidebarFooterClass()</code> to add a sticky footer to the sidebar.</p>
    ${codeFigure(`<ui-sidebar>
  <div data-slot="sidebar-footer" data-sidebar="footer" class=\${sidebarFooterClass()}>
    <ul data-slot="sidebar-menu" data-sidebar="menu" class=\${sidebarMenuClass()}>
      <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=\${sidebarMenuItemClass()}>
        <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" class=\${sidebarMenuButtonClass()}>
          \${UserIcon()} Username
        </button>
      </li>
    </ul>
  </div>
</ui-sidebar>`, { lineNumbers: true })}

    ${heading(toc, 2, 'SidebarContent')}
    <p><code>sidebarContentClass()</code> styles the element that wraps the content of the sidebar. This is where you add your groups. It is scrollable.</p>
    ${codeFigure(`<ui-sidebar>
  <div data-slot="sidebar-content" data-sidebar="content" class=\${sidebarContentClass()}>
    <div data-slot="sidebar-group" data-sidebar="group" class=\${sidebarGroupClass()}></div>
    <div data-slot="sidebar-group" data-sidebar="group" class=\${sidebarGroupClass()}></div>
  </div>
</ui-sidebar>`, { lineNumbers: true })}

    ${heading(toc, 2, 'SidebarGroup')}
    <p>Use <code>sidebarGroupClass()</code> to create a section within the sidebar.</p>
    <p>A group has a label (<code>sidebarGroupLabelClass()</code>), a content area (<code>sidebarGroupContentClass()</code>) and an optional action (<code>sidebarGroupActionClass()</code>).</p>
    ${codeFigure(`<div data-slot="sidebar-group" data-sidebar="group" class=\${sidebarGroupClass()}>
  <div data-slot="sidebar-group-label" data-sidebar="group-label" class=\${sidebarGroupLabelClass()}>Application</div>
  <button type="button" data-slot="sidebar-group-action" data-sidebar="group-action" class=\${sidebarGroupActionClass()}>
    \${PlusIcon()} <span class="sr-only">Add Project</span>
  </button>
  <div data-slot="sidebar-group-content" data-sidebar="group-content" class=\${sidebarGroupContentClass()}></div>
</div>`, { lineNumbers: true })}
    <p>To make a group collapsible, build it on a native <code>&lt;details&gt;</code> with the collapsible helpers, its <code>&lt;summary&gt;</code> as the label. It opens and closes with no JavaScript.</p>
    ${codeFigure(`<details open data-slot="collapsible" class=\${cn(collapsibleClass(), 'group/collapsible')}>
  <summary data-slot="sidebar-group-label" data-sidebar="group-label" class=\${cn(sidebarGroupLabelClass(), 'cursor-pointer list-none [&::-webkit-details-marker]:hidden')}>
    Help
    \${ChevronDownIcon('ml-auto transition-transform group-open/collapsible:rotate-180')}
  </summary>
  <div data-slot="collapsible-content" class=\${collapsibleContentClass()}>
    <div data-slot="sidebar-group-content" data-sidebar="group-content" class=\${sidebarGroupContentClass()}></div>
  </div>
</details>`, { lineNumbers: true })}

    ${heading(toc, 2, 'SidebarMenu')}
    <p><code>sidebarMenuClass()</code> goes on the <code>&lt;ul&gt;</code> of a menu within a group, and <code>sidebarMenuItemClass()</code> on each <code>&lt;li&gt;</code>.</p>
    ${menuDiagram()}
    ${codeFigure(`<ul data-slot="sidebar-menu" data-sidebar="menu" class=\${sidebarMenuClass()}>
  \${projects.map((project) => html\`
    <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=\${sidebarMenuItemClass()}>
      <a href=\${project.url} data-slot="sidebar-menu-button" data-sidebar="menu-button" class=\${sidebarMenuButtonClass()}>
        \${project.icon()}
        <span>\${project.name}</span>
      </a>
    </li>
  \`)}
</ul>`, { lineNumbers: true })}

    ${heading(toc, 2, 'SidebarMenuButton')}
    <p><code>sidebarMenuButtonClass()</code> styles a menu button within a menu item.</p>
    <p>Put it on whatever element the item needs: an <code>&lt;a&gt;</code> for a link, a <code>&lt;button&gt;</code> for an action, the <code>&lt;summary&gt;</code> of a <code>&lt;details&gt;</code> for a collapsible item. It takes <code>variant</code> (<code>default</code> or <code>outline</code>) and <code>size</code> (<code>default</code>, <code>sm</code> or <code>lg</code>); set <code>data-size</code> to the same size.</p>
    <p>Mark the current page's button <code>data-active="true"</code>, and give it <code>aria-current="page"</code> too.</p>
    ${codeFigure(`<a href="#" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-active="true" aria-current="page" class=\${sidebarMenuButtonClass()}>Home</a>`, { lineNumbers: true })}

    ${heading(toc, 2, 'SidebarMenuAction')}
    <p><code>sidebarMenuActionClass()</code> styles a menu action within a menu item. Pass <code>showOnHover: true</code> to keep it hidden until the item is hovered or focused.</p>
    ${codeFigure(`<li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=\${sidebarMenuItemClass()}>
  <a href="#" data-slot="sidebar-menu-button" data-sidebar="menu-button" class=\${sidebarMenuButtonClass()}>
    \${HomeIcon()}
    <span>Home</span>
  </a>
  <button type="button" data-slot="sidebar-menu-action" data-sidebar="menu-action" class=\${sidebarMenuActionClass()}>
    \${PlusIcon()} <span class="sr-only">Add Project</span>
  </button>
</li>`, { lineNumbers: true })}

    ${heading(toc, 2, 'SidebarMenuSub')}
    <p><code>sidebarMenuSubClass()</code> styles a submenu within a menu item.</p>
    ${codeFigure(`<li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=\${sidebarMenuItemClass()}>
  <a href="#" data-slot="sidebar-menu-button" data-sidebar="menu-button" class=\${sidebarMenuButtonClass()}></a>
  <ul data-slot="sidebar-menu-sub" data-sidebar="menu-sub" class=\${sidebarMenuSubClass()}>
    <li data-slot="sidebar-menu-sub-item" data-sidebar="menu-sub-item" class=\${sidebarMenuSubItemClass()}>
      <a href="#" data-slot="sidebar-menu-sub-button" data-sidebar="menu-sub-button" data-size="md" class=\${sidebarMenuSubButtonClass()}></a>
    </li>
  </ul>
</li>`, { lineNumbers: true })}

    ${heading(toc, 2, 'SidebarMenuBadge')}
    <p><code>sidebarMenuBadgeClass()</code> styles a badge within a menu item.</p>
    ${codeFigure(`<li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=\${sidebarMenuItemClass()}>
  <a href="#" data-slot="sidebar-menu-button" data-sidebar="menu-button" class=\${sidebarMenuButtonClass()}></a>
  <div data-slot="sidebar-menu-badge" data-sidebar="menu-badge" class=\${sidebarMenuBadgeClass()}>24</div>
</li>`, { lineNumbers: true })}

    ${heading(toc, 2, 'SidebarMenuSkeleton')}
    <p><code>sidebarMenuSkeleton()</code> renders a loading placeholder for a menu item. It returns the markup itself, and takes <code>showIcon</code> and the text bar's <code>width</code> (a fixed width, since a random one would differ between the server and the browser).</p>
    ${codeFigure(`<ul data-slot="sidebar-menu" data-sidebar="menu" class=\${sidebarMenuClass()}>
  \${Array.from({ length: 5 }, (_, index) => html\`
    <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=\${sidebarMenuItemClass()}>
      \${sidebarMenuSkeleton({ width: \`\${60 + index * 6}%\` })}
    </li>
  \`)}
</ul>`, { lineNumbers: true })}

    ${heading(toc, 2, 'SidebarTrigger')}
    <p>Use <code>&lt;ui-sidebar-trigger&gt;</code> to render a button that toggles the sidebar. It is named "Toggle Sidebar".</p>
    <p>For a trigger of your own, write a component that calls the provider's <code>toggle()</code>. A page never runs in the browser, so the click handler has to live in a component.</p>
    ${codeFigure(`import { WebComponent, html } from '@webjsdev/core';
import type { UiSidebarProvider } from '#components/ui/sidebar.ts';

class CustomTrigger extends WebComponent {
  render() {
    return html\`<button type="button" @click=\${() => this.closest<UiSidebarProvider>('ui-sidebar-provider')?.toggle()}>Toggle Sidebar</button>\`;
  }
}
CustomTrigger.register('custom-trigger');`, { lineNumbers: true })}

    ${heading(toc, 2, 'SidebarRail')}
    <p>The <code>&lt;ui-sidebar-rail&gt;</code> element renders a rail within a sidebar. This rail can be used to toggle the sidebar.</p>
    ${codeFigure(`<ui-sidebar>
  <div data-slot="sidebar-header" data-sidebar="header" class=\${sidebarHeaderClass()}></div>
  <div data-slot="sidebar-content" data-sidebar="content" class=\${sidebarContentClass()}>
    <div data-slot="sidebar-group" data-sidebar="group" class=\${sidebarGroupClass()}></div>
  </div>
  <div data-slot="sidebar-footer" data-sidebar="footer" class=\${sidebarFooterClass()}></div>
  <ui-sidebar-rail></ui-sidebar-rail>
</ui-sidebar>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Controlled Sidebar')}
    <p>The provider keeps its own state, and you drive it from outside: write <code>open</code> or call <code>setOpen()</code> to change it, and listen for <code>ui-open-change</code> to follow it.</p>
    ${codeFigure(`const sidebar = document.querySelector<UiSidebarProvider>('ui-sidebar-provider');

sidebar.addEventListener('ui-open-change', (e) => {
  console.log('open', e.detail.open);
});

sidebar.setOpen(false);`, { lineNumbers: true })}
    <p>The choice is kept in the <code>sidebar_state</code> cookie, so a layout can read it on the server and render <code>default-open</code> to match, with no flash.</p>
    ${codeFigure(`'use server';
import { cookies } from '@webjsdev/server';

export async function sidebarOpen() {
  return cookies().get('sidebar_state') !== 'false';
}`, { title: 'modules/layout/queries/sidebar-open.server.ts', lineNumbers: true })}
    ${codeFigure(`<ui-sidebar-provider default-open=\${String(await sidebarOpen())}>`, { title: 'app/layout.ts' })}

    ${heading(toc, 2, 'Theming')}
    <p>We use the following CSS variables to theme the sidebar.</p>
    ${codeFigure(`:root {
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.439 0 0);
}`, { lang: 'css' })}

    ${heading(toc, 2, 'Styling')}
    <p>Here are some tips for styling the sidebar based on different states.</p>
    ${codeFigure(`<ui-sidebar collapsible="icon">
  <div data-slot="sidebar-content" data-sidebar="content" class=\${sidebarContentClass()}>
    <div data-slot="sidebar-group" data-sidebar="group" class=\${cn(sidebarGroupClass(), 'group-data-[collapsible=icon]:hidden')}></div>
  </div>
</ui-sidebar>`)}
    ${codeFigure(`<li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=\${sidebarMenuItemClass()}>
  <a href="#" data-slot="sidebar-menu-button" data-sidebar="menu-button" class=\${sidebarMenuButtonClass()}></a>
  <button type="button" data-slot="sidebar-menu-action" data-sidebar="menu-action" class=\${cn(sidebarMenuActionClass(), 'peer-data-[active=true]/menu-button:opacity-100')}></button>
</li>`)}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>. Put <code>dir="rtl"</code> on an ancestor and give the sidebar <code>side="right"</code>.</p>
    <a href="/ui/view/sidebar-rtl" target="_blank" data-slot="button" data-size="sm" class=${cn(buttonClass({ size: 'sm' }), 'not-typeset mt-6 no-underline')}>View RTL Sidebar ${ExternalLinkIcon()}</a>

    ${heading(toc, 2, 'Changelog')}
    ${heading(toc, 3, 'RTL Support')}
    <p>Right-to-left support takes five things, and the kit's sidebar ships with all of them, so there is nothing to apply:</p>
    <div class=${steps}>
      <h3>No <code>dir</code> prop to add.</h3>
      <p>The direction comes from the <code>dir</code> attribute on an ancestor, and the phone sheet inherits it.</p>
      <h3>The container carries <code>data-side</code>.</h3>
      <p><code>&lt;ui-sidebar&gt;</code> sets <code>data-side</code> on itself and on its container.</p>
      <h3>The container is positioned by data attributes.</h3>
      <p>The container's classes use <code>data-[side=left]:</code> and <code>data-[side=right]:</code> selectors, with no ternary on the side.</p>
      <h3>The rail is positioned physically.</h3>
      <p><code>&lt;ui-sidebar-rail&gt;</code> uses <code>-right-4</code> / <code>left-0</code> with <code>ltr:</code> and <code>rtl:</code> translates.</p>
      <h3>The trigger's icon flips.</h3>
      <p><code>&lt;ui-sidebar-trigger&gt;</code>'s icon carries <code>rtl:rotate-180</code>.</p>
    </div>
    <p>So a right-to-left sidebar is the direction on an ancestor and the side:</p>
    ${codeFigure(`<div dir="rtl">
  <ui-sidebar-provider>
    <ui-sidebar side="right"></ui-sidebar>
  </ui-sidebar-provider>
</div>`)}
    <p>The sidebar will correctly position itself and handle interactions in both LTR and RTL layouts.</p>
  `;
}
