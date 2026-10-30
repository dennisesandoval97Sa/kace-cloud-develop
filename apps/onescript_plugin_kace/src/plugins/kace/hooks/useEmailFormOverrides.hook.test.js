import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEmailFormOverrides } from './useEmailFormOverrides.js';
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';

vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: vi.fn(() => ({
    getService: vi.fn((name) => {
      if (name === 'apiService') return mockApiService;
      if (name === 'storeService') return mockStoreService;
      return {};
    }),
  })),
}));

vi.mock('#plugins/kace/shared/evaluateKace.js', () => ({
  evaluateKace: vi.fn((code, context) => {
    if (code.includes('setFieldLocked')) {
      context.setFieldLocked('to', true);
    }
    if (code.includes('setFieldHidden')) {
      context.setFieldHidden('send', true);
    }
    return true;
  }),
}));

const mockApiService = {};
const mockStoreService = {
  get: vi.fn(),
};

describe('useEmailFormOverrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('overrides state', () => {
    it('should initialize with baseProps', () => {
      const baseProps = {
        fromLocked: true,
        toLocked: false,
        ccLocked: false,
        sendLocked: false,
      };

      const { result } = renderHook(() =>
        useEmailFormOverrides(baseProps, () => ({}))
      );

      expect(result.current.overrides).toEqual(baseProps);
    });

    it('should merge overrideState with baseProps', () => {
      const baseProps = {
        fromLocked: true,
        toLocked: false,
        sendLocked: false,
      };

      const { result } = renderHook(() =>
        useEmailFormOverrides(baseProps, () => ({}))
      );

      act(() => {
        result.current.setFieldLocked('to', true);
      });

      expect(result.current.overrides.toLocked).toBe(true);
      expect(result.current.overrides.fromLocked).toBe(true);
    });

    it('should allow overriding baseProps', () => {
      const baseProps = {
        fromLocked: false,
        toLocked: false,
      };

      const { result } = renderHook(() =>
        useEmailFormOverrides(baseProps, () => ({}))
      );

      act(() => {
        result.current.setFieldLocked('from', true);
      });

      expect(result.current.overrides.fromLocked).toBe(true);
      expect(result.current.overrides.toLocked).toBe(false);
    });
  });

  describe('setFieldLocked', () => {
    const allLockedBaseProps = {
      fromLocked: false,
      toLocked: false,
      ccLocked: false,
      bccLocked: false,
      subjectLocked: false,
      templateLocked: false,
      bodyLocked: false,
      attachmentsLocked: false,
      replyLocked: false,
      replyAllLocked: false,
      newEmailLocked: false,
      cancelLocked: false,
      sendLocked: false,
    };

    it('should set field as locked', () => {
      const { result } = renderHook(() =>
        useEmailFormOverrides({ toLocked: false }, () => ({}))
      );

      act(() => {
        result.current.setFieldLocked('to', true);
      });

      expect(result.current.overrides.toLocked).toBe(true);
    });

    it('should set field as unlocked', () => {
      const { result } = renderHook(() =>
        useEmailFormOverrides({ toLocked: true }, () => ({}))
      );

      act(() => {
        result.current.setFieldLocked('to', false);
      });

      expect(result.current.overrides.toLocked).toBe(false);
    });

    it('should handle multiple fields', () => {
      const { result } = renderHook(() =>
        useEmailFormOverrides(
          { toLocked: false, ccLocked: false, subjectLocked: false },
          () => ({})
        )
      );

      act(() => {
        result.current.setFieldLocked('to', true);
        result.current.setFieldLocked('cc', true);
        result.current.setFieldLocked('subject', false);
      });

      expect(result.current.overrides.toLocked).toBe(true);
      expect(result.current.overrides.ccLocked).toBe(true);
      expect(result.current.overrides.subjectLocked).toBe(false);
    });

    it('should warn on unknown field', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() =>
        useEmailFormOverrides({}, () => ({}))
      );

      act(() => {
        result.current.setFieldLocked('unknown', true);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('unknown field "unknown"')
      );
      consoleSpy.mockRestore();
    });

    it('should coerce value to boolean', () => {
      const { result } = renderHook(() =>
        useEmailFormOverrides(
          { toLocked: false, ccLocked: false, bccLocked: false },
          () => ({})
        )
      );

      act(() => {
        result.current.setFieldLocked('to', 'true');
        result.current.setFieldLocked('cc', 0);
        result.current.setFieldLocked('bcc', null);
      });

      expect(result.current.overrides.toLocked).toBe(true);
      expect(result.current.overrides.ccLocked).toBe(false);
      expect(result.current.overrides.bccLocked).toBe(false);
    });

    it('should support all locked fields', () => {
      const { result } = renderHook(() =>
        useEmailFormOverrides(allLockedBaseProps, () => ({}))
      );

      const lockedFields = [
        'from',
        'to',
        'cc',
        'bcc',
        'subject',
        'template',
        'body',
        'attachments',
        'reply',
        'replyAll',
        'newEmail',
        'cancel',
        'send',
      ];

      act(() => {
        lockedFields.forEach((field) => {
          result.current.setFieldLocked(field, true);
        });
      });

      lockedFields.forEach((field) => {
        expect(result.current.overrides[`${field}Locked`]).toBe(true);
      });
    });
  });

  describe('setFieldHidden', () => {
    it('should set field as hidden', () => {
      const { result } = renderHook(() =>
        useEmailFormOverrides({ sendHidden: false }, () => ({}))
      );

      act(() => {
        result.current.setFieldHidden('send', true);
      });

      expect(result.current.overrides.sendHidden).toBe(true);
    });

    it('should set field as visible', () => {
      const { result } = renderHook(() =>
        useEmailFormOverrides({ sendHidden: true }, () => ({}))
      );

      act(() => {
        result.current.setFieldHidden('send', false);
      });

      expect(result.current.overrides.sendHidden).toBe(false);
    });

    it('should handle multiple fields', () => {
      const { result } = renderHook(() =>
        useEmailFormOverrides(
          { replyHidden: false, cancelHidden: false },
          () => ({})
        )
      );

      act(() => {
        result.current.setFieldHidden('reply', true);
        result.current.setFieldHidden('cancel', false);
      });

      expect(result.current.overrides.replyHidden).toBe(true);
      expect(result.current.overrides.cancelHidden).toBe(false);
    });

    it('should warn on unknown field', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() =>
        useEmailFormOverrides({}, () => ({}))
      );

      act(() => {
        result.current.setFieldHidden('unknown', true);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('unknown field "unknown"')
      );
      consoleSpy.mockRestore();
    });

    it('should support all hidden fields', () => {
      const hiddenFields = ['reply', 'replyAll', 'newEmail', 'cancel', 'send'];
      const baseProps = Object.fromEntries(
        hiddenFields.map((f) => [`${f}Hidden`, false])
      );

      const { result } = renderHook(() =>
        useEmailFormOverrides(baseProps, () => ({}))
      );

      act(() => {
        hiddenFields.forEach((field) => {
          result.current.setFieldHidden(field, true);
        });
      });

      hiddenFields.forEach((field) => {
        expect(result.current.overrides[`${field}Hidden`]).toBe(true);
      });
    });
  });

  describe('setFieldValue', () => {
    it('should call the registered setter for a known value field', () => {
      const setFrom = vi.fn();
      const { result } = renderHook(() =>
        useEmailFormOverrides({}, () => ({}), { from: setFrom })
      );

      act(() => {
        result.current.setFieldValue('from', 'new@example.com');
      });

      expect(setFrom).toHaveBeenCalledWith('new@example.com');
    });

    it('should support all whitelisted value fields', () => {
      const setters = {
        from: vi.fn(),
        to: vi.fn(),
        cc: vi.fn(),
        bcc: vi.fn(),
        subject: vi.fn(),
      };
      const { result } = renderHook(() =>
        useEmailFormOverrides({}, () => ({}), setters)
      );

      act(() => {
        Object.keys(setters).forEach((field) => {
          result.current.setFieldValue(field, `${field}-value`);
        });
      });

      Object.entries(setters).forEach(([field, setter]) => {
        expect(setter).toHaveBeenCalledWith(`${field}-value`);
      });
    });

    it('should warn and not call any setter for a field outside the whitelist', () => {
      const setLocked = vi.fn();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() =>
        useEmailFormOverrides({}, () => ({}), { fromLocked: setLocked })
      );

      act(() => {
        result.current.setFieldValue('fromLocked', true);
      });

      expect(setLocked).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('unknown field "fromLocked"')
      );
      consoleSpy.mockRestore();
    });

    it('should warn when no setter is registered for a known value field', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() =>
        useEmailFormOverrides({}, () => ({}), {})
      );

      act(() => {
        result.current.setFieldValue('subject', 'New subject');
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('no setter for "subject"')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('runCode', () => {
    it('should execute code with context', () => {
      const { result } = renderHook(() =>
        useEmailFormOverrides({ toLocked: false }, () => ({}))
      );

      act(() => {
        result.current.runCode('setFieldLocked("to", true);');
      });

      expect(result.current.overrides.toLocked).toBe(true);
    });

    it('should skip empty code', () => {
      const { result } = renderHook(() =>
        useEmailFormOverrides({}, () => ({}))
      );

      const initialOverrides = result.current.overrides;

      act(() => {
        result.current.runCode('');
        result.current.runCode('   ');
        result.current.runCode(null);
      });

      expect(result.current.overrides).toEqual(initialOverrides);
    });

    it('should pass submission data to context', () => {
      const mockSubmissionData = { case_data: { id: 'case-1' } };
      const { result } = renderHook(() =>
        useEmailFormOverrides({}, () => mockSubmissionData)
      );

      act(() => {
        result.current.runCode('test');
      });

      const callArgs = evaluateKace.mock.calls[0][1];
      expect(callArgs.submissionData).toEqual(mockSubmissionData);
    });

    it('should include services in context', () => {
      const { result } = renderHook(() =>
        useEmailFormOverrides({}, () => ({}))
      );

      act(() => {
        result.current.runCode('test');
      });

      const callArgs = evaluateKace.mock.calls[0][1];
      expect(callArgs.apiService).toBeDefined();
      expect(callArgs.storeService).toBeDefined();
      expect(callArgs.kaceEngine).toBeDefined();
    });

    it('should handle code execution errors gracefully', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const { result } = renderHook(() =>
        useEmailFormOverrides({}, () => ({}))
      );

      vi.mocked(evaluateKace).mockImplementationOnce(() => {
        throw new Error('Execution error');
      });

      expect(() => {
        act(() => {
          result.current.runCode('throw new Error("test")');
        });
      }).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should pass extra parameters to runCode', () => {
      const { result } = renderHook(() =>
        useEmailFormOverrides({}, () => ({}))
      );

      act(() => {
        result.current.runCode('test', { customData: 'value' });
      });

      const callArgs = evaluateKace.mock.calls[0][1];
      expect(callArgs.customData).toBe('value');
    });
  });
});
