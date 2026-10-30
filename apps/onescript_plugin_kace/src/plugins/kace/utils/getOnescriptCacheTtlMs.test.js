import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getOnescriptCacheTtlMs } from './getOnescriptCacheTtlMs.js';
import { writeTtl, clearTtl } from './kaceCacheTtlStore.js';

beforeEach(() => {
  localStorage.clear();
  clearTtl();
});

afterEach(() => {
  localStorage.clear();
  clearTtl();
});

function makeStore(globalConfig) {
  return {
    get: (path) => (path === 'config.global_config' ? globalConfig : undefined),
  };
}

describe('getOnescriptCacheTtlMs', () => {
  it('returns onescript_cache_ttl_ms from global config', () => {
    const store = makeStore({
      behaviors: {
        application: {
          agente: { onescript: { onescript_cache_ttl_ms: 300_000 } },
        },
      },
    });
    expect(getOnescriptCacheTtlMs(store)).toBe(300_000);
  });

  it('returns 0 when global config is missing', () => {
    expect(getOnescriptCacheTtlMs({ get: () => undefined })).toBe(0);
  });

  it('returns 0 when onescript_cache_ttl_ms is 0', () => {
    const store = makeStore({
      behaviors: {
        application: {
          agente: { onescript: { onescript_cache_ttl_ms: 0 } },
        },
      },
    });
    expect(getOnescriptCacheTtlMs(store)).toBe(0);
  });

  it('falls back to kaceCacheTtlStore when config.global_config is absent from store', () => {
    writeTtl(500_000, 'sig-abc');
    const store = { get: () => undefined };
    expect(getOnescriptCacheTtlMs(store)).toBe(500_000);
  });

  it('returns 0 when neither config nor kaceCacheTtlStore has a TTL', () => {
    const store = { get: () => undefined };
    expect(getOnescriptCacheTtlMs(store)).toBe(0);
  });

  it('ignores legacy onescript_auth_cognito_cache_ttl_ms key (no 3-key fallback)', () => {
    const store = makeStore({
      behaviors: {
        application: {
          agente: {
            onescript: { onescript_auth_cognito_cache_ttl_ms: 1_740_000 },
          },
        },
      },
    });
    expect(getOnescriptCacheTtlMs(store)).toBe(0);
  });

  it('returns 0 for invalid (negative) TTL in config', () => {
    const store = makeStore({
      behaviors: {
        application: {
          agente: { onescript: { onescript_cache_ttl_ms: -1 } },
        },
      },
    });
    expect(getOnescriptCacheTtlMs(store)).toBe(0);
  });
});
