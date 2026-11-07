import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Questionnaire docs page body, ported from shadcn's
 * content/docs/components/radix/questionnaire.mdx (#1666, D15): the same
 * sections in the same order, the prose rewritten where it describes React
 * or the @shadcn/react headless package.
 */
/** The demo shown above the Installation section. */
export const demo = 'questionnaire-demo';

const table = (head: string[], rows: unknown[][]) => html`
  <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
    <table>
      <thead><tr>${head.map((h) => html`<th>${h}</th>`)}</tr></thead>
      <tbody>${rows.map((r) => html`<tr>${r.map((c) => html`<td>${c}</td>`)}</tr>`)}</tbody>
    </table>
  </div>`;

const code = (s: string) => html`<code>${s}</code>`;

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    <p>The questionnaire parts are custom elements. Importing the module registers them, and the page renders them by tag.</p>
    ${codeFigure(`import '#components/ui/questionnaire.ts';`, { lineNumbers: true })}
    ${codeFigure(`const items = [
  {
    name: 'direction',
    required: true,
    prompt: 'What should we prototype next?',
    description: 'Choose a direction or write your own.',
    choices: [
      {
        value: 'delegation',
        label: 'Delegation',
        description: 'Show how work moves to a specialist.',
      },
      {
        value: 'questions',
        label: 'Question prompts',
        description: 'Show choices while the interface waits.',
      },
      { value: 'both', label: 'Both together' },
    ],
    input: { label: 'Another answer', placeholder: 'Type another answer…' },
  },
  {
    name: 'detail',
    required: false,
    prompt: 'How much detail should it include?',
    description: 'Skip this if you are not sure yet.',
    choices: [
      { value: 'focused', label: 'Focused' },
      { value: 'complete', label: 'Complete flow' },
    ],
  },
] as const;`, { lineNumbers: true })}
    <p>Define the collection once and map it into the parts. The page renders every question on the server, and the element takes over the progress, the actions and the shortcuts once it loads.</p>
    ${codeFigure(`html\`
  <ui-questionnaire>
    <ui-questionnaire-progress></ui-questionnaire-progress>
    \${items.map((question) => html\`
      <ui-questionnaire-item name=\${question.name} ?required=\${question.required}>
        <ui-questionnaire-title>\${question.prompt}</ui-questionnaire-title>
        <ui-questionnaire-description>
          \${question.description}
        </ui-questionnaire-description>
        <ui-questionnaire-choices>
          \${question.choices.map((choice) => html\`
            <ui-questionnaire-choice value=\${choice.value}>
              <span class="font-medium">\${choice.label}</span>
              \${'description' in choice
                ? html\`<span class="text-muted-foreground">\${choice.description}</span>\`
                : ''}
            </ui-questionnaire-choice>
          \`)}
          \${'input' in question
            ? html\`<ui-questionnaire-input
                aria-label=\${question.input.label}
                placeholder=\${question.input.placeholder}
              ></ui-questionnaire-input>\`
            : ''}
        </ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>
    \`)}
    <ui-questionnaire-actions>
      <ui-questionnaire-previous></ui-questionnaire-previous>
      <ui-questionnaire-skip></ui-questionnaire-skip>
      <ui-questionnaire-next></ui-questionnaire-next>
      <ui-questionnaire-submit></ui-questionnaire-submit>
    </ui-questionnaire-actions>
  </ui-questionnaire>
\``, { lineNumbers: true })}
    <p>The element renders a native <code>&lt;form&gt;</code>, so the answers are read with <code>FormData</code>. Its own submit handler runs first and cancels a submit that is not on the last question yet, so a listener checks <code>defaultPrevented</code>.</p>
    ${codeFigure(`questionnaire.addEventListener('submit', (event) => {
  if (event.defaultPrevented) return;
  event.preventDefault();
  const answers = new FormData(event.target as HTMLFormElement);
  // answers.get('direction'), answers.getAll(...) for multiple items.
});`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    ${codeFigure(`ui-questionnaire
├── ui-questionnaire-progress
├── ui-questionnaire-item
│   ├── ui-questionnaire-title
│   ├── ui-questionnaire-description
│   ├── ui-questionnaire-choices
│   │   ├── ui-questionnaire-choice
│   │   └── ui-questionnaire-input
│   └── ui-questionnaire-error
└── ui-questionnaire-actions
    ├── ui-questionnaire-previous
    ├── ui-questionnaire-skip
    ├── ui-questionnaire-next
    └── ui-questionnaire-submit`, { lang: 'text' })}
    <p><code>&lt;ui-questionnaire&gt;</code> owns the ordered items, the active item, validation, progress, and navigation. The answers live in the form controls themselves. The containing page, card, dialog, or drawer owns close and cancellation behavior, persistence, transport, and branching.</p>

    ${heading(toc, 2, 'Server Rendering')}
    <p>Every part renders on the server. Without JavaScript every question shows at once, Submit is the only action, and it posts the form with the browser's own <code>required</code> check: set <code>action</code> and <code>method</code> on <code>&lt;ui-questionnaire&gt;</code> to choose where. Once the element loads it shows one question at a time and fills in the progress and the Previous, Skip and Next buttons.</p>

    ${heading(toc, 2, 'Multiple Selection')}
    <p>Use <code>multiple</code> for an item that accepts more than one fixed answer. Its choices render as checkboxes, read with <code>FormData.getAll()</code>.</p>
    ${await componentPreview('questionnaire-multiple', { align: 'end', previewClass: 'min-h-[420px] p-4 sm:p-8' })}

    ${heading(toc, 2, 'Freeform Answer')}
    <p>Compose <code>&lt;ui-questionnaire-input&gt;</code> with fixed choices when the user can provide another answer. On a single-answer item, typing clears the picked choice and picking a choice clears the text.</p>
    ${await componentPreview('questionnaire-freeform', { align: 'end', previewClass: 'min-h-[420px] p-4 sm:p-8' })}

    ${heading(toc, 2, 'Explicit Skip')}
    <p>Add <code>&lt;ui-questionnaire-skip&gt;</code> when an optional item may be intentionally left unanswered. It shows only on an item without <code>required</code>, clears that item's answers, and moves on.</p>
    ${await componentPreview('questionnaire-skip', { align: 'end', previewClass: 'min-h-[520px] p-4 sm:p-8' })}

    ${heading(toc, 2, 'Shortcuts')}
    <p>Assign a letter or number key to each answer with <code>shortcuts="letters"</code> or <code>shortcuts="numbers"</code>. A key picks the matching answer, except while typing in a text field. Set the attribute in the markup, since the choices read it when they render.</p>
    ${await componentPreview('questionnaire-shortcuts', { align: 'end', previewClass: 'min-h-[480px] p-4 sm:p-8' })}

    ${heading(toc, 2, 'Custom Validation')}
    <p>The element checks <code>required</code> items itself. For a rule across answers, listen for <code>submit</code>, check the <code>FormData</code> against a schema such as Zod, call <code>preventDefault()</code> when it fails, and put the message in the item's <code>&lt;ui-questionnaire-error&gt;</code>. The demo below runs the built-in required check.</p>
    ${await componentPreview('questionnaire-validation', { align: 'end', previewClass: 'min-h-[520px] p-4 sm:p-8' })}

    ${heading(toc, 2, 'Controlled')}
    <p>The element owns the active item and dispatches <code>ui-active-change</code> with <code>{ detail: { name } }</code> each time it moves, so host state can follow it. Update a status line like the one in this demo from that listener.</p>
    ${await componentPreview('questionnaire-controlled', { align: 'end', previewClass: 'min-h-[520px] p-4 sm:p-8' })}

    ${heading(toc, 2, 'Resume')}
    <p>Restore saved answers with <code>checked</code> on the choices. The flow starts on the first item.</p>
    ${await componentPreview('questionnaire-resume', { align: 'end', previewClass: 'min-h-[520px] p-4 sm:p-8' })}

    ${heading(toc, 2, 'Conditional Items')}
    <p>Disable items that do not apply to the user's earlier answers. A <code>disabled</code> item is left out of the flow and the progress. To toggle one at runtime, set its <code>disabled</code> attribute from a change listener and call the questionnaire's <code>sync()</code>; in this demo the environment question stays disabled.</p>
    ${await componentPreview('questionnaire-conditional', { align: 'end', previewClass: 'min-h-[520px] p-4 sm:p-8' })}

    ${heading(toc, 2, 'Navigation State')}
    <p>The kit exposes no per-item status, and its navigation buttons never disable. Next validates the active item instead: pressed with no answer, it stays put, marks the item invalid and shows its error. The buttons take <code>variant</code> and <code>size</code> as a button does.</p>
    ${await componentPreview('questionnaire-navigation-state', { align: 'end', previewClass: 'min-h-[480px] p-4 sm:p-8' })}

    ${heading(toc, 2, 'Custom Progress')}
    <p><code>&lt;ui-questionnaire-progress&gt;</code> renders a "Question 1 of 4" line. Style the line with classes on the element.</p>
    ${await componentPreview('questionnaire-progress', { align: 'end', previewClass: 'min-h-[520px] p-4 sm:p-8' })}

    ${heading(toc, 2, 'Animated Items')}
    <p>Animate the active item while keeping progress and navigation stationary. Each item moves its class onto the fieldset it renders, which carries <code>data-active</code> while it is shown, so the <code>data-active:</code> variant targets it directly.</p>
    ${await componentPreview('questionnaire-animated', { align: 'end', previewClass: 'min-h-[520px] p-4 sm:p-8' })}

    ${heading(toc, 2, 'Card')}
    <p>Compose the questionnaire with the Card class helpers while keeping the question title and description semantic: put <code>cardTitleClass()</code> and <code>cardDescriptionClass()</code> on the title and description elements.</p>
    ${await componentPreview('questionnaire-card', { align: 'end', previewClass: 'min-h-[560px] p-4 sm:p-8' })}

    ${heading(toc, 2, 'Dialog')}
    <p>Compose the questionnaire inside a Dialog while keeping cancellation and dismissal host-owned.</p>
    ${await componentPreview('questionnaire-dialog', { align: 'end', previewClass: 'min-h-[320px] p-4 sm:p-8' })}

    ${heading(toc, 2, 'Accessibility')}
    <p><code>&lt;ui-questionnaire-item&gt;</code> renders a <code>fieldset</code>, and <code>&lt;ui-questionnaire-title&gt;</code> renders its <code>legend</code>, which also names the fieldset. Descriptions and active errors are associated with the current item, and an item left unanswered exposes <code>aria-invalid</code> with its error announced as an alert.</p>
    <p>Fixed choices are native radios and checkboxes. Progress is exposed as a named progressbar, navigation uses real buttons, and inactive items are <code>hidden</code> and <code>inert</code>. Successful navigation focuses the newly active item's first answer, and failed validation focuses an available answer control. Enter goes to the next item, and on the last one submits.</p>
    <p>Always give <code>&lt;ui-questionnaire-input&gt;</code> an accessible name with <code>aria-label</code>. A placeholder is not a label.</p>

    ${heading(toc, 2, 'Unstyled')}
    <p>The behavior lives in the <code>&lt;ui-questionnaire-*&gt;</code> elements, and the classes they apply are exported as helpers such as <code>questionnaireChoiceClass()</code>. Since <code>webjs ui add</code> copies the source into your project, change the markup or the classes there.</p>

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'ui-questionnaire')}
    <p>The root. It renders the <code>&lt;form&gt;</code> and owns the active item, validation, and navigation.</p>
    ${table(['Attribute', 'Type', 'Default'], [
      [code('shortcuts'), code('"letters" | "numbers"'), '-'],
      [code('action'), code('string'), '-'],
      [code('method'), code('string'), '-'],
    ])}
    <p>It dispatches <code>ui-active-change</code> with <code>{ detail: { name } }</code> after the active item changes. Its methods are <code>next()</code>, <code>previous()</code>, <code>skip()</code>, <code>validate(item?)</code> (marks the active item invalid and returns <code>false</code> when it needs an answer), <code>answered(item)</code>, <code>items()</code> (the items in the flow) and <code>sync()</code> (redraws the parts after host code changes an item).</p>

    ${heading(toc, 3, 'ui-questionnaire-item')}
    <p>One question, rendered as a <code>fieldset</code>. Its answers share its <code>name</code>.</p>
    ${table(['Attribute', 'Type', 'Default'], [
      [code('name'), code('string'), code('""')],
      [code('required'), code('boolean'), code('false')],
      [code('multiple'), code('boolean'), code('false')],
      [code('disabled'), code('boolean'), code('false')],
    ])}

    ${heading(toc, 3, 'ui-questionnaire-choice')}
    <p>One fixed answer: a radio, or a checkbox in a <code>multiple</code> item, with its label. Put a <code>&lt;ui-questionnaire-choice-description&gt;</code> inside for a second line.</p>
    ${table(['Attribute', 'Type', 'Default'], [
      [code('value'), code('string'), code('""')],
      [code('checked'), code('boolean'), code('false')],
      [code('disabled'), code('boolean'), code('false')],
    ])}

    ${heading(toc, 3, 'ui-questionnaire-input')}
    <p>A freeform answer, a text field named after its item.</p>
    ${table(['Attribute', 'Type', 'Default'], [
      [code('placeholder'), code('string'), code('""')],
      [code('aria-label'), code('string'), '-'],
    ])}

    ${heading(toc, 3, 'ui-questionnaire-error')}
    <p>The item's error line, hidden until the item is invalid. Its content replaces the default message, which is "Choose an answer to continue." on a required item and "Choose an answer or skip this question." otherwise.</p>

    ${heading(toc, 3, 'Navigation buttons')}
    <p><code>&lt;ui-questionnaire-previous&gt;</code>, <code>&lt;ui-questionnaire-skip&gt;</code>, <code>&lt;ui-questionnaire-next&gt;</code> and <code>&lt;ui-questionnaire-submit&gt;</code> show only when they apply. Their content replaces the default label (Previous, Skip, Next, Submit).</p>
    ${table(['Attribute', 'Type', 'Default'], [
      [code('variant'), code('"default" | "outline" | "ghost" | "destructive" | "secondary" | "link"'), html`${code('"outline"')}, ${code('"default"')} on Next and Submit`],
      [code('size'), code('"default" | "xs" | "sm" | "lg"'), code('"default"')],
    ])}

    ${heading(toc, 3, 'Layout parts')}
    <p><code>&lt;ui-questionnaire-progress&gt;</code>, <code>&lt;ui-questionnaire-title&gt;</code>, <code>&lt;ui-questionnaire-description&gt;</code>, <code>&lt;ui-questionnaire-choices&gt;</code> and <code>&lt;ui-questionnaire-actions&gt;</code> take no attributes. <code>&lt;ui-questionnaire-actions&gt;</code> is a styled-only layout helper.</p>
  `;
}
