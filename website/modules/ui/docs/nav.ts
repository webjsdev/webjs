/**
 * The /ui docs navigation (#1666, D15): the ONE source the docs sidebar, the
 * previous and next links, the components index, the sitemap and the llms
 * reader all read, so they cannot disagree.
 *
 * Generated from shadcn/ui's content/docs meta.json trees (the order, the
 * titles and the component descriptions), with each description rewritten
 * where shadcn's names a React library (D1) and the pages in the issue's
 * "Cannot exist" table left out. Hand-edit freely, it is ordinary source.
 */

export interface DocLink {
  title: string;
  href: string;
}

export interface DocGroup {
  title: string;
  items: DocLink[];
}

export interface ComponentDoc {
  slug: string;
  title: string;
  description: string;
}

import { DOC_PAGES } from './pages/index.ts';

/** The sidebar's first group, shadcn's TOP_LEVEL_SECTIONS. */
export const SECTIONS: DocLink[] = [
  {
    title: "Introduction",
    href: "/ui/docs"
  },
  {
    title: "Components",
    href: "/ui/docs/components"
  },
  {
    title: "AI Elements",
    href: "/ui/docs/ai-elements"
  },
  {
    title: "Installation",
    href: "/ui/docs/installation"
  },
  {
    title: "Theming",
    href: "/ui/docs/theming"
  },
  {
    title: "CLI",
    href: "/ui/docs/cli"
  },
  {
    title: "Typeset",
    href: "/ui/docs/typeset"
  },
  {
    title: "Skills",
    href: "/ui/docs/skills"
  },
  {
    title: "Registry",
    href: "/ui/docs/registry"
  },
  {
    title: "Changelog",
    href: "/ui/docs/changelog"
  }
];

