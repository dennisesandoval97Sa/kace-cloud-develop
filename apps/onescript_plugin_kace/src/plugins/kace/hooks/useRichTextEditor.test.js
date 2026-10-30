import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import useRichTextEditor from './useRichTextEditor.js';

const mocks = vi.hoisted(() => ({
  useEventData: vi.fn(),
  useGlobalConfig: vi.fn(),
  storeGet: vi.fn(),
  userCanEditCaseSync: vi.fn(() => true),
}));

vi.mock('#plugins/kace/hooks/useEventData.js', () => ({
  default: () => ({
    descriptionLoading: false,
    data: {
      cases: {
        case_data: { id: 'case-1', descripcion_caso: { descripcion: 'init' } },
      },
    },
  }),
}));

vi.mock('#plugins/kace/hooks/useGlobalConfig.js', () => ({
  useGlobalConfig: mocks.useGlobalConfig,
}));

vi.mock('../KaceEngine.js', () => ({
  KaceEngine: () => ({
    getService: (name) => {
      if (name === 'storeService') return { get: mocks.storeGet };
      if (name === 'user')
        return { canEditCaseSync: mocks.userCanEditCaseSync };
      return null;
    },
  }),
}));

import { GLOBAL_CONFIG_PATHS } from '#plugins/kace/data/constants.js';

afterEach(() => {
  vi.clearAllMocks();
});

describe('useRichTextEditor — lock_case_description_edit', () => {
  it('returns locked=true when the flag is true and the case is being updated', () => {
    mocks.storeGet.mockImplementation((key) => {
      if (key === 'cases.case_data') {
        return { id: 'case-1', descripcion_caso: { descripcion: 'init' } };
      }
      return null;
    });
    mocks.useGlobalConfig.mockImplementation((_onEvent, path) => {
      if (path === GLOBAL_CONFIG_PATHS.LOCK_CASE_DESCRIPTION_EDIT) return true;
      return null;
    });

    const { result } = renderHook(() => useRichTextEditor(vi.fn(), vi.fn()));

    expect(result.current.locked).toBe(true);
  });

  it('returns locked=false when the flag is false', () => {
    mocks.storeGet.mockImplementation((key) => {
      if (key === 'cases.case_data') {
        return { id: 'case-1', descripcion_caso: { descripcion: 'init' } };
      }
      return null;
    });
    mocks.useGlobalConfig.mockReturnValue(false);

    const { result } = renderHook(() => useRichTextEditor(vi.fn(), vi.fn()));

    expect(result.current.locked).toBe(false);
  });

  it('returns locked=false when the flag is absent and the case is being created', () => {
    mocks.storeGet.mockImplementation((key) => {
      if (key === 'cases.case_data')
        return { descripcion_caso: { descripcion: '' } };
      return null;
    });
    mocks.useGlobalConfig.mockReturnValue(null);

    const { result } = renderHook(() => useRichTextEditor(vi.fn(), vi.fn()));

    expect(result.current.locked).toBe(false);
  });
});
