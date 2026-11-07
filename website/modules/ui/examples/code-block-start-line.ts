import { html } from '@webjsdev/core';
import {
  codeBlockClass, codeBlockHeaderClass, codeBlockTitleClass,
  codeBlockContentClass, codeBlockCodeClass, codeBlockLines,
} from '#modules/ui/components/code-block.ts';

const code = `  if (!session) {
    redirect("/login")
  }

  const projects = await db.project.findMany({
    where: { ownerId: session.user.id },
    orderBy: { updatedAt: "desc" },
  })

  return <ProjectList projects={projects} />
}`;

// The counter starts one below the first line: line 995 is counter-reset 994.
export default function CodeBlockStartLine() {
  return html`
    <div class="w-full max-w-md">
      <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
        <div data-slot="code-block-header" class=${codeBlockHeaderClass()}>
          <div data-slot="code-block-title" class=${codeBlockTitleClass()}>app/dashboard/page.tsx</div>
        </div>
        <pre data-slot="code-block-content" data-numbered tabindex="0" dir="ltr" style="counter-reset: line 994" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${codeBlockLines(code)}</code></pre>
      </div>
    </div>
  `;
}
