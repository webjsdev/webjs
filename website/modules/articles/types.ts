export type Article = {
  slug: string;
  title: string;
  date: string;
  description: string;
  /** One-line hook shown under the H1 (the evergreen index cards omit it). */
  tagline: string;
  /** The exact keyword phrase this article targets, e.g. "web components framework". */
  keyword: string;
  tags: string[];
  author: string;
};

export type ArticleWithBody = Article & {
  body: string;
};
