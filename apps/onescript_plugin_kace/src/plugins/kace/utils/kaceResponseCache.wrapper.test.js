import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildKaceResponseCacheKey,
  kaceResponseCacheGet,
  kaceResponseCacheSet,
  kaceResponseCacheableStatus,
  isKaceDefaultPostCacheableUrl,
  isKaceNeverCacheableGetUrl,
  invalidateKaceResponseCacheForCases,
  clearKaceResponseCache,
  stableStringify,
} from './kaceResponseCache.js';
import { KaceHttpCache } from './kaceHttpCache.js';

beforeEach(() => {
  localStorage.clear();
  KaceHttpCache.resetIndex();
});

afterEach(() => {
  localStorage.clear();
  KaceHttpCache.resetIndex();
});

describe('kaceResponseCache wrappers', () => {
  it('buildKaceResponseCacheKey delegates to KaceHttpCache key format', () => {
    const key = buildKaceResponseCacheKey('t1', 'GET', '/foo', { id: 1 }, null);
    expect(key.startsWith('kace:http:')).toBe(true);
  });

  it('kaceResponseCacheSet / Get round-trip through localStorage', () => {
    const key = buildKaceResponseCacheKey('t1', 'GET', '/foo', null, null);
    const res = { data: { x: 1 }, status: 200, statusText: 'OK' };
    kaceResponseCacheSet(key, res, 60_000);
    const hit = kaceResponseCacheGet(key);
    expect(hit).not.toBeNull();
    expect(hit.data).toEqual({ x: 1 });
  });

  it('kaceResponseCacheSet with ttl 0 does not persist', () => {
    const key = buildKaceResponseCacheKey('t1', 'GET', '/foo', null, null);
    kaceResponseCacheSet(key, { data: {}, status: 200, statusText: '' }, 0);
    expect(kaceResponseCacheGet(key)).toBeNull();
  });

  it('kaceResponseCacheableStatus returns true for 2xx', () => {
    expect(kaceResponseCacheableStatus({ status: 200 })).toBe(true);
  });

  it('isKaceDefaultPostCacheableUrl matches /schemas/rules/search', () => {
    expect(isKaceDefaultPostCacheableUrl('/schemas/rules/search')).toBe(true);
  });

  it('isKaceDefaultPostCacheableUrl matches /classifications-groups-relationships/search', () => {
    expect(
      isKaceDefaultPostCacheableUrl(
        '/classifications-groups-relationships/search'
      )
    ).toBe(true);
    expect(
      isKaceDefaultPostCacheableUrl(
        'https://api.example.com/classifications-groups-relationships/search'
      )
    ).toBe(true);
  });

  it('isKaceNeverCacheableGetUrl matches GET paths with UUID segment', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(isKaceNeverCacheableGetUrl(`/cases/${uuid}`)).toBe(true);
    expect(
      isKaceNeverCacheableGetUrl(
        `https://api.example.com/cases/${uuid}/transitions`
      )
    ).toBe(true);
    expect(isKaceNeverCacheableGetUrl(`/cases/${uuid}?expand=foo`)).toBe(true);
  });

  it('isKaceNeverCacheableGetUrl does not match paths without UUID in path', () => {
    expect(isKaceNeverCacheableGetUrl('/aux-definitions')).toBe(false);
    expect(isKaceNeverCacheableGetUrl('/cases/12345')).toBe(false);
    expect(
      isKaceNeverCacheableGetUrl(
        '/cases?filter=550e8400-e29b-41d4-a716-446655440000'
      )
    ).toBe(false);
  });

  it('invalidateKaceResponseCacheForCases delegates to KaceHttpCache', () => {
    const k1 = buildKaceResponseCacheKey(
      't1',
      'GET',
      '/cases/123/transitions',
      null,
      null
    );
    kaceResponseCacheSet(k1, { data: {}, status: 200, statusText: '' }, 60_000);
    invalidateKaceResponseCacheForCases(['123']);
    expect(kaceResponseCacheGet(k1)).toBeNull();
  });

  it('clearKaceResponseCache clears all entries', () => {
    const k1 = buildKaceResponseCacheKey('t1', 'GET', '/a', null, null);
    kaceResponseCacheSet(k1, { data: {}, status: 200, statusText: '' }, 60_000);
    clearKaceResponseCache();
    expect(kaceResponseCacheGet(k1)).toBeNull();
  });

  it('stableStringify still works (re-exported)', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe('{"a":1,"b":2}');
  });
});
