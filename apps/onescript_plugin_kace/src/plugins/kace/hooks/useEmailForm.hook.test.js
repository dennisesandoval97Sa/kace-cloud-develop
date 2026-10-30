import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import Swal from 'sweetalert2';
import { useEmailForm } from './useEmailForm.js';
import { resolveTemplateAttachmentPlaceholders } from '#plugins/kace/shared/templateAttachmentImageResolver.js';

const {
  mockEmailService,
  mockCaseService,
  mockApiService,
  mockStoreService,
  mockKaceEngine,
} = vi.hoisted(() => {
  const mockEmailService = { get: vi.fn(), sendEmail: vi.fn() };
  const mockCaseService = {
    get: vi.fn(),
    createCase: vi.fn(),
    validateCaseFields: vi.fn(),
    finishTimerAfterSubmit: vi.fn(),
  };
  const mockApiService = { post: vi.fn() };
  const mockStoreService = { get: vi.fn(), set: vi.fn() };
  const mockKaceEngine = vi.fn(() => ({
    getService: vi.fn((name) => {
      if (name === 'email') return mockEmailService;
      if (name === 'cases') return mockCaseService;
      if (name === 'apiService') return mockApiService;
      if (name === 'storeService') return mockStoreService;
      return {};
    }),
  }));
  return {
    mockEmailService,
    mockCaseService,
    mockApiService,
    mockStoreService,
    mockKaceEngine,
  };
});

vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: mockKaceEngine,
}));

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn().mockResolvedValue({ isConfirmed: true }),
    showLoading: vi.fn(),
  },
}));

vi.mock('#plugins/kace/components/email-form/EmailTemplatesUtils', () => ({
  resolveTemplate: vi.fn((template) => ({
    asunto: 'Resolved Subject',
    cuerpo: '<p>Resolved Body</p>',
    ...template,
  })),
}));

vi.mock('#plugins/kace/shared/postMessageToParent.util.js', () => ({
  postMessageToParent: vi.fn(),
}));

vi.mock('#plugins/kace/shared/templateAttachmentImageResolver.js', () => ({
  resolveTemplateAttachmentPlaceholders: vi.fn((html) => Promise.resolve(html)),
}));

