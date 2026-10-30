import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useKaceScriptSelectLoad } from './useKaceScriptSelectLoad.js';

describe('useKaceScriptSelectLoad', () => {
  it('skips second executor when segmented cache hit and refetch off', async () => {
    const executor = vi.fn(async ({ setOptions }) => {
      setOptions([{ label: 'a', value: '1' }]);
    });
    const applyOptions = vi.fn();
    const { result } = renderHook(
      ({ page }) =>
        useKaceScriptSelectLoad({
          componentKey: 'fieldA',
          refetchOnEveryOpen: false,
          segmented: true,
          dependencySignature: 'dep',
          getContext: () => ({ page, remoteTerm: '' }),
          mergeOptionsForDisplay: (x) => x,
          applyOptions,
        }),
      { initialProps: { page: 1 } }
    );
    await act(async () => {
      await result.current.load(executor);
    });
    await act(async () => {
      await result.current.load(executor);
    });
    expect(executor).toHaveBeenCalledTimes(1);
    expect(applyOptions).toHaveBeenCalled();
  });

  it('runs executor again when refetch on every open', async () => {
    const executor = vi.fn(async ({ setOptions }) => {
      setOptions([{ label: 'a', value: '1' }]);
    });
    const { result } = renderHook(() =>
      useKaceScriptSelectLoad({
        componentKey: 'fieldA',
        refetchOnEveryOpen: true,
        segmented: true,
        dependencySignature: '',
        getContext: () => ({ page: 1, remoteTerm: '' }),
        mergeOptionsForDisplay: (x) => x,
        applyOptions: () => {},
      })
    );
    await act(async () => {
      await result.current.load(executor);
    });
    await act(async () => {
      await result.current.load(executor);
    });
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it('merges page 2 into buffer when append flag omitted and segmented', async () => {
    const applyOptions = vi.fn();
    const { result, rerender } = renderHook(
      ({ page }) =>
        useKaceScriptSelectLoad({
          componentKey: 'fieldA',
          refetchOnEveryOpen: false,
          segmented: true,
          dependencySignature: '',
          getContext: () => ({ page, remoteTerm: '' }),
          mergeOptionsForDisplay: (x) => x,
          applyOptions,
        }),
      { initialProps: { page: 1 } }
    );
    await act(async () => {
      await result.current.load(async ({ setOptions }) => {
        setOptions([{ label: 'a', value: '1' }]);
      });
    });
    rerender({ page: 2 });
    await act(async () => {
      await result.current.load(async ({ setOptions }) => {
        setOptions([{ label: 'b', value: '2' }]);
      });
    });
    const last = applyOptions.mock.calls[applyOptions.mock.calls.length - 1][0];
    expect(last.map((o) => String(o.value))).toEqual(['1', '2']);
  });

  it('honors replace on page 2 to drop prior pages from buffer', async () => {
    const applyOptions = vi.fn();
    const { result, rerender } = renderHook(
      ({ page }) =>
        useKaceScriptSelectLoad({
          componentKey: 'fieldA',
          refetchOnEveryOpen: false,
          segmented: true,
          dependencySignature: '',
          getContext: () => ({ page, remoteTerm: '' }),
          mergeOptionsForDisplay: (x) => x,
          applyOptions,
        }),
      { initialProps: { page: 1 } }
    );
    await act(async () => {
      await result.current.load(async ({ setOptions }) => {
        setOptions([{ label: 'a', value: '1' }]);
      });
    });
    rerender({ page: 2 });
    await act(async () => {
      await result.current.load(async ({ setOptions }) => {
        setOptions([{ label: 'z', value: '9' }], { replace: true });
      });
    });
    const last = applyOptions.mock.calls[applyOptions.mock.calls.length - 1][0];
    expect(last.map((o) => String(o.value))).toEqual(['9']);
  });

  it('invokes onInfiniteStall when page adds no new unique options', async () => {
    const onInfiniteStall = vi.fn();
    const { result, rerender } = renderHook(
      ({ page }) =>
        useKaceScriptSelectLoad({
          componentKey: 'fieldA',
          refetchOnEveryOpen: false,
          segmented: true,
          dependencySignature: '',
          getContext: () => ({ page, remoteTerm: '' }),
          mergeOptionsForDisplay: (x) => x,
          applyOptions: () => {},
          onInfiniteStall,
        }),
      { initialProps: { page: 1 } }
    );
    await act(async () => {
      await result.current.load(async ({ setOptions }) => {
        setOptions([{ label: 'a', value: '1' }]);
      });
    });
    rerender({ page: 2 });
    await act(async () => {
      await result.current.load(async ({ setOptions }) => {
        setOptions([{ label: 'a', value: '1' }]);
      });
    });
    expect(onInfiniteStall).toHaveBeenCalledTimes(1);
  });

  it('caches each page independently so repeat visits are cache hits', async () => {
    const executor = vi.fn(async ({ setOptions, kaceSelectPage }) => {
      setOptions([
        { label: `p${kaceSelectPage}`, value: String(kaceSelectPage) },
      ]);
    });
    const { result, rerender } = renderHook(
      ({ page }) =>
        useKaceScriptSelectLoad({
          componentKey: 'fieldA',
          refetchOnEveryOpen: false,
          segmented: true,
          dependencySignature: '',
          getContext: () => ({ page, remoteTerm: '' }),
          mergeOptionsForDisplay: (x) => x,
          applyOptions: () => {},
        }),
      { initialProps: { page: 1 } }
    );
    await act(async () => {
      await result.current.load(executor);
    });
    rerender({ page: 2 });
    await act(async () => {
      await result.current.load(executor);
    });
    expect(executor).toHaveBeenCalledTimes(2);
    rerender({ page: 1 });
    await act(async () => {
      await result.current.load(executor);
    });
    rerender({ page: 2 });
    await act(async () => {
      await result.current.load(executor);
    });
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it('invalidateCache clears hits', async () => {
    const executor = vi.fn(async ({ setOptions }) => {
      setOptions([{ label: 'a', value: '1' }]);
    });
    const { result } = renderHook(() =>
      useKaceScriptSelectLoad({
        componentKey: 'fieldA',
        refetchOnEveryOpen: false,
        segmented: true,
        dependencySignature: '',
        getContext: () => ({ page: 1, remoteTerm: '' }),
        mergeOptionsForDisplay: (x) => x,
        applyOptions: () => {},
      })
    );
    await act(async () => {
      await result.current.load(executor);
    });
    act(() => {
      result.current.invalidateCache();
    });
    await act(async () => {
      await result.current.load(executor);
    });
    expect(executor).toHaveBeenCalledTimes(2);
  });
});
