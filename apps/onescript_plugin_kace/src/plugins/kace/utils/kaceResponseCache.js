import {
  KaceHttpCache,
  buildKaceHttpCacheKey,
  stableStringify,
} from './kaceHttpCache.js';

export { stableStringify };

export function buildKaceResponseCacheKey(
  tenantId,
  method,
  url,
  paramsOrNull,
  dataOrNull
) {
  return buildKaceHttpCacheKey(tenantId, method, url, paramsOrNull, dataOrNull);
}

export function kaceResponseCacheGet(key) {
  return KaceHttpCache.get(key);
}

export function kaceResponseCacheSet(key, response, ttlMs = 0) {
  KaceHttpCache.set(key, response, ttlMs);
}

export function kaceResponseCacheableStatus(response) {
  if (!response || typeof response.status !== 'number') return false;
  return response.status >= 200 && response.status < 300;
}

export function isKaceDefaultPostCacheableUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.includes('/cases/auxiliary')) return false;
  if (url.includes('/case-attachments') && !url.includes('/search'))
    return false;
  const patterns = [
    /\/sub-cases\/search$/,
    /\/case-session-duration\/search/,
    /\/auxiliaries\/.+\/list\/search/,
    /\/auxiliaries\/.+\/search$/,
    /\/case-attachments\/search$/,
    /\/users\/search$/,
    /\/groups\/search$/,
    /\/user-group-relationships\/search$/,
    /\/classifications\/search$/,
    /\/classifications-groups-relationships\/search$/,
    /\/transitions\/search$/,
    /\/literals\/search$/,
    /\/schemas\/rules\/search$/,
  ];
  return patterns.some((re) => re.test(url));
}

const UUID_IN_PATH =
  /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/|\?|$)/i;

export function isKaceNeverCacheableGetUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return UUID_IN_PATH.test(url);
}

export function invalidateKaceResponseCacheForCases(caseIds) {
  KaceHttpCache.invalidateForCases(caseIds);
}

export function clearKaceResponseCache() {
  KaceHttpCache.clear();
}
