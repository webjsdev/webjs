import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { RHEA, installation, migrating } from './shared.ts';

/**
 * File Tree, ported from shadcn's content/docs/ai-elements/radix/file-tree.mdx
 * (#1666). A folder is the kit's Collapsible, a native details element, so
 * opening and closing it needs no script.
 */
export const title = 'File Tree';
export const description = 'The files the agent changed, as a folder tree.';

export default async function body(toc: TocEntry[]) {
  return html`
    ${await componentPreview('file-tree-demo', RHEA)}
    <p>File Tree is the files the agent changed, shown as folders you can open. A folder is a <a href="/ui/docs/components/collapsible">Collapsible</a>. A file is a <a href="/ui/docs/components/button">Button</a>. For a single file the agent read or edited, use a <a href="/ui/docs/ai-elements/tool">Tool</a> line instead.</p>

    ${await installation(toc, {
      prose: html`File Tree is built with the <a href="/ui/docs/components/collapsible">Collapsible</a> and <a href="/ui/docs/components/button">Button</a> components.`,
      add: 'collapsible button',
      source: 'collapsible',
      dependencies: ['button'],
    })}

    ${heading(toc, 2, 'Usage')}
    <p>Render nodes recursively. Nest each folder's children in its collapsible content. The summary takes the button classes itself, since a button nested inside a <code>&lt;summary&gt;</code> would split the control from its label.</p>
    ${codeFigure(`if (node.type === 'folder') {
  return html\`
    <details data-slot="collapsible" open class=\${collapsibleClass()}>
      <summary data-slot="collapsible-trigger" class=\${cn(buttonClass({ variant: 'ghost', size: 'sm' }), 'w-full list-none justify-start [&::-webkit-details-marker]:hidden')}>
        \${ChevronRightIcon('transition-transform [[open]>summary>&]:rotate-90')}
        \${FolderIcon()}
        \${node.name}
      </summary>
      <div data-slot="collapsible-content" class=\${collapsibleContentClass()}>
        <div class="ml-4 flex flex-col">
          \${node.children.map((child) => fileTreeNode(child))}
        </div>
      </div>
    </details>
  \`;
}`, { lineNumbers: true })}
    ${codeFigure(`<button type="button" data-slot="button" data-variant="ghost" data-size="sm" class=\${cn(buttonClass({ variant: 'ghost', size: 'sm' }), 'w-full justify-start')} @click=\${() => this.select(node.path)}>
  \${FileIcon()}
  \${node.name}
</button>`, { lineNumbers: true })}
    <p>See <a href="/ui/docs/components/collapsible#file-tree">Collapsible</a>.</p>

    ${migrating(toc, {
      name: 'File Tree',
      file: 'file-tree.tsx',
      parts: [
        ['FileTreeFolder', html`A <code>&lt;details&gt;</code> with <code>collapsibleClass()</code>. Its <code>&lt;summary&gt;</code> takes <code>buttonClass({ variant: 'ghost', size: 'sm' })</code> plus <code>w-full justify-start</code>, and its children go in the collapsible content.`],
        ['FileTreeFile', html`A button with <code>buttonClass({ variant: 'ghost', size: 'sm' })</code> whose click handler selects its path. If a file has actions, render them next to the button, not inside it.`],
        ['FileTree', html`The container. Keep the expanded and selected paths in your component, as the <code>open</code> attribute and <code>aria-current</code>.`],
        ['FileTreeIcon, FileTreeName, FileTreeActions', html`The icon, the name and the actions inside or beside the button, as they are.`],
      ],
    })}
  `;
}
