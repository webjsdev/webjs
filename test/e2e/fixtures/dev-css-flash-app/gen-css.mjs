// A stand-in for `tailwindcss -i input.css -o app.css` (#967): scans app/ for
// `c-<color>` utility classes and writes one rule per class it finds, after a
// deliberate delay so a compile is never instant (Tailwind takes 100ms to
// seconds). Like Tailwind, it emits rules ONLY for classes the source uses, so
// markup that names a new class has no backing rule until this has run.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const delay = Number(process.env.GEN_CSS_DELAY_MS || 800);
await new Promise((r) => setTimeout(r, delay));
const classes = new Set();
for (const f of readdirSync('app', { recursive: true }).map((f) => join('app', String(f)))) {
  if (!/\.(ts|js)$/.test(String(f))) continue;
  for (const m of readFileSync(String(f), 'utf8').matchAll(/\bc-([a-z]+)\b/g)) classes.add(m[1]);
}
writeFileSync('public/app.css', [...classes].sort().map((c) => `.c-${c} { color: ${c}; }`).join('\n') + '\n');
