import { TenantContext } from '../context/TenantContext.js';

const CACHE = new Map();
const PENDING = new Map();

export class EntityCache {
    static async get(namespace, key, fetcher, ttlMs) {
        const cacheKey = EntityCache.#buildKey(namespace, key);
        const now = Date.now();
        const entry = CACHE.get(cacheKey);
        if (entry && entry.expiresAt > now) {
            return entry.value;
        }
        const pending = PENDING.get(cacheKey);
        if (pending) {
            return pending;
        }
        const promise = fetcher()
            .then((value) => {
                CACHE.set(cacheKey, { value, expiresAt: Date.now() + ttlMs });
                PENDING.delete(cacheKey);
                return value;
            })
            .catch((err) => {
                PENDING.delete(cacheKey);
                throw err;
            });
        PENDING.set(cacheKey, promise);
        return promise;
    }

    static invalidate(namespace, key) {
        CACHE.delete(EntityCache.#buildKey(namespace, key));
    }

    static invalidateNamespace(namespace) {
        const tenantId = TenantContext.getTenantId() ?? 'default';
        const prefix = `${tenantId}:${namespace}:`;
        for (const key of CACHE.keys()) {
            if (key.startsWith(prefix)) {
                CACHE.delete(key);
            }
        }
    }

    static clear() {
        CACHE.clear();
        PENDING.clear();
    }

    static #buildKey(namespace, key) {
        const tenantId = TenantContext.getTenantId() ?? 'default';
        return `${tenantId}:${namespace}:${key}`;
    }
}
