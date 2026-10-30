import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchAuxHistory = vi.fn();
const storeGet = vi.fn();
const storeSet = vi.fn();

vi.mock(
  '#plugins/kace/components/event-log/lib/resolveEventLogContext.js',
  () => ({
    resolveEventLogContext: () => ({
      entityId: 'case-1',
      primaryEntity: 'cases',
    }),
  })
);

vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: () => ({
    getService: (name) => {
      if (name === 'aux') return { fetchAuxHistory };
      if (name === 'storeService') return { get: storeGet, set: storeSet };
      return { get: () => null, set: vi.fn() };
    },
  }),
}));

import { useEventLog } from './useEventLog.js';

const page = (offset) =>
  Array.from({ length: 20 }, (_, i) => ({
    id: `i${offset + i}`,
    entity_id: 'case-1',
    changed_attributes: {},
    new_attributes: {
      id: 'case-1',
      created_at: '2026-10-14T13:59:25.000Z',
    },
    original_attributes: {},
    creator_name: 'Ana Pérez',
  }));

describe('useEventLog.loadMore', () => {
  beforeEach(() => {
    fetchAuxHistory.mockReset();
    fetchAuxHistory.mockImplementation(({ offset }) =>
      Promise.resolve(page(offset))
    );
    storeGet.mockReset();
    storeGet.mockReturnValue(null);
    storeSet.mockReset();
  });

  it('does not fire a second request while the first is in flight', async () => {
    let resolveFirst;
    fetchAuxHistory.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    );

    const { result } = renderHook(() =>
      useEventLog({ contextCaseId: 'case-1' })
    );

    let first;
    let second;
    await act(async () => {
      first = result.current.actions.loadMore();
      second = result.current.actions.loadMore();
    });

    expect(fetchAuxHistory).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst(page(0));
      await Promise.all([first, second]);
    });

    expect(fetchAuxHistory).toHaveBeenCalledTimes(1);
    expect(result.current.state.items).toHaveLength(20);
  });

  it('blocks a second loadMore in the same tick after a page is already loaded', async () => {
    const { result } = renderHook(() =>
      useEventLog({ contextCaseId: 'case-1' })
    );

    await act(async () => {
      await result.current.actions.loadMore();
    });
    expect(fetchAuxHistory).toHaveBeenCalledTimes(1);

    let resolveSecond;
    fetchAuxHistory.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve;
        })
    );

    await act(async () => {
      const again = result.current.actions.loadMore();
      const blocked = result.current.actions.loadMore();
      resolveSecond(page(20));
      await Promise.all([again, blocked]);
    });

    expect(fetchAuxHistory).toHaveBeenCalledTimes(2);
    expect(result.current.state.items).toHaveLength(40);
  });

  it('discards a late loadMore after the sheet is closed and reopened', async () => {
    let resolveLate;
    const latePromise = new Promise((resolve) => {
      resolveLate = resolve;
    });

    const { result } = renderHook(() =>
      useEventLog({ contextCaseId: 'case-1' })
    );

    await act(async () => {
      result.current.actions.toggleSheet();
    });
    expect(result.current.state.isSheetOpen).toBe(true);

    fetchAuxHistory.mockImplementationOnce(() => latePromise);
    let loadMorePromise;
    await act(async () => {
      loadMorePromise = result.current.actions.loadMore();
    });

    await act(async () => {
      result.current.actions.toggleSheet();
    });
    expect(result.current.state.isSheetOpen).toBe(false);
    expect(result.current.state.items).toEqual([]);

    await act(async () => {
      result.current.actions.toggleSheet();
      await result.current.actions.fetchHistory();
    });

    const freshIds = result.current.state.items.map((item) => item.id);
    expect(freshIds).toEqual(page(0).map((item) => item.id));

    await act(async () => {
      resolveLate(page(99));
      await loadMorePromise;
    });

    await waitFor(() => {
      expect(result.current.state.items.map((item) => item.id)).toEqual(
        freshIds
      );
    });
  });
});
