import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionStorageCache } from './sessionStorageCache.js';

vi.mock('./storeService.js', () => ({
  storeService: {
    get: vi.fn((path) => {
      if (path === 'auth.tenant_id') return 'tenant1';
      if (path === 'auth.id_token') return 'idt';
      if (path === 'auth.access_token') return 'act';
      if (path === 'auth.token_type') return 'Bearer';
      if (path === 'auth.refresh_token') return 'rt';
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
    }),
    set: vi.fn(),
  },
}));

describe('UserService.fetchUserData — TTL=0 does not cache', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('does not write auth-cognito cache when TTL is 0', async () => {
    const { UserService } = await import('./userService.js');
    const mockApi = {
      post: vi.fn().mockResolvedValue({
        status: 200,
        data: { data: { user: { id: 'u1' } } },
      }),
      authService: {},
    };
    const service = new UserService({
      apiService: mockApi,
      store: {},
    });

    await service.fetchUserData({
      access_token: 'act',
      expires_in: 3600,
      id_token: 'idt',
      refresh_token: 'rt',
      token_type: 'Bearer',
    });

    const cached = SessionStorageCache.peek('auth-cognito', 'default');
    expect(cached).toBeNull();
  });
});
