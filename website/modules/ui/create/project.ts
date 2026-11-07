/**
 * The commands the configurator's Get Code dialog offers (#1666), shadcn's
 * project form (apps/v4/app/(app)/(create)/components/project-form.tsx)
 * mapped onto what WebJs really ships:
 *
 * - **New Project.** shadcn's `shadcn init --preset <code> --template <x>`
 *   creates an app from a framework template. A WebJs app comes from
 *   `create-webjs` (the full-stack template, the only one with UI), and the
 *   preset is then applied by `@webjsdev/ui init --preset <code>`. The
 *   scaffold's theme block already carries its end marker, so init replaces
 *   it in place. The options are the scaffold's real flags: the runtime
 *   (`--runtime node|bun`) and the database (`--db sqlite|postgres`).
 *   shadcn's monorepo, RTL and pointer switches have no WebJs flag, so they
 *   are not offered.
 * - **Existing Project.** `@webjsdev/ui init --preset <code>` in the app.
 *   shadcn's `apply --only theme|font` has no WebJs counterpart yet, so there
 *   is one command, the whole preset.
 * - **Theme.** The tokens, for a stylesheet edited by hand.
 *
 * Pure, so <create-customizer> rebuilds the commands in the browser.
 */

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';
export type Runtime = 'node' | 'bun';
export type Database = 'sqlite' | 'postgres';

export const PACKAGE_MANAGERS: readonly PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun'];

export interface ProjectOptions {
  pm: PackageManager;
  runtime: Runtime;
  db: Database;
  name: string;
}

export const DEFAULT_PROJECT: ProjectOptions = { pm: 'npm', runtime: 'node', db: 'sqlite', name: 'my-app' };

/** The `@webjsdev/ui` runner for a package manager. */
function uiRunner(pm: PackageManager): string {
  switch (pm) {
    case 'npm': return 'npx @webjsdev/ui';
    case 'pnpm': return 'pnpm dlx @webjsdev/ui';
    case 'yarn': return 'yarn dlx @webjsdev/ui';
    case 'bun': return 'bunx @webjsdev/ui';
  }
}

/** Apply a preset to the app in the current directory. */
export function applyCommand(pm: PackageManager, code: string): string {
  return `${uiRunner(pm)} init --preset ${code}`;
}

/**
 * Scaffold an app and apply the preset to it. `bun create webjs` picks the Bun
 * runtime by itself and the others Node, so `--runtime` is written only when
 * the choice differs from that. npm passes flags to the initializer after
 * `--`.
 */
export function newProjectCommand(options: ProjectOptions, code: string): string {
  const { pm, runtime, db, name } = options;
  const flags: string[] = [];
  if (runtime !== (pm === 'bun' ? 'bun' : 'node')) flags.push(`--runtime ${runtime}`);
  if (db === 'postgres') flags.push('--db postgres');
  const rest = flags.join(' ');
  const create = pm === 'npm'
    ? `npm create webjs@latest ${name}${rest ? ` -- ${rest}` : ''}`
    : `${pm} create webjs ${name}${rest ? ` ${rest}` : ''}`;
  return `${create} && cd ${name} && ${applyCommand(pm, code)}`;
}

/** A project name the scaffold accepts, else the default. */
export function projectName(value: string | null | undefined): string {
  const name = (value || '').trim();
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,213}$/.test(name) ? name : DEFAULT_PROJECT.name;
}
