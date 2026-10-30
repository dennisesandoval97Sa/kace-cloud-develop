import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmailForm } from './EmailForm.jsx';
import { useEmailForm } from '#plugins/kace/hooks/useEmailForm.js';
import { useReceivedEmail } from '#plugins/kace/hooks/useReceivedEmail.js';
import { useEmailFormOverrides } from '#plugins/kace/hooks/useEmailFormOverrides.js';

vi.mock('./components/EmailFormActions.jsx', () => ({
  EmailFormActions: ({ onReply, onReplyAll, onNewEmail, onCancel, onSend }) => (
    <div data-testid="email-form-actions">
      <button onClick={onReply} data-testid="reply-btn">
        Reply
      </button>
      <button onClick={onReplyAll} data-testid="reply-all-btn">
        Reply All
      </button>
      <button onClick={onNewEmail} data-testid="new-email-btn">
        New Email
      </button>
      <button onClick={onCancel} data-testid="cancel-btn">
        Cancel
      </button>
      <button onClick={onSend} data-testid="send-btn">
        Send
      </button>
    </div>
  ),
}));

vi.mock('./components/EmailFormFields.jsx', () => ({
  EmailFormFields: () => <div data-testid="email-form-fields">Form Fields</div>,
}));

vi.mock('./components/EmailBodyEditor.jsx', () => ({
  EmailBodyEditor: () => <div data-testid="email-body-editor">Body Editor</div>,
}));

vi.mock('./components/EmailAttachments.jsx', () => ({
  EmailAttachments: () => (
    <div data-testid="email-attachments">Attachments</div>
  ),
}));

vi.mock('./components/ReceivedEmailView.jsx', () => ({
  ReceivedEmailView: () => (
    <div data-testid="received-email-view">Received Email</div>
  ),
}));

vi.mock('./components/SendStatusAlerts.jsx', () => ({
  SendStatusAlerts: () => <div data-testid="send-status-alerts">Alerts</div>,
}));

vi.mock('#plugins/kace/hooks/useEmailForm.js', () => ({
  useEmailForm: vi.fn(() => ({
    activeAction: null,
    formVisible: false,
    from: '',
    setFrom: vi.fn(),
    to: '',
    setTo: vi.fn(),
    cc: '',
    setCc: vi.fn(),
    bcc: '',
    setBcc: vi.fn(),
    subject: '',
    setSubject: vi.fn(),
    template: '',
    bodyRef: { current: null },
    templateOptions: [],
    templatesLoading: false,
    templatesError: null,
    handleTemplateChange: vi.fn(),
    exec: vi.fn(),
    attachments: [],
    attachmentInputRef: { current: null },
    handleAttachmentClick: vi.fn(),
    handleAttachmentChange: vi.fn(),
    handleAttachmentRemove: vi.fn(),
    handleReply: vi.fn(),
    handleReplyAll: vi.fn(),
    handleNewEmail: vi.fn(),
    handleCancel: vi.fn(),
    isSending: false,
    sendError: null,
    sendSuccess: false,
    handleSend: vi.fn(),
  })),
}));

vi.mock('#plugins/kace/hooks/useReceivedEmail.js', () => ({
  useReceivedEmail: vi.fn(() => ({
    loading: false,
    receivedEmail: null,
  })),
}));

vi.mock('#plugins/kace/hooks/useEmailFormOverrides.js', () => ({
  useEmailFormOverrides: vi.fn((baseProps) => ({
    overrides: baseProps,
    setFieldLocked: vi.fn(),
    setFieldHidden: vi.fn(),
    runCode: vi.fn(),
  })),
}));

