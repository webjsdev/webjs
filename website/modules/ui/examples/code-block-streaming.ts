import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  codeBlockClass, codeBlockHeaderClass, codeBlockTitleClass, codeBlockActionsClass,
  codeBlockContentClass, codeBlockCodeClass, codeBlockLines, type CodeBlockLineVariant,
} from '#modules/ui/components/code-block.ts';
import { RotateCcwIcon } from '#lib/ui/lucide.ts';

const blocks: {
  title?: string
  language: string
  code: string
  lineNumbers?: boolean
  highlight?: number[]
  diff?: boolean
}[] = [
  {
    title: 'hooks/use-debounce.ts',
    language: 'ts',
    lineNumbers: true,
    code: `export function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timeout)
  }, [value, delay])

  return debounced
}`,
  },
  {
    language: 'bash',
    code: 'npx @webjsdev/ui add code-block',
  },
  {
    title: 'components/search.tsx',
    language: 'tsx',
    lineNumbers: true,
    diff: true,
    code: ` export function Search() {
   const [query, setQuery] = React.useState("")
-  const results = useSearch(query)
+  const debounced = useDebounce(query, 300)
+  const results = useSearch(debounced)

   return <SearchResults results={results} />
 }`,
  },
  {
    title: 'app/api/chat/route.ts',
    language: 'ts',
    lineNumbers: true,
    highlight: [5, 6, 7, 8],
    code: `import { streamText } from "ai"

export async function POST(request: Request) {
  const { messages } = await request.json()

  const result = streamText({
    model: "anthropic/claude-sonnet-4.5",
    messages,
  })

  return result.toUIMessageStreamResponse()
}`,
  },
  {
    title: '.env.local',
    language: 'bash',
    code: 'AI_GATEWAY_API_KEY=your-api-key',
  },
];

function StreamingBlock(block: (typeof blocks)[number]) {
  const rows = block.code.split('\n');
  // A diff row starts with +, - or a space. The marker is not part of the code.
  const source = block.diff ? rows.map((row) => row.slice(1)).join('\n') : block.code;
  const variants: Record<number, CodeBlockLineVariant> = {};
  rows.forEach((row, index) => {
    if (block.diff) {
      variants[index + 1] = row.startsWith('+') ? 'added' : row.startsWith('-') ? 'removed' : 'default';
    } else if (block.highlight?.includes(index)) {
      variants[index + 1] = 'highlighted';
    }
  });

  return html`
    <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
      ${block.title ? html`
        <div data-slot="code-block-header" class=${codeBlockHeaderClass()}>
          <div data-slot="code-block-title" class=${codeBlockTitleClass()}>${block.title}</div>
          <div data-slot="code-block-actions" class=${codeBlockActionsClass()}>
            <ui-code-block-copy-button value=${source}></ui-code-block-copy-button>
          </div>
        </div>
      ` : ''}
      <pre data-slot="code-block-content" ?data-numbered=${!!block.lineNumbers} tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${codeBlockLines(source, { variants })}</code></pre>
    </div>
  `;
}

// The settled state, with every block written out. A component streaming
// text in holds it in a signal and renders these same lines as it grows.
export default function CodeBlockStreaming() {
  return html`
    <div class="flex w-full max-w-md flex-col gap-4">
      ${blocks.map(StreamingBlock)}
      <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'self-start')}>
        ${RotateCcwIcon()}
        Replay
      </button>
    </div>
  `;
}
