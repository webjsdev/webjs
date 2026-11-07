import {
  buildPresetItem,
  encodePreset,
  getIconLibrary,
  presetFontUrls,
  type PresetConfig,
} from '../../../../packages/ui/packages/registry/themes/preset.js';

const SITE = 'https://webjs.dev';

/** A fenced block, built here so no template literal holds a backtick run. */
function fence(lang: string, body: string): string {
  const tick = '`'.repeat(3);
  return `${tick}${lang}\n${body}\n${tick}`;
}

function cssBlock(selector: string, vars: Record<string, string> | undefined): string {
  const lines = Object.entries(vars || {}).map(([k, v]) => `  --${k}: ${v};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

/**
 * The markdown a person or an agent follows to set a WebJs app up by hand
 * for one design-system choice, the WebJs form of shadcn's
 * /init/md (apps/v4/app/(app)/(create)/lib/build-instructions.ts). The one
 * command does all of it, so it comes first; the steps after it are what
 * that command writes.
 *
 * @param config a resolved preset config
 * @param components the kit's component names, for the closing list
 */
export function presetInstructions(config: PresetConfig, components: string[]): string {
  const code = encodePreset(config);
  const item = buildPresetItem(config);
  const icons = getIconLibrary(config.iconLibrary);
  const fontUrls = presetFontUrls(config);
  const componentsJson = {
    $schema: 'https://ui.webjs.dev/schema.json',
    style: config.style,
    tailwind: { css: 'styles/globals.css', baseColor: config.baseColor, cssVariables: true },
    aliases: { components: 'components', utils: 'lib/utils/cn', ui: 'components/ui', lib: 'lib' },
    iconLibrary: config.iconLibrary,
  };

  const sections = [
    `# WebJs UI preset ${code}\n\nStyle **${config.style}**, base color **${config.baseColor}**, theme **${config.theme}**, chart color **${config.chartColor}**, font **${config.font}**${config.fontHeading !== 'inherit' ? ` with **${config.fontHeading}** headings` : ''}, radius **${config.radius}**, icons **${icons ? icons.title : config.iconLibrary}**.`,
    `## The one command\n\nRun this in a WebJs app. It writes everything below.\n\n${fence('bash', `npx @webjsdev/ui init --preset ${code}`)}`,
    `## Step 1: components.json\n\n${fence('json', JSON.stringify(componentsJson, null, 2))}`,
    `## Step 2: Theme tokens\n\nThe theme block in \`styles/globals.css\`, between its \`/* @webjsdev/ui theme */\` and \`/* @webjsdev/ui theme end */\` markers, sets these values. Running \`init --preset\` again replaces that block in place.\n\n${fence('css', [cssBlock('@theme inline', item.cssVars.theme), cssBlock(':root', item.cssVars.light), cssBlock('.dark', item.cssVars.dark)].join('\n\n'))}`,
    fontUrls.length
      ? `## Step 3: Fonts\n\nThe theme names the font families. Load the faces, self-hosted under \`public/\` or from Google Fonts, with a stylesheet link in the root layout:\n\n${fence('html', fontUrls.map((u) => `<link rel="stylesheet" href="${u}">`).join('\n'))}`
      : null,
    `## Step 4: Icons\n\nThe icons are ${icons ? icons.title : config.iconLibrary}, written beside the cn() helper as \`lib/utils/icons.ts\`. Every icon library exports the same function names, so changing it later changes no import.\n\n${fence('bash', `npx @webjsdev/ui add ${icons ? icons.item : 'lib-icons'}`)}`,
    `## Available components\n\n${components.join(', ')}\n\nAdd one with \`npx @webjsdev/ui add <name>\`. Each is documented at \`${SITE}/ui/docs/components/<name>\`.`,
  ];
  return sections.filter(Boolean).join('\n\n---\n\n') + '\n';
}
