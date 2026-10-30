import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetTokens = vi.fn();
const mockStoreSet = vi.fn();

vi.mock('../KaceEngine.js', () => ({
  KaceEngine: () => ({
    getService: (name) => {
      if (name === 'authService') {
        return { setTokens: mockSetTokens };
      }
      return null;
    },
  }),
}));

vi.mock('#plugins/kace/services/storeService.js', () => ({
  storeService: {
    set: (...args) => mockStoreSet(...args),
    get: vi.fn(),
  },
}));

vi.mock('#plugins/kace/services/sessionStorageCache.js', () => ({
  mergeKaceSessionTokensBundle: vi.fn(),
}));

import { mergeKaceSessionTokensBundle } from '#plugins/kace/services/sessionStorageCache.js';
import {
  applyTokensFromParentPayload,
  requestReinitFromParent,
} from '../shared/kaceParentTokenBridge.js';
import { useKaceTokenSync } from './useKaceTokenSync.hook.js';

beforeEach(() => {
  vi.stubGlobal('parent', { postMessage: vi.fn() });
  mockSetTokens.mockClear();
  mockStoreSet.mockClear();
  mergeKaceSessionTokensBundle.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useKaceTokenSync', () => {
  it('does nothing when enabled is false', () => {
    renderHook(() => useKaceTokenSync(false));

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window.parent,
          data: {
            type: 'KACE_TOKENS_UPDATED',
            tokens: { id_token: 'id' },
            refresh_token: 'rt',
          },
        })
      );
    });

    expect(mockSetTokens).not.toHaveBeenCalled();
  });

  it('applies KACE_TOKENS_UPDATED from parent', () => {
    renderHook(() => useKaceTokenSync(true));

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window.parent,
          data: {
            type: 'KACE_TOKENS_UPDATED',
            tokens: {
              id_token: 'id-tok',
              access_token: 'acc-tok',
              token_type: 'Bearer',
              expires_in: 3600,
            },
            refresh_token: 'rt-new',
          },
        })
      );
    });

    expect(mockSetTokens).toHaveBeenCalledWith({
      accessToken: 'acc-tok',
      refreshToken: 'rt-new',
      idToken: 'id-tok',
      tokenType: 'Bearer',
      expiresIn: 3600,
    });
    expect(mockStoreSet).toHaveBeenCalledWith('auth.refresh_token', 'rt-new');
    expect(mergeKaceSessionTokensBundle).toHaveBeenCalledWith(
      expect.objectContaining({ 'auth.refresh_token': 'rt-new' })
    );
  });

  it('ignores KACE_TOKENS_UPDATED from non-parent source', () => {
    renderHook(() => useKaceTokenSync(true));

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'KACE_TOKENS_UPDATED',
            tokens: { id_token: 'id' },
            refresh_token: 'rt',
          },
        })
      );
    });

    expect(mockSetTokens).not.toHaveBeenCalled();
  });

  it('requestReinit posts KACE_REINIT_REQUEST and applies KACE_REINIT_RESPONSE', async () => {
    renderHook(() => useKaceTokenSync(true));

    const reinitPromise = requestReinitFromParent();

    const requestId = window.parent.postMessage.mock.calls[0][0].requestId;
    expect(window.parent.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'KACE_REINIT_REQUEST',
        requestId: expect.any(String),
      }),
      '*'
    );

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: window.parent,
          data: {
            type: 'KACE_REINIT_RESPONSE',
            requestId,
            params: { refresh_token: 'rt-reinit' },
            tokens: {
              id_token: 'id-reinit',
              access_token: 'acc-reinit',
              token_type: 'Bearer',
              expires_in: 7200,
            },
          },
        })
      );
    });

    await expect(reinitPromise).resolves.toBeUndefined();

    expect(mockSetTokens).toHaveBeenCalledWith({
      accessToken: 'acc-reinit',
      refreshToken: 'rt-reinit',
      idToken: 'id-reinit',
      tokenType: 'Bearer',
      expiresIn: 7200,
    });
    expect(mockStoreSet).toHaveBeenCalledWith(
      'auth.refresh_token',
      'rt-reinit'
    );
  });

  it('requestReinit rejects on timeout', async () => {
    vi.useFakeTimers();
    renderHook(() => useKaceTokenSync(true));

    const expectation = expect(requestReinitFromParent()).rejects.toThrow(
      'timeout'
    );

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    await expectation;
  });

  it('clears bridge handlers on unmount', () => {
    const { unmount } = renderHook(() => useKaceTokenSync(true));
    unmount();

    applyTokensFromParentPayload({
      tokens: { id_token: 'x' },
      refresh_token: 'rt',
    });

    expect(mockSetTokens).not.toHaveBeenCalled();
  });
});
