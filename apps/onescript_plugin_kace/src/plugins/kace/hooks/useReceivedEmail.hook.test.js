import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useReceivedEmail } from './useReceivedEmail.js';

const {
  mockApiService,
  mockCaseService,
  mockFileService,
  mockKaceEngine,
  mockGetHandshakeParams,
} = vi.hoisted(() => {
  const mockApiService = { post: vi.fn(), get: vi.fn() };
  const mockCaseService = { get: vi.fn(), storeService: { get: vi.fn() } };
  const mockFileService = {
    downloadFile: vi.fn().mockResolvedValue(undefined),
  };
  const mockKaceEngine = vi.fn(() => ({
    getService: vi.fn((name) => {
      if (name === 'apiService') return mockApiService;
      if (name === 'cases') return mockCaseService;
      if (name === 'file') return mockFileService;
      return {};
    }),
  }));
  const mockGetHandshakeParams = vi.fn(() => null);
  return {
    mockApiService,
    mockCaseService,
    mockFileService,
    mockKaceEngine,
    mockGetHandshakeParams,
  };
});

vi.mock('#plugins/kace/KaceEngine.js', () => ({
  KaceEngine: mockKaceEngine,
}));

vi.mock('#plugins/kace/utils/withHandshakeEvaluatorContext.js', () => ({
  getHandshakeParams: mockGetHandshakeParams,
}));

