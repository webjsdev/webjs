import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { componentPreview, type PreviewOptions } from '#lib/ui/docs/preview.ts';
import { installation, table } from '../ai-elements/shared.ts';

/**
 * React / Questionnaire, ported from shadcn's content/docs/react/
 * questionnaire.mdx (#1666). shadcn documents the headless Questionnaire in
 * @shadcn/react; the kit ported it as the <ui-questionnaire> elements, so
 * this page is their element-level reference in shadcn's section order.
 * Every attribute, method, event and data attribute named here is read from
 * packages/ui/packages/registry/components/questionnaire.ts. The sections
 * from Keyboard navigation on are in reference(), below.
 */
export const title = 'Questionnaire';
export const description = 'Build accessible, multi-step questionnaires with single, multiple, freeform, and intentionally skipped answers.';

const code = (s: string) => html`<code>${s}</code>`;
const preview = (name: string, minH: string) =>
  componentPreview(name, { align: 'end', hideCode: true, previewClass: `${minH} p-4 sm:p-8` } satisfies PreviewOptions);

export default async function body(toc: TocEntry[]) {
  return html`
    <p><code>&lt;ui-questionnaire&gt;</code> is a form element for presenting one question at a time. It manages answers, progress, validation, and navigation.</p>
    <p>It works well for agent clarification prompts, onboarding, surveys, intake forms, and configuration.</p>
    <p>The parts are custom elements that apply the kit's classes, and a <code>class</code> written on any part is merged onto the element that part renders, so you restyle it by adding classes, or by editing the copy the CLI puts in your project. For the themed examples, see <a href="/ui/docs/components/questionnaire">Questionnaire</a>.</p>

    ${await installation(toc, {
      prose: html`The elements ship in the Questionnaire component file. Adding it copies <code>components/ui/questionnaire.ts</code> into your project, together with the <a href="/ui/docs/components/button">Button</a> its navigation actions are styled with.`,
      add: 'questionnaire',
      source: 'questionnaire',
      dependencies: ['button'],
    })}

    ${heading(toc, 2, 'Import')}
    ${codeFigure(`import '#components/ui/questionnaire.ts';`)}
    <p>Importing the file registers every part as its own element. Each part takes the attributes listed in the <a href="#api-reference">API Reference</a>, plus a <code>class</code> that is merged onto the element it renders.</p>

    ${heading(toc, 2, 'Anatomy')}
    ${codeFigure(`<ui-questionnaire>
  <ui-questionnaire-progress></ui-questionnaire-progress>
  <ui-questionnaire-item name="question">
    <ui-questionnaire-title></ui-questionnaire-title>
    <ui-questionnaire-description></ui-questionnaire-description>
    <ui-questionnaire-choices>
      <ui-questionnaire-choice value="answer">
        Label
        <ui-questionnaire-choice-description></ui-questionnaire-choice-description>
      </ui-questionnaire-choice>
      <ui-questionnaire-input></ui-questionnaire-input>
    </ui-questionnaire-choices>
    <ui-questionnaire-error></ui-questionnaire-error>
  </ui-questionnaire-item>
  <ui-questionnaire-actions>
    <ui-questionnaire-previous></ui-questionnaire-previous>
    <ui-questionnaire-skip></ui-questionnaire-skip>
    <ui-questionnaire-next></ui-questionnaire-next>
    <ui-questionnaire-submit></ui-questionnaire-submit>
  </ui-questionnaire-actions>
</ui-questionnaire>`, { lang: 'html' })}
    <p><code>&lt;ui-questionnaire&gt;</code> renders a form. Each <code>&lt;ui-questionnaire-item&gt;</code> renders a fieldset, and its <code>&lt;ui-questionnaire-title&gt;</code> renders the legend. <code>&lt;ui-questionnaire-choice&gt;</code> renders a label around a native radio or checkbox, the indicator and the shortcut hint, so there are no separate input, label and shortcut parts to compose.</p>

    ${heading(toc, 2, 'Styled version')}
    <p>The kit has one version, and it is styled. Its parts are these elements:</p>
    ${table(['Element', 'Part'], [
      [code('<ui-questionnaire>'), 'The root form.'],
      [code('<ui-questionnaire-progress>'), 'The progress line.'],
      [code('<ui-questionnaire-item>'), 'One step, rendered as a fieldset.'],
      [code('<ui-questionnaire-title>'), 'The step\'s question, rendered as the legend.'],
      [code('<ui-questionnaire-description>'), 'Supporting text for the step.'],
      [code('<ui-questionnaire-choices>'), 'The list of choices.'],
      [code('<ui-questionnaire-choice>'), 'One choice: the native input, its label and its shortcut hint.'],
      [code('<ui-questionnaire-choice-description>'), 'A second line inside a choice.'],
      [code('<ui-questionnaire-input>'), 'A free-text answer.'],
      [code('<ui-questionnaire-error>'), 'The step\'s validation message.'],
      [code('<ui-questionnaire-actions>'), 'The layout container for the buttons.'],
      [html`${code('<ui-questionnaire-previous>')}, ${code('<ui-questionnaire-skip>')}, ${code('<ui-questionnaire-next>')}, ${code('<ui-questionnaire-submit>')}`, 'The navigation buttons.'],
    ])}

    ${heading(toc, 2, 'Basic usage')}
    <p>Each item is one step. Its <code>name</code> identifies the step and becomes the form field name for its answers. A choice's <code>value</code> is the submitted answer.</p>
    ${await preview('questionnaire-demo', 'min-h-[560px]')}
    ${codeFigure(`type Question = {
  name: string;
  required: boolean;
  prompt: string;
  description: string;
  choices: { value: string; label: string; description?: string }[];
  input?: { label: string; placeholder: string };
};

const items: Question[] = [
  {
    name: 'prototype',
    required: true,
    prompt: 'What should we prototype next?',
    description: 'Choose a direction or write your own.',
    choices: [
      { value: 'delegation', label: 'Delegation', description: 'Show how work moves to a specialist.' },
      { value: 'questions', label: 'Question prompts', description: 'Show choices while the interface waits.' },
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
];`)}
    ${codeFigure(`html\`
  <ui-questionnaire>
    <ui-questionnaire-progress></ui-questionnaire-progress>
    \${items.map((question) => html\`
      <ui-questionnaire-item name=\${question.name} ?required=\${question.required}>
        <ui-questionnaire-title>\${question.prompt}</ui-questionnaire-title>
        <ui-questionnaire-description>\${question.description}</ui-questionnaire-description>
        <ui-questionnaire-choices>
          \${question.choices.map((choice) => html\`
            <ui-questionnaire-choice value=\${choice.value}>
              \${choice.label}
              \${choice.description
                ? html\`<ui-questionnaire-choice-description>\${choice.description}</ui-questionnaire-choice-description>\`
                : ''}
            </ui-questionnaire-choice>
          \`)}
          \${question.input
            ? html\`<ui-questionnaire-input aria-label=\${question.input.label} placeholder=\${question.input.placeholder}></ui-questionnaire-input>\`
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
    ${codeFigure(`questionnaire.addEventListener('submit', (event) => {
  // The element cancels a submit that only moved to the next item.
  if (event.defaultPrevented) return;
  event.preventDefault();

  const formData = new FormData(event.target as HTMLFormElement);
  console.log({
    prototype: formData.get('prototype'),
    detail: formData.get('detail'),
  });
});`, { lineNumbers: true })}
    <p>There is no <code>items</code> collection to pass. Every part renders on the server from its markup, and the element reads the item order from the DOM. Before the element loads, every item shows at once and Submit is the only action; once it loads it shows one item at a time and fills in the progress and the Previous, Skip and Next actions.</p>

    ${heading(toc, 2, 'Multiple selection')}
    <p><code>multiple</code> turns an item's fixed choices into native checkboxes. Read the answers with <code>FormData.getAll()</code>.</p>
    ${await preview('questionnaire-multiple', 'min-h-[420px]')}
    ${codeFigure(`<ui-questionnaire-item name="signals" multiple required>
  <ui-questionnaire-title>What should every update include?</ui-questionnaire-title>
  <ui-questionnaire-description>Select all that apply.</ui-questionnaire-description>
  <ui-questionnaire-choices>
    <ui-questionnaire-choice value="progress">Progress</ui-questionnaire-choice>
    <ui-questionnaire-choice value="decisions">Decisions</ui-questionnaire-choice>
    <ui-questionnaire-choice value="risks">Risks</ui-questionnaire-choice>
  </ui-questionnaire-choices>
  <ui-questionnaire-error></ui-questionnaire-error>
</ui-questionnaire-item>`, { lang: 'html' })}
    ${codeFigure(`const signals = new FormData(form).getAll('signals').map(String);`)}

    ${heading(toc, 2, 'Freeform answers')}
    <p><code>&lt;ui-questionnaire-input&gt;</code> adds a freeform answer and renders a native text input named after its item. On a single-answer item, typing clears the picked choice and picking a choice clears the text.</p>
    ${await preview('questionnaire-freeform', 'min-h-[420px]')}
    ${codeFigure(`<ui-questionnaire-item name="prototype" required>
  <ui-questionnaire-title>What should we prototype next?</ui-questionnaire-title>
  <ui-questionnaire-choices>
    <ui-questionnaire-choice value="delegation">Delegation</ui-questionnaire-choice>
    <ui-questionnaire-choice value="questions">Question prompts</ui-questionnaire-choice>
    <ui-questionnaire-input
      aria-label="Another prototype direction"
      placeholder="Type another direction…"
    ></ui-questionnaire-input>
  </ui-questionnaire-choices>
  <ui-questionnaire-error></ui-questionnaire-error>
</ui-questionnaire-item>`, { lang: 'html' })}
    <p>The text input is always submitted, as an empty string when it was not used, so treat <code>""</code> as no answer.</p>

    ${heading(toc, 2, 'Explicit skip')}
    <p><code>&lt;ui-questionnaire-skip&gt;</code> shows on an optional item, clears that item's answers, and moves on. The kit has no <code>onStatusChange</code>: a skipped item submits like an unanswered one, its choices absent from <code>FormData</code> and its text input empty. When your application needs to tell the two apart, record the click on the Skip action together with the active item, which the <code>ui-active-change</code> event names.</p>
    ${await preview('questionnaire-skip', 'min-h-[520px]')}
    ${codeFigure(`let active = questionnaire.items()[0]?.name;
const skipped = new Set<string>();

questionnaire.addEventListener('ui-active-change', (e) => {
  active = e.detail.name;
});
questionnaire.querySelector('ui-questionnaire-skip')?.addEventListener('click', () => {
  skipped.add(active);
});`, { lineNumbers: true })}
    ${codeFigure(`<ui-questionnaire>
  <ui-questionnaire-item name="timing">
    <ui-questionnaire-title>When should this be revisited?</ui-questionnaire-title>
    <ui-questionnaire-description>Skip this if timing has not been decided.</ui-questionnaire-description>
    <ui-questionnaire-choices>
      <ui-questionnaire-choice value="week">This week</ui-questionnaire-choice>
      <ui-questionnaire-choice value="cycle">Next cycle</ui-questionnaire-choice>
    </ui-questionnaire-choices>
  </ui-questionnaire-item>
  <ui-questionnaire-actions>
    <ui-questionnaire-skip></ui-questionnaire-skip>
    <ui-questionnaire-submit></ui-questionnaire-submit>
  </ui-questionnaire-actions>
</ui-questionnaire>`, { lang: 'html' })}

    ${heading(toc, 2, 'Answer shortcuts')}
    <p>Use <code>shortcuts="letters"</code> or <code>shortcuts="numbers"</code> to give each fixed choice a key, by its position in its item. Each choice shows its hint on its own, so there is no shortcut part to place.</p>
    ${await preview('questionnaire-shortcuts', 'min-h-[480px]')}
    ${codeFigure(`<ui-questionnaire shortcuts="letters">
  <ui-questionnaire-item name="review" required>
    <ui-questionnaire-title>What should the agent review?</ui-questionnaire-title>
    <ui-questionnaire-choices>
      <ui-questionnaire-choice value="api">Public API</ui-questionnaire-choice>
      <ui-questionnaire-choice value="tests">Test coverage</ui-questionnaire-choice>
    </ui-questionnaire-choices>
  </ui-questionnaire-item>
</ui-questionnaire>`, { lang: 'html' })}
    <p><code>"letters"</code> assigns <code>A</code> through <code>Z</code>; <code>"numbers"</code> assigns <code>1</code> through <code>9</code>. A disabled choice keeps its position, so the keys after it do not shift, and its own key does nothing. Selecting an answer by shortcut does not advance to the next item. Set the attribute in the markup, since the choices read it when they render.</p>

    ${await rest(toc)}
    ${await reference(toc)}
  `;
}

async function rest(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Validation')}
    <p>Questionnaire validates the active item before moving forward, and when the form submits on the last item it returns to the first required item that has no answer.</p>
    <ul>
      <li>A required item is valid after it has an answer: a checked choice or a filled text input.</li>
      <li>An optional item is always valid.</li>
      <li>Disabled items are left out.</li>
    </ul>
    <p><code>required</code> does not add visible "Required" text. Say it in the title or description.</p>
    <p>When validation fails, Questionnaire keeps or opens the invalid item, marks its fieldset <code>aria-invalid</code>, and focuses its first answer. Add <code>&lt;ui-questionnaire-error&gt;</code> to show a message.</p>
    ${codeFigure(`<ui-questionnaire-item name="scope" required>
  <ui-questionnaire-title>What should the project include? (Required)</ui-questionnaire-title>
  <ui-questionnaire-choices><!-- choices --></ui-questionnaire-choices>
  <ui-questionnaire-error></ui-questionnaire-error>
</ui-questionnaire-item>`, { lang: 'html' })}
    <p>The error stays hidden until the item is invalid. Its content replaces the default message, which is "Choose an answer to continue." on a required item.</p>
    ${codeFigure(`<ui-questionnaire-error>Please choose a project scope.</ui-questionnaire-error>`, { lang: 'html' })}
    <p>Validation still works without an error part. When one is rendered, it is a <code>role="alert"</code> while shown, so the message is announced.</p>
    <p>For Zod or another validator, check the <code>FormData</code> in a <code>submit</code> listener, cancel the submit when it fails, and set the item's <code>invalid</code> property, which shows its error. The kit has no public way to move to an earlier item from your code, so this marks the item on screen, the last one when Submit fires.</p>
    ${await preview('questionnaire-validation', 'min-h-[520px]')}
    ${codeFigure(`import type { UiQuestionnaireItem } from '#components/ui/questionnaire.ts';

questionnaire.addEventListener('submit', (event) => {
  if (event.defaultPrevented) return;
  const data = Object.fromEntries(new FormData(event.target as HTMLFormElement));
  if (!schema.safeParse(data).success) {
    event.preventDefault();
    const item = questionnaire.querySelector<UiQuestionnaireItem>('ui-questionnaire-item[name="audience"]');
    if (item) item.invalid = true;
  }
});`, { lineNumbers: true })}

    ${heading(toc, 2, 'Controlled navigation')}
    <p>The element owns the active item; there is no <code>item</code> attribute to set it from outside. It dispatches <code>ui-active-change</code> with <code>{ detail: { name } }</code> each time it moves, so your state can follow it, and its <code>next()</code>, <code>previous()</code> and <code>skip()</code> methods move it from your own controls.</p>
    ${await preview('questionnaire-controlled', 'min-h-[520px]')}
    ${codeFigure(`questionnaire.addEventListener('ui-active-change', (e) => {
  status.textContent = \`Current checkpoint: \${e.detail.name}\`;
});

nextButton.addEventListener('click', () => questionnaire.next());`)}

    ${heading(toc, 2, 'Resume with defaults')}
    <p>Restore a saved draft with <code>checked</code> on the choices. The flow always starts on the first item, since there is no <code>defaultItem</code>, and <code>&lt;ui-questionnaire-input&gt;</code> takes no saved value. A native <code>&lt;button type="reset"&gt;</code> restores the inputs, but the element does not listen for the reset, so the choices' checked look and the active item stay as they were.</p>
    ${await preview('questionnaire-resume', 'min-h-[520px]')}
    ${codeFigure(`<ui-questionnaire>
  <ui-questionnaire-item name="scope" required>
    <ui-questionnaire-title>Which files are in scope?</ui-questionnaire-title>
    <ui-questionnaire-choices>
      <ui-questionnaire-choice value="component" checked>Component only</ui-questionnaire-choice>
    </ui-questionnaire-choices>
  </ui-questionnaire-item>
</ui-questionnaire>`, { lang: 'html' })}

    ${heading(toc, 2, 'Conditional items')}
    <p>Set <code>disabled</code> to remove an item from the current flow. Disabled items are excluded from progress, navigation, validation, and submission. To change it at runtime, toggle the attribute from a <code>change</code> listener and call the questionnaire's <code>sync()</code>.</p>
    ${await preview('questionnaire-conditional', 'min-h-[520px]')}
    ${codeFigure(`questionnaire.addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  if (input.name !== 'runtime') return;
  questionnaire
    .querySelector('ui-questionnaire-item[name="region"]')
    ?.toggleAttribute('disabled', input.value !== 'remote');
  questionnaire.sync();
});`, { lineNumbers: true })}

    ${heading(toc, 2, 'Navigation state')}
    <p>Navigation actions stay enabled so activating Next or Submit can show a validation error. The kit never disables them and has no render state or <code>data-status</code> to read. To change the look of Next while the active item has no checked choice, select on the state the markup does carry:</p>
    ${await preview('questionnaire-navigation-state', 'min-h-[480px]')}
    ${codeFigure(`[data-slot="questionnaire"]:not(:has([data-slot="questionnaire-item"][data-active] :checked))
  [data-slot="questionnaire-next"] {
  opacity: 0.5;
}`, { lang: 'css' })}

    ${heading(toc, 2, 'Custom progress')}
    <p><code>&lt;ui-questionnaire-progress&gt;</code> renders <code>Question {current} of {total}</code> and takes no render target or content. Style it with classes. For another format, render your own line and update it from <code>ui-active-change</code>.</p>
    ${await preview('questionnaire-progress', 'min-h-[520px]')}
    ${codeFigure(`questionnaire.addEventListener('ui-active-change', (e) => {
  const items = questionnaire.items();
  const current = items.findIndex((item) => item.name === e.detail.name) + 1;
  output.textContent = \`Checkpoint \${current} of \${items.length}\`;
});`)}
    <p>The progressbar's accessible name is fixed as "Questionnaire progress"; an <code>aria-label</code> on the element is not passed to it.</p>

    ${heading(toc, 2, 'Animated items')}
    <p>Animate the active item while keeping progress and navigation stationary. A class on <code>&lt;ui-questionnaire-item&gt;</code> lands on the fieldset it renders, which carries <code>data-active</code> while it is shown.</p>
    ${await preview('questionnaire-animated', 'min-h-[520px]')}
    ${codeFigure(`<ui-questionnaire-item
  class="data-active:animate-in data-active:fade-in-0 data-active:slide-in-from-bottom-2 data-active:duration-300 motion-reduce:animate-none"
  name="task"
  required
>
  ...
</ui-questionnaire-item>`, { lang: 'html' })}
    <p>Inactive items hide immediately, so animate the entry only.</p>

    ${heading(toc, 2, 'Card composition')}
    <p>Place the root around a card and put the title and description in the card header, with the card's classes on them. The title still renders the legend, and the item names its fieldset by the title wherever it sits, so there is no <code>aria-labelledby</code> to wire.</p>
    ${await preview('questionnaire-card', 'min-h-[560px]')}
    ${codeFigure(`<ui-questionnaire>
  <div data-slot="card" class=\${cardClass()}>
    <ui-questionnaire-item name="task" required>
      <div data-slot="card-header" class=\${cardHeaderClass()}>
        <ui-questionnaire-title class=\${cardTitleClass()}>What should the agent work on?</ui-questionnaire-title>
        <ui-questionnaire-description class=\${cardDescriptionClass()}>
          Choose the task that should be handled next.
        </ui-questionnaire-description>
        <div data-slot="card-action" class=\${cardActionClass()}>
          <ui-questionnaire-progress></ui-questionnaire-progress>
        </div>
      </div>
      <div data-slot="card-content" class=\${cardContentClass()}>
        <ui-questionnaire-choices><!-- choices --></ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </div>
    </ui-questionnaire-item>
    <div data-slot="card-footer" class=\${cardFooterClass()}>
      <ui-questionnaire-next>Next</ui-questionnaire-next>
      <ui-questionnaire-submit>Submit</ui-questionnaire-submit>
    </div>
  </div>
</ui-questionnaire>`, { lang: 'html' })}

    ${heading(toc, 2, 'Dialog composition')}
    <p>Keep dialog dismissal separate from Skip: closing cancels the flow, while skipping records an intentional unanswered item.</p>
    ${await preview('questionnaire-dialog', 'min-h-[320px]')}
    ${codeFigure(`<ui-dialog>
  <ui-dialog-trigger><button class=\${buttonClass({ variant: 'outline' })}>Open clarification</button></ui-dialog-trigger>
  <ui-dialog-content>
    <ui-questionnaire>
      <ui-questionnaire-item name="scope" required>
        <div data-slot="dialog-header" class=\${dialogHeaderClass()}>
          <ui-questionnaire-progress></ui-questionnaire-progress>
          <ui-questionnaire-title class=\${dialogTitleClass()}>Which files are in scope?</ui-questionnaire-title>
          <ui-questionnaire-description class=\${dialogDescriptionClass()}>
            Choose how broadly the agent can update the workspace.
          </ui-questionnaire-description>
        </div>
        <ui-questionnaire-choices><!-- choices --></ui-questionnaire-choices>
        <ui-questionnaire-error></ui-questionnaire-error>
      </ui-questionnaire-item>
      <div data-slot="dialog-footer" class=\${dialogFooterClass()}>
        <ui-dialog-close><button class=\${buttonClass({ variant: 'outline' })}>Cancel</button></ui-dialog-close>
        <ui-questionnaire-next>Next</ui-questionnaire-next>
        <ui-questionnaire-submit>Send answer</ui-questionnaire-submit>
      </div>
    </ui-questionnaire>
  </ui-dialog-content>
</ui-dialog>`, { lang: 'html' })}

    ${heading(toc, 2, 'Custom render targets')}
    <p>The kit has no <code>render</code> prop. Each part renders a fixed element (the root a <code>form</code>, an item a <code>fieldset</code>, a title a <code>legend</code>, a description a <code>p</code>, the actions <code>button</code>s), and a <code>class</code> on the part is merged onto that element. A part's host is <code>display: contents</code>, so the rendered element is the box its parent lays out. To render something else, edit the component file the CLI copied into your project.</p>
    <p>Unlike the headless primitive, every rendered element carries a <code>data-slot</code>, which the styles key on and you can select on too.</p>

    ${heading(toc, 2, 'Native forms')}
    <p><code>&lt;ui-questionnaire&gt;</code> always renders a native form. It takes <code>action</code> and <code>method</code> attributes, which it passes to the form, and the native <code>submit</code> and <code>reset</code> events bubble from it. Do not nest a questionnaire inside another form. Binding a <code>'use server'</code> action needs <code>action=\${fn}</code> on a <code>&lt;form&gt;</code> your template writes, so the element's form takes a URL, not a server action.</p>
    <p>Answers serialize through native controls:</p>
    <ul>
      <li><code>FormData.get(itemName)</code> reads a single answer.</li>
      <li><code>FormData.getAll(itemName)</code> reads multiple answers.</li>
      <li>A skipped item's choices are absent from <code>FormData</code>; its text input, if it has one, is present and empty.</li>
    </ul>
    <p>The form gets <code>novalidate</code> once the element loads, so validation uses the error parts instead of the browser's constraint UI. With JavaScript off it has no <code>novalidate</code>, every item shows, and the browser's own <code>required</code> check covers a required single-answer item's radios.</p>
    <p><code>form.reset()</code> restores the native controls only. The element does not reset the active item or the validation state.</p>
  `;
}

/** Keyboard navigation through the API Reference. */
async function reference(toc: TocEntry[]) {
  const rows = (r: [string, unknown][]) => table(['Data attribute', 'Value'], r.map(([a, v]) => [code(a), v]));
  return html`
    ${heading(toc, 2, 'Keyboard navigation')}
    <p>Questionnaire builds on native radio, checkbox, input, and button behavior.</p>
    ${table(['Key', 'Behavior'], [
      [code('Tab'), 'Moves focus between answer controls and visible actions. Inactive items are inert and hidden actions are hidden, so neither takes focus.'],
      [html`${code('Shift')} + ${code('Tab')}`, 'Moves focus to the previous control or action.'],
      [html`${code('ArrowUp')}, ${code('ArrowDown')}, ${code('ArrowLeft')}, ${code('ArrowRight')}`, 'Native radio behavior: moves to and selects the previous or next radio of the active item. Arrow keys do not move between items.'],
      [code('Space'), 'Selects a radio, toggles a checkbox, or activates a focused action.'],
      [code('Enter'), 'In an answer control, submits the form the browser\'s way, which the element turns into Next, validating first, and on the last item into Submit. On a focused action, activates it.'],
      [html`${code('A')} to ${code('Z')}, ${code('1')} to ${code('9')}`, html`With ${code('shortcuts')}, selects the matching choice of the active item, or toggles it in a ${code('multiple')} item. Does not advance.`],
    ])}
    <p>Shortcuts pause while you type in a text field and while <code>Ctrl</code>, <code>Cmd</code> or <code>Alt</code> is held. There is no <code>Command/Ctrl</code> + <code>Enter</code> binding, and no way to turn the key handling off other than leaving out <code>shortcuts</code>; Enter is the browser's own form submission.</p>
    <p>Navigation actions stay enabled so an attempted action can reveal validation feedback. See <a href="#navigation-state">Navigation state</a> to restyle an unanswered action.</p>

    ${heading(toc, 2, 'Accessibility')}
    <ul>
      <li><code>&lt;ui-questionnaire-item&gt;</code> renders a <code>fieldset</code>.</li>
      <li><code>&lt;ui-questionnaire-title&gt;</code> renders a <code>legend</code> with an <code>id</code>, and the item names its fieldset by it with <code>aria-labelledby</code>, wherever the title sits inside the item.</li>
      <li>The description and, while the item is invalid, the error are connected with <code>aria-describedby</code>.</li>
      <li>An invalid item's fieldset exposes <code>aria-invalid="true"</code>, and its error is a <code>role="alert"</code>. The answer controls do not carry <code>aria-invalid</code>.</li>
      <li><code>&lt;ui-questionnaire-progress&gt;</code> renders a <code>role="progressbar"</code> named "Questionnaire progress", with current, minimum, maximum, and text values, as a polite live region.</li>
      <li>Fixed choices are native radios and checkboxes.</li>
      <li>Assigned shortcut keys are exposed with <code>aria-keyshortcuts</code> on each choice's input, and the visible Next or Submit carries <code>aria-keyshortcuts="Enter"</code>.</li>
      <li>Inactive items are <code>hidden</code> and <code>inert</code>; actions that do not apply are <code>hidden</code> and <code>aria-hidden</code>.</li>
      <li>Navigation focuses the newly active item's first available answer.</li>
      <li>Validation focuses the first available answer control.</li>
      <li>Disabled items are omitted from progress and navigation.</li>
    </ul>
    <p>Always give <code>&lt;ui-questionnaire-input&gt;</code> an accessible name with <code>aria-label</code>, which the element passes to the input it renders. It does not pass an <code>id</code> or <code>aria-labelledby</code>, so a visible <code>&lt;label for&gt;</code> cannot point at the input; repeat the visible text in <code>aria-label</code>.</p>
    ${codeFigure(`<ui-questionnaire-input
  aria-label="Other answer"
  placeholder="Type another answer…"
></ui-questionnaire-input>`, { lang: 'html' })}
    <p>A placeholder is not a label.</p>

    ${heading(toc, 2, 'Data attributes')}
    <p>Use these attributes for styling. Boolean attributes are present when true and absent when false. They sit on the elements the parts render, not on the part hosts, and every rendered element also carries a <code>data-slot</code> named after its part. Where a state has no data attribute of its own, the native or ARIA attribute that carries it is listed.</p>

    ${heading(toc, 3, 'Root and Progress')}
    ${rows([
      ['data-shortcuts', html`${code('"letters"')} | ${code('"numbers"')} on the form when enabled.`],
    ])}
    <p>There is no <code>data-current</code>, <code>data-total</code>, <code>data-first</code> or <code>data-last</code>. The progress element carries the position as <code>aria-valuenow</code> and <code>aria-valuemax</code>.</p>

    ${heading(toc, 3, 'Item')}
    ${rows([
      ['data-active', 'Present on the active item\'s fieldset once the element has loaded.'],
    ])}
    <p>The fieldset also carries <code>hidden</code> and <code>inert</code> while inactive, <code>disabled</code> when the item is disabled, and <code>aria-invalid="true"</code> after failed validation. There is no <code>data-status</code>, <code>data-required</code>, <code>data-multiple</code>, <code>data-disabled</code> or <code>data-invalid</code>.</p>

    ${heading(toc, 3, 'Choice')}
    ${rows([
      ['data-type', html`${code('"radio"')} | ${code('"checkbox"')}`],
      ['data-checked', 'Present when selected.'],
      ['data-unchecked', 'Present when not selected.'],
      ['data-disabled', 'Present when the choice or its item is disabled.'],
      ['data-shortcut', 'The assigned key, a lowercase letter or a number. The hint shows it in uppercase.'],
    ])}
    <p>The choice renders a label (<code>data-slot="questionnaire-choice"</code>) holding the input (<code>questionnaire-choice-input</code>), the indicator (<code>questionnaire-choice-indicator</code>, with <code>-indicator-dot</code> and <code>-indicator-check</code>), the label text (<code>questionnaire-choice-label</code>) and the shortcut hint (<code>questionnaire-choice-shortcut</code>). It has no <code>data-invalid</code>.</p>

    ${heading(toc, 3, 'Choices')}
    <p>No state attributes. The shortcut mode is on the form's <code>data-shortcuts</code>.</p>

    ${heading(toc, 3, 'Input')}
    <p>No state attributes. The input (<code>data-slot="questionnaire-input"</code>) sits in a wrapper (<code>questionnaire-input-wrapper</code>) and is natively <code>disabled</code> with its item; style an empty input with <code>:placeholder-shown</code>.</p>

    ${heading(toc, 3, 'Error')}
    <p>No state attributes. The error is <code>hidden</code> until its item is invalid, and a <code>role="alert"</code> while it shows.</p>

    ${heading(toc, 3, 'Previous, Skip, Next, and Submit')}
    ${rows([
      ['data-variant', 'The button variant.'],
      ['data-size', 'The button size.'],
    ])}
    <p>An action that does not apply to the active item is <code>hidden</code> and <code>aria-hidden</code>; a visible Next or Submit carries <code>aria-keyshortcuts="Enter"</code>. There is no <code>data-visible</code>, <code>data-hidden</code>, <code>data-disabled</code>, <code>data-shortcut</code> or <code>data-status</code>.</p>

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'ui-questionnaire')}
    <p>The form and coordination root.</p>
    ${table(['Attribute', 'Type', 'Default', 'Description'], [
      [code('shortcuts'), code('"letters" | "numbers"'), '-', 'Assigns answer shortcuts by each choice\'s position in its item.'],
      [code('action'), code('string'), '-', 'The form\'s action URL, used when the last item submits.'],
      [code('method'), code('string'), '-', 'The form\'s method.'],
      [code('class'), code('string'), '-', 'Merged onto the form.'],
    ])}
    ${table(['Method or event', 'Description'], [
      [code('next()'), 'Validates the active item and moves to the next one.'],
      [code('previous()'), 'Moves back one item.'],
      [code('skip()'), 'Clears an optional active item\'s answers and moves on.'],
      [code('validate(item?)'), 'Checks an item, the active one by default. Marks it invalid, focuses its answer and returns false when it needs an answer.'],
      [code('answered(item)'), 'Whether an item has a checked choice or a filled text input.'],
      [code('items()'), 'The items in the flow, in order: every one not disabled.'],
      [code('sync()'), 'Redraws the parts after your code changes an item, such as its disabled attribute.'],
      [code('ui-active-change'), html`Dispatched (bubbling) after the active item changes, with ${code('{ detail: { name } }')}.`],
      [code('submit'), 'The native submit event. The element cancels a submit that only moved to the next item, so check defaultPrevented.'],
    ])}
    <p>There is no <code>item</code>, <code>defaultItem</code>, <code>items</code> or <code>noValidate</code> attribute: the flow starts on the first enabled item, the order comes from the markup, and <code>novalidate</code> is set once the element loads.</p>

    ${heading(toc, 3, 'ui-questionnaire-progress')}
    <p>Position within the enabled items. It renders <code>Question {current} of {total}</code> and takes no attributes, content or render target apart from a merged <code>class</code>. Its accessible name is "Questionnaire progress".</p>

    ${heading(toc, 3, 'ui-questionnaire-item')}
    <p>One questionnaire step, rendered as a <code>fieldset</code>.</p>
    ${table(['Attribute', 'Type', 'Default', 'Description'], [
      [code('name'), code('string'), code('""'), 'Unique item identifier and the native form field name of its answers.'],
      [code('required'), code('boolean'), code('false'), 'Requires an answer and hides Skip.'],
      [code('multiple'), code('boolean'), code('false'), 'Renders fixed choices as checkboxes.'],
      [code('disabled'), code('boolean'), code('false'), 'Omits the item from progress, navigation, validation and submission.'],
    ])}
    <p>It also has an <code>invalid</code> property, set by validation and settable from your own validator, and <code>inputs()</code> and <code>choices()</code> methods returning its answer controls and its choices. Item names must be unique within a questionnaire. There is no <code>onStatusChange</code>.</p>

    ${heading(toc, 3, 'ui-questionnaire-title')}
    <p>The item title. It renders a <code>legend</code> with an id the item uses for <code>aria-labelledby</code>, and takes a merged <code>class</code>.</p>

    ${heading(toc, 3, 'ui-questionnaire-description')}
    <p>Supporting text, rendered as a <code>p</code> and connected to the item with <code>aria-describedby</code>. It takes a merged <code>class</code>.</p>

    ${heading(toc, 3, 'ui-questionnaire-choices')}
    <p>A layout container (a <code>div</code>) for fixed and freeform answers. It takes a merged <code>class</code>.</p>

    ${heading(toc, 3, 'ui-questionnaire-choice')}
    <p>A fixed answer. It renders a <code>label</code> around a native radio, or a checkbox in a <code>multiple</code> item, its indicator, its content and its shortcut hint, so the whole row is associated with the control.</p>
    ${table(['Attribute', 'Type', 'Default', 'Description'], [
      [code('value'), code('string'), code('""'), 'Native answer value.'],
      [code('checked'), code('boolean'), code('false'), 'Initial checked state.'],
      [code('disabled'), code('boolean'), code('false'), 'Disables the native answer control.'],
      [code('class'), code('string'), '-', 'Merged onto the label.'],
    ])}
    <p>Its <code>input()</code> method returns the native control. There is no controlled <code>checked</code>: the control owns its state after the first render. Put a <code>&lt;ui-questionnaire-choice-description&gt;</code> inside for a second line.</p>

    ${heading(toc, 3, 'Choice input, label and shortcut')}
    <p>The choice's input, label and shortcut hint are rendered by <code>&lt;ui-questionnaire-choice&gt;</code>: the input is laid transparent over the row, the label text is the choice's content, and the shortcut hint shows the assigned key and stays hidden without one. They are not separate elements, so they take no attributes; style them through their <code>data-slot</code>.</p>

    ${heading(toc, 3, 'ui-questionnaire-input')}
    <p>A freeform answer, a native text input whose <code>name</code> is its item's.</p>
    ${table(['Attribute', 'Type', 'Default', 'Description'], [
      [code('placeholder'), code('string'), code('""'), 'The input\'s placeholder.'],
      [code('aria-label'), code('string'), '-', 'The input\'s accessible name.'],
      [code('class'), code('string'), '-', 'Merged onto the wrapper around the input.'],
    ])}
    <p>The input is always <code>type="text"</code>, and there is no <code>value</code>, <code>defaultValue</code> or <code>type</code> attribute.</p>

    ${heading(toc, 3, 'ui-questionnaire-error')}
    <p>The validation message, a <code>p</code> hidden until its item fails validation. Its content replaces the default message, "Choose an answer to continue." on a required item and "Choose an answer or skip this question." otherwise. It takes a merged <code>class</code>.</p>

    ${heading(toc, 3, 'Navigation actions')}
    <p><code>&lt;ui-questionnaire-previous&gt;</code>, <code>&lt;ui-questionnaire-skip&gt;</code>, <code>&lt;ui-questionnaire-next&gt;</code> and <code>&lt;ui-questionnaire-submit&gt;</code> render native buttons and stay mounted while their visibility changes. Their content replaces the default label.</p>
    ${table(['Part', 'Type', 'Visible when', 'Disabled when'], [
      [code('<ui-questionnaire-previous>'), code('"button"'), 'Not on the first item.', 'Never.'],
      [code('<ui-questionnaire-skip>'), code('"button"'), 'The active item is optional.', 'Never.'],
      [code('<ui-questionnaire-next>'), code('"button"'), 'Not on the last item.', 'Never.'],
      [code('<ui-questionnaire-submit>'), code('"submit"'), 'On the last item, and before the element loads.', 'Never.'],
    ])}
    ${table(['Attribute', 'Type', 'Default'], [
      [code('variant'), html`a <a href="/ui/docs/components/button">Button</a> variant`, html`${code('"outline"')}, ${code('"default"')} on Next and Submit`],
      [code('size'), html`a <a href="/ui/docs/components/button">Button</a> size`, code('"default"')],
      [code('class'), code('string'), html`Merged onto the button.`],
    ])}
    <p><code>&lt;ui-questionnaire-actions&gt;</code> is the layout container: a grid that places Previous at the start and Skip, Next and Submit at the end. It takes a merged <code>class</code>.</p>
  `;
}
