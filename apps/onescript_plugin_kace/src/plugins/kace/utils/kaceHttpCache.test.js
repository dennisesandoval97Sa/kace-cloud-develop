import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KaceHttpCache, buildKaceHttpCacheKey } from './kaceHttpCache.js';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  localStorage.clear();
  KaceHttpCache.resetIndex();
});

afterEach(() => {
  vi.useRealTimers();
  KaceHttpCache.resetIndex();
});

describe('buildKaceHttpCacheKey', () => {
  it('builds a key from tenant + method + url + params', () => {
    const key = buildKaceHttpCacheKey(
      'tenant1',
      'GET',
      '/cases',
      { id: 1 },
      null
    );
    expect(key).toContain('tenant1');
    expect(key).toContain('GET');
    expect(key).toContain('/cases');
  });

  it('builds different keys for different params', () => {
    const a = buildKaceHttpCacheKey('t1', 'GET', '/cases', { id: 1 }, null);
    const b = buildKaceHttpCacheKey('t1', 'GET', '/cases', { id: 2 }, null);
    expect(a).not.toBe(b);
  });
});

describe('KaceHttpCache.set / get', () => {
  it('writes and reads an entry when ttl > 0', () => {
    const key = buildKaceHttpCacheKey('t1', 'GET', '/cases', null, null);
    const snapshot = { data: { items: [1, 2] }, status: 200, statusText: 'OK' };
    KaceHttpCache.set(key, snapshot, 60_000);

    const hit = KaceHttpCache.get(key);
    expect(hit).not.toBeNull();
    expect(hit.data).toEqual({ items: [1, 2] });
    expect(hit.status).toBe(200);
  });

  it('does NOT write when ttl <= 0', () => {
    const key = buildKaceHttpCacheKey('t1', 'GET', '/cases', null, null);
    const snapshot = { data: { items: [] }, status: 200, statusText: 'OK' };
    KaceHttpCache.set(key, snapshot, 0);

    expect(KaceHttpCache.get(key)).toBeNull();
    expect(KaceHttpCache.set(key, snapshot, -1)).toBeUndefined();
    expect(KaceHttpCache.get(key)).toBeNull();
  });

  it('returns null when entry is expired', () => {
    const key = buildKaceHttpCacheKey('t1', 'GET', '/cases', null, null);
    const snapshot = { data: { x: 1 }, status: 200, statusText: 'OK' };
    KaceHttpCache.set(key, snapshot, 1000);

    vi.setSystemTime(new Date('2026-01-01T00:00:02.000Z'));
    expect(KaceHttpCache.get(key)).toBeNull();
  });

  it('returns a deep clone of the cached data', () => {
    const key = buildKaceHttpCacheKey('t1', 'GET', '/cases', null, null);
    const snapshot = { data: { items: [1] }, status: 200, statusText: 'OK' };
    KaceHttpCache.set(key, snapshot, 60_000);

    const hit = KaceHttpCache.get(key);
    hit.data.items.push(2);

    const hit2 = KaceHttpCache.get(key);
    expect(hit2.data.items).toEqual([1]);
  });

  it('clones the response on set so later mutation of the original is isolated', () => {
    const key = buildKaceHttpCacheKey('t1', 'GET', '/cases', null, null);
    const response = { data: { items: [1] }, status: 200, statusText: 'OK' };
    KaceHttpCache.set(key, response, 60_000);

    // mutate the original object after set
    response.data.items.push(99);
    response.status = 500;

    const hit = KaceHttpCache.get(key);
    expect(hit.data.items).toEqual([1]);
    expect(hit.status).toBe(200);
  });
});

describe('KaceHttpCache.clear', () => {
  it('removes all kace:http: entries', () => {
    const k1 = buildKaceHttpCacheKey('t1', 'GET', '/a', null, null);
    const k2 = buildKaceHttpCacheKey('t1', 'GET', '/b', null, null);
    KaceHttpCache.set(k1, { data: {}, status: 200, statusText: '' }, 60_000);
    KaceHttpCache.set(k2, { data: {}, status: 200, statusText: '' }, 60_000);

    KaceHttpCache.clear();

    expect(KaceHttpCache.get(k1)).toBeNull();
    expect(KaceHttpCache.get(k2)).toBeNull();
  });

  it('leaves non-kace keys intact', () => {
    localStorage.setItem('other-key', 'keep-me');
    const k1 = buildKaceHttpCacheKey('t1', 'GET', '/a', null, null);
    KaceHttpCache.set(k1, { data: {}, status: 200, statusText: '' }, 60_000);

    KaceHttpCache.clear();

    expect(localStorage.getItem('other-key')).toBe('keep-me');
  });
});

