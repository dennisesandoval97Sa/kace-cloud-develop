/**
 * localStorage-backed HTTP response cache for {@link ApiService}.
 * Keys: tenant + method + URL + stable-serialized params/body.
 * TTL per entry + LRU eviction by total stored bytes.
 */

const FIELD_SEP = '\u0002';
const KEY_PREFIX = 'kace:http:';
const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;

let maxBytes = DEFAULT_MAX_BYTES;
/** @type {Map<string, { size: number, lastAccess: number }>|null} */
let index = null;

/**
 * Deterministic JSON serialization (sorted object keys).
 * @param {unknown} value
 * @returns {string}
 */
export function stableStringify(value) {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/**
 * @param {string|undefined|null} tenantId
 * @param {string} method
 * @param {string} url
 * @param {unknown} paramsOrNull - GET/DELETE/HEAD: axios params
 * @param {unknown} dataOrNull - POST/PUT: body
 * @returns {string}
 */
export function buildKaceHttpCacheKey(
  tenantId,
  method,
  url,
  paramsOrNull,
  dataOrNull
) {
  const m = String(method || 'GET').toUpperCase();
  const third =
    m === 'GET' || m === 'DELETE' || m === 'HEAD'
      ? stableStringify(paramsOrNull ?? null)
      : stableStringify(dataOrNull ?? null);
  return `${KEY_PREFIX}${tenantId ?? ''}${FIELD_SEP}${m}${FIELD_SEP}${url}${FIELD_SEP}${third}`;
}

/**
 * @param {string} key
 * @returns {{ tenantId: string, method: string, url: string, rest: string }}
 */
function parseKey(key) {
  const body = key.slice(KEY_PREFIX.length);
  const parts = body.split(FIELD_SEP);
  return {
    tenantId: parts[0] ?? '',
    method: parts[1] ?? '',
    url: parts[2] ?? '',
    rest: parts[3] ?? '',
  };
}

function rebuildIndex() {
  index = new Map();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(KEY_PREFIX)) continue;
    const raw = localStorage.getItem(k);
    const size = raw ? raw.length : 0;
    index.set(k, { size, lastAccess: 0 });
  }
}

function ensureIndex() {
  if (index === null) rebuildIndex();
}

function touch(key, size) {
  ensureIndex();
  index.delete(key);
  index.set(key, { size, lastAccess: Date.now() });
}

function evictUntilUnderLimit() {
  ensureIndex();
  let total = 0;
  for (const { size } of index.values()) total += size;
  while (total > maxBytes && index.size > 0) {
    const oldestKey = index.keys().next().value;
    if (oldestKey == null) break;
    const entry = index.get(oldestKey);
    total -= entry.size;
    index.delete(oldestKey);
    try {
      localStorage.removeItem(oldestKey);
    } catch (_) {}
  }
}

/**
 * @param {{ data: any, status: number, statusText?: string }} response
 * @returns {{ data: any, status: number, statusText?: string }}
 */
function snapshotFromResponse(response) {
  let dataClone;
  try {
    dataClone = JSON.parse(JSON.stringify(response.data));
  } catch (_) {
    dataClone = response.data;
  }
  return {
    data: dataClone,
    status: response.status,
    statusText: response.statusText,
  };
}

/**
 * @param {{ data: any, status: number, statusText?: string }} snapshot
 * @returns {{ data: any, status: number, statusText?: string, headers: {}, config: {} }}
 */
function materializeResponse(snapshot) {
  let dataClone;
  try {
    dataClone = JSON.parse(JSON.stringify(snapshot.data));
  } catch (_) {
    dataClone = snapshot.data;
  }
  return {
    data: dataClone,
    status: snapshot.status,
    statusText: snapshot.statusText,
    headers: {},
    config: {},
  };
}

export const KaceHttpCache = {
  set(key, response, ttlMs) {
    if (ttlMs == null || ttlMs <= 0) return;
    const snapshot = snapshotFromResponse(response);
    const entry = {
      value: snapshot,
      expiresAt: Date.now() + ttlMs,
      ttlAtInsert: ttlMs,
    };
    const raw = JSON.stringify(entry);
    if (raw.length > maxBytes) return;
    try {
      localStorage.setItem(key, raw);
      touch(key, raw.length);
      evictUntilUnderLimit();
    } catch (_) {
      evictUntilUnderLimit();
      try {
        localStorage.setItem(key, raw);
        touch(key, raw.length);
      } catch (_) {}
    }
  },

  get(key) {
    ensureIndex();
    let raw;
    try {
      raw = localStorage.getItem(key);
    } catch (_) {
      return null;
    }
    if (!raw) return null;
    let entry;
    try {
      entry = JSON.parse(raw);
    } catch (_) {
      return null;
    }
    if (!entry || entry.value == null) {
      try {
        localStorage.removeItem(key);
      } catch (_) {}
      index.delete(key);
      return null;
    }
    if (entry.expiresAt != null && entry.expiresAt <= Date.now()) {
      try {
        localStorage.removeItem(key);
      } catch (_) {}
      index.delete(key);
      return null;
    }
    touch(key, raw.length);
    return materializeResponse(entry.value);
  },

  clear() {
    ensureIndex();
    for (const k of [...index.keys()]) {
      try {
        localStorage.removeItem(k);
      } catch (_) {}
    }
    index.clear();
  },

  invalidateForCases(caseIds) {
    ensureIndex();
    const ids = [
      ...new Set(
        caseIds.filter((x) => x != null && x !== '').map((x) => String(x))
      ),
    ];
    if (!ids.length) return;
    const esc = (id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      ...ids.map((id) => new RegExp(`/cases/${esc(id)}(?:/|\\?|$)`)),
      ...ids.map((id) => new RegExp(`/aux-cases/${esc(id)}(?:\\?|$)`)),
      ...ids.map((id) => new RegExp(`/case-descriptions/${esc(id)}(?:\\?|$)`)),
      ...ids.map(
        (id) => new RegExp(`/case-available-states/${esc(id)}(?:\\?|$)`)
      ),
      ...ids.map((id) => new RegExp(`/case-transitions/${esc(id)}(?:\\?|$)`)),
    ];
    for (const k of [...index.keys()]) {
      const parsed = parseKey(k);
      const url = parsed.url ?? '';
      if (patterns.some((re) => re.test(url))) {
        try {
          localStorage.removeItem(k);
        } catch (_) {}
        index.delete(k);
      }
    }
  },

  setMaxBytes(limit) {
    maxBytes = limit;
  },

  resetIndex() {
    index = null;
  },
};