/** Every component page, in shadcn's order, with its title and description. */
export const COMPONENTS: ComponentDoc[] = [
  {
    slug: "accordion",
    title: "Accordion",
    description: "A vertically stacked set of interactive headings that each reveal a section of content."
  },
  {
    slug: "alert",
    title: "Alert",
    description: "Displays a callout for user attention."
  },
  {
    slug: "alert-dialog",
    title: "Alert Dialog",
    description: "A modal dialog that interrupts the user with important content and expects a response."
  },
  {
    slug: "aspect-ratio",
    title: "Aspect Ratio",
    description: "Displays content within a desired ratio."
  },
  {
    slug: "attachment",
    title: "Attachment",
    description: "Displays a file or image attachment with media, metadata, upload state, and actions."
  },
  {
    slug: "avatar",
    title: "Avatar",
    description: "An image element with a fallback for representing the user."
  },
  {
    slug: "badge",
    title: "Badge",
    description: "Displays a badge or a component that looks like a badge."
  },
  {
    slug: "breadcrumb",
    title: "Breadcrumb",
    description: "Displays the path to the current resource using a hierarchy of links."
  },
  {
    slug: "bubble",
    title: "Bubble",
    description: "Displays conversational content in a message bubble. Supports variants, alignment, grouping, reactions, and collapsible content."
  },
  {
    slug: "button",
    title: "Button",
    description: "Displays a button or a component that looks like a button."
  },
  {
    slug: "button-group",
    title: "Button Group",
    description: "A container that groups related buttons together with consistent styling."
  },
  {
    slug: "calendar",
    title: "Calendar",
    description: "A calendar component that allows users to select a date or a range of dates."
  },
  {
    slug: "card",
    title: "Card",
    description: "Displays a card with header, content, and footer."
  },
  {
    slug: "carousel",
    title: "Carousel",
    description: "A carousel with motion and swipe built on CSS scroll snap."
  },
  {
    slug: "chart",
    title: "Chart",
    description: "Beautiful charts, rendered on the server as SVG. Copy and paste into your apps."
  },
  {
    slug: "checkbox",
    title: "Checkbox",
    description: "A control that allows the user to toggle between checked and not checked."
  },
  {
    slug: "code-block",
    title: "Code Block",
    description: "Displays code, terminal output and diffs with an optional header, line numbers and a copy button."
  },
  {
    slug: "collapsible",
    title: "Collapsible",
    description: "An interactive component which expands/collapses a panel."
  },
  {
    slug: "combobox",
    title: "Combobox",
    description: "Autocomplete input with a list of suggestions."
  },
  {
    slug: "command",
    title: "Command",
    description: "Command menu for search and quick actions."
  },
  {
    slug: "context-menu",
    title: "Context Menu",
    description: "Displays a menu of actions triggered by a right click."
  },
  {
    slug: "data-table",
    title: "Data Table",
    description: "Powerful tables and datagrids built from the table helpers."
  },
  {
    slug: "date-picker",
    title: "Date Picker",
    description: "A date picker component with range and presets."
  },
  {
    slug: "dialog",
    title: "Dialog",
    description: "A window overlaid on either the primary window or another dialog window, rendering the content underneath inert."
  },
  {
    slug: "direction",
    title: "Direction",
    description: "Reads the text direction an element renders in."
  },
  {
    slug: "drawer",
    title: "Drawer",
    description: "A drawer that slides in from an edge of the screen."
  },
  {
    slug: "dropdown-menu",
    title: "Dropdown Menu",
    description: "Displays a menu to the user, such as a set of actions or functions, triggered by a button."
  },
  {
    slug: "empty",
    title: "Empty",
    description: "Use the Empty component to display an empty state."
  },
  {
    slug: "field",
    title: "Field",
    description: "Combine labels, controls, and help text to compose accessible form fields and grouped inputs."
  },
  {
    slug: "hover-card",
    title: "Hover Card",
    description: "For sighted users to preview content available behind a link."
  },
  {
    slug: "input",
    title: "Input",
    description: "A text input component for forms and user data entry with built-in styling and accessibility features."
  },
  {
    slug: "input-group",
    title: "Input Group",
    description: "Add addons, buttons, and helper content to inputs."
  },
  {
    slug: "input-otp",
    title: "Input OTP",
    description: "Accessible one-time password component with copy-paste functionality."
  },
  {
    slug: "item",
    title: "Item",
    description: "A versatile component for displaying content with media, title, description, and actions."
  },
  {
    slug: "kbd",
    title: "Kbd",
    description: "Used to display textual user input from keyboard."
  },
  {
    slug: "label",
    title: "Label",
    description: "Renders an accessible label associated with controls."
  },
  {
    slug: "marker",
    title: "Marker",
    description: "Displays an inline status, system note, bordered row, or labeled separator in a conversation."
  },
  {
    slug: "menubar",
    title: "Menubar",
    description: "A visually persistent menu common in desktop applications that provides quick access to a consistent set of commands."
  },
  {
    slug: "message",
    title: "Message",
    description: "Displays a message in a conversation, with optional avatar, header, footer, and alignment."
  },
  {
    slug: "message-scroller",
    title: "Message Scroller",
    description: "A chat scroll container that anchors turns, opens saved transcripts, follows streamed responses, loads history without jumping, and jumps to any message."
  },
  {
    slug: "native-select",
    title: "Native Select",
    description: "A styled native HTML select element with consistent design system integration."
  },
  {
    slug: "navigation-menu",
    title: "Navigation Menu",
    description: "A collection of links for navigating websites."
  },
  {
    slug: "pagination",
    title: "Pagination",
    description: "Pagination with page navigation, next and previous links."
  },
  {
    slug: "popover",
    title: "Popover",
    description: "Displays rich content in a popup, triggered by a button."
  },
  {
    slug: "progress",
    title: "Progress",
    description: "Displays an indicator showing the completion progress of a task, typically displayed as a progress bar."
  },
  {
    slug: "questionnaire",
    title: "Questionnaire",
    description: "A multi-step questionnaire with single-choice, multiple-choice, freeform, and skippable questions."
  },
  {
    slug: "radio-group",
    title: "Radio Group",
    description: "A set of checkable buttons, known as radio buttons, where no more than one of the buttons can be checked at a time."
  },
  {
    slug: "resizable",
    title: "Resizable",
    description: "Accessible resizable panel groups and layouts with keyboard support."
  },
  {
    slug: "scroll-area",
    title: "Scroll Area",
    description: "Augments native scroll functionality with custom, cross-browser styling."
  },
  {
    slug: "select",
    title: "Select",
    description: "Displays a list of options for the user to pick from, triggered by a button."
  },
  {
    slug: "separator",
    title: "Separator",
    description: "Visually or semantically separates content."
  },
  {
    slug: "sheet",
    title: "Sheet",
    description: "Extends the Dialog component to display content that complements the main content of the screen."
  },
  {
    slug: "sidebar",
    title: "Sidebar",
    description: "A composable, themeable and customizable sidebar component."
  },
  {
    slug: "skeleton",
    title: "Skeleton",
    description: "Use to show a placeholder while content is loading."
  },
  {
    slug: "slider",
    title: "Slider",
    description: "An input where the user selects a value from within a given range."
  },
  {
    slug: "sonner",
    title: "Sonner",
    description: "An opinionated toast component."
  },
  {
    slug: "spinner",
    title: "Spinner",
    description: "An indicator that can be used to show a loading state."
  },
  {
    slug: "switch",
    title: "Switch",
    description: "A control that allows the user to toggle between checked and not checked."
  },
  {
    slug: "table",
    title: "Table",
    description: "A responsive table component."
  },
  {
    slug: "tabs",
    title: "Tabs",
    description: "A set of layered sections of content, known as tab panels, that are displayed one at a time."
  },
  {
    slug: "textarea",
    title: "Textarea",
    description: "Displays a form textarea or a component that looks like a textarea."
  },
  {
    slug: "toast",
    title: "Toast",
    description: "A succinct message that is displayed temporarily."
  },
  {
    slug: "toggle",
    title: "Toggle",
    description: "A two-state button that can be either on or off."
  },
  {
    slug: "toggle-group",
    title: "Toggle Group",
    description: "A set of two-state buttons that can be toggled on or off."
  },
  {
    slug: "tooltip",
    title: "Tooltip",
    description: "A popup that displays information related to an element when the element receives keyboard focus or the mouse hovers over it."
  },
  {
    slug: "trace",
    title: "Trace",
    description: "The building block for reasoning, tool calls, sources and more."
  },
  {
    slug: "typography",
    title: "Typography",
    description: "Styles for headings, paragraphs, lists, etc."
  }
];

