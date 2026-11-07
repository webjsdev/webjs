/**
 * The playground example's static data, shadcn's
 * apps/v4/app/(app)/examples/playground/data/{models,presets}.ts as they are.
 */

export const types = ['GPT-3', 'Codex'] as const;

export type ModelType = (typeof types)[number];

export interface Model {
  id: string;
  name: string;
  description: string;
  strengths?: string;
  type: ModelType;
}

export const models: Model[] = [
  {
    id: 'c305f976-8e38-42b1-9fb7-d21b2e34f0da',
    name: 'text-davinci-003',
    description:
      'Most capable GPT-3 model. Can do any task the other models can do, often with higher quality, longer output and better instruction-following. Also supports inserting completions within text.',
    type: 'GPT-3',
    strengths: 'Complex intent, cause and effect, creative generation, search, summarization for audience',
  },
  {
    id: '464a47c3-7ab5-44d7-b669-f9cb5a9e8465',
    name: 'text-curie-001',
    description: 'Very capable, but faster and lower cost than Davinci.',
    type: 'GPT-3',
    strengths: 'Language translation, complex classification, sentiment, summarization',
  },
  {
    id: 'ac0797b0-7e31-43b6-a494-da7e2ab43445',
    name: 'text-babbage-001',
    description: 'Capable of straightforward tasks, very fast, and lower cost.',
    type: 'GPT-3',
    strengths: 'Moderate classification, semantic search',
  },
  {
    id: 'be638fb1-973b-4471-a49c-290325085802',
    name: 'text-ada-001',
    description: 'Capable of very simple tasks, usually the fastest model in the GPT-3 series, and lowest cost.',
    type: 'GPT-3',
    strengths: 'Parsing text, simple classification, address correction, keywords',
  },
  {
    id: 'b43c0ea9-5ad4-456a-ae29-26cd77b6d0fb',
    name: 'code-davinci-002',
    description:
      'Most capable Codex model. Particularly good at translating natural language to code. In addition to completing code, also supports inserting completions within code.',
    type: 'Codex',
  },
  {
    id: 'bbd57291-4622-4a21-9eed-dd6bd786fdd1',
    name: 'code-cushman-001',
    description:
      'Almost as capable as Davinci Codex, but slightly faster. This speed advantage may make it preferable for real-time applications.',
    type: 'Codex',
    strengths: 'Real-time application where low-latency is preferable',
  },
];

export interface Preset {
  id: string;
  name: string;
}

export const presets: Preset[] = [
  { id: '9cb0e66a-9937-465d-a188-2c4c4ae2401f', name: 'Grammatical Standard English' },
  { id: '61eb0e32-2391-4cd3-adc3-66efe09bc0b7', name: 'Summarize for a 2nd grader' },
  { id: 'a4e1fa51-f4ce-4e45-892c-224030a00bdd', name: 'Text to command' },
  { id: 'cc198b13-4933-43aa-977e-dcd95fa30770', name: 'Q&A' },
  { id: 'adfa95be-a575-45fd-a9ef-ea45386c64de', name: 'English to other languages' },
  { id: 'c569a06a-0bd6-43a7-adf9-bf68c09e7a79', name: 'Parse unstructured data' },
  { id: '15ccc0d7-f37a-4f0a-8163-a37e162877dc', name: 'Classification' },
  { id: '4641ef41-1c0f-421d-b4b2-70fe431081f3', name: 'Natural language to Python' },
  { id: '48d34082-72f3-4a1b-a14d-f15aca4f57a0', name: 'Explain code' },
  { id: 'dfd42fd5-0394-4810-92c6-cc907d3bfd1a', name: 'Chat' },
];
