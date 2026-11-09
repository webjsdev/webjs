// Node walker for check-on-edit.sh. Reads the PostToolUse JSON payload (arg or
// stdin), and after an edit to an app source file runs `webjs check --json` and
// hands the edited file's violations back to the agent, each with its fix.
//
// Lit and Next.js habits are meant to produce correct WebJs code, and where one
// cannot, `webjs check` names the WebJs fix. Running it right after the edit
// means a wrong habit is corrected in the same turn instead of surfacing at CI.
//
// Silent (exit 0, no output) unless the edited file has violations: when the
// path is not a .js/.ts module, sits outside the app or under node_modules, the
// app has no local `webjs` bin, the check fails to run, or the file is clean.
// Violations in OTHER files are not replayed, so a pre-existing problem
// elsewhere never nags on every edit.
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, relative, isAbsolute, join, sep } from 'node:path';

function readPayload() {
  const arg = process.argv[2];
  if (arg && arg.trim().startsWith('{')) return arg;
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

let data;
try { data = JSON.parse(readPayload() || '{}'); } catch { process.exit(0); }
const input = data.tool_input || {};
const rawPath = input.file_path || input.filePath || '';
if (!rawPath) process.exit(0);

// Only JS / TS modules (not declaration files) are app source `webjs check` reads.
if (!/\.(ts|js|mts|mjs)$/.test(rawPath) || /\.d\.ts$/.test(rawPath)) process.exit(0);

/** The real path, so a symlinked checkout compares equal to the project dir. */
const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };

const projectDir = real(process.env.CLAUDE_PROJECT_DIR || data.cwd || process.cwd());
const filePath = real(isAbsolute(rawPath) ? rawPath : resolve(projectDir, rawPath));

const inside = (child, parent) => child === parent || child.startsWith(parent + sep);

/** The nearest directory at or above `start`, within the project, holding package.json plus app/. */
function findAppRoot(start) {
  for (let dir = start; inside(dir, projectDir); dir = dirname(dir)) {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'app'))) return dir;
    if (dirname(dir) === dir) break;
  }
  return null;
}

if (!inside(filePath, projectDir)) process.exit(0);
const appRoot = findAppRoot(dirname(filePath));
if (!appRoot) process.exit(0);
const rel = relative(appRoot, filePath).split(sep).join('/');
if (/(^|\/)(node_modules|\.webjs|dist|coverage)\//.test(rel)) process.exit(0);

/** The app's own `webjs` bin (a workspace may hoist it), never a network install. */
function findBin(start) {
  let dir = start;
  for (;;) {
    const bin = join(dir, 'node_modules', '.bin', process.platform === 'win32' ? 'webjs.cmd' : 'webjs');
    if (existsSync(bin)) return bin;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}
const bin = process.env.WEBJS_CHECK_ON_EDIT_BIN || findBin(appRoot);
if (!bin) process.exit(0);

const run = spawnSync(bin, ['check', '--json'], {
  cwd: appRoot,
  encoding: 'utf8',
  timeout: Number(process.env.WEBJS_CHECK_ON_EDIT_TIMEOUT_MS) || 50_000,
  maxBuffer: 16 * 1024 * 1024,
});
if (run.error || !run.stdout) process.exit(0);

let report;
try { report = JSON.parse(run.stdout); } catch { process.exit(0); }
if (!report || !Array.isArray(report.violations)) process.exit(0);

/** A violation's file, normalized to an app-relative posix path. */
const vRel = (f) => {
  if (!f) return '';
  const abs = isAbsolute(f) ? f : resolve(appRoot, f);
  return relative(appRoot, real(abs)).split(sep).join('/');
};
const mine = report.violations.filter((v) => vRel(v.file) === rel);
if (mine.length === 0) process.exit(0);

const lines = mine.map((v) => `- [${v.rule}] ${v.message}${v.fix ? `\n  Fix: ${v.fix}` : ''}`);
const reason =
  `webjs check found ${mine.length} problem${mine.length === 1 ? '' : 's'} in ${rel}. ` +
  `Fix ${mine.length === 1 ? 'it' : 'them'} before moving on:\n${lines.join('\n')}\n` +
  'Set WEBJS_NO_CHECK_ON_EDIT=1 to turn this hook off.';

process.stdout.write(JSON.stringify({
  decision: 'block',
  reason,
  hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: reason },
}) + '\n');
