import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockStoreGet = vi.fn();
const mockStoreSet = vi.fn();

vi.mock('../KaceEngine', () => ({
  KaceEngine: () => ({
    getService: (name) => {
      if (name === 'storeService') {
        return { get: mockStoreGet, set: mockStoreSet };
      }
      if (name === 'user') {
        return { canEditCaseSync: () => true };
      }
      if (name === 'file') {
        return { deleteFile: vi.fn(), downloadFile: vi.fn() };
      }
      return null;
    },
  }),
}));

vi.mock('#plugins/kace/hooks/useEventData.js', () => ({
  default: () => ({
    data: {},
    // Skips the store-hydration effect entirely so tests only exercise file selection.
    attachmentsLoading: true,
    error: null,
  }),
}));

import useAttachment from './useAttachment.js';

const globalConfigWith = (allowedExtensions) => ({
  behaviors: {
    application: {
      agente: {
        files_extensions: {
          allowed_file_extensions: allowedExtensions,
          maximun_size_allowed: 0,
          quantity_files_allowed: 0,
        },
      },
    },
  },
});

const makeFile = (name) => new File(['content'], name, { type: 'image/png' });

describe('useAttachment', () => {
  beforeEach(() => {
    mockStoreGet.mockReset();
    mockStoreSet.mockReset();
    mockStoreGet.mockImplementation((key) => {
      if (key === 'config.cases_config') {
        return { allow_client_send_attachments: true };
      }
      return null;
    });
  });

  it('accepts a lowercase file extension when the allowed catalog is uppercase', async () => {
    mockStoreGet.mockImplementation((key) => {
      if (key === 'config.global_config') return globalConfigWith(['.PNG']);
      if (key === 'config.cases_config')
        return { allow_client_send_attachments: true };
      return null;
    });

    const { result } = renderHook(() => useAttachment(() => {}, {}));

    await act(async () => {
      result.current.handleFileChange({
        target: { files: [makeFile('foto.png')] },
      });
    });

    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0].path).toBe('foto.png');
    expect(result.current.message).toBeNull();
  });

  it('accepts an uppercase file extension when the allowed catalog is lowercase', async () => {
    mockStoreGet.mockImplementation((key) => {
      if (key === 'config.global_config') return globalConfigWith(['.png']);
      if (key === 'config.cases_config')
        return { allow_client_send_attachments: true };
      return null;
    });

    const { result } = renderHook(() => useAttachment(() => {}, {}));

    await act(async () => {
      result.current.handleFileChange({
        target: { files: [makeFile('FOTO.PNG')] },
      });
    });

    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0].path).toBe('FOTO.PNG');
  });

  it('rejects a file extension that is not in the allowed catalog regardless of case', async () => {
    mockStoreGet.mockImplementation((key) => {
      if (key === 'config.global_config') return globalConfigWith(['.PNG']);
      if (key === 'config.cases_config')
        return { allow_client_send_attachments: true };
      return null;
    });

    const { result } = renderHook(() => useAttachment(() => {}, {}));

    await act(async () => {
      result.current.handleFileChange({
        target: { files: [makeFile('malware.exe')] },
      });
    });

    expect(result.current.files).toHaveLength(0);
    expect(result.current.message).toEqual({
      type: 'danger',
      text: 'Extension de archivos no valida.',
    });
  });

  it('rejects a filename without an extension even when it matches an allowed entry verbatim', async () => {
    mockStoreGet.mockImplementation((key) => {
      if (key === 'config.global_config') return globalConfigWith(['.png']);
      if (key === 'config.cases_config')
        return { allow_client_send_attachments: true };
      return null;
    });

    const { result } = renderHook(() => useAttachment(() => {}, {}));

    await act(async () => {
      result.current.handleFileChange({
        target: { files: [makeFile('png')] },
      });
    });

    expect(result.current.files).toHaveLength(0);
    expect(result.current.message).toEqual({
      type: 'danger',
      text: 'Extension de archivos no valida.',
    });
  });
});