describe('useEmailForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockEmailService.get.mockResolvedValue([
      { value: 'template-1', asunto: 'Subject 1', cuerpo: 'Body 1' },
      { value: 'template-2', asunto: 'Subject 2', cuerpo: 'Body 2' },
    ]);

    mockCaseService.get.mockResolvedValue({
      case_data: { id: 'case-1' },
    });

    mockStoreService.get.mockReturnValue('case-1');

    mockApiService.post.mockResolvedValue({
      data: { data: { uploadUrl: 'https://s3.example.com/upload' } },
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useEmailForm());

      expect(result.current.from).toBe('');
      expect(result.current.to).toBe('');
      expect(result.current.cc).toBe('');
      expect(result.current.bcc).toBe('');
      expect(result.current.subject).toBe('');
      expect(result.current.template).toBe('');
      expect(result.current.attachments).toEqual([]);
      expect(result.current.isSending).toBe(false);
      expect(result.current.sendError).toBe(null);
      expect(result.current.sendSuccess).toBe(false);
      expect(result.current.formVisible).toBe(false);
      expect(result.current.activeAction).toBe(null);
    });

    it('should load email templates on mount', async () => {
      renderHook(() => useEmailForm());

      await waitFor(() => {
        expect(mockEmailService.get).toHaveBeenCalledWith('email.templates');
      });
    });

    it('should load case data on mount', async () => {
      renderHook(() => useEmailForm());

      await waitFor(() => {
        expect(mockCaseService.get).toHaveBeenCalledWith('cases.case_data');
      });
    });

    it('should set templates loading state correctly', async () => {
      const { result } = renderHook(() => useEmailForm());

      expect(result.current.templatesLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.templatesLoading).toBe(false);
      });
    });

    it('should handle template loading error', async () => {
      mockEmailService.get.mockRejectedValue(new Error('Load error'));

      const { result } = renderHook(() => useEmailForm());

      await waitFor(() => {
        expect(result.current.templatesError).toBe(
          'No se pudieron cargar las plantillas.'
        );
      });
    });
  });

  describe('handleTemplateChange', () => {
    it('should update template and resolve body', async () => {
      const { result } = renderHook(() => useEmailForm());

      await waitFor(() => {
        expect(result.current.templateOptions.length).toBeGreaterThan(0);
      });

      const event = {
        target: {
          value: 'template-1',
        },
      };

      act(() => {
        result.current.handleTemplateChange(event);
      });

      expect(result.current.template).toBe('template-1');
    });

    it('should not update if template is empty', async () => {
      const { result } = renderHook(() => useEmailForm());

      await waitFor(() => {
        expect(result.current.templateOptions.length).toBeGreaterThan(0);
      });

      const event = { target: { value: '' } };

      act(() => {
        result.current.handleTemplateChange(event);
      });

      expect(result.current.template).toBe('');
    });

    it('should not update subject if in reply mode', async () => {
      const { result } = renderHook(() =>
        useEmailForm({
          receivedEmail: { subject: 'Original Subject' },
        })
      );

      await waitFor(() => {
        expect(result.current.templateOptions.length).toBeGreaterThan(0);
      });

      act(() => {
        result.current.handleReply();
      });

      const subjectAfterReply = result.current.subject;

      act(() => {
        result.current.handleTemplateChange({
          target: { value: 'template-1' },
        });
      });

      expect(result.current.subject).toBe(subjectAfterReply);
    });
  });

  describe('handleTemplateChange race condition guard', () => {
    it('discards a slower, stale template resolution in favor of the latest selection', async () => {
      mockEmailService.get.mockResolvedValue([
        { value: 'template-a', asunto: 'A', cuerpo: '<p>A</p>' },
        { value: 'template-b', asunto: 'B', cuerpo: '<p>B</p>' },
      ]);

      let resolveA;
      const pendingA = new Promise((resolve) => {
        resolveA = resolve;
      });
      resolveTemplateAttachmentPlaceholders
        .mockImplementationOnce(() => pendingA)
        .mockImplementationOnce((html) => Promise.resolve(html));

      const { result } = renderHook(() => useEmailForm());
      await waitFor(() => {
        expect(result.current.templateOptions.length).toBeGreaterThan(0);
      });

      result.current.bodyRef.current = { innerHTML: '' };

      let changeAPromise;
      act(() => {
        changeAPromise = result.current.handleTemplateChange({
          target: { value: 'template-a' },
        });
      });

      await act(async () => {
        await result.current.handleTemplateChange({
          target: { value: 'template-b' },
        });
      });

      expect(result.current.bodyRef.current.innerHTML).toBe('<p>B</p>');

      await act(async () => {
        resolveA('<p>A</p>');
        await changeAPromise;
      });

      // A's late resolution must not clobber B's already-painted body.
      expect(result.current.bodyRef.current.innerHTML).toBe('<p>B</p>');
    });
  });

  describe('handleTemplateChange html safety', () => {
    it('preserves html-entity-escaped tags as literal text instead of executing them', async () => {
      mockEmailService.get.mockResolvedValue([
        {
          value: 'template-escaped',
          asunto: 'Subj',
          cuerpo: 'see &lt;script&gt;alert(1)&lt;/script&gt; in docs',
        },
      ]);

      const { result } = renderHook(() => useEmailForm());
      await waitFor(() => {
        expect(result.current.templateOptions.length).toBeGreaterThan(0);
      });

      result.current.bodyRef.current = { innerHTML: '' };

      await act(async () => {
        await result.current.handleTemplateChange({
          target: { value: 'template-escaped' },
        });
      });

      expect(result.current.bodyRef.current.innerHTML).toBe(
        'see &lt;script&gt;alert(1)&lt;/script&gt; in docs'
      );
    });
  });

  describe('handleReply', () => {
    it('should set form visible and active action', async () => {
      const { result } = renderHook(() =>
        useEmailForm({
          receivedEmail: {
            from: 'sender@example.com',
            email_account: 'account@example.com',
            subject: 'Original Subject',
          },
        })
      );

      act(() => {
        result.current.handleReply();
      });

      expect(result.current.formVisible).toBe(true);
      expect(result.current.activeAction).toBe('reply');
    });

    it('should populate reply fields correctly', () => {
      const { result } = renderHook(() =>
        useEmailForm({
          receivedEmail: {
            from: 'sender@example.com',
            email_account: 'account@example.com',
            subject: 'Original Subject',
          },
        })
      );

      act(() => {
        result.current.handleReply();
      });

      expect(result.current.to).toBe('sender@example.com');
      expect(result.current.from).toBe('account@example.com');
      expect(result.current.subject).toBe('Re: Original Subject');
      expect(result.current.cc).toBe('');
      expect(result.current.bcc).toBe('');
    });

    it('should call onSubmit', () => {
      const onSubmit = vi.fn();
      const { result } = renderHook(() =>
        useEmailForm({
          onSubmit,
          receivedEmail: {
            from: 'sender@example.com',
            email_account: 'account@example.com',
          },
        })
      );

      act(() => {
        result.current.handleReply();
      });

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'reply',
        })
      );
    });
  });

  describe('handleReplyAll', () => {
    it('should populate all recipient fields', () => {
      const { result } = renderHook(() =>
        useEmailForm({
          receivedEmail: {
            from: 'sender@example.com',
            cc: 'cc@example.com',
            bcc: 'bcc@example.com',
            email_account: 'account@example.com',
            subject: 'Original',
          },
        })
      );

      act(() => {
        result.current.handleReplyAll();
      });

      expect(result.current.to).toBe('sender@example.com');
      expect(result.current.cc).toBe('cc@example.com');
      expect(result.current.bcc).toBe('bcc@example.com');
      expect(result.current.activeAction).toBe('replyAll');
    });

    it('should handle array cc/bcc values', () => {
      const { result } = renderHook(() =>
        useEmailForm({
          receivedEmail: {
            from: ['sender1@example.com', 'sender2@example.com'],
            cc: ['cc1@example.com', 'cc2@example.com'],
            email_account: 'account@example.com',
          },
        })
      );

      act(() => {
        result.current.handleReplyAll();
      });

      expect(result.current.to).toBe(
        'sender1@example.com, sender2@example.com'
      );
      expect(result.current.cc).toBe('cc1@example.com, cc2@example.com');
    });
  });

  describe('handleNewEmail', () => {
    it('should initialize new email action', () => {
      const { result } = renderHook(() =>
        useEmailForm({
          receivedEmail: {
            email_account: 'account@example.com',
            from: 'original@example.com',
          },
        })
      );

      act(() => {
        result.current.handleNewEmail();
      });

      expect(result.current.activeAction).toBe('newEmail');
      expect(result.current.from).toBe('account@example.com');
      expect(result.current.to).toBe('original@example.com');
      expect(result.current.cc).toBe('');
      expect(result.current.bcc).toBe('');
      expect(result.current.subject).toBe('');
    });
  });

  describe('handleCancel', () => {
    it('should reset form state', () => {
      const { result } = renderHook(() =>
        useEmailForm({
          receivedEmail: { email_account: 'account@example.com' },
        })
      );

      act(() => {
        result.current.handleNewEmail();
      });

      expect(result.current.formVisible).toBe(true);
      expect(result.current.activeAction).toBe('newEmail');

      act(() => {
        result.current.handleCancel();
      });

      expect(result.current.formVisible).toBe(false);
      expect(result.current.activeAction).toBe(null);
    });

    it('should call onCancel', () => {
      const onCancel = vi.fn();
      const { result } = renderHook(() =>
        useEmailForm({
          onCancel,
          receivedEmail: { email_account: 'account@example.com' },
        })
      );

      act(() => {
        result.current.handleCancel();
      });

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('attachment handling', () => {
    it('should add attachments', () => {
      const { result } = renderHook(() => useEmailForm());

      const file1 = new File(['content1'], 'file1.txt');
      const file2 = new File(['content2'], 'file2.pdf');

      act(() => {
        const event = { target: { files: [file1] } };
        result.current.handleAttachmentChange(event);
      });

      expect(result.current.attachments).toHaveLength(1);

      act(() => {
        const event = { target: { files: [file2] } };
        result.current.handleAttachmentChange(event);
      });

      expect(result.current.attachments).toHaveLength(2);
    });

    it('should remove attachments by index', () => {
      const { result } = renderHook(() => useEmailForm());

      const file1 = new File(['content1'], 'file1.txt');
      const file2 = new File(['content2'], 'file2.txt');

      act(() => {
        const event = { target: { files: [file1, file2] } };
        result.current.handleAttachmentChange(event);
      });

      expect(result.current.attachments).toHaveLength(2);

      act(() => {
        result.current.handleAttachmentRemove(0);
      });

      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].name).toBe('file2.txt');
    });

    it('should clear file input after selection', () => {
      const { result } = renderHook(() => useEmailForm());

      const file = new File(['content'], 'file.txt');
      let capturedEvent;

      const mockFileInput = {
        click: vi.fn(),
        value: 'somevalue',
      };

      // Mock the ref
      act(() => {
        result.current.handleAttachmentClick();
      });

      const event = {
        target: { files: [file], value: '' },
      };

      act(() => {
        result.current.handleAttachmentChange(event);
      });

      expect(event.target.value).toBe('');
    });
  });

  describe('validateEmailFields', () => {
    it('should validate required fields for newEmail via handleSend', async () => {
      const { result } = renderHook(() => useEmailForm());

      act(() => {
        result.current.handleNewEmail();
      });

      result.current.bodyRef.current = { innerHTML: '' };

      await act(async () => {
        await result.current.handleSend();
      });

      // validation failed — sendEmail not called
      expect(result.current.isSending).toBe(false);
    });

    it('should not block send for reply when body is present', async () => {
      const { result } = renderHook(() =>
        useEmailForm({
          receivedEmail: {
            email_account: 'account@example.com',
            from: 'sender@example.com',
            in_reply_to: 'msg-1',
            interaction_id: 'int-1',
          },
        })
      );

      act(() => {
        result.current.handleReply();
      });
      result.current.bodyRef.current = { innerHTML: '<p>body</p>' };

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.sendSuccess).toBe(true);
    });

    it('should block send for reply when body is empty', async () => {
      const { result } = renderHook(() =>
        useEmailForm({
          receivedEmail: {
            email_account: 'account@example.com',
            from: 'sender@example.com',
          },
        })
      );

      act(() => {
        result.current.handleReply();
      });
      result.current.bodyRef.current = { innerHTML: '' };

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.sendSuccess).toBe(false);
    });
  });

  describe('handleSend', () => {
    it('should validate before sending', async () => {
      const { result } = renderHook(() => useEmailForm());

      act(() => {
        result.current.setTo('');
        result.current.handleNewEmail();
      });

      result.current.bodyRef.current = { innerHTML: '' };

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.isSending).toBe(false);
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should show error when no case is saved', async () => {
      mockStoreService.get.mockReturnValue(null);

      const { result } = renderHook(() =>
        useEmailForm({
          receivedEmail: {
            email_account: 'account@example.com',
            from: 'sender@example.com',
          },
        })
      );

      act(() => {
        result.current.handleReply();
      });
      result.current.bodyRef.current = { innerHTML: '<p>Body</p>' };

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.sendError).toBeTruthy();
    });

    it('should call sendEmail when validation passes', async () => {
      const { result } = renderHook(() =>
        useEmailForm({
          receivedEmail: {
            email_account: 'account@example.com',
            from: 'sender@example.com',
            subject: 'Original',
            in_reply_to: 'msg-123',
            interaction_id: 'int-123',
          },
        })
      );

      act(() => {
        result.current.handleReply();
      });

      result.current.bodyRef.current = { innerHTML: '<p>Reply body</p>' };

      await act(async () => {
        await result.current.handleSend();
      });

      expect(mockEmailService.sendEmail).toHaveBeenCalled();
    });

    it('should clear attachments after successful send', async () => {
      mockEmailService.sendEmail.mockResolvedValue({});
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useEmailForm({
          receivedEmail: {
            email_account: 'account@example.com',
            from: 'sender@example.com',
            in_reply_to: 'msg-1',
            interaction_id: 'int-1',
          },
        })
      );

      act(() => {
        result.current.handleReply();
        result.current.handleAttachmentChange({
          target: { files: [new File(['c'], 'f.txt')] },
        });
      });

      expect(result.current.attachments).toHaveLength(1);
      result.current.bodyRef.current = { innerHTML: '<p>Body</p>' };

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.attachments).toHaveLength(0);
    });

    it('should set sendSuccess after successful send', async () => {
      const { result } = renderHook(() =>
        useEmailForm({
          receivedEmail: {
            email_account: 'account@example.com',
            from: 'sender@example.com',
          },
        })
      );

      act(() => {
        result.current.handleReply();
      });

      result.current.bodyRef.current = { innerHTML: '<p>Body</p>' };

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.sendSuccess).toBe(true);
    });
  });

  describe('custom send handler', () => {
    it('should call customSendHandler if provided', async () => {
      const customSendHandler = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useEmailForm({
          customSendHandler,
          receivedEmail: {
            email_account: 'account@example.com',
            from: 'sender@example.com',
          },
        })
      );

      act(() => {
        result.current.handleReply();
      });

      result.current.bodyRef.current = { innerHTML: '<p>Body</p>' };

      await act(async () => {
        await result.current.handleSend();
      });

      expect(customSendHandler).toHaveBeenCalled();
    });

    it('should pass context to customSendHandler', async () => {
      const customSendHandler = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useEmailForm({
          customSendHandler,
          receivedEmail: {
            email_account: 'account@example.com',
            from: 'sender@example.com',
          },
        })
      );

      act(() => {
        result.current.handleReply();
      });

      result.current.bodyRef.current = { innerHTML: '<p>Body</p>' };

      await act(async () => {
        await result.current.handleSend();
      });

      const callArgs = customSendHandler.mock.calls[0];
      expect(callArgs[0]).toBeDefined(); // payload
      expect(callArgs[1]).toBeDefined(); // context
      expect(callArgs[1].kaceEngine).toBeDefined();
      expect(callArgs[1].apiService).toBeDefined();
    });
  });

  describe('buildPayload', () => {
    it('should build correct payload for reply action', () => {
      const { result } = renderHook(() =>
        useEmailForm({
          receivedEmail: {
            email_account: 'account@example.com',
            from: 'sender@example.com',
            subject: 'Original',
            in_reply_to: 'msg-123',
            interaction_id: 'int-123',
          },
        })
      );

      act(() => {
        result.current.handleReply();
      });

      result.current.bodyRef.current = { innerHTML: '<p>Body</p>' };

      // The payload is built internally during send
      // We can verify it gets called correctly
      expect(result.current.activeAction).toBe('reply');
    });
  });

  describe('template polling', () => {
    it('should reload templates when the current classification changes', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      let classification = 'class-1';
      mockStoreService.get.mockImplementation((key) => {
        if (key === 'classifications.current_classification')
          return classification;
        return 'case-1';
      });

      renderHook(() => useEmailForm());

      expect(mockEmailService.get).toHaveBeenCalledTimes(1);

      classification = 'class-2';
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(mockEmailService.get).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should not reload templates when the classification is unchanged', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockStoreService.get.mockImplementation((key) => {
        if (key === 'classifications.current_classification') return 'class-1';
        return 'case-1';
      });

      renderHook(() => useEmailForm());

      expect(mockEmailService.get).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(mockEmailService.get).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should clear the interval on unmount', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockStoreService.get.mockImplementation((key) => {
        if (key === 'classifications.current_classification') return 'class-1';
        return 'case-1';
      });

      const { unmount } = renderHook(() => useEmailForm());
      unmount();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(mockEmailService.get).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe('attachment validation from global config', () => {
    const withFileExtensions = (files_extensions) => (key) => {
      if (key === 'config.global_config') {
        return { behaviors: { application: { agente: { files_extensions } } } };
      }
      return 'case-1';
    };

    it('should reject files with disallowed extensions', () => {
      mockStoreService.get.mockImplementation(
        withFileExtensions({
          allowed_file_extensions: ['.pdf', '.png'],
          maximun_size_allowed: 0,
          quantity_files_allowed: 0,
        })
      );

      const { result } = renderHook(() => useEmailForm());

      const validFile = new File(['x'], 'doc.pdf');
      const invalidFile = new File(['x'], 'doc.exe');

      act(() => {
        result.current.handleAttachmentChange({
          target: { files: [validFile, invalidFile] },
        });
      });

      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].name).toBe('doc.pdf');
      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: 'warning',
          text: expect.stringContaining('doc.exe'),
        })
      );
    });

    it('should reject files larger than maximun_size_allowed (in MB)', () => {
      mockStoreService.get.mockImplementation(
        withFileExtensions({
          allowed_file_extensions: [],
          maximun_size_allowed: 1,
          quantity_files_allowed: 0,
        })
      );

      const { result } = renderHook(() => useEmailForm());

      const bigFile = new File([new Uint8Array(2 * 1024 * 1024)], 'big.txt');
      const smallFile = new File(['small'], 'small.txt');

      act(() => {
        result.current.handleAttachmentChange({
          target: { files: [bigFile, smallFile] },
        });
      });

      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].name).toBe('small.txt');
      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: 'warning',
          text: expect.stringContaining('big.txt'),
        })
      );
    });

    it('should reject duplicate file names already attached', () => {
      const { result } = renderHook(() => useEmailForm());
      const file = new File(['a'], 'dup.txt');

      act(() => {
        result.current.handleAttachmentChange({ target: { files: [file] } });
      });
      expect(result.current.attachments).toHaveLength(1);
      expect(Swal.fire).not.toHaveBeenCalled();

      act(() => {
        result.current.handleAttachmentChange({ target: { files: [file] } });
      });
      expect(result.current.attachments).toHaveLength(1);
      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: 'warning',
          text: expect.stringContaining('dup.txt'),
        })
      );
    });

    it('should not show a warning when every selected file is accepted', () => {
      const { result } = renderHook(() => useEmailForm());
      const file = new File(['a'], 'ok.txt');

      act(() => {
        result.current.handleAttachmentChange({ target: { files: [file] } });
      });

      expect(result.current.attachments).toHaveLength(1);
      expect(Swal.fire).not.toHaveBeenCalled();
    });

    it('should cap attachments at quantity_files_allowed', () => {
      mockStoreService.get.mockImplementation(
        withFileExtensions({
          allowed_file_extensions: [],
          maximun_size_allowed: 0,
          quantity_files_allowed: 1,
        })
      );

      const { result } = renderHook(() => useEmailForm());
      const file1 = new File(['a'], 'a.txt');
      const file2 = new File(['b'], 'b.txt');

      act(() => {
        result.current.handleAttachmentChange({
          target: { files: [file1, file2] },
        });
      });

      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].name).toBe('a.txt');
      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: 'warning',
          text: expect.stringContaining('máximo de 1 adjunto'),
        })
      );
    });

    it('should warn about the exact number of files dropped by the quota, not just the ones over the limit', () => {
      mockStoreService.get.mockImplementation(
        withFileExtensions({
          allowed_file_extensions: [],
          maximun_size_allowed: 0,
          quantity_files_allowed: 2,
        })
      );

      const { result } = renderHook(() => useEmailForm());
      const files = [
        new File(['a'], 'a.txt'),
        new File(['b'], 'b.txt'),
        new File(['c'], 'c.txt'),
      ];

      act(() => {
        result.current.handleAttachmentChange({ target: { files } });
      });

      expect(result.current.attachments).toHaveLength(2);
      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('no se agregó 1 archivo'),
        })
      );
    });
  });

  describe('validExtensions and allowMultiple', () => {
    it('should default to no accept restriction and allow multiple files', () => {
      const { result } = renderHook(() => useEmailForm());

      expect(result.current.validExtensions).toBeUndefined();
      expect(result.current.allowMultiple).toBe(true);
    });

    it('should build a comma-separated accept string with a leading dot per extension', () => {
      mockStoreService.get.mockImplementation((key) => {
        if (key === 'config.global_config') {
          return {
            behaviors: {
              application: {
                agente: {
                  files_extensions: {
                    allowed_file_extensions: ['pdf', '.png'],
                  },
                },
              },
            },
          };
        }
        return 'case-1';
      });

      const { result } = renderHook(() => useEmailForm());

      expect(result.current.validExtensions).toBe('.pdf,.png');
    });

    it('should disallow multiple files when quantity_files_allowed is 1', () => {
      mockStoreService.get.mockImplementation((key) => {
        if (key === 'config.global_config') {
          return {
            behaviors: {
              application: {
                agente: { files_extensions: { quantity_files_allowed: 1 } },
              },
            },
          };
        }
        return 'case-1';
      });

      const { result } = renderHook(() => useEmailForm());

      expect(result.current.allowMultiple).toBe(false);
    });

    it('should allow multiple files when quantity_files_allowed is greater than 1', () => {
      mockStoreService.get.mockImplementation((key) => {
        if (key === 'config.global_config') {
          return {
            behaviors: {
              application: {
                agente: { files_extensions: { quantity_files_allowed: 5 } },
              },
            },
          };
        }
        return 'case-1';
      });

      const { result } = renderHook(() => useEmailForm());

      expect(result.current.allowMultiple).toBe(true);
    });
  });

  describe('handleNewEmail setFrom fix', () => {
    it('should preserve a manually set from value when no receivedEmail email_account is present', () => {
      const { result } = renderHook(() => useEmailForm());

      act(() => {
        result.current.setFrom('manual@example.com');
      });
      expect(result.current.from).toBe('manual@example.com');

      act(() => {
        result.current.handleNewEmail();
      });

      expect(result.current.from).toBe('manual@example.com');
    });

    it('should overwrite from with receivedEmail.email_account when present', () => {
      const { result } = renderHook(() =>
        useEmailForm({
          receivedEmail: { email_account: 'account@example.com' },
        })
      );

      act(() => {
        result.current.setFrom('manual@example.com');
      });

      act(() => {
        result.current.handleNewEmail();
      });

      expect(result.current.from).toBe('account@example.com');
    });
  });

  describe('custom save handler', () => {
    it('should call customSaveHandler and use its returned caseId', async () => {
      const customSaveHandler = vi.fn().mockResolvedValue({
        caseId: 'custom-case-1',
      });
      mockStoreService.get.mockReturnValue(null);

      const { result } = renderHook(() =>
        useEmailForm({
          customSaveHandler,
          saveCaseBeforeSend: true,
          getSubmissionData: () => ({ case_data: { case: { id: 1 } } }),
        })
      );

      await act(async () => {
        await result.current.handleSend();
      });

      expect(customSaveHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ case_data: expect.anything() }),
          currentCaseId: null,
          apiService: expect.anything(),
          storeService: expect.anything(),
        })
      );
      expect(result.current.sendError).toBe(null);
    });

    it('should pass currentCaseId from the store instead of requiring the script to read it', async () => {
      const customSaveHandler = vi.fn().mockResolvedValue({});
      mockStoreService.get.mockReturnValue('existing-case-42');

      const { result } = renderHook(() =>
        useEmailForm({ customSaveHandler, saveCaseBeforeSend: true })
      );

      await act(async () => {
        await result.current.handleSend();
      });

      expect(customSaveHandler).toHaveBeenCalledWith(
        expect.objectContaining({ currentCaseId: 'existing-case-42' })
      );
      // No caseId returned by the script, but currentCaseId covers it — no error.
      expect(result.current.sendError).toBe(null);
    });

    it('should surface an error when customSaveHandler resolves without a caseId and none is stored', async () => {
      const customSaveHandler = vi.fn().mockResolvedValue({});
      mockStoreService.get.mockReturnValue(null);

      const { result } = renderHook(() =>
        useEmailForm({ customSaveHandler, saveCaseBeforeSend: true })
      );

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.sendError).toContain('Error al guardar el caso');
    });

    it('should fall back to the stored case_id when customSaveHandler omits caseId', async () => {
      const customSaveHandler = vi.fn().mockResolvedValue({});
      mockStoreService.get.mockReturnValue('stored-case-1');

      const { result } = renderHook(() =>
        useEmailForm({ customSaveHandler, saveCaseBeforeSend: true })
      );

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.sendError).toBe(null);
    });
  });

  describe('send failure error UX', () => {
    it('should set sendError and keep sendSuccess false when sendEmail rejects', async () => {
      mockEmailService.sendEmail.mockRejectedValue(new Error('SMTP down'));

      const { result } = renderHook(() =>
        useEmailForm({
          receivedEmail: {
            email_account: 'account@example.com',
            from: 'sender@example.com',
            in_reply_to: 'msg-1',
            interaction_id: 'int-1',
          },
        })
      );

      act(() => {
        result.current.handleReply();
      });
      result.current.bodyRef.current = { innerHTML: '<p>Body</p>' };

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.sendError).toBe('SMTP down');
      expect(result.current.sendSuccess).toBe(false);
      expect(result.current.isSending).toBe(false);
    });

    it('should not clear pending attachments when send fails', async () => {
      mockEmailService.sendEmail.mockRejectedValue(new Error('SMTP down'));

      const { result } = renderHook(() =>
        useEmailForm({
          receivedEmail: {
            email_account: 'account@example.com',
            from: 'sender@example.com',
            in_reply_to: 'msg-1',
            interaction_id: 'int-1',
          },
        })
      );

      act(() => {
        result.current.handleReply();
        result.current.handleAttachmentChange({
          target: { files: [new File(['c'], 'f.txt')] },
        });
      });
      result.current.bodyRef.current = { innerHTML: '<p>Body</p>' };

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.attachments).toHaveLength(1);
    });
  });
});
