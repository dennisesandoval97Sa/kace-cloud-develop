import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedStableTerm } from './useDebouncedStableTerm.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedStableTerm', () => {
  it('mirrors value immediately when disabled', () => {
    const { result, rerender } = renderHook(
      ({ value, enabled }) => useDebouncedStableTerm(value, 100, enabled),
      { initialProps: { value: 'a', enabled: false } }
    );
    expect(result.current).toBe('a');
    rerender({ value: 'b', enabled: false });
    expect(result.current).toBe('b');
  });

  it('debounces when enabled', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedStableTerm(value, 100, true),
      { initialProps: { value: 'a' } }
    );
    expect(result.current).toBe('a');
    rerender({ value: 'b' });
    expect(result.current).toBe('a');
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('b');
  });
});