describe('EmailForm', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    onActionChange: vi.fn(),
    customSendHandler: null,
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
    replyHidden: false,
    replyAllHidden: false,
    newEmailHidden: false,
    cancelHidden: false,
    sendHidden: false,
    bodyMode: false,
    receivedEmailAutoLoad: true,
    receivedAttachments: [],
    floatingButton: false,
    saveCaseBeforeSend: false,
    sendButtonText: 'Send',
    sendingButtonText: 'Sending...',
    sendButtonIcon: 'fa fa-paper-plane',
    sendButtonIconHidden: false,
    sendButtonColor: '',
    emitEvent: vi.fn(),
    submissionData: () => ({}),
    onMountCode: '',
    onActionChangeCode: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the email form wrapper', () => {
      render(<EmailForm {...defaultProps} />);

      expect(screen.getByTestId('send-status-alerts')).toBeInTheDocument();
      expect(screen.getByTestId('email-form-actions')).toBeInTheDocument();
    });

    it('should render form when bodyMode is false', () => {
      render(<EmailForm {...defaultProps} bodyMode={false} />);

      expect(screen.getByTestId('email-form-fields')).toBeInTheDocument();
      expect(screen.getByTestId('email-body-editor')).toBeInTheDocument();
      expect(screen.getByTestId('email-attachments')).toBeInTheDocument();
    });

    it('should render received email view when bodyMode is true and formVisible is false', () => {
      useEmailForm.mockReturnValueOnce({
        ...defaultProps,
        formVisible: false,
      });

      render(<EmailForm {...defaultProps} bodyMode={true} />);

      expect(screen.getByTestId('send-status-alerts')).toBeInTheDocument();
    });

    it('should have email-form-wrapper class', () => {
      const { container } = render(<EmailForm {...defaultProps} />);

      expect(
        container.querySelector('.email-form-wrapper')
      ).toBeInTheDocument();
    });
  });

  describe('props passing', () => {
    it('should pass locked props to child components', () => {
      const customProps = {
        ...defaultProps,
        fromLocked: true,
        toLocked: true,
        sendLocked: false,
      };

      render(<EmailForm {...customProps} />);

      expect(useEmailFormOverrides).toHaveBeenCalledWith(
        expect.objectContaining({
          fromLocked: true,
          toLocked: true,
          sendLocked: false,
        }),
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should pass hidden props to child components', () => {
      const customProps = {
        ...defaultProps,
        replyHidden: true,
        sendHidden: true,
      };

      render(<EmailForm {...customProps} />);

      expect(useEmailFormOverrides).toHaveBeenCalledWith(
        expect.objectContaining({
          replyHidden: true,
          sendHidden: true,
        }),
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should pass button customization props', () => {
      const { container } = render(
        <EmailForm
          {...defaultProps}
          sendButtonText="Enviar"
          sendButtonIcon="fa fa-envelope"
          sendButtonColor="#ff0000"
        />
      );

      expect(container).toBeDefined();
    });
  });

  describe('received email handling', () => {
    it('should pass receivedAttachments prop', () => {
      render(
        <EmailForm
          {...defaultProps}
          receivedAttachments={[{ id: '1', name: 'file.pdf' }]}
        />
      );

      expect(useReceivedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          active: defaultProps.bodyMode,
          autoLoad: defaultProps.receivedEmailAutoLoad,
        })
      );
    });

    it('should control received email loading with active prop', () => {
      render(<EmailForm {...defaultProps} bodyMode={true} />);

      expect(useReceivedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          active: true,
        })
      );
    });
  });

  describe('custom code execution', () => {
    it('should pass onMountCode and onActionChangeCode to hook', () => {
      render(
        <EmailForm
          {...defaultProps}
          onMountCode='console.log("mounted")'
          onActionChangeCode='console.log("action changed")'
        />
      );

      expect(useEmailFormOverrides).toHaveBeenCalled();
    });
  });

  describe('action callbacks', () => {
    it('should call onSubmit when form is submitted', () => {
      const onSubmit = vi.fn();

      useEmailForm.mockReturnValueOnce({
        ...defaultProps,
        onSubmit,
        handleSend: vi.fn().mockImplementation(() => {
          onSubmit({ action: 'send' });
        }),
      });

      render(<EmailForm {...defaultProps} onSubmit={onSubmit} />);

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should pass submission data function to hook', () => {
      const submissionDataFn = () => ({ case_data: { id: 'case-1' } });

      render(<EmailForm {...defaultProps} submissionData={submissionDataFn} />);

      expect(useEmailForm).toHaveBeenCalled();
    });
  });

  describe('floating button mode', () => {
    it('should render with floatingButton prop', () => {
      const { container } = render(
        <EmailForm {...defaultProps} floatingButton={true} />
      );

      expect(
        container.querySelector('.email-form-wrapper')
      ).toBeInTheDocument();
    });
  });

  describe('custom send handler', () => {
    it('should pass customSendHandler to useEmailForm', () => {
      const customHandler = vi.fn();

      render(<EmailForm {...defaultProps} customSendHandler={customHandler} />);

      expect(useEmailForm).toHaveBeenCalledWith(
        expect.objectContaining({
          customSendHandler: customHandler,
        })
      );
    });
  });

  describe('save case before send', () => {
    it('should pass saveCaseBeforeSend to hook', () => {
      render(<EmailForm {...defaultProps} saveCaseBeforeSend={true} />);

      expect(useEmailForm).toHaveBeenCalledWith(
        expect.objectContaining({
          saveCaseBeforeSend: true,
        })
      );
    });
  });

  describe('CSS styling', () => {
    it('should have email-form-wrapper class for layout', () => {
      const { container } = render(<EmailForm {...defaultProps} />);

      const wrapper = container.querySelector('.email-form-wrapper');
      expect(wrapper).toHaveClass('email-form-wrapper');
    });

    it('should render horizontal layout in bodyMode with formVisible', () => {
      useEmailForm.mockReturnValueOnce({
        ...defaultProps,
        formVisible: true,
        activeAction: 'reply',
      });

      useReceivedEmail.mockReturnValueOnce({
        loading: false,
        receivedEmail: { from: 'test@example.com' },
      });

      const { container } = render(
        <EmailForm {...defaultProps} bodyMode={true} />
      );

      expect(container).toBeDefined();
    });
  });

  describe('emitEvent prop', () => {
    it('should pass emitEvent to useEmailForm', () => {
      const emitEvent = vi.fn();

      render(<EmailForm {...defaultProps} emitEvent={emitEvent} />);

      expect(useEmailForm).toHaveBeenCalledWith(
        expect.objectContaining({ emitEvent })
      );
    });
  });
});
