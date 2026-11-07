'use server';

import { readGithubStars } from '#lib/github-stars.server.ts';

/**
 * The /ui header's GitHub star count (#1666), as an action so the chrome
 * layout can import it safely. The cache and the fallback live in
 * lib/github-stars.server.ts.
 */
export async function githubStars(): Promise<number | null> {
  return readGithubStars();
}
