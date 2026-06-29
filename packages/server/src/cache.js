/**
 * Pluggable cache store: the foundation for rate limiting, sessions,
 * and any feature that needs shared state across requests.
 *
 * Default: in-memory LRU (single-process, great for dev).
 * For production horizontal scaling, the user explicitly switches to Redis:
 *
 * ```js
 * import { setStore, redisStore } from '@webjsdev/server';
 * setStore(redisStore({ url: process.env.REDIS_URL }));
 * ```
 *
 * No magic, no auto-detection. The user decides.
 *
 * @module cache
 */

/**
 * @typedef {Object} CacheStore
 * @property {(key: string) => Promise<string | null>} get
 * @property {(key: string, value: string, ttlMs?: number) => Promise<void>} set
 * @property {(key: string) => Promise<void>} delete
 * @property {(key: string, ttlMs?: number) => Promise<number>} increment
 *   Atomically increment a counter. Returns the new value. Creates the
 *   key with value 1 if it doesn't exist. TTL is set on creation only.
 * @property {((key: string, member: string, ttlMs?: number) => Promise<void>)} [setAdd]
 *   OPTIONAL. Atomically add `member` to the SET stored at `key`, refreshing the
 *   key's TTL. Eliminates the lost-update race of a read-modify-write JSON array
 *   (the tag index in `cache-tags.js`, #752). A store WITHOUT this method makes
 *   the tag index fall back to the non-atomic JSON path (the documented caveat).
 *   Paired with `setMembers`; implement both or neither.
 * @property {((key: string) => Promise<string[]>)} [setMembers]
 *   OPTIONAL. Return the members of the SET stored at `key` (empty array on a
 *   miss). The read counterpart of `setAdd`.
 */

/**
 * In-memory LRU cache store. Fast, zero dependencies, single-process only.
 * Entries are evicted when the cache exceeds `maxSize`.
 *
 * @param {{ maxSize?: number }} [opts]
 * @returns {CacheStore}
 */
export function memoryStore(opts = {}) {
  const max = opts.maxSize || 10000;
  /** @type {Map<string, { value: string, expiresAt: number | null }>} */
  const map = new Map();

  function evict() {
    if (map.size <= max) return;
    const oldest = map.keys().next().value;
    map.delete(oldest);
  }

  function isExpired(entry) {
    return entry.expiresAt !== null && Date.now() > entry.expiresAt;
  }

  // Only a finite, positive ttlMs sets an expiration. NaN, Infinity,
  // 0, negative, or non-number all fall back to "no TTL" (null).
  // Without this, NaN slips past the truthiness check and entries
  // silently live forever, which masks bugs in caller code that
  // computes ttl from arithmetic.
  function expiresAtFrom(ttlMs) {
    return typeof ttlMs === 'number' && Number.isFinite(ttlMs) && ttlMs > 0
      ? Date.now() + ttlMs
      : null;
  }

  return {
    async get(key) {
      const entry = map.get(key);
      if (!entry) return null;
      if (isExpired(entry)) { map.delete(key); return null; }
      // Move to end (LRU)
      map.delete(key);
      map.set(key, entry);
      return entry.value;
    },
    async set(key, value, ttlMs) {
      map.delete(key); // remove old position
      map.set(key, {
        value,
        expiresAt: expiresAtFrom(ttlMs),
      });
      evict();
    },
    async delete(key) {
      map.delete(key);
    },
    async increment(key, ttlMs) {
      const entry = map.get(key);
      if (!entry || isExpired(entry)) {
        map.set(key, {
          value: '1',
          expiresAt: expiresAtFrom(ttlMs),
        });
        return 1;
      }
      const next = parseInt(entry.value, 10) + 1;
      // Mutate value + re-insert so the bumped key counts as recent
      // for LRU eviction. Without the re-insert, a hot rate-limit
      // bucket stays at its original position and gets evicted ahead
      // of less-active keys.
      entry.value = String(next);
      map.delete(key);
      map.set(key, entry);
      return next;
    },
    // Atomic SET ops (#752). The entry value for a set key is a native `Set`
    // (not a JSON string), so the add is a single synchronous mutation with no
    // read-modify-write await gap: concurrent `setAdd` calls in one process
    // cannot lose an entry. Only the tag index uses these keys, so the mixed
    // value type (string for normal keys, Set for set keys) never collides with
    // `get`/`increment`. The key still rides the same LRU + TTL machinery.
    async setAdd(key, member, ttlMs) {
      const entry = map.get(key);
      const set = entry && !isExpired(entry) && entry.value instanceof Set
        ? entry.value
        : new Set();
      set.add(member);
      map.delete(key); // re-insert at the end (LRU) + refresh TTL like Redis EXPIRE
      map.set(key, { value: set, expiresAt: expiresAtFrom(ttlMs) });
      evict();
    },
    async setMembers(key) {
      const entry = map.get(key);
      if (!entry) return [];
      if (isExpired(entry)) { map.delete(key); return []; }
      return entry.value instanceof Set ? [...entry.value] : [];
    },
  };
}

