import { storeService } from './storeService.js';

const PREFIX = 'kace';

const LEGACY_AUTH_SESSION_TOKENS_KEY = 'auth.session_tokens';

export const KACE_SESSION_TOKENS_NS = 'session-tokens';
export const KACE_SESSION_TOKENS_ENTRY_KEY = 'bundle';

function buildKey(namespace, key) {
  const tenantId = storeService.get('auth.tenant_id') ?? 'default';
  return `${PREFIX}:${tenantId}:${namespace}:${key}`;
}

export class SessionStorageCache {
  static peek(namespace, key) {
    const cacheKey = buildKey(namespace, key);
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (entry.expiresAt != null && entry.expiresAt <= Date.now()) return null;
      return entry.value !== undefined ? entry.value : null;
    } catch (_) {
      return null;
    }
  }

  static async get(namespace, key, fetcher, ttlMs) {
    const cacheKey = buildKey(namespace, key);
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const entry = JSON.parse(raw);
        const fresh = entry.expiresAt == null || entry.expiresAt > Date.now();
        if (fresh) {
          return entry.value;
        }
      }
    } catch (_) {}

    if (!fetcher) return null;

    const value = await fetcher();
    SessionStorageCache.set(namespace, key, value, ttlMs);
    return value;
  }

  static set(namespace, key, value, ttlMs) {
    if (ttlMs != null && ttlMs <= 0) return;
    const cacheKey = buildKey(namespace, key);
    try {
      const expiresAt = ttlMs == null ? null : Date.now() + ttlMs;
      sessionStorage.setItem(cacheKey, JSON.stringify({ value, expiresAt }));
    } catch (_) {}
  }

  static invalidate(namespace, key) {
    const cacheKey = buildKey(namespace, key);
    try {
      sessionStorage.removeItem(cacheKey);
    } catch (_) {}
  }

  static clear() {
    try {
      const toRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(`${PREFIX}:`)) toRemove.push(k);
      }
      toRemove.forEach((k) => sessionStorage.removeItem(k));
    } catch (_) {}
  }
}

export function getKaceSessionTokensBundle() {
  const fromNs = SessionStorageCache.peek(
    KACE_SESSION_TOKENS_NS,
    KACE_SESSION_TOKENS_ENTRY_KEY
  );
  if (fromNs && typeof fromNs === 'object') return fromNs;
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(LEGACY_AUTH_SESSION_TOKENS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    SessionStorageCache.set(
      KACE_SESSION_TOKENS_NS,
      KACE_SESSION_TOKENS_ENTRY_KEY,
      parsed,
      null
    );
    sessionStorage.removeItem(LEGACY_AUTH_SESSION_TOKENS_KEY);
    return parsed;
  } catch (_) {
    return null;
  }
}

export function mergeKaceSessionTokensBundle(partial) {
  const current = getKaceSessionTokensBundle() || {};
  SessionStorageCache.set(
    KACE_SESSION_TOKENS_NS,
    KACE_SESSION_TOKENS_ENTRY_KEY,
    { ...current, ...partial },
    null
  );
}

export function clearKaceSessionTokensBundle() {
  SessionStorageCache.invalidate(
    KACE_SESSION_TOKENS_NS,
    KACE_SESSION_TOKENS_ENTRY_KEY
  );
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(LEGACY_AUTH_SESSION_TOKENS_KEY);
    }
  } catch (_) {}
}
