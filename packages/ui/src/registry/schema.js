import { z } from 'zod';

// Wire-compatible port of shadcn's registry schema.
// Source: ~/Documents/Projects/shadcn/packages/shadcn/src/registry/schema.ts

export const registryItemTypeSchema = z.enum([
  'registry:lib',
  'registry:block',
  'registry:component',
  'registry:ui',
  'registry:hook',
  'registry:page',
  'registry:file',
  'registry:theme',
  'registry:style',
  'registry:item',
  'registry:base',
  'registry:font',
  'registry:example',
  'registry:internal',
]);

export const registryItemFileSchema = z.discriminatedUnion('type', [
  z.object({
    path: z.string(),
    content: z.string().optional(),
    type: z.enum(['registry:file', 'registry:page']),
    target: z.string(),
  }),
  z.object({
    path: z.string(),
    content: z.string().optional(),
    type: registryItemTypeSchema.exclude(['registry:file', 'registry:page']),
    target: z.string().optional(),
  }),
]);

export const registryItemTailwindSchema = z.object({
  config: z
    .object({
      content: z.array(z.string()).optional(),
      theme: z.record(z.string(), z.any()).optional(),
      plugins: z.array(z.string()).optional(),
    })
    .optional(),
});

export const registryItemCssVarsSchema = z.object({
  theme: z.record(z.string(), z.string()).optional(),
  light: z.record(z.string(), z.string()).optional(),
  dark: z.record(z.string(), z.string()).optional(),
});

const cssValueSchema = z.lazy(() =>
  z.union([
    z.string(),
    z.array(z.union([z.string(), z.record(z.string(), z.string())])),
    z.record(z.string(), cssValueSchema),
  ]),
);

export const registryItemCssSchema = z.record(z.string(), cssValueSchema);
export const registryItemEnvVarsSchema = z.record(z.string(), z.string());

export const registryItemCommonSchema = z.object({
  $schema: z.string().optional(),
  extends: z.string().optional(),
  name: z.string(),
  title: z.string().optional(),
  author: z.string().min(2).optional(),
  description: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  devDependencies: z.array(z.string()).optional(),
  registryDependencies: z.array(z.string()).optional(),
  files: z.array(registryItemFileSchema).optional(),
  tailwind: registryItemTailwindSchema.optional(),
  cssVars: registryItemCssVarsSchema.optional(),
  css: registryItemCssSchema.optional(),
  envVars: registryItemEnvVarsSchema.optional(),
  meta: z.record(z.string(), z.any()).optional(),
  docs: z.string().optional(),
  categories: z.array(z.string()).optional(),
});

export const rawConfigSchema = z
  .object({
    $schema: z.string().optional(),
    style: z.string().default('default'),
    tailwind: z.object({
      config: z.string().optional(),
      css: z.string(),
      baseColor: z.string().default('neutral'),
      cssVariables: z.boolean().default(true),
      prefix: z.string().default('').optional(),
    }),
    iconLibrary: z.string().optional().default('lucide'),
    aliases: z.object({
      components: z.string().default('components'),
      utils: z.string().default('lib/utils'),
      ui: z.string().optional().default('components/ui'),
      lib: z.string().optional().default('lib'),
    }),
    registries: z.record(z.string(), z.any()).optional(),
  })
  .strict();

export const registryItemSchema = registryItemCommonSchema.extend({
  type: registryItemTypeSchema,
});

export const registrySchema = z.object({
  name: z.string(),
  homepage: z.string().optional(),
  items: z.array(registryItemSchema),
});

export const registryIndexSchema = z.array(registryItemSchema);
