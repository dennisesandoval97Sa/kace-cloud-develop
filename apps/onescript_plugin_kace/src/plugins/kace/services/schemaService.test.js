import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SchemaService } from './schemaService.js';
import { KaceHttpCache } from '../utils/kaceHttpCache.js';

const storeGet = vi.fn((path) => {
  if (path === 'auth.tenant_id') return 'tenant1';
  if (path === 'config.selected_group_id') return 'group1';
  if (path === 'config.global_config') {
    return {
      behaviors: {
        application: {
          agente: { onescript: { onescript_cache_ttl_ms: 60_000 } },
        },
      },
    };
  }
  return undefined;
});

vi.mock('./storeService.js', () => ({
  storeService: {
    get: (...args) => storeGet(...args),
  },
}));

const mockApiService = { post: vi.fn() };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  localStorage.clear();
  KaceHttpCache.resetIndex();
  vi.clearAllMocks();
  storeGet.mockImplementation((path) => {
    if (path === 'auth.tenant_id') return 'tenant1';
    if (path === 'config.selected_group_id') return 'group1';
    if (path === 'config.global_config') {
      return {
        behaviors: {
          application: {
            agente: { onescript: { onescript_cache_ttl_ms: 60_000 } },
          },
        },
      };
    }
    return undefined;
  });
});

afterEach(() => {
  vi.useRealTimers();
  KaceHttpCache.resetIndex();
});

describe('SchemaService.fetchRulesSearch — KaceHttpCache-backed', () => {
  it('calls the API on first fetch and caches in localStorage', async () => {
    const rules = [{ id: 1 }];
    mockApiService.post.mockResolvedValueOnce({ data: rules, status: 200 });

    const service = new SchemaService({
      apiService: mockApiService,
      store: {},
    });
    const result = await service.fetchRulesSearch({ body: { filter: 'a' } });

    expect(result).toEqual(rules);
    expect(mockApiService.post).toHaveBeenCalledTimes(1);
  });

  it('returns cached result on second call without hitting the API', async () => {
    const rules = [{ id: 2 }];
    mockApiService.post.mockResolvedValueOnce({ data: rules, status: 200 });

    const service = new SchemaService({
      apiService: mockApiService,
      store: {},
    });
    const body = { filter: 'b' };

    await service.fetchRulesSearch({ body });
    const second = await service.fetchRulesSearch({ body });

    expect(second).toEqual(rules);
    expect(mockApiService.post).toHaveBeenCalledTimes(1);
  });

  it('respects TTL — re-fetches after expiry', async () => {
    storeGet.mockImplementation((path) => {
      if (path === 'auth.tenant_id') return 'tenant1';
      if (path === 'config.global_config') {
        return {
          behaviors: {
            application: {
              agente: { onescript: { onescript_cache_ttl_ms: 999 } },
            },
          },
        };
      }
      return undefined;
    });

    const rules = [{ id: 3 }];
    mockApiService.post.mockResolvedValueOnce({ data: rules, status: 200 });

    const service = new SchemaService({
      apiService: mockApiService,
      store: {},
    });
    await service.fetchRulesSearch({ body: { filter: 'c' } });

    vi.setSystemTime(new Date('2026-01-01T00:00:01.001Z'));
    mockApiService.post.mockResolvedValueOnce({
      data: [{ id: 4 }],
      status: 200,
    });
    const third = await service.fetchRulesSearch({ body: { filter: 'c' } });

    expect(mockApiService.post).toHaveBeenCalledTimes(2);
    expect(third).toEqual([{ id: 4 }]);
  });

  it('does NOT cache when TTL is 0', async () => {
    storeGet.mockImplementation((path) => {
      if (path === 'auth.tenant_id') return 'tenant1';
      if (path === 'config.global_config') {
        return {
          behaviors: {
            application: {
              agente: { onescript: { onescript_cache_ttl_ms: 0 } },
            },
          },
        };
      }
      return undefined;
    });

    const rules = [{ id: 5 }];
    mockApiService.post.mockResolvedValue({ data: rules, status: 200 });

    const service = new SchemaService({
      apiService: mockApiService,
      store: {},
    });
    await service.fetchRulesSearch({ body: { filter: 'd' } });

    const body = { filter: 'd' };
    const second = await service.fetchRulesSearch({ body });

    expect(mockApiService.post).toHaveBeenCalledTimes(2);
    expect(second).toEqual(rules);
  });
});