describe('useReceivedEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCaseService.get.mockClear();
    mockCaseService.storeService.get.mockClear();
    mockApiService.post.mockClear();
    mockApiService.get.mockClear();
    mockFileService.downloadFile.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('when disabled (active: false)', () => {
    it('should not load email when inactive', () => {
      const { result } = renderHook(() =>
        useReceivedEmail({ active: false, autoLoad: true })
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.receivedEmail).toBe(null);
      expect(mockApiService.post).not.toHaveBeenCalled();
    });

    it('should set loading to false immediately', () => {
      const { result } = renderHook(() => useReceivedEmail({ active: false }));

      expect(result.current.loading).toBe(false);
    });
  });

  describe('when autoLoad is false', () => {
    it('should listen to kace:setReceivedEmail event', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => useReceivedEmail({ active: true, autoLoad: false }));

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'kace:setReceivedEmail',
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    it('should update state from event detail', async () => {
      const { result } = renderHook(() =>
        useReceivedEmail({ active: true, autoLoad: false })
      );

      const emailData = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Email',
        bodyHtml: '<p>Test body</p>',
      };

      window.dispatchEvent(
        new CustomEvent('kace:setReceivedEmail', { detail: emailData })
      );

      await waitFor(() => {
        expect(result.current.receivedEmail).toEqual(emailData);
        expect(result.current.loading).toBe(false);
      });
    });

    it('should remove event listener on cleanup', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useReceivedEmail({ active: true, autoLoad: false })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'kace:setReceivedEmail',
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('autoLoad behavior', () => {
    beforeEach(() => {
      window.__KACE_AUTH_READY__ = true;
      mockCaseService.storeService.get.mockImplementation((key) =>
        key === 'cases.case_id' ? 'case-1' : null
      );
      // resolve waitForInteractionId immediately on first check
      mockGetHandshakeParams.mockReturnValue({
        interaction_id: 'default-interaction',
      });
    });

    afterEach(() => {
      delete window.__KACE_AUTH_READY__;
    });

    it('should fetch received email when autoLoad is true', async () => {
      mockApiService.post.mockResolvedValue({
        data: { data: { items: [{ id: 'email-1' }] } },
      });
      mockApiService.get.mockResolvedValue({
        data: {
          data: {
            id: 'email-1',
            sender: 'sender@example.com',
            email_account: 'account@example.com',
            subject: 'Test',
            body: { body_html: '<p>Test</p>' },
            received_at: '2024-01-01T10:00:00Z',
          },
        },
      });

      const { result } = renderHook(() =>
        useReceivedEmail({ active: true, autoLoad: true })
      );

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should build search payload with case ID', async () => {
      mockApiService.post.mockResolvedValue({ data: { data: { items: [] } } });

      renderHook(() => useReceivedEmail({ active: true, autoLoad: true }));

      await waitFor(() => {
        expect(mockApiService.post).toHaveBeenCalledWith(
          'emails/search',
          expect.objectContaining({ filter: expect.any(Array) })
        );
      });
    });

    it('should use interaction ID if available', async () => {
      mockGetHandshakeParams.mockReturnValue({
        interaction_id: 'interaction-123',
      });
      mockApiService.post.mockResolvedValue({
        data: { data: { items: [{ id: 'email-1' }] } },
      });
      mockApiService.get.mockResolvedValue({ data: { data: {} } });

      renderHook(() => useReceivedEmail({ active: true, autoLoad: true }));

      await waitFor(() => {
        expect(mockApiService.post).toHaveBeenCalled();
        const payload = mockApiService.post.mock.calls[0][1];
        expect(payload.filter[0].value).toBe('interaction-123');
      });
    });

    it('should transform API response to receivedEmail format', async () => {
      const mockEmailDetail = {
        id: 'email-1',
        sender: 'sender@example.com',
        email_account: 'account@example.com',
        to: ['recipient1@example.com', 'recipient2@example.com'],
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        subject: 'Test Subject',
        body: { body_html: '<p>Body HTML</p>' },
        received_at: '2024-01-01T10:00:00Z',
        attachments: [{ id: 'att-1', name: 'file.pdf' }],
        interaction: { id: 'int-1' },
        channel_hub_message_id: 'msg-123',
      };

      mockApiService.post.mockResolvedValue({
        data: { data: { items: [{ id: 'email-1' }] } },
      });
      mockApiService.get.mockResolvedValue({ data: { data: mockEmailDetail } });

      const { result } = renderHook(() =>
        useReceivedEmail({ active: true, autoLoad: true })
      );

      await waitFor(() => {
        expect(result.current.receivedEmail).toEqual({
          from: 'sender@example.com',
          to: 'recipient1@example.com, recipient2@example.com',
          cc: 'cc@example.com',
          bcc: 'bcc@example.com',
          date: '2024-01-01T10:00:00Z',
          subject: 'Test Subject',
          bodyHtml: '<p>Body HTML</p>',
          attachments: [{ id: 'att-1', name: 'file.pdf' }],
          interaction_id: 'int-1',
          in_reply_to: 'msg-123',
          email_account: 'account@example.com',
        });
      });
    });

    it('should handle no emails found', async () => {
      mockApiService.post.mockResolvedValue({ data: { data: { items: [] } } });

      const { result } = renderHook(() =>
        useReceivedEmail({ active: true, autoLoad: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.receivedEmail).toBe(null);
      });
    });

    it('should handle API errors gracefully', async () => {
      mockApiService.post.mockRejectedValue(new Error('API Error'));
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const { result } = renderHook(() =>
        useReceivedEmail({ active: true, autoLoad: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.receivedEmail).toBe(null);
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should not update state if cancelled', async () => {
      let resolvePost;
      mockApiService.post.mockReturnValue(
        new Promise((r) => {
          resolvePost = r;
        })
      );

      const { unmount } = renderHook(() =>
        useReceivedEmail({ active: true, autoLoad: true })
      );

      await waitFor(() => expect(mockApiService.post).toHaveBeenCalled());

      unmount();
      resolvePost({ data: { data: { items: [{ id: 'email-1' }] } } });

      expect(mockApiService.post).toHaveBeenCalled();
    });

    it('should timeout waiting for auth after 25 seconds', async () => {
      vi.useFakeTimers();
      delete window.__KACE_AUTH_READY__;
      mockGetHandshakeParams.mockReturnValue(null);
      mockApiService.post.mockResolvedValue({ data: { data: { items: [] } } });

      const { result } = renderHook(() =>
        useReceivedEmail({ active: true, autoLoad: true })
      );

      await act(() => vi.advanceTimersByTimeAsync(36000));

      vi.useRealTimers();

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 3000 }
      );
    });
  });

  describe('external html body fetch fallback', () => {
    beforeEach(() => {
      window.__KACE_AUTH_READY__ = true;
      mockCaseService.storeService.get.mockImplementation((key) =>
        key === 'cases.case_id' ? 'case-1' : null
      );
      mockGetHandshakeParams.mockReturnValue({
        interaction_id: 'default-interaction',
      });
      mockApiService.post.mockResolvedValue({
        data: { data: { items: [{ id: 'email-1' }] } },
      });
    });

    afterEach(() => {
      delete window.__KACE_AUTH_READY__;
    });

    it('falls back to the inline body when the external body fetch fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      mockApiService.get.mockImplementation((url) => {
        if (url.includes('/body?part=html')) {
          return Promise.reject(new Error('404'));
        }
        return Promise.resolve({
          data: {
            data: {
              id: 'email-1',
              sender: 'sender@example.com',
              body: { body_html: '<p>Inline fallback</p>' },
            },
          },
        });
      });

      const { result } = renderHook(() =>
        useReceivedEmail({ active: true, autoLoad: true })
      );

      await waitFor(() => {
        expect(result.current.receivedEmail?.bodyHtml).toBe(
          '<p>Inline fallback</p>'
        );
      });
      // The whole load must not fail just because the extra endpoint did.
      expect(result.current.receivedEmail?.from).toBe('sender@example.com');

      consoleErrorSpy.mockRestore();
    });

    it('prefers the external body content over the inline one when the fetch succeeds', async () => {
      mockApiService.get.mockImplementation((url) => {
        if (url.includes('/body?part=html')) {
          return Promise.resolve({
            data: { data: { content: '<p>External content</p>' } },
          });
        }
        return Promise.resolve({
          data: {
            data: {
              id: 'email-1',
              body: { body_html: '<p>Inline (should be overridden)</p>' },
            },
          },
        });
      });

      const { result } = renderHook(() =>
        useReceivedEmail({ active: true, autoLoad: true })
      );

      await waitFor(() => {
        expect(result.current.receivedEmail?.bodyHtml).toBe(
          '<p>External content</p>'
        );
      });
    });

    it('strips style from the received body (untrusted external sender)', async () => {
      mockApiService.get.mockImplementation((url) => {
        if (url.includes('/body?part=html')) {
          return Promise.resolve({
            data: {
              data: { content: '<p style="color:red">hi</p>' },
            },
          });
        }
        return Promise.resolve({ data: { data: { id: 'email-1' } } });
      });

      const { result } = renderHook(() =>
        useReceivedEmail({ active: true, autoLoad: true })
      );

      await waitFor(() => {
        expect(result.current.receivedEmail?.bodyHtml).toBe('<p>hi</p>');
      });
    });
  });

  describe('handleDownloadAttachment bucket key', () => {
    it('defaults to "attachments" when receivedAttachmentsS3Bucket is not provided', async () => {
      const { result } = renderHook(() => useReceivedEmail({ active: false }));

      await act(async () => {
        await result.current.handleDownloadAttachment(
          { id: 'e-1', filename: 'file.pdf' },
          'key-1'
        );
      });

      expect(mockFileService.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'attachments' })
      );
    });

    it('falls back to the default when receivedAttachmentsS3Bucket is an explicit empty string', async () => {
      const { result } = renderHook(() =>
        useReceivedEmail({ active: false, receivedAttachmentsS3Bucket: '' })
      );

      await act(async () => {
        await result.current.handleDownloadAttachment(
          { id: 'e-1', filename: 'file.pdf' },
          'key-1'
        );
      });

      expect(mockFileService.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'attachments' })
      );
    });

    it('uses a custom receivedAttachmentsS3Bucket when explicitly configured', async () => {
      const { result } = renderHook(() =>
        useReceivedEmail({
          active: false,
          receivedAttachmentsS3Bucket: 'custom-bucket',
        })
      );

      await act(async () => {
        await result.current.handleDownloadAttachment(
          { id: 'e-1', filename: 'file.pdf' },
          'key-1'
        );
      });

      expect(mockFileService.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'custom-bucket' })
      );
    });
  });

  describe('string array conversion', () => {
    it('should convert array to comma-separated string', async () => {
      window.__KACE_AUTH_READY__ = true;
      mockGetHandshakeParams.mockReturnValue({ interaction_id: 'int-1' });
      mockCaseService.storeService.get.mockImplementation((key) =>
        key === 'cases.case_id' ? 'case-1' : null
      );
      mockApiService.post.mockResolvedValue({
        data: { data: { items: [{ id: 'email-1' }] } },
      });
      mockApiService.get.mockResolvedValue({
        data: {
          data: {
            to: ['user1@example.com', 'user2@example.com'],
            cc: 'single@example.com',
            sender: 'sender@example.com',
            email_account: 'account@example.com',
          },
        },
      });

      const { result } = renderHook(() =>
        useReceivedEmail({ active: true, autoLoad: true })
      );

      await waitFor(
        () => {
          expect(result.current.receivedEmail?.to).toBe(
            'user1@example.com, user2@example.com'
          );
          expect(result.current.receivedEmail?.cc).toBe('single@example.com');
        },
        { timeout: 5000 }
      );

      delete window.__KACE_AUTH_READY__;
    });
  });

  describe('loading state', () => {
    it('should start with loading true when active', () => {
      const { result } = renderHook(() =>
        useReceivedEmail({ active: true, autoLoad: true })
      );

      expect(result.current.loading).toBe(true);
    });

    it('should set loading to true when listening for event', () => {
      const { result } = renderHook(() =>
        useReceivedEmail({ active: true, autoLoad: false })
      );

      expect(result.current.loading).toBe(true);
    });

    it('should set loading to false after receiving event', async () => {
      const { result } = renderHook(() =>
        useReceivedEmail({ active: true, autoLoad: false })
      );

      window.dispatchEvent(
        new CustomEvent('kace:setReceivedEmail', {
          detail: { from: 'test@example.com' },
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });
});
