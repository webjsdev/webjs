/**
 * The scaffold's pages: index, new, show and edit, plus the shared form
 * fields (Rails' `_form` partial). Forms bind the generated actions, so they
 * work with JavaScript off, and a failed submit re-renders with the typed
 * values and each field's message from `actionData`.
 *
 * Styling uses the app's UI kit helpers when it has them (the full-stack
 * scaffold ships button, input and label) and plain Tailwind otherwise.
 */

/**
 * @typedef {import('./index.js').AppContext} AppContext
 * @typedef {import('./fields.js').Field} Field
 * @typedef {import('./names.js').ResourceNames} ResourceNames
 */

const PLAIN_INPUT = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm';
const PLAIN_LABEL = 'text-sm font-medium';
const PLAIN_BUTTON = 'inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground';
const PLAIN_OUTLINE = 'inline-flex items-center rounded-md border border-input px-4 py-2 text-sm font-medium';

/**
 * @param {AppContext} ctx
 * @param {ResourceNames} n
 * @param {Field[]} fields
 * @returns {{ files: { path: string, content: string }[], uiAdd: string[] }}
 */
export function pageFiles(ctx, n, fields) {
  const uiAdd = [];
  const needsTextarea = fields.some((f) => f.kind === 'text' || f.kind === 'json');
  let textarea = ctx.ui.textarea;
  if (needsTextarea && !textarea && ctx.ui.kit) { uiAdd.push('textarea'); textarea = true; }
  const cls = uiClasses(ctx, textarea);
  const buttonImport = ctx.ui.button ? "import { buttonClass } from '#components/ui/button.ts';\n" : '';
  const mod = `#modules/${n.kebabPlural}`;
  const app = `app/${n.kebabPlural}`;
  const title = titleExpr(n, fields);

  const fieldsFile = fieldsHelper(ctx, n, fields, cls, needsTextarea && textarea);

  const index = `import { html } from '@webjsdev/core';
${buttonImport}import { list${n.Plural} } from '${mod}/queries/list-${n.kebabPlural}.server.ts';

export const metadata = { title: '${cap(n.humanPlural)}' };

// A thin route: the data and the mutations live in modules/${n.kebabPlural}/.
export default async function ${n.Plural}Page() {
  const ${n.plural} = await list${n.Plural}();
  return html\`
    <section class="mx-auto max-w-2xl grid gap-6 py-10">
      <header class="flex items-center justify-between gap-4">
        <h1 class="text-2xl font-semibold m-0">${cap(n.humanPlural)}</h1>
        <a ${cls.button} href="/${n.kebabPlural}/new">New ${n.human}</a>
      </header>
      \${${n.plural}.length === 0
        ? html\`<p class="text-sm text-muted-foreground m-0">No ${n.humanPlural} yet.</p>\`
        : html\`
          <ul class="grid gap-2 m-0 p-0 list-none">
            \${${n.plural}.map((${n.singular}) => html\`
              <li><a class="font-medium hover:underline" href="/${n.kebabPlural}/\${${n.singular}.id}">\${${title}}</a></li>\`)}
          </ul>\`}
    </section>
  \`;
}
`;

  const newPage = `import { html } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
${buttonImport}import { create${n.Singular} } from '${mod}/actions/create-${n.kebab}.server.ts';
import { ${n.singular}Fields } from '${mod}/${n.kebab}-fields.ts';

export const metadata = { title: 'New ${n.human}' };

// A failed submit re-renders this page with the action's result on actionData:
// the typed values and a message per field.
export default function New${n.Singular}Page({ actionData }: PageProps<'/${n.kebabPlural}/new'>) {
  return html\`
    <section class="mx-auto max-w-xl grid gap-6 py-10">
      <h1 class="text-2xl font-semibold m-0">New ${n.human}</h1>
      <form action=\${create${n.Singular}} class="grid gap-4">
        \${${n.singular}Fields(actionData?.values ?? {}, actionData?.fieldErrors ?? {})}
        <div class="flex gap-2">
          <button ${cls.button} type="submit">Create ${n.human}</button>
          <a ${cls.outline} href="/${n.kebabPlural}">Cancel</a>
        </div>
      </form>
    </section>
  \`;
}
`;

  const show = `import { html, notFound } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
${buttonImport}import { get${n.Singular} } from '${mod}/queries/get-${n.kebab}.server.ts';
import { delete${n.Singular} } from '${mod}/actions/delete-${n.kebab}.server.ts';

export const metadata = { title: '${cap(n.human)}' };

export default async function ${n.Singular}Page({ params }: PageProps<'/${n.kebabPlural}/[id]'>) {
  const ${n.singular} = await get${n.Singular}(Number(params.id));
  if (!${n.singular}) notFound();
  return html\`
    <section class="mx-auto max-w-xl grid gap-6 py-10">
      <h1 class="text-2xl font-semibold m-0">\${${title}}</h1>
      <dl class="grid gap-3 m-0">
${fields.map((f) => `        <div>
          <dt class="text-sm text-muted-foreground">${f.label}</dt>
          <dd class="m-0">${display(n, f)}</dd>
        </div>`).join('\n')}
      </dl>
      <div class="flex gap-2">
        <a ${cls.outline} href="/${n.kebabPlural}/\${${n.singular}.id}/edit">Edit</a>
        <a ${cls.outline} href="/${n.kebabPlural}">Back to ${n.humanPlural}</a>
        <form action=\${delete${n.Singular}} class="ml-auto">
          <input type="hidden" name="id" value=\${${n.singular}.id}>
          <button ${cls.destructive} type="submit">Delete</button>
        </form>
      </div>
    </section>
  \`;
}
`;

  const edit = `import { html, nothing, notFound } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
${buttonImport}import { get${n.Singular} } from '${mod}/queries/get-${n.kebab}.server.ts';
import { update${n.Singular} } from '${mod}/actions/update-${n.kebab}.server.ts';
import { ${n.singular}Fields, ${n.singular}FormValues } from '${mod}/${n.kebab}-fields.ts';

export const metadata = { title: 'Edit ${n.human}' };

// The form shows the record, or after a failed submit what was typed.
export default async function Edit${n.Singular}Page({ params, actionData }: PageProps<'/${n.kebabPlural}/[id]/edit'>) {
  const ${n.singular} = await get${n.Singular}(Number(params.id));
  if (!${n.singular}) notFound();
  return html\`
    <section class="mx-auto max-w-xl grid gap-6 py-10">
      <h1 class="text-2xl font-semibold m-0">Edit ${n.human}</h1>
      \${actionData?.error ? html\`<p role="alert" class="text-sm text-destructive m-0">\${actionData.error}</p>\` : nothing}
      <form action=\${update${n.Singular}} class="grid gap-4">
        <input type="hidden" name="id" value=\${${n.singular}.id}>
        \${${n.singular}Fields(actionData?.values ?? ${n.singular}FormValues(${n.singular}), actionData?.fieldErrors ?? {})}
        <div class="flex gap-2">
          <button ${cls.button} type="submit">Update ${n.human}</button>
          <a ${cls.outline} href="/${n.kebabPlural}/\${${n.singular}.id}">Cancel</a>
        </div>
      </form>
    </section>
  \`;
}
`;

  return {
    uiAdd,
    files: [
      { path: `modules/${n.kebabPlural}/${n.kebab}-fields.ts`, content: fieldsFile },
      { path: `${app}/page.ts`, content: index },
      { path: `${app}/new/page.ts`, content: newPage },
      { path: `${app}/[id]/page.ts`, content: show },
      { path: `${app}/[id]/edit/page.ts`, content: edit },
    ],
  };
}