/** The sidebar's groups after Sections, in shadcn's tree order. */
export const NAV: DocGroup[] = [
  {
    title: "Components",
    items: [
      {
        title: "Accordion",
        href: "/ui/docs/components/accordion"
      },
      {
        title: "Alert",
        href: "/ui/docs/components/alert"
      },
      {
        title: "Alert Dialog",
        href: "/ui/docs/components/alert-dialog"
      },
      {
        title: "Aspect Ratio",
        href: "/ui/docs/components/aspect-ratio"
      },
      {
        title: "Attachment",
        href: "/ui/docs/components/attachment"
      },
      {
        title: "Avatar",
        href: "/ui/docs/components/avatar"
      },
      {
        title: "Badge",
        href: "/ui/docs/components/badge"
      },
      {
        title: "Breadcrumb",
        href: "/ui/docs/components/breadcrumb"
      },
      {
        title: "Bubble",
        href: "/ui/docs/components/bubble"
      },
      {
        title: "Button",
        href: "/ui/docs/components/button"
      },
      {
        title: "Button Group",
        href: "/ui/docs/components/button-group"
      },
      {
        title: "Calendar",
        href: "/ui/docs/components/calendar"
      },
      {
        title: "Card",
        href: "/ui/docs/components/card"
      },
      {
        title: "Carousel",
        href: "/ui/docs/components/carousel"
      },
      {
        title: "Chart",
        href: "/ui/docs/components/chart"
      },
      {
        title: "Checkbox",
        href: "/ui/docs/components/checkbox"
      },
      {
        title: "Code Block",
        href: "/ui/docs/components/code-block"
      },
      {
        title: "Collapsible",
        href: "/ui/docs/components/collapsible"
      },
      {
        title: "Combobox",
        href: "/ui/docs/components/combobox"
      },
      {
        title: "Command",
        href: "/ui/docs/components/command"
      },
      {
        title: "Context Menu",
        href: "/ui/docs/components/context-menu"
      },
      {
        title: "Data Table",
        href: "/ui/docs/components/data-table"
      },
      {
        title: "Date Picker",
        href: "/ui/docs/components/date-picker"
      },
      {
        title: "Dialog",
        href: "/ui/docs/components/dialog"
      },
      {
        title: "Direction",
        href: "/ui/docs/components/direction"
      },
      {
        title: "Drawer",
        href: "/ui/docs/components/drawer"
      },
      {
        title: "Dropdown Menu",
        href: "/ui/docs/components/dropdown-menu"
      },
      {
        title: "Empty",
        href: "/ui/docs/components/empty"
      },
      {
        title: "Field",
        href: "/ui/docs/components/field"
      },
      {
        title: "Hover Card",
        href: "/ui/docs/components/hover-card"
      },
      {
        title: "Input",
        href: "/ui/docs/components/input"
      },
      {
        title: "Input Group",
        href: "/ui/docs/components/input-group"
      },
      {
        title: "Input OTP",
        href: "/ui/docs/components/input-otp"
      },
      {
        title: "Item",
        href: "/ui/docs/components/item"
      },
      {
        title: "Kbd",
        href: "/ui/docs/components/kbd"
      },
      {
        title: "Label",
        href: "/ui/docs/components/label"
      },
      {
        title: "Marker",
        href: "/ui/docs/components/marker"
      },
      {
        title: "Menubar",
        href: "/ui/docs/components/menubar"
      },
      {
        title: "Message",
        href: "/ui/docs/components/message"
      },
      {
        title: "Message Scroller",
        href: "/ui/docs/components/message-scroller"
      },
      {
        title: "Native Select",
        href: "/ui/docs/components/native-select"
      },
      {
        title: "Navigation Menu",
        href: "/ui/docs/components/navigation-menu"
      },
      {
        title: "Pagination",
        href: "/ui/docs/components/pagination"
      },
      {
        title: "Popover",
        href: "/ui/docs/components/popover"
      },
      {
        title: "Progress",
        href: "/ui/docs/components/progress"
      },
      {
        title: "Questionnaire",
        href: "/ui/docs/components/questionnaire"
      },
      {
        title: "Radio Group",
        href: "/ui/docs/components/radio-group"
      },
      {
        title: "Resizable",
        href: "/ui/docs/components/resizable"
      },
      {
        title: "Scroll Area",
        href: "/ui/docs/components/scroll-area"
      },
      {
        title: "Select",
        href: "/ui/docs/components/select"
      },
      {
        title: "Separator",
        href: "/ui/docs/components/separator"
      },
      {
        title: "Sheet",
        href: "/ui/docs/components/sheet"
      },
      {
        title: "Sidebar",
        href: "/ui/docs/components/sidebar"
      },
      {
        title: "Skeleton",
        href: "/ui/docs/components/skeleton"
      },
      {
        title: "Slider",
        href: "/ui/docs/components/slider"
      },
      {
        title: "Sonner",
        href: "/ui/docs/components/sonner"
      },
      {
        title: "Spinner",
        href: "/ui/docs/components/spinner"
      },
      {
        title: "Switch",
        href: "/ui/docs/components/switch"
      },
      {
        title: "Table",
        href: "/ui/docs/components/table"
      },
      {
        title: "Tabs",
        href: "/ui/docs/components/tabs"
      },
      {
        title: "Textarea",
        href: "/ui/docs/components/textarea"
      },
      {
        title: "Toast",
        href: "/ui/docs/components/toast"
      },
      {
        title: "Toggle",
        href: "/ui/docs/components/toggle"
      },
      {
        title: "Toggle Group",
        href: "/ui/docs/components/toggle-group"
      },
      {
        title: "Tooltip",
        href: "/ui/docs/components/tooltip"
      },
      {
        title: "Trace",
        href: "/ui/docs/components/trace"
      },
      {
        title: "Typography",
        href: "/ui/docs/components/typography"
      }
    ]
  },
  {
    title: "AI Elements",
    items: [
      {
        title: "Chain of Thought",
        href: "/ui/docs/ai-elements/chain-of-thought"
      },
      {
        title: "Chat",
        href: "/ui/docs/ai-elements/chat"
      },
      {
        title: "Checkpoint",
        href: "/ui/docs/ai-elements/checkpoint"
      },
      {
        title: "Confirmation",
        href: "/ui/docs/ai-elements/confirmation"
      },
      {
        title: "Context",
        href: "/ui/docs/ai-elements/context"
      },
      {
        title: "File Tree",
        href: "/ui/docs/ai-elements/file-tree"
      },
      {
        title: "Inline Citation",
        href: "/ui/docs/ai-elements/inline-citation"
      },
      {
        title: "Message",
        href: "/ui/docs/ai-elements/message"
      },
      {
        title: "Model Selector",
        href: "/ui/docs/ai-elements/model-selector"
      },
      {
        title: "Plan",
        href: "/ui/docs/ai-elements/plan"
      },
      {
        title: "Prompt Input",
        href: "/ui/docs/ai-elements/prompt-input"
      },
      {
        title: "Queue",
        href: "/ui/docs/ai-elements/queue"
      },
      {
        title: "Reasoning",
        href: "/ui/docs/ai-elements/reasoning"
      },
      {
        title: "Sources",
        href: "/ui/docs/ai-elements/sources"
      },
      {
        title: "Stack Trace",
        href: "/ui/docs/ai-elements/stack-trace"
      },
      {
        title: "Subagent",
        href: "/ui/docs/ai-elements/subagent"
      },
      {
        title: "Suggestion",
        href: "/ui/docs/ai-elements/suggestion"
      },
      {
        title: "Task",
        href: "/ui/docs/ai-elements/task"
      },
      {
        title: "Terminal",
        href: "/ui/docs/ai-elements/terminal"
      },
      {
        title: "Test Results",
        href: "/ui/docs/ai-elements/test-results"
      },
      {
        title: "Tool",
        href: "/ui/docs/ai-elements/tool"
      }
    ]
  },
  {
    title: "Get Started",
    items: [
      {
        title: "Introduction",
        href: "/ui/docs"
      },
      {
        title: "Installation",
        href: "/ui/docs/installation"
      },
      {
        title: "components.json",
        href: "/ui/docs/components-json"
      },
      {
        title: "Package Imports",
        href: "/ui/docs/package-imports"
      },
      {
        title: "Theming",
        href: "/ui/docs/theming"
      },
      {
        title: "Typeset",
        href: "/ui/docs/typeset"
      },
      {
        title: "Dark Mode",
        href: "/ui/docs/dark-mode"
      },
      {
        title: "RTL",
        href: "/ui/docs/rtl"
      },
      {
        title: "CLI",
        href: "/ui/docs/cli"
      },
      {
        title: "Monorepo",
        href: "/ui/docs/monorepo"
      },
      {
        title: "Skills",
        href: "/ui/docs/skills"
      },
      {
        title: "JavaScript",
        href: "/ui/docs/javascript"
      },
      {
        title: "Blocks",
        href: "/ui/docs/blocks"
      },
      {
        title: "Figma",
        href: "/ui/docs/figma"
      },
      {
        title: "Changelog",
        href: "/ui/docs/changelog"
      },
      {
        title: "llms.txt",
        href: "/ui/llms.txt"
      }
    ]
  },
  {
    title: "React primitives",
    items: [
      {
        title: "Message Scroller",
        href: "/ui/docs/react/message-scroller"
      },
      {
        title: "Questionnaire",
        href: "/ui/docs/react/questionnaire"
      }
    ]
  },
  {
    title: "Helpers",
    items: [
      {
        title: "AI SDK",
        href: "/ui/docs/helpers/ai-sdk"
      },
      {
        title: "TanStack AI",
        href: "/ui/docs/helpers/tanstack-ai"
      }
    ]
  },
  {
    title: "Forms",
    items: [
      {
        title: "Forms",
        href: "/ui/docs/forms"
      }
    ]
  },
  {
    title: "Utilities",
    items: [
      {
        title: "scroll-fade",
        href: "/ui/docs/utils/scroll-fade"
      },
      {
        title: "shimmer",
        href: "/ui/docs/utils/shimmer"
      }
    ]
  },
  {
    title: "Registry",
    items: [
      {
        title: "Introduction",
        href: "/ui/docs/registry"
      },
      {
        title: "Getting Started",
        href: "/ui/docs/registry/getting-started"
      },
      {
        title: "GitHub Registries",
        href: "/ui/docs/registry/github"
      },
      {
        title: "Registry Directory",
        href: "/ui/docs/registry/registry-index"
      },
      {
        title: "Registry Health",
        href: "/ui/docs/registry/health"
      },
      {
        title: "Examples",
        href: "/ui/docs/registry/examples"
      },
      {
        title: "Namespaces",
        href: "/ui/docs/registry/namespace"
      },
      {
        title: "Authentication",
        href: "/ui/docs/registry/authentication"
      },
      {
        title: "Dynamic Search",
        href: "/ui/docs/registry/dynamic-search"
      },
      {
        title: "MCP Server",
        href: "/ui/docs/registry/mcp"
      },
      {
        title: "FAQ",
        href: "/ui/docs/registry/faq"
      },
      {
        title: "API Reference",
        href: "/ui/docs/registry/api-reference"
      },
      {
        title: "registry.json",
        href: "/ui/docs/registry/registry-json"
      },
      {
        title: "registry-item.json",
        href: "/ui/docs/registry/registry-item-json"
      }
    ]
  }
];

