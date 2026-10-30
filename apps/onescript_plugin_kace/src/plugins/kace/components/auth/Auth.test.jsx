import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock useInitHandshake — control state from tests
vi.mock('#plugins/kace/hooks/useInitHandshake.hook.js', () => ({
  useInitHandshake: vi.fn(),
}));

// Mock heavy dependencies so Auth.jsx can be imported
vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: vi.fn(() => ({
    initSession: vi.fn().mockResolvedValue(undefined),
    hydrateExistingCase: vi
      .fn()
      .mockResolvedValue({ auxCaseId: null, auxCaseData: null }),
    getService: vi.fn((name) => {
      if (name === 'user') {
        return { canEditCaseSync: () => true };
      }
      return null;
    }),
  })),
  resetKaceEngineCache: vi.fn(),
  notifyKaceAuthReady: vi.fn(),
}));

vi.mock('#plugins/kace/services/storeService.js', () => ({
  storeService: {
    set: vi.fn(),
    get: vi.fn((path) => (path === 'config.global_config' ? null : null)),
  },
}));

vi.mock('#plugins/kace/hooks/useAuthInteractionReporter.hook.js', () => ({
  useAuthInteractionReporter: vi.fn(),
}));

vi.mock('#plugins/kace/hooks/useKaceTokenSync.hook.js', () => ({
  useKaceTokenSync: vi.fn(),
}));

vi.mock('#plugins/kace/shared/kaceParentTokenBridge.js', () => ({
  setEmbeddedInKace: vi.fn(),
}));

vi.mock('#plugins/kace/components/auth/buildInitialCaseData.js', () => ({
  buildInitialCaseData: vi.fn(() => ({})),
}));

vi.mock('#plugins/kace/shared/KaceData.js', () => ({ default: {} }));
vi.mock('#plugins/kace/env/index.js', () => ({
  VITE_COGNITO_CLIENT_ID: null,
  VITE_COGNITO_URL: null,
  VITE_TENANT_ID: null,
}));

import { useInitHandshake } from '#plugins/kace/hooks/useInitHandshake.hook.js';
import { useKaceTokenSync } from '#plugins/kace/hooks/useKaceTokenSync.hook.js';
import { setEmbeddedInKace } from '#plugins/kace/shared/kaceParentTokenBridge.js';
import { storeService } from '#plugins/kace/services/storeService.js';
import {
  getKaceSessionTokensBundle,
  SessionStorageCache,
} from '#plugins/kace/services/sessionStorageCache.js';
import { Auth } from './Auth.jsx';

const DEFAULT_PROPS = {
  component: { parent_origin: 'https://kace.example.com' },
  emitEvent: vi.fn(),
  handleChange: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('Auth', () => {
  it('renders error UI when handshake times out', () => {
    useInitHandshake.mockReturnValue({
      data: null,
      error: new Error('timeout'),
      pending: false,
    });
    render(<Auth {...DEFAULT_PROPS} />);
    expect(screen.getByText(/no se pudo inicializar/i)).toBeInTheDocument();
  });

  it('marks embedded_in_kace after successful handshake', async () => {
    useInitHandshake.mockReturnValue({
      data: {
        params: {
          tenant_id: 't1',
          user_id: 'u1',
          refresh_token: 'rt',
          fingerprint: 'fp',
          client_id: 'c1',
        },
        tokens: null,
        authCognitoResponse: null,
      },
      error: null,
      pending: false,
    });

    render(<Auth {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(setEmbeddedInKace).toHaveBeenCalledWith(true);
      expect(storeService.set).toHaveBeenCalledWith(
        'auth.embedded_in_kace',
        true
      );
    });

    expect(useKaceTokenSync).toHaveBeenCalledWith(true);
  });

  it('writes session tokens via SessionStorageCache when tokens.id_token present', async () => {
    useInitHandshake.mockReturnValue({
      data: {
        params: {
          tenant_id: 't1',
          user_id: 'u1',
          refresh_token: 'rt',
          fingerprint: 'fp',
          client_id: 'c1',
        },
        tokens: {
          id_token: 'id-tok',
          access_token: 'acc-tok',
          token_type: 'Bearer',
          expires_in: 3600,
        },
        authCognitoResponse: null,
      },
      error: null,
      pending: false,
    });

    render(<Auth {...DEFAULT_PROPS} />);

    await waitFor(() => {
      const stored = getKaceSessionTokensBundle();
      expect(stored).not.toBeNull();
      expect(stored['auth.id_token']).toBe('id-tok');
      expect(stored['auth.access_token']).toBe('acc-tok');
      expect(stored['auth.token_type']).toBe('Bearer');
      expect(stored['auth.expires_in']).toBe('3600');
    });

    expect(storeService.set).toHaveBeenCalledWith('auth.handshake_params', {
      tenant_id: 't1',
      user_id: 'u1',
      refresh_token: 'rt',
      fingerprint: 'fp',
      client_id: 'c1',
    });
  });

  it('writes authCognitoResponse to SessionStorageCache when present', async () => {
    storeService.get.mockImplementation((path) => {
      if (path === 'config.global_config') {
        return {
          behaviors: {
            application: {
              agente: { onescript: { onescript_cache_ttl_ms: 1_740_000 } },
            },
          },
        };
      }
      return null;
    });

    useInitHandshake.mockReturnValue({
      data: {
        params: {
          tenant_id: 't1',
          user_id: 'u1',
          refresh_token: 'rt',
          fingerprint: 'fp',
          client_id: 'c1',
        },
        tokens: {
          id_token: 'id-tok',
          access_token: 'acc',
          token_type: 'Bearer',
          expires_in: 3600,
        },
        authCognitoResponse: { group_id: 'g1', ttl: 1740000 },
      },
      error: null,
      pending: false,
    });

    render(<Auth {...DEFAULT_PROPS} />);

    await waitFor(() => {
      const stored = SessionStorageCache.peek('auth-cognito', 'default');
      expect(stored?.data).toEqual({ group_id: 'g1', ttl: 1740000 });
      expect(stored?.tokenUserId).toBeNull();
    });
  });

  it('clears auth-cognito cache when authCognitoResponse is null', async () => {
    SessionStorageCache.set(
      'auth-cognito',
      'default',
      { data: { old: true } },
      null
    );
    sessionStorage.setItem(
      'auth.auth_cognito_response',
      JSON.stringify({ data: { old: true } })
    );

    useInitHandshake.mockReturnValue({
      data: {
        params: {
          tenant_id: 't1',
          user_id: 'u1',
          refresh_token: 'rt',
          fingerprint: 'fp',
          client_id: 'c1',
        },
        tokens: {
          id_token: 'id-tok',
          access_token: 'acc',
          token_type: 'Bearer',
          expires_in: 3600,
        },
        authCognitoResponse: null,
      },
      error: null,
      pending: false,
    });

    render(<Auth {...DEFAULT_PROPS} />);

    // After init, the old stale cache must be cleared even when authCognitoResponse is null
    await waitFor(() => {
      expect(SessionStorageCache.peek('auth-cognito', 'default')).toBeNull();
      expect(sessionStorage.getItem('auth.auth_cognito_response')).toBeNull();
    });
  });

  it('clears the edit snapshot when Auth unmounts', () => {
    useInitHandshake.mockReturnValue({
      data: null,
      error: new Error('timeout'),
      pending: false,
    });
    const { unmount } = render(<Auth {...DEFAULT_PROPS} />);
    unmount();
    expect(storeService.set).toHaveBeenCalledWith('cases.edit_snapshot', null);
  });
});
