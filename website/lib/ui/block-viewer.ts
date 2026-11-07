import { asset, html, svg } from '@webjsdev/core';
import { blockDisplay, type BlockFile } from '#modules/ui/queries/blocks.server.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * shadcn/ui's BlockViewer (apps/v4/components/block-viewer.tsx and
 * block-display.tsx, #1666): one registry block as a toolbar over a resizable
 * preview of /ui/view/<name>, with a Code view that lists the block's files
 * as a tree beside the selected file's source.
 *
 * Everything is server markup in shadcn's classes, and the state is native
 * form controls: Preview / Code, the viewport size and the selected file are
 * radio groups whose checked radio the CSS reads with `:has()`. So the
 * toggles, the viewport sizes and the file tree all work with JavaScript off,
 * and the preview iframe and every file's source are in the HTML. The
 * <block-viewer> element (components/block-viewer.ts) adds only what markup
 * cannot do: drag-resizing the preview, refresh, the copy buttons, and
 * keeping the tree's highlight on the chosen file. A page rendering a viewer
 * imports that element itself, so this module stays server-only and elided.
 *
 * blockViewer is used by /ui/blocks and /ui/blocks/<category>; blockPreview
 * by the Sidebar docs page, which leads with sidebar-07 the way shadcn's
 * sidebar.mdx leads with its block.
 */

// The lucide icons the viewer draws, from lucide 1.21.0 (ISC). Local rather
// than from lib/ui/lucide.ts, which the elision analyser reads as client work,
// so importing it would ship this module and every page using it.
const icon = (cls: string, body: unknown) =>
  svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${cls}>${body}</svg>`;
const CheckIcon = () => icon('lucide lucide-check', svg`<path d="M20 6 9 17l-5-5"></path>`);
const ChevronRightIcon = (cls = '') => icon(`lucide lucide-chevron-right ${cls}`, svg`<path d="m9 18 6-6-6-6"></path>`);
const FileIcon = () => icon('lucide lucide-file', svg`<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path>`);
const FolderIcon = () => icon('lucide lucide-folder', svg`<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path>`);
const MonitorIcon = () => icon('lucide lucide-monitor', svg`<rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" x2="16" y1="21" y2="21"></line><line x1="12" x2="12" y1="17" y2="21"></line>`);
const RotateCwIcon = () => icon('lucide lucide-rotate-cw', svg`<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path>`);
const TerminalIcon = () => icon('lucide lucide-terminal', svg`<path d="M12 19h8"></path><path d="m4 17 6-6-6-6"></path>`);
const TabletIcon = () => icon('lucide lucide-tablet', svg`<rect width="16" height="20" x="4" y="2" rx="2" ry="2"></rect><line x1="12" x2="12.01" y1="18" y2="18"></line>`);
const SmartphoneIcon = () => icon('lucide lucide-smartphone', svg`<rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><path d="M12 18h.01"></path>`);
const FullscreenIcon = () => icon('lucide lucide-fullscreen', svg`<path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><rect width="10" height="8" x="7" y="8" rx="1"></rect>`);
const ClipboardIcon = () => icon('lucide lucide-clipboard', svg`<rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>`);

// The TypeScript mark shadcn's figcaption shows for a .ts / .tsx file (its Icons.ts).
const TsIcon = () => svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" class="fill-foreground"><path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"></path></svg>`;

/** A copy button's two faces; the element flips `data-copied` for a moment. */
const copyFaces = (idle: unknown) => html`<span class="contents group-data-[copied]/copy:hidden">${idle}</span><span class="hidden group-data-[copied]/copy:contents">${CheckIcon()}</span>`;

const separator = (cls: string) => html`<div role="none" data-slot="separator" data-orientation="vertical" class=${`shrink-0 bg-border w-px self-stretch ${cls}`}></div>`;

// shadcn's TabsList / TabsTrigger (new-york), with the trigger as a label
// around a radio so the active tab is the checked radio.
const TAB = 'relative inline-flex h-6 flex-1 cursor-pointer items-center justify-center rounded-sm border border-transparent px-2 text-xs font-medium whitespace-nowrap text-foreground/60 transition-all select-none hover:text-foreground has-checked:bg-background has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 dark:text-muted-foreground dark:hover:text-foreground dark:has-checked:border-input dark:has-checked:bg-input/30 dark:has-checked:text-foreground';
// shadcn's ToggleGroupItem at size-6, rounded-sm.
const TOGGLE = 'inline-flex size-6 cursor-pointer items-center justify-center rounded-sm text-sm font-medium transition-[color,box-shadow] select-none hover:bg-muted hover:text-muted-foreground has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0';
// shadcn's ghost icon Button at size-6, rounded-sm.
const GHOST_ICON = 'inline-flex size-6 shrink-0 items-center justify-center rounded-sm p-0 text-foreground outline-none transition-all hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:hover:bg-accent/50 [&_svg]:size-4 [&_svg]:shrink-0';
// shadcn's outline sm Button with `w-fit gap-1 px-2 shadow-none`.
const OUTLINE_SM = 'group/copy inline-flex h-8 w-fit shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border bg-background px-2 text-sm font-medium whitespace-nowrap text-foreground shadow-none outline-none transition-all hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50 [&_svg]:size-4 [&_svg]:shrink-0';
// shadcn's SidebarMenuButton as the file tree draws it.
const TREE_BUTTON = 'flex h-8 w-full cursor-pointer items-center gap-2 overflow-hidden rounded-none p-2 ps-(--index) text-left text-sm whitespace-nowrap outline-none hover:bg-muted-foreground/15 focus-visible:bg-muted-foreground/15 data-[active=true]:bg-muted-foreground/15 data-[active=true]:font-medium has-focus-visible:bg-muted-foreground/15 [&_svg]:size-4 [&_svg]:shrink-0';

interface TreeNode {
  name: string;
  /** The file's index in the block's files, on a leaf. */
  file?: number;
  children?: TreeNode[];
}

/** shadcn's createFileTreeForRegistryItemFiles: the targets as a folder tree. */
function fileTree(files: BlockFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  files.forEach((f, file) => {
    const parts = f.target.split('/');
    let level = root;
    parts.forEach((name, i) => {
      if (i === parts.length - 1) {
        level.push({ name, file });
        return;
      }
      let dir = level.find((n) => n.name === name && n.children);
      if (!dir) {
        dir = { name, children: [] };
        level.push(dir);
      }
      level = dir.children!;
    });
  });
  return root;
}

function treeItems(block: string, nodes: TreeNode[], depth: number): unknown {
  return nodes.map((node) => {
    if (!node.children) {
      const indent = `${depth * (depth === 2 ? 1.2 : 1.3)}rem`;
      return html`<li data-slot="sidebar-menu-item" class="relative">
        <label for=${`${block}-file-${node.file}`} data-file=${node.file} data-active=${node.file === 0 ? 'true' : 'false'} class=${TREE_BUTTON} style=${`--index: ${indent}`}>
          ${ChevronRightIcon('invisible')}${FileIcon()}${node.name}
        </label>
      </li>`;
    }
    const indent = `${depth * (depth === 1 ? 1 : 1.2)}rem`;
    return html`<li data-slot="sidebar-menu-item" class="relative">
      <details open class="group/collapsible">
        <summary class=${`${TREE_BUTTON} list-none [&::-webkit-details-marker]:hidden`} style=${`--index: ${indent}`}>
          ${ChevronRightIcon('transition-transform group-open/collapsible:rotate-90')}${FolderIcon()}${node.name}
        </summary>
        <ul data-slot="sidebar-menu-sub" class="m-0 flex w-full min-w-0 flex-col gap-1.5 border-none p-0">
          ${treeItems(block, node.children, depth + 1)}
        </ul>
      </details>
    </li>`;
  });
}

export interface BlockViewerOptions {
  /** The preview's height, shadcn's `meta.iframeHeight`. */
  iframeHeight?: string;
}

/**
 * shadcn's ComponentPreview with `type="block"` (components/component-preview.tsx),
 * which a docs page leads with: the block's frame in a bordered box, clipped
 * to its top left at a 1600px width, with an optional caption. Below `md` it
 * shows the block's screenshot instead, as shadcn does.
 */
export function blockPreview(name: string, opts: { caption?: string } = {}) {
  const content = html`<div data-not-typeset data-slot="block-preview" class="relative mt-6 aspect-[4/2.5] w-full overflow-hidden rounded-2xl border md:-mx-1">
    ${blockImage(name, 'absolute top-0 left-0 z-20 h-full w-[1600px] max-w-none bg-background object-cover object-left-top md:hidden')}
    <div class="absolute inset-0 hidden w-[1600px] bg-background md:block">
      <iframe src=${`/ui/view/${name}`} title=${`${name} preview`} loading="lazy" class="size-full"></iframe>
    </div>
  </div>`;
  if (!opts.caption) return content;
  return html`<figure class="flex flex-col gap-4">
    ${content}
    <figcaption class="text-center text-sm text-muted-foreground">${opts.caption}</figcaption>
  </figure>`;
}

/**
 * A block's screenshot in both themes, shadcn's two next/image pictures:
 * public/images/blocks/<name>-{light,dark}.png at shadcn's 1440 by 900, shot
 * by scripts/shoot-block-images.mjs. A phone sees it in place of the live
 * frame, which would render the block's own small-screen layout rather than
 * the desktop page a reader is choosing.
 */
function blockImage(name: string, cls: string) {
  const src = (theme: string) => asset(`/public/images/blocks/${name}-${theme}.png`);
  return html`<img src=${src('light')} alt=${name} data-block=${name} width="1440" height="900" loading="lazy" decoding="async" class=${`${cls} dark:hidden`}>
    <img src=${src('dark')} alt=${name} data-block=${name} width="1440" height="900" loading="lazy" decoding="async" class=${`${cls} hidden dark:block`}>`;
}

/** The viewer for one block, or nothing when `name` is not a block. */
export async function blockViewer(name: string, opts: BlockViewerOptions = {}) {
  const block = await blockDisplay(name);
  if (!block) return '';
  const height = opts.iframeHeight ?? '930px';
  const src = `/ui/view/${block.name}`;
  const command = `npx @webjsdev/ui add ${block.name}`;
  const description = block.description.replace(/\.$/, '');

  return html`<block-viewer
    id=${block.name}
    data-slot="block-viewer"
    class="group/block-view-wrapper flex min-w-0 scroll-mt-24 flex-col-reverse items-stretch gap-4 overflow-hidden md:flex-col"
    style=${`--height: ${height}`}
  >
    <div data-slot="block-viewer-toolbar" class="hidden w-full items-center gap-2 pl-2 md:pr-6 lg:flex">
      <div role="radiogroup" aria-label="View" class="grid h-8 w-fit grid-cols-2 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
        <label class=${TAB}><input type="radio" class="sr-only" name=${`${block.name}-view`} value="preview" data-block-view="preview" checked>Preview</label>
        <label class=${TAB}><input type="radio" class="sr-only" name=${`${block.name}-view`} value="code" data-block-view="code">Code</label>
      </div>
      ${separator('mx-2 h-4 self-center')}
      <a href=${`#${block.name}`} class="flex-1 text-center text-sm font-medium text-foreground no-underline underline-offset-2 hover:underline md:flex-auto md:text-left">${description}</a>
      <div class="ml-auto flex items-center gap-2">
        <div class="flex h-8 items-center gap-1.5 rounded-md border p-[3px] shadow-none">
          <div role="radiogroup" aria-label="Preview size" class="flex items-center gap-1">
            <label class=${TOGGLE} title="Desktop"><input type="radio" class="sr-only" name=${`${block.name}-viewport`} value="desktop" data-block-viewport="desktop" aria-label="Desktop" checked>${MonitorIcon()}</label>
            <label class=${TOGGLE} title="Tablet"><input type="radio" class="sr-only" name=${`${block.name}-viewport`} value="tablet" data-block-viewport="tablet" aria-label="Tablet">${TabletIcon()}</label>
            <label class=${TOGGLE} title="Mobile"><input type="radio" class="sr-only" name=${`${block.name}-viewport`} value="mobile" data-block-viewport="mobile" aria-label="Mobile">${SmartphoneIcon()}</label>
          </div>
          ${separator('h-4 self-center')}
          <a href=${src} target="_blank" rel="noopener" class=${GHOST_ICON} title="Open in New Tab"><span class="sr-only">Open in New Tab</span>${FullscreenIcon()}</a>
          ${separator('h-4 self-center')}
          <button type="button" data-block-refresh class=${GHOST_ICON} title="Refresh Preview">${RotateCwIcon()}<span class="sr-only">Refresh Preview</span></button>
        </div>
        ${separator('mx-1 h-4 self-center')}
        <button type="button" data-block-copy=${command} class=${OUTLINE_SM}>${copyFaces(TerminalIcon())}<span>${command}</span></button>
      </div>
    </div>

    <div data-slot="block-viewer-view" class="hidden md:h-(--height) lg:flex group-has-[[data-block-view=code]:checked]/block-view-wrapper:hidden">
      <div class="relative grid w-full gap-4">
        <div class="absolute inset-0 right-4 [background-image:radial-gradient(#d4d4d4_1px,transparent_1px)] [background-size:20px_20px] dark:[background-image:radial-gradient(#404040_1px,transparent_1px)]"></div>
        <div data-block-panels class="relative z-10 flex after:absolute after:inset-0 after:right-3 after:z-0 after:rounded-xl after:bg-surface/50">
          <div data-block-panel class="relative z-10 w-[calc(100%-0.75rem)] min-w-[30%] shrink-0 overflow-hidden rounded-xl border bg-background group-has-[[data-block-viewport=tablet]:checked]/block-view-wrapper:w-[60%] group-has-[[data-block-viewport=mobile]:checked]/block-view-wrapper:w-[30%]">
            <iframe src=${src} title=${`${block.title} preview`} height=${parseInt(height, 10) || 930} loading="lazy" class="relative z-20 no-scrollbar h-full w-full bg-background"></iframe>
          </div>
          <div data-block-handle role="separator" aria-orientation="vertical" aria-label="Resize the preview" class="relative z-10 hidden w-3 shrink-0 cursor-col-resize touch-none bg-transparent p-0 after:absolute after:top-1/2 after:right-0 after:h-8 after:w-[6px] after:translate-x-[-1px] after:-translate-y-1/2 after:rounded-full after:bg-border after:transition-all hover:after:h-10 md:block"></div>
        </div>
      </div>
    </div>

    <div data-slot="block-viewer-code" class="mr-[14px] hidden overflow-hidden rounded-xl border bg-code text-code-foreground md:h-(--height) group-has-[[data-block-view=code]:checked]/block-view-wrapper:flex">
      <div class="w-72 shrink-0">
        <div class="flex min-h-full flex-col border-r">
          <div class="flex h-12 shrink-0 items-center border-b px-4 text-sm font-medium text-sidebar-foreground/70">Files</div>
          <ul data-slot="sidebar-menu" class="m-0 flex w-full min-w-0 list-none flex-col gap-1.5 p-0">
            ${treeItems(block.name, fileTree(block.files), 1)}
          </ul>
        </div>
      </div>
      <div class="flex min-w-0 flex-1 flex-col">
        ${block.files.map((file, i) => html`<div class="contents">
          <input type="radio" class="peer sr-only" id=${`${block.name}-file-${i}`} name=${`${block.name}-file`} value=${file.target} data-block-file=${i} ?checked=${i === 0} aria-label=${file.target}>
          <div data-block-source class="hidden min-h-0 flex-1 flex-col peer-checked:flex peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 [&_[data-rehype-pretty-code-figure]]:m-0! [&_[data-rehype-pretty-code-figure]]:flex [&_[data-rehype-pretty-code-figure]]:min-h-0 [&_[data-rehype-pretty-code-figure]]:flex-1 [&_[data-rehype-pretty-code-figure]]:flex-col [&_[data-rehype-pretty-code-figure]]:rounded-none [&_[data-rehype-pretty-code-figure]]:border-none [&_pre]:flex-1">
            <div class="flex h-12 shrink-0 items-center gap-2 border-b px-4 py-2 text-sm text-code-foreground [&_svg]:size-4 [&_svg]:text-code-foreground [&_svg]:opacity-70">
              ${TsIcon()}${file.target}
              <div class="ml-auto flex items-center gap-2">
                <button type="button" data-block-copy-file=${i} class=${`group/copy ${GHOST_ICON} size-7`} title="Copy Code"><span class="sr-only">Copy Code</span>${copyFaces(ClipboardIcon())}</button>
              </div>
            </div>
            ${codeFigure(file.source, { lineNumbers: true })}
          </div>
        </div>`)}
      </div>
    </div>

    <div data-slot="block-viewer-mobile" class="flex flex-col gap-2 lg:hidden">
      <div class="flex items-center gap-2 px-2">
        <div class="line-clamp-1 text-sm font-medium">${block.description}</div>
        <div class="ml-auto shrink-0 font-mono text-xs text-muted-foreground">${block.name}</div>
      </div>
      <div class="overflow-hidden rounded-xl border">
        ${blockImage(block.name, 'object-cover')}
      </div>
    </div>
  </block-viewer>`;
}