/** Every docs page in reading order, for the previous and next links. */
export function readingOrder(): DocLink[] {
  return NAV.flatMap((g) => g.items).filter((l) => l.href.startsWith('/ui/docs'));
}

/** The pages either side of `href`, or null at an end. */
export function neighbours(href: string): { previous: DocLink | null; next: DocLink | null } {
  const order = readingOrder();
  const i = order.findIndex((l) => l.href === href);
  if (i < 0) return { previous: null, next: null };
  return { previous: order[i - 1] ?? null, next: order[i + 1] ?? null };
}

/** The component record for a slug, or undefined. */
export function componentDoc(slug: string): ComponentDoc | undefined {
  return COMPONENTS.find((c) => c.slug === slug);
}

/**
 * The header's main nav, shadcn's siteConfig.navItems. shadcn's also lists
 * Blocks, Charts, Typeset and Create; each joins in the step of
 * #1666 that builds its page, so the header never links to a page that does
 * not exist yet. The header and the search menu's Pages group both read it.
 */
export const HEADER_NAV: DocLink[] = [
  { title: 'Home', href: '/ui' },
  { title: 'Docs', href: '/ui/docs' },
  { title: 'Components', href: '/ui/docs/components' },
  { title: 'Directory', href: '/ui/docs/directory' },
];

/**
 * Whether a docs href has a page yet. The nav lists shadcn's whole tree so
 * its order is settled, but only these routes are built; the search menu
 * offers only these. Widen it as each page lands.
 */
export function docPageExists(href: string): boolean {
  if (href === '/ui/docs' || href === '/ui/docs/components' || href === '/ui/docs/directory') return true;
  if (href.startsWith('/ui/docs/') && href.slice('/ui/docs/'.length) in DOC_PAGES) return true;
  const prefix = '/ui/docs/components/';
  return href.startsWith(prefix) && !!componentDoc(href.slice(prefix.length));
}
