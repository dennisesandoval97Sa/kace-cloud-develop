const KEY = 'kace_cache_ttl_ms';

function readEntry() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

export function readTtl() {
  const entry = readEntry();
  if (!entry) return null;
  const ttl = Number(entry.ttl);
  if (!Number.isFinite(ttl) || ttl < 0) return null;
  return Math.floor(ttl);
}

export function readSignature() {
  const entry = readEntry();
  if (!entry) return null;
  return typeof entry.configSignature === 'string'
    ? entry.configSignature
    : null;
}

export function writeTtl(ttl, configSignature) {
  try {
    const entry = {
      ttl: Math.floor(Number(ttl) || 0),
      updatedAt: new Date().toISOString(),
      configSignature: String(configSignature ?? ''),
    };
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch (_) {
    /* ignore quota errors */
  }
}

export function clearTtl() {
  try {
    localStorage.removeItem(KEY);
  } catch (_) {
    /* ignore */
  }
}
