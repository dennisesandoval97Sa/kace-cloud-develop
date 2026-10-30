import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigurationService } from './configurationService.js';
import {
  KaceHttpCache,
  buildKaceHttpCacheKey,
} from '../utils/kaceHttpCache.js';
import {
  readTtl,
  readSignature,
  clearTtl,
} from '../utils/kaceCacheTtlStore.js';
import { SessionStorageCache } from './sessionStorageCache.js';

const storeData = {};
const storeSet = vi.fn((path, value) => {
  storeData[path] = value;
});
const storeGet = vi.fn((path) => {
  if (path in storeData) return storeData[path];
  if (path === 'auth.tenant_id') return 'tenant1';
  if (path === 'configuration_id_selected_group') return 'cfg-1';
  return undefined;
});

vi.mock('./storeService.js', () => ({
  storeService: {
    get: (...args) => storeGet(...args),
    set: (...args) => storeSet(...args),
  },
}));

beforeEach(() => {
  for (const key of Object.keys(storeData)) delete storeData[key];
  localStorage.clear();
  sessionStorage.clear();
  KaceHttpCache.resetIndex();
  clearTtl();
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  KaceHttpCache.resetIndex();
  clearTtl();
});

describe('ConfigurationService.fetchGlobalConfig — cache invalidation on config change', () => {
  it('clears KaceHttpCache and auth-cognito when config signature changes', async () => {
    const httpKey = buildKaceHttpCacheKey('t1', 'GET', '/cases', null, null);
    KaceHttpCache.set(
      httpKey,
      { data: { x: 1 }, status: 200, statusText: '' },
      60_000
    );
    SessionStorageCache.set(
      'auth-cognito',
      'default',
      { data: { user: 'old' } },
      60_000
    );

    const newSettings = {
      behaviors: {
        application: {
          agente: { onescript: { onescript_cache_ttl_ms: 120_000 } },
        },
      },
    };
    const mockApi = {
      get: vi.fn().mockResolvedValue({
        status: 200,
        data: { data: { settings: newSettings } },
      }),
    };
    const mockUserService = {
      get: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ConfigurationService({
      apiService: mockApi,
      userService: mockUserService,
      store: {},
      emitEvent: vi.fn(),
    });

    await service.fetchGlobalConfig();

    expect(KaceHttpCache.get(httpKey)).toBeNull();
    expect(SessionStorageCache.peek('auth-cognito', 'default')).toBeNull();
    expect(readTtl()).toBe(120_000);
    expect(readSignature()).toBeTruthy();
  });

  it('does NOT invalidate when signature is the same', async () => {
    const settings = {
      behaviors: {
        application: {
          agente: { onescript: { onescript_cache_ttl_ms: 60_000 } },
        },
      },
    };

    const httpKey = buildKaceHttpCacheKey('t1', 'GET', '/cases', null, null);

    const mockApi = {
      get: vi.fn().mockResolvedValue({
        status: 200,
        data: { data: { settings } },
      }),
    };
    const mockUserService = { get: vi.fn().mockResolvedValue(undefined) };

    const service = new ConfigurationService({
      apiService: mockApi,
      userService: mockUserService,
      store: {},
      emitEvent: vi.fn(),
    });

    await service.fetchGlobalConfig();

    KaceHttpCache.set(
      httpKey,
      { data: { x: 1 }, status: 200, statusText: '' },
      60_000
    );

    mockApi.get.mockResolvedValueOnce({
      status: 200,
      data: { data: { settings } },
    });
    await service.fetchGlobalConfig();
    expect(KaceHttpCache.get(httpKey)).not.toBeNull();
  });
});
