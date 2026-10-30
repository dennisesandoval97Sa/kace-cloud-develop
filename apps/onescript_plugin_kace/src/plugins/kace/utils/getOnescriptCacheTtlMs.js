import { readTtl } from './kaceCacheTtlStore.js';

const CANONICAL_PATH = [
  'behaviors',
  'application',
  'agente',
  'onescript',
  'onescript_cache_ttl_ms',
];

function readCanonicalTtlFromSettings(settings) {
  if (!settings || typeof settings !== 'object') return undefined;
  let node = settings;
  for (const segment of CANONICAL_PATH) {
    node = node?.[segment];
    if (node == null) return undefined;
  }
  return node;
}

export function getOnescriptCacheTtlMs(storeService) {
  const settings = storeService?.get?.('config.global_config') ?? undefined;
  let ttl = readCanonicalTtlFromSettings(settings);

  if (ttl == null) {
    const persisted = readTtl();
    if (persisted != null) ttl = persisted;
  }

  if (ttl == null) return 0;

  const parsed = Number(ttl);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;

  return Math.floor(parsed);
}
