// A mutation that evicts cached reads. After you change data, call the narrowest
// revalidate that covers the change so the next request refetches instead of
// serving a stale cache() result or a revalidate-cached page. (A 'use server'
// action already runs its declared `invalidates` tags automatically; these are
// the same helpers, callable directly when you need finer control.)
'use server';
import { revalidateTag, revalidateTags, revalidatePath, revalidateAll, getStore, memoryStore } from '@webjsdev/server';

export async function bustCaches() {
  revalidateTag('todos'); // one cache() tag
  revalidateTags(['todos', 'user:me']); // several tags at once
  revalidatePath('/features/caching'); // a revalidate-cached page URL
  // getStore() is the active cache store (memoryStore() in dev, redisStore() in
  // prod via setStore()); fall back to a fresh memoryStore() if none is set.
  const store = getStore() ?? memoryStore();
  const backed = store != null;
  revalidateAll(); // the nuclear option: drop the whole cache
  return { success: true as const, data: { backed } };
}
