import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  accordionClass, accordionItemClass, accordionTriggerClass, accordionContentClass,
} from '#modules/ui/components/accordion.ts';
import { ChevronDownIcon, ChevronUpIcon } from '#lib/ui/lucide.ts';
import { docsPage, heading, type TocEntry } from '#lib/ui/docs/page.ts';

// Same "<Page> | <Section>" shape the documentation uses, so a tab or a search
// result reads consistently across /docs and /ui.
export const metadata = {
  title: 'Introduction | WebJs UI',
};

/**
 * The component library's introduction, /ui/docs, ported from shadcn's
 * content/docs/(root)/index.mdx (#1666): the same opening, the same five
 * principles in the same order, and the upstream-updates question, each
 * rewritten to say what WebJs UI does. The kit's two tiers, its commands
 * and its accessibility split are documented on the component, CLI and
 * Installation pages, which these sections point to.
 */
export default async function UiIntro() {
  const toc: TocEntry[] = [];
  const body = html`
      <p><strong>This is not a component library. It is how you build your component library.</strong></p>
      <p>You know how most traditional component libraries work: you install a package from npm, import the components, and use them in your app.</p>
      <p>This approach works well until you need to customize a component to fit your design system or require one that isn't included in the library. <strong>Often, you end up wrapping library components, writing workarounds to override styles, or mixing components from different libraries with incompatible APIs.</strong></p>
      <p>This is what WebJs UI aims to solve. It is built around the following principles:</p>
      <ul>
        <li><strong>Open Code:</strong> The top layer of your component code is open for modification.</li>
        <li><strong>Composition:</strong> Every component uses a common, composable interface, making them predictable.</li>
        <li><strong>Distribution:</strong> A flat-file schema and command-line tool make it easy to distribute components.</li>
        <li><strong>Beautiful Defaults:</strong> Carefully chosen default styles, so you get great design out-of-the-box.</li>
        <li><strong>AI-Ready:</strong> Open code for LLMs to read, understand, and improve.</li>
      </ul>

      ${heading(toc, 2, 'Open Code')}
      <p>WebJs UI hands you the actual component code: <code>webjs ui add</code> copies the source into your app's <code>components/ui/</code>. You have full control to customize and extend the components to your needs. This means:</p>
      <ul>
        <li><strong>Full Transparency:</strong> You see exactly how each component is built.</li>
        <li><strong>Easy Customization:</strong> Modify any part of a component to fit your design and functionality requirements.</li>
        <li><strong>AI Integration:</strong> Access to the code makes it straightforward for LLMs to read, understand, and even improve your components.</li>
      </ul>
      <p><em>In a typical library, if you need to change a button's behavior, you have to override styles or wrap the component. With WebJs UI, you simply edit the button code directly.</em></p>
      <div data-slot="accordion" class=${cn(accordionClass(), 'not-typeset mt-6')}>
        <details name="intro-faq" data-slot="accordion-item" class=${cn(accordionItemClass(), 'border-none')}>
          <summary data-slot="accordion-trigger" class=${accordionTriggerClass()}>
            How do I pull upstream updates in an Open Code approach?
            ${ChevronDownIcon('pointer-events-none ml-auto size-4 shrink-0 text-muted-foreground group-open:hidden')}
            ${ChevronUpIcon('pointer-events-none ml-auto hidden size-4 shrink-0 text-muted-foreground group-open:inline')}
          </summary>
          <div data-slot="accordion-content" class=${cn(accordionContentClass(), 'flex flex-col gap-4')}>
            <p>WebJs UI builds on the platform rather than on a headless library: a dialog is a native <code>&lt;dialog&gt;</code>, a popover the <code>popover</code> attribute, and the few custom elements extend <code>WebComponent</code> from <code>@webjsdev/core</code>. So the core your components stand on receives fixes when you update <code>@webjsdev/core</code> and the browser.</p>
            <p>The topmost layer, the code closest to your design system, is yours and is not coupled to the kit. Run <code>webjs ui diff</code> to see how your copy differs from the registry, and take the changes you want.</p>
          </div>
        </details>
      </div>

      ${heading(toc, 2, 'Composition')}
      <p>Every component in WebJs UI shares a common, composable interface: a class helper you put on a native element (<code>buttonClass()</code> on a real <code>&lt;button&gt;</code>), or a custom element that mirrors shadcn's tree tag for tag (<code>&lt;ui-dialog-content&gt;</code> for <code>DialogContent</code>). <strong>If a component does not exist, we bring it in, make it composable, and adjust its style to match and work with the rest of the design system.</strong></p>
      <p><em>A shared, composable interface means it's predictable for both your team and LLMs. You are not learning different APIs for every new component. Variant names, sizes and the data attributes match shadcn's, so what you know about shadcn/ui carries over.</em></p>

      ${heading(toc, 2, 'Distribution')}
      <p>WebJs UI is also a code distribution system. It defines a schema for components and a CLI to distribute them.</p>
      <ul>
        <li><strong>Schema:</strong> A flat-file structure that defines the components, their dependencies, and properties. It is shadcn's registry item format. See <a href="/ui/docs/registry/registry-item-json">registry-item.json</a>.</li>
        <li><strong>CLI:</strong> A command-line tool to distribute and install components, blocks and charts across WebJs apps. See the <a href="/ui/docs/cli">CLI</a>.</li>
      </ul>
      <p><em>You can use the schema to distribute your components to other projects from a <a href="/ui/docs/registry">registry of your own</a>, or have AI generate completely new components based on existing schema.</em></p>

      ${heading(toc, 2, 'Beautiful Defaults')}
      <p>WebJs UI comes with a large collection of components that have carefully chosen default styles. They are designed to look good on their own and to work well together as a consistent system:</p>
      <ul>
        <li><strong>Good Out-of-the-Box:</strong> Your UI has a clean and minimal look without extra work.</li>
        <li><strong>Unified Design:</strong> Components naturally fit with one another. Each component is built to match the others, keeping your UI consistent.</li>
        <li><strong>Easily Customizable:</strong> If you want to change something, it's simple to override and extend the defaults, or pick another of shadcn's styles and themes in <a href="/ui/create">Create</a>.</li>
      </ul>

      ${heading(toc, 2, 'AI-Ready')}
      <p>The design of WebJs UI makes it easy for AI tools to work with your code. Its open code and consistent API allow AI models to read, understand, and even generate new components. Every WebJs app also ships a read-only MCP server whose <code>ui</code> tool lists the kit and returns any component's helpers and example, and the <a href="/ui/docs/skills">skill</a> tells an agent to install a ready-made block before writing a view by hand.</p>
      <p><em>An AI model can learn how your components work and suggest improvements or even create new components that integrate with your existing design.</em></p>
  `;
  return docsPage({
    href: '/ui/docs',
    title: 'Introduction',
    description: 'WebJs UI is a set of beautifully-designed, accessible components and a code distribution platform for WebJs apps. Open Source. Open Code.',
    toc,
    body,
  });
}
