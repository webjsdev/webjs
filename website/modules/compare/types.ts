export type Comparison = {
  slug: string;
  title: string;
  date: string;
  description: string;
  /** The framework being compared against, e.g. "Next.js". */
  competitor: string;
  /** Canonical URL of the competitor's official site (outbound link). */
  link: string;
  /** One-line hook shown on the index card. */
  tagline: string;
  tags: string[];
  author: string;
};

export type ComparisonWithBody = Comparison & {
  body: string;
};
