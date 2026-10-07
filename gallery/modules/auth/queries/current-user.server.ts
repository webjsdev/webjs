'use server';

import { getCurrentUser } from '../auth.server.ts';

// Deliberately POST-default (no `method` export): a per-session result must
// never land in a cache, and GET is the verb a `cache` window gets added to.
// SSR seeding applies to any verb, so staying POST costs the first paint nothing.
export async function currentUser() {
  return getCurrentUser();
}
