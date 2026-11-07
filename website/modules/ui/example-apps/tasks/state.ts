import type { Task } from './data.ts';
import { readSelectorTheme, DEFAULT_SELECTOR_THEME } from '#lib/ui/selector-themes.ts';

/**
 * The tasks table's state, read from and written to the query string (#1666).
 * shadcn keeps it in TanStack Table's React state; here the server applies it,
 * so filtering, sorting, hiding columns and paging are links and a GET form
 * that work with JavaScript off. Pure, so the page and the tests share it.
 *
 *   q         the title filter (case-insensitive substring)
 *   status    a status to keep, repeatable
 *   priority  a priority to keep, repeatable
 *   sort      `<column>.asc` or `<column>.desc` (title, status or priority)
 *   hide      a column to hide, repeatable (title, status or priority)
 *   size      rows per page (10, 20, 25, 30, 40 or 50; 25 by default)
 *   page      the 1-based page
 *   theme     the examples theme (lib/ui/selector-themes.ts), carried along
 *             so a filter, a sort or a page keeps it
 */

export const PATH = '/ui/examples/tasks';
export const PAGE_SIZES = [10, 20, 25, 30, 40, 50];
const DEFAULT_SIZE = 25;
export const SORTABLE = ['title', 'status', 'priority'] as const;
export const HIDEABLE = ['title', 'status', 'priority'] as const;
export type Column = (typeof SORTABLE)[number];

export interface TasksState {
  q: string;
  status: string[];
  priority: string[];
  sort: { id: Column; desc: boolean } | null;
  hide: Column[];
  size: number;
  page: number;
  theme: string;
}

const isColumn = (v: string): v is Column => (SORTABLE as readonly string[]).includes(v);

export function parseState(params: URLSearchParams): TasksState {
  const [sortId, dir] = (params.get('sort') ?? '').split('.');
  const size = Number(params.get('size'));
  const page = Math.floor(Number(params.get('page')));
  return {
    q: (params.get('q') ?? '').trim(),
    status: params.getAll('status'),
    priority: params.getAll('priority'),
    sort: isColumn(sortId) && (dir === 'asc' || dir === 'desc') ? { id: sortId, desc: dir === 'desc' } : null,
    hide: params.getAll('hide').filter(isColumn),
    size: PAGE_SIZES.includes(size) ? size : DEFAULT_SIZE,
    page: page >= 1 ? page : 1,
    theme: readSelectorTheme(params),
  };
}

/** The URL for `state` with `patch` applied, leaving out every default. */
export function hrefFor(state: TasksState, patch: Partial<TasksState> = {}): string {
  const s = { ...state, ...patch };
  const p = new URLSearchParams();
  if (s.q) p.set('q', s.q);
  for (const v of s.status) p.append('status', v);
  for (const v of s.priority) p.append('priority', v);
  if (s.sort) p.set('sort', `${s.sort.id}.${s.sort.desc ? 'desc' : 'asc'}`);
  for (const v of s.hide) p.append('hide', v);
  if (s.size !== DEFAULT_SIZE) p.set('size', String(s.size));
  if (s.page > 1) p.set('page', String(s.page));
  if (s.theme !== DEFAULT_SELECTOR_THEME) p.set('theme', s.theme);
  const qs = p.toString();
  return qs ? `${PATH}?${qs}` : PATH;
}

function matches(t: Task, s: TasksState, skip?: 'status' | 'priority'): boolean {
  if (s.q && !t.title.toLowerCase().includes(s.q.toLowerCase())) return false;
  if (skip !== 'status' && s.status.length && !s.status.includes(t.status)) return false;
  if (skip !== 'priority' && s.priority.length && !s.priority.includes(t.priority)) return false;
  return true;
}

function count(tasks: Task[], key: 'status' | 'priority'): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tasks) m.set(t[key], (m.get(t[key]) ?? 0) + 1);
  return m;
}

export interface TasksView {
  rows: Task[];
  filtered: number;
  pageCount: number;
  page: number;
  /** Each faceted filter's counts, under every OTHER filter, as TanStack's faceting counts them. */
  facets: { status: Map<string, number>; priority: Map<string, number> };
}

export function applyState(tasks: Task[], s: TasksState): TasksView {
  const filtered = tasks.filter((t) => matches(t, s));
  if (s.sort) {
    const { id, desc } = s.sort;
    filtered.sort((a, b) => (desc ? -1 : 1) * a[id].localeCompare(b[id]));
  }
  const pageCount = Math.max(1, Math.ceil(filtered.length / s.size));
  const page = Math.min(s.page, pageCount);
  return {
    rows: filtered.slice((page - 1) * s.size, page * s.size),
    filtered: filtered.length,
    pageCount,
    page,
    facets: {
      status: count(tasks.filter((t) => matches(t, s, 'status')), 'status'),
      priority: count(tasks.filter((t) => matches(t, s, 'priority')), 'priority'),
    },
  };
}
