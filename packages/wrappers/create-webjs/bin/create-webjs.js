#!/usr/bin/env node
/**
 * `create-webjs` is the `npx` / `npm create` entry point for scaffolding a
 * webjs app.
 *
 *   npm create webjs@latest my-app
 *   npx create-webjs@latest my-app
 *   npm create webjs@latest my-api  -- --template api
 *   npm create webjs@latest my-saas -- --template saas --no-install
 *
 * This is a thin wrapper around `@webjsdev/cli`'s `scaffoldApp()`. Behaviour
 * matches `webjs create` exactly, including auto-install (npm / pnpm / yarn /
 * bun, detected from `npm_config_user_agent`). Pass `--no-install` to opt out.
 *
 * The package mirrors the create-next-app / create-react-app / create-astro
 * pattern so the homepage hero is a single command and users don't need a
 * global install of `@webjsdev/cli` to start. The `npm create <suffix>` form
 * is npm's documented shorthand for `npx create-<suffix>`; both routes
 * resolve to this same package and bin.
 */
import { scaffoldApp } from '@webjsdev/cli/lib/create.js';

const TEMPLATES = ['full-stack', 'api', 'saas'];

const args = process.argv.slice(2);

function flagValue(name) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
}

const usage = `Usage:
  npm create webjs@latest <app-name> [-- --template full-stack|api|saas] [-- --no-install]
  npx create-webjs@latest <app-name> [--template full-stack|api|saas] [--no-install]

Templates:
  full-stack (default)  pages + components + API + Drizzle/SQLite
  api                   route handlers + modules, no SSR/UI
  saas                  auth + login/signup + protected dashboard + Drizzle User model

Options:
  --no-install          skip running the package manager's install in the new directory
  -h, --help            show this help`;

if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  console.log(usage);
  process.exit(args.length === 0 ? 1 : 0);
}

const positional = args.filter((a) => !a.startsWith('-'));
const name = positional[0];
if (!name) {
  console.error('Error: <app-name> is required.\n');
  console.error(usage);
  process.exit(1);
}

const template = flagValue('--template') || 'full-stack';
if (!TEMPLATES.includes(template)) {
  console.error(`Error: unknown template '${template}'. Only ${TEMPLATES.join(' / ')} are supported.\n`);
  console.error(usage);
  process.exit(1);
}

const noInstall = args.includes('--no-install');

await scaffoldApp(name, process.cwd(), { template, install: !noInstall });
