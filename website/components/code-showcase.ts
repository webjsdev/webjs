import { WebComponent, html, signal } from '@webjsdev/core';
import { highlight } from '#lib/highlight.ts';
import { COMPONENT_SAMPLE, ACTION_SAMPLE, PAGE_SAMPLE } from '#lib/samples.ts';

const FILES = [
  { name: 'like-button.ts', path: 'components/like-button.ts', folder: 'components', label: 'Interactive component', code: COMPONENT_SAMPLE },
  { name: 'get-post.server.ts', path: 'queries/get-post.server.ts', folder: 'queries', label: 'Server query', code: ACTION_SAMPLE },
  { name: 'page.ts', path: 'app/posts/[id]/page.ts', folder: 'app/posts/[id]', label: 'SSR page', code: PAGE_SAMPLE },
];

const ICONS = {
  folder: html`<svg class="w-4 h-4 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/></svg>`,
  folderOpen: html`<svg class="w-4 h-4 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2h6.86a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2z"/><path d="M2 10h20"/></svg>`,
  tsFile: html`<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="3" fill="#3178c6"/><text x="12" y="16.5" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10" font-weight="700" fill="#ffffff">TS</text></svg>`,
  copy: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  check: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`
};

export class CodeShowcase extends WebComponent {
  activeTab = signal<number>(0);
  copied = signal<boolean>(false);
  private _resetTimer: number | undefined;

  disconnectedCallback() {
    if (this._resetTimer) clearTimeout(this._resetTimer);
    super.disconnectedCallback?.();
  }

  _copy = async () => {
    const activeCode = FILES[this.activeTab.get()].code;
    try {
      await navigator.clipboard.writeText(activeCode);
    } catch {
      return;
    }
    this.copied.set(true);
    if (this._resetTimer) clearTimeout(this._resetTimer);
    this._resetTimer = (setTimeout(() => this.copied.set(false), 1500) as unknown as number);

    (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.(
      'event',
      'copy_showcase_code',
      { file: FILES[this.activeTab.get()].path },
    );
  };

  render() {
    const activeIdx = this.activeTab.get();
    const isCopied = this.copied.get();
    const activeFile = FILES[activeIdx];

    const codeLines = activeFile.code.replace(/^\n+|\n+$/g, '').split('\n');
    const lineNumbers = Array.from({ length: codeLines.length }, (_, i) => i + 1);

    const dots = html`
      <div class="flex gap-1.5 select-none shrink-0">
        <span class="w-3 h-3 rounded-full bg-[#ff5f57]/80"></span>
        <span class="w-3 h-3 rounded-full bg-[#febc2e]/80"></span>
        <span class="w-3 h-3 rounded-full bg-[#28c840]/80"></span>
      </div>
    `;

    return html`
      <div class="flex flex-col md:flex-row w-full rounded-2xl border border-[var(--editor-border)] bg-[var(--editor-bg)] overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] min-h-[460px] text-left">
        <!-- Sidebar File Explorer -->
        <aside class="hidden md:flex flex-col w-64 bg-[var(--editor-sidebar-bg)] border-r border-[var(--editor-border)] shrink-0 select-none font-sans text-xs">
          <div class="flex items-center justify-between px-4 py-3.5 border-b border-[var(--editor-border)] text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
            <span>Explorer</span>
            <span class="text-[9px] px-1 py-0.5 bg-fg/5 rounded text-fg-subtle">workspace</span>
          </div>

          <div class="p-3 flex flex-col gap-2">
            <div class="flex items-center gap-1.5 text-fg font-semibold px-1">
              ${ICONS.folderOpen}
              <span>my-app</span>
            </div>

            <div class="pl-3 flex flex-col gap-1.5">
              <!-- Folder queries -->
              <div>
                <div class="flex items-center gap-1.5 text-fg-subtle py-0.5 px-1">
                  ${ICONS.folder}
                  <span>queries</span>
                </div>
                <div class="pl-5 mt-0.5">
                  <button
                    class="flex items-center gap-2 w-full px-2 py-1 rounded text-left transition-all cursor-pointer ${activeIdx === 1 ? 'bg-bg-subtle text-fg font-medium' : 'text-fg-subtle hover:text-fg hover:bg-bg-subtle/50'}"
                    @click=${() => { this.activeTab.set(1); this.copied.set(false); }}
                  >
                    ${ICONS.tsFile}
                    <span class="truncate">get-post.server.ts</span>
                  </button>
                </div>
              </div>

              <!-- Folder app/posts/[id] -->
              <div>
                <div class="flex items-center gap-1.5 text-fg-subtle py-0.5 px-1">
                  ${ICONS.folder}
                  <span>app/posts/[id]</span>
                </div>
                <div class="pl-5 mt-0.5">
                  <button
                    class="flex items-center gap-2 w-full px-2 py-1 rounded text-left transition-all cursor-pointer ${activeIdx === 2 ? 'bg-bg-subtle text-fg font-medium' : 'text-fg-subtle hover:text-fg hover:bg-bg-subtle/50'}"
                    @click=${() => { this.activeTab.set(2); this.copied.set(false); }}
                  >
                    ${ICONS.tsFile}
                    <span class="truncate">page.ts</span>
                  </button>
                </div>
              </div>

              <!-- Folder components -->
              <div>
                <div class="flex items-center gap-1.5 text-fg-subtle py-0.5 px-1">
                  ${ICONS.folder}
                  <span>components</span>
                </div>
                <div class="pl-5 mt-0.5">
                  <button
                    class="flex items-center gap-2 w-full px-2 py-1 rounded text-left transition-all cursor-pointer ${activeIdx === 0 ? 'bg-bg-subtle text-fg font-medium' : 'text-fg-subtle hover:text-fg hover:bg-bg-subtle/50'}"
                    @click=${() => { this.activeTab.set(0); this.copied.set(false); }}
                  >
                    ${ICONS.tsFile}
                    <span class="truncate">like-button.ts</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <!-- Main Editor Area -->
        <div class="flex flex-col flex-1 min-w-0 bg-[var(--editor-bg)] relative">
          <!-- Editor Title bar / Tabs -->
          <div class="flex items-center justify-between border-b border-[var(--editor-border)] bg-[var(--editor-tab-bg)] px-4 select-none shrink-0" role="tablist">
            <div class="flex items-center overflow-x-auto scrollbar-none gap-px">
              ${FILES.map((f, idx) => {
                const isActive = idx === activeIdx;
                return html`
                  <button
                    class="flex items-center gap-2 px-4 py-3 text-[11px] font-medium cursor-pointer transition-all border-b-2 ${isActive ? 'bg-[var(--editor-active-tab-bg)] text-[var(--editor-fg)] border-b-[var(--editor-fg)] font-semibold' : 'bg-transparent text-fg-subtle border-b-transparent hover:text-[var(--editor-fg)] hover:bg-bg-subtle/50'}"
                    role="tab"
                    aria-selected=${isActive ? 'true' : 'false'}
                    @click=${() => { this.activeTab.set(idx); this.copied.set(false); }}
                  >
                    ${ICONS.tsFile}
                    <span>${f.name}</span>
                    <span class="text-[9px] text-fg-subtle hover:text-fg ml-1">✕</span>
                  </button>
                `;
              })}
            </div>
            <div class="flex items-center gap-4">
              <span class="hidden sm:inline text-[10px] font-mono text-fg-subtle">${activeFile.path}</span>
              ${dots}
            </div>
          </div>

          <!-- Active Code Pane -->
          <div class="relative flex-1 flex flex-col min-w-0 min-h-0 bg-[var(--editor-bg)]">
            <!-- Copy button -->
            <button
              class="absolute right-4 top-4 z-10 inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--editor-border)] bg-[var(--editor-sidebar-bg)] cursor-pointer transition-all duration-[140ms] hover:text-[var(--editor-fg)] hover:border-border-strong text-fg-subtle ${isCopied ? 'text-green-600 dark:text-green-400 border-green-500/20 bg-green-500/10' : ''}"
              type="button"
              aria-label="Copy code sample"
              @click=${this._copy}
            >
              ${isCopied ? ICONS.check : ICONS.copy}
            </button>

            <!-- Syntax Highlighted Code with Line Numbers -->
            <div class="flex font-mono text-[13px] leading-[1.7] [tab-size:2] overflow-auto flex-1 min-h-[340px] max-h-[460px] p-5 select-text">
              <!-- Line Numbers Column -->
              <div class="hidden sm:flex flex-col text-right pr-4 text-[var(--editor-gutter-fg)] select-none border-r border-[var(--editor-gutter-border)] mr-4 font-mono">
                ${lineNumbers.map(n => html`<span>${n}</span>`)}
              </div>
              <!-- Code Column -->
              <pre class="m-0 overflow-x-auto flex-1 font-mono text-[var(--editor-fg)]"><code>${highlight(activeFile.code)}</code></pre>
            </div>
          </div>

          <!-- Bottom Status Bar -->
          <footer class="flex items-center justify-between px-4 py-1.5 bg-[var(--editor-status-bg)] border-t border-[var(--editor-border)] text-[10px] font-mono text-fg-subtle select-none shrink-0">
            <div class="flex items-center gap-3">
              <span class="flex items-center gap-1 text-fg-muted">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                <span>main</span>
              </span>
              <span>✓ sync</span>
            </div>
            <div class="flex items-center gap-4">
              <span>TypeScript</span>
              <span>UTF-8</span>
              <span>Tab Size: 2</span>
            </div>
          </footer>
        </div>
      </div>
    `;
  }
}

CodeShowcase.register('code-showcase');
