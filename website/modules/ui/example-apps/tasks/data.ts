import { CircleHelpIcon, CircleIcon, TimerIcon, CircleCheckIcon, CircleOffIcon, ArrowDownIcon, ArrowRightIcon, ArrowUpIcon } from './icons.ts';

/**
 * shadcn's examples/tasks/data/data.tsx and schema.ts (#1666): the labels,
 * statuses and priorities a task can have, and the task's shape.
 */

export interface Task {
  id: string;
  title: string;
  status: string;
  label: string;
  priority: string;
}

export interface Option {
  value: string;
  label: string;
  icon?: (cls?: string) => unknown;
}

export const labels: Option[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'documentation', label: 'Documentation' },
];

export const statuses: Option[] = [
  { value: 'backlog', label: 'Backlog', icon: CircleHelpIcon },
  { value: 'todo', label: 'Todo', icon: CircleIcon },
  { value: 'in progress', label: 'In Progress', icon: TimerIcon },
  { value: 'done', label: 'Done', icon: CircleCheckIcon },
  { value: 'canceled', label: 'Canceled', icon: CircleOffIcon },
];

export const priorities: Option[] = [
  { label: 'Low', value: 'low', icon: ArrowDownIcon },
  { label: 'Medium', value: 'medium', icon: ArrowRightIcon },
  { label: 'High', value: 'high', icon: ArrowUpIcon },
];