/**
 * Redis-backed cache store. Scales horizontally: all instances share
 * the same cache. Requires `REDIS_URL` in the environment or explicit URL.
 *
 * Uses the `ioredis` package if available, falls back to built-in
 * `redis` package (Node 20+ ships with `node:` prefix modules but
 * not a Redis client: the user must install one).
 *
 * @param {{ url?: string }} [opts]
 * @returns {CacheStore}
 */
export function redisStore(opts = {}) {
  const url = opts.url || process.env.REDIS_URL;
  if (!url) throw new Error('redisStore requires REDIS_URL environment variable or opts.url');

  /** @type {any} */
  let client = null;
  let connecting = null;

  async function getClient() {
    if (client) return client;
    if (connecting) return connecting;
    connecting = (async () => {
      // Try ioredis first (most popular), then redis package
      try {
        const { default: Redis } = await import('ioredis');
        client = new Redis(url);
        return client;
      } catch {}
      try {
        const { createClient } = await import('redis');
        client = createClient({ url });
        await client.connect();
        return client;
      } catch {}
      throw new Error('Install a Redis client: npm install ioredis (or npm install redis)');
    })();
    return connecting;
  }

  return {
    async get(key) {
      const c = await getClient();
      return c.get(key);
    },
    async set(key, value, ttlMs) {
      const c = await getClient();
      if (ttlMs) {
        // ioredis: set(key, value, 'PX', ms): redis: set(key, value, { PX: ms })
        if (typeof c.set === 'function' && c.set.length >= 4) {
          await c.set(key, value, 'PX', ttlMs);
        } else {
          await c.set(key, value, { PX: ttlMs });
        }
      } else {
        await c.set(key, value);
      }
    },
    async delete(key) {
      const c = await getClient();
      await c.del(key);
    },
    async increment(key, ttlMs) {
      const c = await getClient();
      const val = await c.incr(key);
      // Set TTL only when counter is first created (val === 1)
      if (val === 1 && ttlMs) {
        await c.pexpire(key, ttlMs);
      }
      return val;
    },
    // Atomic SET ops (#752): SADD is an atomic set insert across instances, so
    // the tag index no longer loses a concurrent append the way a JSON-array
    // read-modify-write did. A per-member TTL is not native to a Redis set, so
    // refresh the whole key's expiry on each add (PEXPIRE), keeping the
    // short-TTL floor as defense-in-depth. ioredis uses lowercase command names
    // (`sadd`); node-redis v4 uses camelCase (`sAdd`), so probe both.
    async setAdd(key, member, ttlMs) {
      const c = await getClient();
      if (typeof c.sadd === 'function') await c.sadd(key, member);
      else await c.sAdd(key, member);
      if (ttlMs) {
        if (typeof c.pexpire === 'function') await c.pexpire(key, ttlMs);
        else await c.pExpire(key, ttlMs);
      }
    },
    async setMembers(key) {
      const c = await getClient();
      const members = typeof c.smembers === 'function'
        ? await c.smembers(key)
        : await c.sMembers(key);
      return Array.isArray(members) ? members : [];
    },
  };
}

/** @type {CacheStore | null} */
let _defaultStore = null;

/**
 * Get the default cache store. Memory store unless explicitly set via
 * `setStore()`. No auto-detection: the user decides.
 *
 * @returns {CacheStore}
 */
export function getStore() {
  if (!_defaultStore) _defaultStore = memoryStore();
  return _defaultStore;
}

/**
 * Set the default cache store. Call this at app startup to use Redis:
 *
 * ```js
 * import { setStore, redisStore } from '@webjsdev/server';
 * setStore(redisStore({ url: process.env.REDIS_URL }));
 * ```
 *
 * @param {CacheStore} store
 */
export function setStore(store) {
  _defaultStore = store;
}
