export type Guide = {
  slug: string;
  title: string;
  date: string;
  description: string;
  /** One-line hook shown on the index card and under the H1. */
  tagline: string;
  /** The exact keyword phrase this guide targets, e.g. "AI-first web framework". */
  keyword: string;
  tags: string[];
  author: string;
};

export type GuideWithBody = Guide & {
  body: string;
};
