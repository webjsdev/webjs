export type Entry = {
  package: string;     // "@webjsdev/core"
  shortPkg: string;    // "core"
  version: string;     // "0.6.0"
  date: string;        // ISO timestamp
  commitCount: number;
  body: string;        // raw markdown body (after frontmatter)
};
