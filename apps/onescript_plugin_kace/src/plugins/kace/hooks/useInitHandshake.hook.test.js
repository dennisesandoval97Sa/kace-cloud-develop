import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInitHandshake } from './useInitHandshake.hook.js';

const PARENT_ORIGIN = 'https://kace.example.com';

beforeEach(() => {
  vi.stubGlobal('parent', { postMessage: vi.fn() });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useInitHandshake', () => {
  it('sends KACE_INIT_REQUEST to window.parent with wildcard target', () => {
    renderHook(() => useInitHandshake());
    expect(window.parent.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'KACE_INIT_REQUEST',
        requestId: expect.any(String),
      }),
      '*'
    );
  });

  it('starts in pending state', () => {
    const { result } = renderHook(() => useInitHandshake());
    expect(result.current.pending).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('resolves with data when parent responds with matching requestId', async () => {
    const { result } = renderHook(() => useInitHandshake());
    const requestId = window.parent.postMessage.mock.calls[0][0].requestId;

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: PARENT_ORIGIN,
          data: {
            type: 'KACE_INIT_RESPONSE',
            requestId,
            params: { tenant_id: 't1', user_id: 'u1' },
            tokens: { id_token: 'id-tok' },
            authCognitoResponse: { config: true },
          },
        })
      );
    });

    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.data.params.tenant_id).toBe('t1');
    expect(result.current.data.authCognitoResponse).toEqual({ config: true });
  });

  it('resolves when requestId matches regardless of event origin', async () => {
    const { result } = renderHook(() => useInitHandshake());
    const requestId = window.parent.postMessage.mock.calls[0][0].requestId;

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://evil.com',
          data: {
            type: 'KACE_INIT_RESPONSE',
            requestId,
            params: { tenant_id: 't1' },
            tokens: {},
            authCognitoResponse: null,
          },
        })
      );
    });

    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.data.params.tenant_id).toBe('t1');
  });

  it('sets error.message to "timeout" after 10000 ms with no response', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useInitHandshake());

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.pending).toBe(false);
    expect(result.current.error?.message).toBe('timeout');
    expect(result.current.data).toBeNull();
  });

  it('ignores messages with a different requestId', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useInitHandshake());

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: PARENT_ORIGIN,
          data: {
            type: 'KACE_INIT_RESPONSE',
            requestId: 'wrong-id',
            params: {},
            tokens: {},
            authCognitoResponse: null,
          },
        })
      );
    });

    expect(result.current.pending).toBe(true);
  });

  it('ignores messages with wrong type', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useInitHandshake());
    const requestId = window.parent.postMessage.mock.calls[0][0].requestId;

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: PARENT_ORIGIN,
          data: { type: 'SOMETHING_ELSE', requestId, params: {} },
        })
      );
    });

    expect(result.current.pending).toBe(true);
  });
});
