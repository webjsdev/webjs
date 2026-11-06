import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  navigationMenuLinkClass, navigationMenuTriggerStyle,
} from '#modules/ui/components/navigation-menu.ts';

const components: { title: string; href: string; description: string }[] = [
  {
    title: 'Alert Dialog',
    href: '/docs/primitives/alert-dialog',
    description:
      'A modal dialog that interrupts the user with important content and expects a response.',
  },
  {
    title: 'Hover Card',
    href: '/docs/primitives/hover-card',
    description:
      'For sighted users to preview content available behind a link.',
  },
  {
    title: 'Progress',
    href: '/docs/primitives/progress',
    description:
      'Displays an indicator showing the completion progress of a task, typically displayed as a progress bar.',
  },
  {
    title: 'Scroll-area',
    href: '/docs/primitives/scroll-area',
    description: 'Visually or semantically separates content.',
  },
  {
    title: 'Tabs',
    href: '/docs/primitives/tabs',
    description:
      'A set of layered sections of content, known as tab panels, that are displayed one at a time.',
  },
  {
    title: 'Tooltip',
    href: '/docs/primitives/tooltip',
    description:
      'A popup that displays information related to an element when the element receives keyboard focus or the mouse hovers over it.',
  },
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

export default function NavigationMenuDemo() {
  return html`
    <ui-navigation-menu>
      <ui-navigation-menu-list>
        <ui-navigation-menu-item>
          <ui-navigation-menu-trigger>Getting started</ui-navigation-menu-trigger>
          <ui-navigation-menu-content>
            <ul class="w-96">
              ${ListItem('/docs', 'Introduction', 'Re-usable components built with Tailwind CSS.')}
              ${ListItem('/docs/installation', 'Installation', 'How to install dependencies and structure your app.')}
              ${ListItem('/docs/primitives/typography', 'Typography', 'Styles for headings, paragraphs, lists...etc')}
            </ul>
          </ui-navigation-menu-content>
        </ui-navigation-menu-item>
        <ui-navigation-menu-item class="hidden md:flex">
          <ui-navigation-menu-trigger>Components</ui-navigation-menu-trigger>
          <ui-navigation-menu-content>
            <ul class="grid w-[400px] gap-2 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
              ${components.map((component) => ListItem(component.href, component.title, component.description))}
            </ul>
          </ui-navigation-menu-content>
        </ui-navigation-menu-item>
        <ui-navigation-menu-item>
          <a href="/docs" data-slot="navigation-menu-link" class=${cn(navigationMenuLinkClass(), navigationMenuTriggerStyle())}>Docs</a>
        </ui-navigation-menu-item>
      </ui-navigation-menu-list>
    </ui-navigation-menu>
  `;
}
