'use server';

/**
 * `getSeedUser` backs the SSR action-seeding e2e fixture (#472). It is a real
 * `'use server'` action (the client import becomes an RPC stub), awaited inside
 * `<seeded-user>`'s `async render()`. On first load the SSR result is SEEDED
 * into the page, so hydration resolves it without the RPC; a prop bump asks for
 * a different id, which misses the seed and goes to the network.
 *
 * A module-scope call counter is mirrored onto `globalThis` so a server-side
 * test can assert the action ran exactly once per rendered component at SSR.
 */
let calls = 0;
export async function getSeedUser(id: number): Promise<{ id: number; name: string; joined: Date }> {
  calls += 1;
  (globalThis as Record<string, unknown>).__seedUserCalls = calls;
  return { id, name: `User ${id}`, joined: new Date('2020-01-01T00:00:00.000Z') };
}