describe('KaceHttpCache.invalidateForCases', () => {
  it('removes entries whose URL references any of the given case ids', () => {
    const k1 = buildKaceHttpCacheKey(
      't1',
      'GET',
      '/cases/123/transitions',
      null,
      null
    );
    const k2 = buildKaceHttpCacheKey(
      't1',
      'GET',
      '/cases/456/transitions',
      null,
      null
    );
    const k3 = buildKaceHttpCacheKey('t1', 'GET', '/other', null, null);
    KaceHttpCache.set(k1, { data: {}, status: 200, statusText: '' }, 60_000);
    KaceHttpCache.set(k2, { data: {}, status: 200, statusText: '' }, 60_000);
    KaceHttpCache.set(k3, { data: {}, status: 200, statusText: '' }, 60_000);

    KaceHttpCache.invalidateForCases(['123']);

    expect(KaceHttpCache.get(k1)).toBeNull();
    expect(KaceHttpCache.get(k2)).not.toBeNull();
    expect(KaceHttpCache.get(k3)).not.toBeNull();
  });

  it('invalidates /aux-cases/:id entries', () => {
    const k = buildKaceHttpCacheKey('t1', 'GET', '/aux-cases/123', null, null);
    const other = buildKaceHttpCacheKey(
      't1',
      'GET',
      '/aux-cases/456',
      null,
      null
    );
    KaceHttpCache.set(k, { data: {}, status: 200, statusText: '' }, 60_000);
    KaceHttpCache.set(other, { data: {}, status: 200, statusText: '' }, 60_000);

    KaceHttpCache.invalidateForCases(['123']);

    expect(KaceHttpCache.get(k)).toBeNull();
    expect(KaceHttpCache.get(other)).not.toBeNull();
  });

  it('invalidates /case-descriptions/:id entries', () => {
    const k = buildKaceHttpCacheKey(
      't1',
      'GET',
      '/case-descriptions/123',
      null,
      null
    );
    KaceHttpCache.set(k, { data: {}, status: 200, statusText: '' }, 60_000);

    KaceHttpCache.invalidateForCases(['123']);

    expect(KaceHttpCache.get(k)).toBeNull();
  });

  it('invalidates /case-available-states/:id entries', () => {
    const k = buildKaceHttpCacheKey(
      't1',
      'GET',
      '/case-available-states/123',
      null,
      null
    );
    KaceHttpCache.set(k, { data: {}, status: 200, statusText: '' }, 60_000);

    KaceHttpCache.invalidateForCases(['123']);

    expect(KaceHttpCache.get(k)).toBeNull();
  });

  it('invalidates /case-transitions/:id entries', () => {
    const k = buildKaceHttpCacheKey(
      't1',
      'GET',
      '/case-transitions/123',
      null,
      null
    );
    KaceHttpCache.set(k, { data: {}, status: 200, statusText: '' }, 60_000);

    KaceHttpCache.invalidateForCases(['123']);

    expect(KaceHttpCache.get(k)).toBeNull();
  });

  it('does nothing when caseIds is empty', () => {
    const k = buildKaceHttpCacheKey(
      't1',
      'GET',
      '/cases/123/transitions',
      null,
      null
    );
    KaceHttpCache.set(k, { data: {}, status: 200, statusText: '' }, 60_000);

    KaceHttpCache.invalidateForCases([]);

    expect(KaceHttpCache.get(k)).not.toBeNull();
  });
});

describe('KaceHttpCache LRU by size', () => {
  it('evicts oldest entries when size limit is exceeded', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    KaceHttpCache.setMaxBytes(2_000);

    const bigResponse = {
      data: { items: 'x'.repeat(600) },
      status: 200,
      statusText: '',
    };

    const k1 = buildKaceHttpCacheKey('t1', 'GET', '/a', null, null);
    KaceHttpCache.set(k1, bigResponse, 60_000);

    vi.setSystemTime(new Date('2026-01-01T00:00:01.000Z'));
    const k2 = buildKaceHttpCacheKey('t1', 'GET', '/b', null, null);
    KaceHttpCache.set(k2, bigResponse, 60_000);

    vi.setSystemTime(new Date('2026-01-01T00:00:02.000Z'));
    const k3 = buildKaceHttpCacheKey('t1', 'GET', '/c', null, null);
    KaceHttpCache.set(k3, bigResponse, 60_000);

    expect(KaceHttpCache.get(k1)).toBeNull();
    expect(KaceHttpCache.get(k2)).not.toBeNull();
    expect(KaceHttpCache.get(k3)).not.toBeNull();
  });

  it('evicts least-recently-used, not oldest-inserted (LRU not FIFO)', () => {
    KaceHttpCache.setMaxBytes(2_000);

    const bigResponse = {
      data: { items: 'x'.repeat(600) },
      status: 200,
      statusText: '',
    };

    const k1 = buildKaceHttpCacheKey('t1', 'GET', '/a', null, null);
    KaceHttpCache.set(k1, bigResponse, 60_000);

    vi.setSystemTime(new Date('2026-01-01T00:00:01.000Z'));
    const k2 = buildKaceHttpCacheKey('t1', 'GET', '/b', null, null);
    KaceHttpCache.set(k2, bigResponse, 60_000);

    // rescue k1 — makes k2 the least-recently-used
    vi.setSystemTime(new Date('2026-01-01T00:00:02.000Z'));
    KaceHttpCache.get(k1);

    vi.setSystemTime(new Date('2026-01-01T00:00:03.000Z'));
    const k3 = buildKaceHttpCacheKey('t1', 'GET', '/c', null, null);
    KaceHttpCache.set(k3, bigResponse, 60_000);

    // k2 was least-recently-used → evicted; k1 was rescued → survives
    expect(KaceHttpCache.get(k2)).toBeNull();
    expect(KaceHttpCache.get(k1)).not.toBeNull();
    expect(KaceHttpCache.get(k3)).not.toBeNull();
  });

  it('does not flush the cache when a single entry exceeds maxBytes', () => {
    KaceHttpCache.setMaxBytes(2_000);

    const smallResponse = {
      data: { items: 'x'.repeat(100) },
      status: 200,
      statusText: '',
    };
    const hugeResponse = {
      data: { items: 'x'.repeat(5_000) },
      status: 200,
      statusText: '',
    };

    const k1 = buildKaceHttpCacheKey('t1', 'GET', '/small', null, null);
    KaceHttpCache.set(k1, smallResponse, 60_000);

    const kHuge = buildKaceHttpCacheKey('t1', 'GET', '/huge', null, null);
    KaceHttpCache.set(kHuge, hugeResponse, 60_000);

    // oversized entry is rejected, existing entries survive
    expect(KaceHttpCache.get(kHuge)).toBeNull();
    expect(KaceHttpCache.get(k1)).not.toBeNull();
  });
});
