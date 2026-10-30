import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearKaceSessionTokensBundle,
  getKaceSessionTokensBundle,
  SessionStorageCache,
} from './sessionStorageCache.js';

vi.mock('./storeService.js', () => ({
  storeService: {
    get: vi.fn((path) => {
      if (path === 'auth.tenant_id') return 'tenant1';
      if (path === 'config.selected_group_id') return 'group1';
      return undefined;
    }),
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SessionStorageCache.peek', () => {
  it('returns value when expiresAt is null', () => {
    SessionStorageCache.set('ns', 'p1', { a: 1 }, null);
    expect(SessionStorageCache.peek('ns', 'p1')).toEqual({ a: 1 });
  });

  it('returns null when numeric TTL expired', () => {
    SessionStorageCache.set('ns', 'p2', { b: 2 }, 1000);
    vi.setSystemTime(new Date('2026-01-01T00:00:02.000Z'));
    expect(SessionStorageCache.peek('ns', 'p2')).toBeNull();
  });
});

describe('getKaceSessionTokensBundle', () => {
  it('migrates legacy auth.session_tokens into namespaced storage', () => {
    sessionStorage.setItem(
      'auth.session_tokens',
      JSON.stringify({ 'auth.refresh_token': 'rt1' })
    );
    const bundle = getKaceSessionTokensBundle();
    expect(bundle).toEqual({ 'auth.refresh_token': 'rt1' });
    expect(sessionStorage.getItem('auth.session_tokens')).toBeNull();
    expect(
      sessionStorage.getItem('kace:tenant1:session-tokens:bundle')
    ).toBeTruthy();
  });

  it('clearKaceSessionTokensBundle removes namespaced and legacy keys', () => {
    SessionStorageCache.set(
      'session-tokens',
      'bundle',
      { 'auth.id_token': 'x' },
      null
    );
    sessionStorage.setItem('auth.session_tokens', '{}');
    clearKaceSessionTokensBundle();
    expect(
      sessionStorage.getItem('kace:tenant1:session-tokens:bundle')
    ).toBeNull();
    expect(sessionStorage.getItem('auth.session_tokens')).toBeNull();
  });
});

describe('SessionStorageCache.set / get (cache hit)', () => {
  it('returns cached value before TTL expires', async () => {
    SessionStorageCache.set('ns', 'k1', { result: 42 }, 60_000);

    const fetcher = vi.fn().mockResolvedValue({ result: 99 });
    const value = await SessionStorageCache.get('ns', 'k1', fetcher, 60_000);

    expect(value).toEqual({ result: 42 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('includes tenantId and groupId in the sessionStorage key', () => {
    SessionStorageCache.set('ns', 'k1', { x: 1 }, 60_000);

    const keys = Object.keys(sessionStorage);
    expect(keys).toContain('kace:tenant1:ns:k1');
  });

  it('does NOT write when ttl is 0', () => {
    SessionStorageCache.set('ns', 'zero-ttl', { x: 1 }, 0);
    expect(sessionStorage.getItem('kace:tenant1:ns:zero-ttl')).toBeNull();
  });

  it('does NOT write when ttl is negative', () => {
    SessionStorageCache.set('ns', 'neg-ttl', { x: 1 }, -100);
    expect(sessionStorage.getItem('kace:tenant1:ns:neg-ttl')).toBeNull();
  });

  it('still writes when ttl is null (no expiry, for tokens)', () => {
    SessionStorageCache.set('ns', 'null-ttl', { x: 1 }, null);
    expect(sessionStorage.getItem('kace:tenant1:ns:null-ttl')).not.toBeNull();
  });
});

describe('SessionStorageCache.get (cache miss)', () => {
  it('calls fetcher and caches result when no entry exists', async () => {
    const fetcher = vi.fn().mockResolvedValue({ fresh: true });
    const value = await SessionStorageCache.get('ns', 'k2', fetcher, 60_000);

    expect(value).toEqual({ fresh: true });
    expect(fetcher).toHaveBeenCalledTimes(1);

    const raw = sessionStorage.getItem('kace:tenant1:ns:k2');
    expect(JSON.parse(raw).value).toEqual({ fresh: true });
  });

  it('calls fetcher and caches result when entry is expired', async () => {
    sessionStorage.setItem(
      'kace:tenant1:ns:k3',
      JSON.stringify({ value: { old: true }, expiresAt: Date.now() - 1 })
    );

    const fetcher = vi.fn().mockResolvedValue({ new: true });
    const value = await SessionStorageCache.get('ns', 'k3', fetcher, 60_000);

    expect(value).toEqual({ new: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('returns null when fetcher is null and there is no valid entry', async () => {
    const value = await SessionStorageCache.get('ns', 'missing', null, 60_000);
    expect(value).toBeNull();
  });
});

describe('SessionStorageCache.invalidate', () => {
  it('removes the specific entry', () => {
    SessionStorageCache.set('ns', 'k4', { x: 1 }, 60_000);
    expect(sessionStorage.getItem('kace:tenant1:ns:k4')).not.toBeNull();

    SessionStorageCache.invalidate('ns', 'k4');
    expect(sessionStorage.getItem('kace:tenant1:ns:k4')).toBeNull();
  });
});

describe('SessionStorageCache.clear', () => {
  it('removes all kace: entries and leaves other keys intact', () => {
    SessionStorageCache.set('ns1', 'a', { x: 1 }, 60_000);
    SessionStorageCache.set('ns2', 'b', { y: 2 }, 60_000);
    sessionStorage.setItem('other-app-key', 'keep-me');

    SessionStorageCache.clear();

    expect(sessionStorage.getItem('kace:tenant1:ns1:a')).toBeNull();
    expect(sessionStorage.getItem('kace:tenant1:ns2:b')).toBeNull();
    expect(sessionStorage.getItem('other-app-key')).toBe('keep-me');
  });
});

describe('SessionStorageCache — handles corrupted entries gracefully', () => {
  it('treats invalid JSON as a cache miss', async () => {
    sessionStorage.setItem('kace:tenant1:ns:bad', 'not-json');
    const fetcher = vi.fn().mockResolvedValue({ recovered: true });

    const value = await SessionStorageCache.get('ns', 'bad', fetcher, 60_000);
    expect(value).toEqual({ recovered: true });
  });
});
