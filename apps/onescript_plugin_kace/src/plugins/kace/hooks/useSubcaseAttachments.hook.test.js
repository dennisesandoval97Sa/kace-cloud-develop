import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockStoreGet = vi.fn();

vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: () => ({
    getService: (name) => {
      if (name === 'storeService') {
        return { get: mockStoreGet };
      }
      if (name === 'user') {
        return { canEditCaseSync: () => true };
      }
      if (name === 'file') {
        return {
          fetchAttachmentsByCaseId: vi.fn().mockResolvedValue([]),
          deleteFile: vi.fn(),
          downloadFile: vi.fn(),
        };
      }
      return null;
    },
  }),
}));

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn() },
}));

import { useSubcaseAttachments } from './useSubcaseAttachments.hook.js';

const makeFile = (name) => new File(['content'], name, { type: 'image/png' });

describe('useSubcaseAttachments', () => {
  beforeEach(() => {
    mockStoreGet.mockReset();
    mockStoreGet.mockImplementation((key) => {
      if (key === 'config.cases_config') {
        return { allow_client_send_attachments: true };
      }
      return null;
    });
  });

  it('accepts a lowercase file extension when the allowed catalog is uppercase', () => {
    mockStoreGet.mockImplementation((key) => {
      if (key === 'cases.allowed_files_extensions') return ['.PNG'];
      if (key === 'config.cases_config')
        return { allow_client_send_attachments: true };
      return null;
    });

    const { result } = renderHook(() =>
      useSubcaseAttachments({ enabled: true })
    );

    act(() => {
      result.current.handleFileChange({
        target: { files: [makeFile('foto.png')] },
      });
    });

    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0].path).toBe('foto.png');
    expect(result.current.message).toBeNull();
  });

  it('accepts an uppercase file extension when the allowed catalog is lowercase', () => {
    mockStoreGet.mockImplementation((key) => {
      if (key === 'cases.allowed_files_extensions') return ['.png'];
      if (key === 'config.cases_config')
        return { allow_client_send_attachments: true };
      return null;
    });

    const { result } = renderHook(() =>
      useSubcaseAttachments({ enabled: true })
    );

    act(() => {
      result.current.handleFileChange({
        target: { files: [makeFile('FOTO.PNG')] },
      });
    });

    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0].path).toBe('FOTO.PNG');
  });

  it('rejects a file extension that is not in the allowed catalog regardless of case', () => {
    mockStoreGet.mockImplementation((key) => {
      if (key === 'cases.allowed_files_extensions') return ['.PNG'];
      if (key === 'config.cases_config')
        return { allow_client_send_attachments: true };
      return null;
    });

    const { result } = renderHook(() =>
      useSubcaseAttachments({ enabled: true })
    );

    act(() => {
      result.current.handleFileChange({
        target: { files: [makeFile('malware.exe')] },
      });
    });

    expect(result.current.files).toHaveLength(0);
    expect(result.current.message).toEqual({
      type: 'danger',
      text: 'Extensión de archivos no válida.',
    });
  });

  it('rejects a filename without an extension even when it matches an allowed entry verbatim', () => {
    mockStoreGet.mockImplementation((key) => {
      if (key === 'cases.allowed_files_extensions') return ['.png'];
      if (key === 'config.cases_config')
        return { allow_client_send_attachments: true };
      return null;
    });

    const { result } = renderHook(() =>
      useSubcaseAttachments({ enabled: true })
    );

    act(() => {
      result.current.handleFileChange({
        target: { files: [makeFile('png')] },
      });
    });

    expect(result.current.files).toHaveLength(0);
    expect(result.current.message).toEqual({
      type: 'danger',
      text: 'Extensión de archivos no válida.',
    });
  });
});
