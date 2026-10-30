import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockStoreGet = vi.fn();

vi.mock('#plugins/kace/services/storeService.js', () => ({
  storeService: {
    get: (...args) => mockStoreGet(...args),
  },
}));

import { useKaceDisabled } from './useKaceDisabled.hook.js';

describe('useKaceDisabled', () => {
  beforeEach(() => {
    mockStoreGet.mockReset();
    mockStoreGet.mockReturnValue(undefined);
  });

  it('treats cases.case_edit_locked as readOnlyLock by default so the wrapper stays scrollable', () => {
    mockStoreGet.mockImplementation((key) =>
      key === 'cases.case_edit_locked' ? true : undefined
    );

    const { result } = renderHook(() => useKaceDisabled(false));

    expect(result.current).toEqual({
      disabled: true,
      readOnlyLock: true,
      className: '',
    });
    expect(mockStoreGet).toHaveBeenCalledWith('cases.case_edit_locked');
  });

  it('keeps the overlay class for generic Form.io disabled when the case is not locked', () => {
    mockStoreGet.mockReturnValue(false);

    const { result } = renderHook(() => useKaceDisabled(true));

    expect(result.current).toEqual({
      disabled: true,
      readOnlyLock: false,
      className: 'kace-component--disabled',
    });
  });

  it('does not lock when an explicit readOnlyStoreKey is null', () => {
    mockStoreGet.mockImplementation((key) =>
      key === 'cases.case_edit_locked' ? true : undefined
    );

    const { result } = renderHook(() =>
      useKaceDisabled(false, { readOnlyStoreKey: null })
    );

    expect(result.current).toEqual({
      disabled: false,
      readOnlyLock: false,
      className: '',
    });
    expect(mockStoreGet).not.toHaveBeenCalledWith('cases.case_edit_locked');
  });
});
