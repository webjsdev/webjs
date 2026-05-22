export type Post = {
  slug: string;
  title: string;
  date: string;
  description: string;
  tags: string[];
  author: string;
};

export type PostWithBody = Post & {
  body: string;
};
