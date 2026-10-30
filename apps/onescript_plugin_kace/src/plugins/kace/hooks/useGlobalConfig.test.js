import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGlobalConfig } from './useGlobalConfig.js';

vi.mock('../KaceEngine', () => ({
  KaceEngine: () => ({
    getService: () => ({
      get: () => true,
    }),
  }),
}));

describe('useGlobalConfig', () => {
  it('da de baja el listener kaceAuthData al desmontar', () => {
    const listeners = new Map();
    const onEvent = vi.fn((name, handler) => {
      listeners.set(name, handler);
    });
    const offEvent = vi.fn((name, handler) => {
      if (listeners.get(name) === handler) listeners.delete(name);
    });

    const { unmount } = renderHook(() =>
      useGlobalConfig(onEvent, 'config.allow_case_reclassification', offEvent)
    );

    expect(onEvent).toHaveBeenCalledWith('kaceAuthData', expect.any(Function));
    const handler = onEvent.mock.calls[0][1];

    unmount();

    expect(offEvent).toHaveBeenCalledWith('kaceAuthData', handler);
  });
});
