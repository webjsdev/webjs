import { html } from '@webjsdev/core';

const PKG_COLOR: Record<string, string> = {
  core:        'bg-accent/15 text-accent',
  server:      'bg-blue-500/15 text-blue-500',
  cli:         'bg-emerald-500/15 text-emerald-500',
  'ts-plugin': 'bg-purple-500/15 text-purple-500',
  ui:          'bg-orange-500/15 text-orange-500',
};

/** Color-coded pill badge for the package short-name in a changelog entry. */
export function pkgBadge(pkg: string) {
  const cls = PKG_COLOR[pkg] || 'bg-fg-subtle/15 text-fg-subtle';
  return html`<span class="${cls} font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] px-2 py-0.5 rounded">${pkg}</span>`;
}
