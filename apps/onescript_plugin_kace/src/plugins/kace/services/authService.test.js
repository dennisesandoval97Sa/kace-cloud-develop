import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAxiosPost = vi.fn();

vi.mock('axios', () => ({
  default: {
    post: (...args) => mockAxiosPost(...args),
    create: vi.fn(() => ({
      post: (...args) => mockAxiosPost(...args),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

vi.mock('#plugins/kace/utils/oauthRefreshFatalOverlay.js', () => ({
  showOAuthRefreshFatalOverlay: vi.fn(),
}));

const mockIsEmbeddedInKace = vi.fn();
const mockWaitForValidTokenFromParent = vi.fn();
const mockRequestReinitFromParent = vi.fn();

vi.mock('#plugins/kace/shared/kaceParentTokenBridge.js', () => ({
  isEmbeddedInKace: () => mockIsEmbeddedInKace(),
  waitForValidTokenFromParent: (...args) =>
    mockWaitForValidTokenFromParent(...args),
  requestReinitFromParent: () => mockRequestReinitFromParent(),
}));

import { AuthService } from './authService.js';

function makeIdToken(expOffsetMs) {
  const exp = Math.floor((Date.now() + expOffsetMs) / 1000);
  const payload = btoa(JSON.stringify({ exp }));
  return `e30.${payload}.sig`;
}

function createAuthService(overrides = {}) {
  return new AuthService({
    apiUrl: 'https://api.example.com',
    clientId: 'client',
    tenantId: 'tenant',
    fingerprint: 'fp',
    cognitoClientId: 'cognito-client',
    cognitoUrl: 'https://cognito.example.com',
    refreshToken: 'refresh-token',
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockIsEmbeddedInKace.mockReturnValue(false);
  mockWaitForValidTokenFromParent.mockResolvedValue(undefined);
  mockRequestReinitFromParent.mockResolvedValue(undefined);
  mockAxiosPost.mockResolvedValue({
    status: 200,
    data: {
      id_token: makeIdToken(3600_000),
      access_token: 'access-token',
      token_type: 'Bearer',
      expires_in: 3600,
    },
  });
});

describe('AuthService embedded iframe token sync', () => {
  it('validateToken does not call axios.post and calls waitForValidTokenFromParent', async () => {
    mockIsEmbeddedInKace.mockReturnValue(true);
    const service = createAuthService();
    service.idToken = makeIdToken(-60_000);

    mockWaitForValidTokenFromParent.mockImplementation(async () => {
      service.setTokens({
        idToken: makeIdToken(3600_000),
        accessToken: 'parent-access',
        tokenType: 'Bearer',
        expiresIn: 3600,
        refreshToken: 'parent-refresh',
      });
    });

    await service.validateToken();

    expect(mockWaitForValidTokenFromParent).toHaveBeenCalledTimes(1);
    expect(mockWaitForValidTokenFromParent).toHaveBeenCalledWith({
      isValid: expect.any(Function),
      timeoutMs: 2000,
      requestReinit: expect.any(Function),
    });
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });
});

describe('AuthService standalone refresh', () => {
  it('refreshTokenFlow calls axios.post to cognito oauth2/token', async () => {
    mockIsEmbeddedInKace.mockReturnValue(false);
    const service = createAuthService();

    await service.refreshTokenFlow();

    expect(mockWaitForValidTokenFromParent).not.toHaveBeenCalled();
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    expect(mockAxiosPost).toHaveBeenCalledWith(
      'https://cognito.example.com/oauth2/token',
      expect.any(String),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
  });
});
