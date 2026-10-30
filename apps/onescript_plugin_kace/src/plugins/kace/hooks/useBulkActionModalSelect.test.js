import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBulkActionModalSelect } from './useBulkActionModalSelect.js';

vi.mock('#plugins/kace/hooks/useDebouncedStableTerm.js', () => ({
  useDebouncedStableTerm: (value) => value,
}));

describe('useBulkActionModalSelect', () => {
  it('filters static options locally in legacy mode', () => {
    const options = [
      { label: 'Ana Garcia', value: '1' },
      { label: 'Bob Smith', value: '2' },
    ];
    const { result } = renderHook(() =>
      useBulkActionModalSelect({
        fieldKey: 'user',
        options,
        value: '',
        showWhenCode: '',
        evaluateShowWhen: vi.fn(() => true),
        setSelectOptions: vi.fn(),
        dependencySignature: '',
        disabled: false,
      })
    );
    act(() => {
      result.current.setSearchTerm('ana');
    });
    expect(result.current.mode).toBe('legacy');
    expect(result.current.filteredOptions).toEqual([
      { label: 'Ana Garcia', value: '1' },
    ]);
  });

  it('enters segmented mode and forwards append load meta', async () => {
    const setSelectOptions = vi.fn();
    const evaluateShowWhen = vi.fn(async ({ onSetSelectOptions }) => {
      onSetSelectOptions([{ label: 'U1', value: '1' }], { append: true });
      return true;
    });
    const { result } = renderHook(() =>
      useBulkActionModalSelect({
        fieldKey: 'user',
        options: [],
        value: '',
        showWhenCode: 'return true',
        evaluateShowWhen,
        setSelectOptions,
        dependencySignature: 'x',
        disabled: false,
      })
    );
    act(() => {
      result.current.openDropdown();
    });
    await waitFor(() => {
      expect(evaluateShowWhen).toHaveBeenCalled();
    });
    expect(result.current.mode).toBe('segmented');
    expect(setSelectOptions).toHaveBeenCalledWith(
      'user',
      [{ label: 'U1', value: '1' }],
      { replace: true }
    );
  });

  it('does not reload when localSearchOnly and search term changes', async () => {
    const setSelectOptions = vi.fn();
    const evaluateShowWhen = vi.fn(async ({ onSetSelectOptions }) => {
      onSetSelectOptions(
        [
          { label: 'Administrators Group', value: '1' },
          { label: 'felipe', value: '2' },
        ],
        { replace: true }
      );
      return true;
    });
    const { result } = renderHook(() =>
      useBulkActionModalSelect({
        fieldKey: 'group',
        options: [],
        value: '',
        showWhenCode: 'return true',
        evaluateShowWhen,
        setSelectOptions,
        dependencySignature: 'x',
        disabled: false,
        localSearchOnly: true,
      })
    );
    act(() => {
      result.current.openDropdown();
    });
    await waitFor(() => {
      expect(evaluateShowWhen).toHaveBeenCalledTimes(1);
    });
    act(() => {
      result.current.setSearchTerm('admin');
    });
    expect(evaluateShowWhen).toHaveBeenCalledTimes(1);
  });

  it('filters options locally when localSearchOnly is true', () => {
    const options = [
      { label: 'Administrators Group', value: '1' },
      { label: 'felipe', value: '2' },
    ];
    const { result } = renderHook(() =>
      useBulkActionModalSelect({
        fieldKey: 'group',
        options,
        value: '',
        showWhenCode: 'return true',
        evaluateShowWhen: vi.fn(() => true),
        setSelectOptions: vi.fn(),
        dependencySignature: 'x',
        disabled: false,
        localSearchOnly: true,
      })
    );
    act(() => {
      result.current.setSearchTerm('admin');
    });
    expect(result.current.filteredOptions).toEqual([
      { label: 'Administrators Group', value: '1' },
    ]);
  });
});
