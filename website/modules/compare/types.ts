export type Comparison = {
  slug: string;
  title: string;
  date: string;
  description: string;
  /** The framework being compared against, e.g. "Next.js". */
  competitor: string;
  /** One-line hook shown on the index card. */
  tagline: string;
  tags: string[];
  author: string;
};

export type ComparisonWithBody = Comparison & {
  body: string;
};