/**
 * The `class=...` attribute for each control: the UI kit helper when the app
 * has it, plain Tailwind otherwise.
 * @param {AppContext} ctx
 * @param {boolean} [textarea] whether the kit's textarea helper is there
 * @returns {Record<'input'|'textarea'|'label'|'button'|'outline'|'destructive', string>}
 */
export function uiClasses(ctx, textarea = false) {
  return {
    input: ctx.ui.input ? 'class=${inputClass()}' : `class="${PLAIN_INPUT}"`,
    textarea: textarea ? 'class=${textareaClass()}' : `class="${PLAIN_INPUT}"`,
    label: ctx.ui.label ? 'class=${labelClass()}' : `class="${PLAIN_LABEL}"`,
    button: ctx.ui.button ? 'class=${buttonClass()}' : `class="${PLAIN_BUTTON}"`,
    outline: ctx.ui.button ? "class=${buttonClass({ variant: 'outline' })}" : `class="${PLAIN_OUTLINE}"`,
    destructive: ctx.ui.button ? "class=${buttonClass({ variant: 'destructive' })}" : `class="${PLAIN_OUTLINE}"`,
  };
}

const cap = (/** @type {string} */ s) => s[0].toUpperCase() + s.slice(1);

/**
 * The expression naming one record: its first string field, else its id.
 * @param {ResourceNames} n
 * @param {Field[]} fields
 */
function titleExpr(n, fields) {
  const f = fields.find((x) => x.kind === 'string');
  const fallback = `'${cap(n.human)} ' + ${n.singular}.id`;
  if (!f) return fallback;
  return f.notNull ? `${n.singular}.${f.name}` : `${n.singular}.${f.name} || ${fallback}`;
}

/**
 * How the show page prints one field.
 * @param {ResourceNames} n
 * @param {Field} f
 */
function display(n, f) {
  const v = `${n.singular}.${f.name}`;
  switch (f.kind) {
    case 'boolean': return `\${${v} ? 'Yes' : 'No'}`;
    case 'datetime': return `\${${v} ? ${v}.toISOString() : ''}`;
    case 'json': return `<pre class="text-sm m-0">\${JSON.stringify(${v}, null, 2)}</pre>`;
    default: return `\${${v} ?? ''}`;
  }
}

/**
 * The shared fields file: one labelled control per field, its error message,
 * and the conversion from a record to the strings the controls show.
 * @param {AppContext} ctx
 * @param {ResourceNames} n
 * @param {Field[]} fields
 * @param {Record<string, string>} cls
 * @param {boolean} kitTextarea
 */
function fieldsHelper(ctx, n, fields, cls, kitTextarea) {
  const imports = [];
  if (ctx.ui.input && fields.some((f) => !['text', 'json', 'boolean'].includes(f.kind))) imports.push("import { inputClass } from '#components/ui/input.ts';");
  if (kitTextarea) imports.push("import { textareaClass } from '#components/ui/textarea.ts';");
  if (ctx.ui.label) imports.push("import { labelClass } from '#components/ui/label.ts';");
  const controls = fields.map((f) => {
    const k = f.name;
    const req = f.notNull && f.kind !== 'boolean' ? ' required' : '';
    const aria = `\n            aria-invalid=\${errors.${k} ? 'true' : nothing} aria-describedby=\${errors.${k} ? '${k}-error' : nothing}`;
    if (f.kind === 'boolean') {
      return `      <div class="flex items-center gap-2">
        <input type="checkbox" id="${k}" name="${k}" class="size-4 accent-primary" ?checked=\${values.${k} === 'on'}>
        <label ${cls.label} for="${k}">${f.label}</label>
      </div>`;
    }
    let control;
    if (f.kind === 'text' || f.kind === 'json') {
      control = `<textarea ${cls.textarea} id="${k}" name="${k}" rows="${f.kind === 'json' ? 6 : 4}"${req}${aria}>\${values.${k} ?? ''}</textarea>`;
    } else {
      const type = f.kind === 'datetime' ? 'datetime-local' : ['integer', 'float', 'references'].includes(f.kind) ? 'number' : 'text';
      const step = f.kind === 'float' ? ' step="any"' : '';
      control = `<input ${cls.input} id="${k}" name="${k}" type="${type}"${step} value=\${values.${k} ?? ''}${req}${aria}>`;
    }
    return `      <div class="grid gap-2">
        <label ${cls.label} for="${k}">${f.label}</label>
        ${control}
        \${fieldError('${k}', errors)}
      </div>`;
  });
  const toValue = (/** @type {Field} */ f) => {
    const v = `${n.singular}.${f.name}`;
    switch (f.kind) {
      case 'string':
      case 'text': return f.notNull ? v : `${v} ?? ''`;
      case 'boolean': return `${v} ? 'on' : ''`;
      case 'datetime': return `${v} ? toDateTimeLocal(${v}) : ''`;
      case 'json': return `${v} == null ? '' : JSON.stringify(${v}, null, 2)`;
      default: return `${v} == null ? '' : String(${v})`;
    }
  };
  const hasDate = fields.some((f) => f.kind === 'datetime');
  return `import { html, nothing } from '@webjsdev/core';
${imports.join('\n')}${imports.length ? '\n' : ''}import type { ${n.Singular} } from './types.ts';

// The ${n.human} form's fields, shared by the new and edit pages (Rails' _form
// partial). values is what the controls show: what was typed after a failed
// submit, otherwise the record's own values (${n.singular}FormValues).
export function ${n.singular}Fields(values: Record<string, string>, errors: Record<string, string>) {
  return html\`
${controls.join('\n')}
  \`;
}

// A record as the strings its form controls show.
export function ${n.singular}FormValues(${n.singular}: ${n.Singular}): Record<string, string> {
  return {
${fields.map((f) => `    ${f.name}: ${toValue(f)},`).join('\n')}
  };
}

function fieldError(name: string, errors: Record<string, string>) {
  return errors[name] ? html\`<p id=\${name + '-error'} role="alert" class="text-sm text-destructive m-0">\${errors[name]}</p>\` : nothing;
}
${hasDate ? `
// A datetime-local control reads local time with no zone: YYYY-MM-DDTHH:mm.
function toDateTimeLocal(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
` : ''}`;
}
