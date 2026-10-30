import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmailFormActions } from './EmailFormActions.jsx';

describe('EmailFormActions', () => {
  const defaultProps = {
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
    isSending: false,
    sendButtonText: 'Enviar',
    sendingButtonText: 'Enviando...',
    sendButtonIcon: 'fa fa-paper-plane',
    sendButtonIconHidden: false,
    sendButtonColor: '',
    floatingButton: false,
    onReply: vi.fn(),
    onReplyAll: vi.fn(),
    onNewEmail: vi.fn(),
    onCancel: vi.fn(),
    onSend: vi.fn(),
  };

  describe('button rendering', () => {
    it('should render all action buttons by default', () => {
      render(<EmailFormActions {...defaultProps} />);

      expect(screen.getByText('↩ Responder')).toBeInTheDocument();
      expect(screen.getByText('↩ Responder a todos')).toBeInTheDocument();
      expect(screen.getByText('✉ Nueva respuesta')).toBeInTheDocument();
      expect(screen.getByText('✕ Cancelar respuesta')).toBeInTheDocument();
      expect(screen.getByText('Enviar')).toBeInTheDocument();
    });

    it('should hide reply button when replyHidden is true', () => {
      render(<EmailFormActions {...defaultProps} replyHidden={true} />);

      expect(screen.queryByText('↩ Responder')).not.toBeInTheDocument();
    });

    it('should hide reply all button when replyAllHidden is true', () => {
      render(<EmailFormActions {...defaultProps} replyAllHidden={true} />);

      expect(screen.queryByText('↩ Responder a todos')).not.toBeInTheDocument();
    });

    it('should hide new email button when newEmailHidden is true', () => {
      render(<EmailFormActions {...defaultProps} newEmailHidden={true} />);

      expect(screen.queryByText('✉ Nueva respuesta')).not.toBeInTheDocument();
    });

    it('should hide cancel button when cancelHidden is true', () => {
      render(<EmailFormActions {...defaultProps} cancelHidden={true} />);

      expect(
        screen.queryByText('✕ Cancelar respuesta')
      ).not.toBeInTheDocument();
    });

    it('should hide send button when sendHidden is true', () => {
      render(<EmailFormActions {...defaultProps} sendHidden={true} />);

      expect(screen.queryByText('Enviar')).not.toBeInTheDocument();
    });

    it('should hide multiple buttons', () => {
      render(
        <EmailFormActions
          {...defaultProps}
          replyHidden={true}
          replyAllHidden={true}
          sendHidden={true}
        />
      );

      expect(screen.queryByText('↩ Responder')).not.toBeInTheDocument();
      expect(screen.queryByText('↩ Responder a todos')).not.toBeInTheDocument();
      expect(screen.queryByText('Enviar')).not.toBeInTheDocument();
      expect(screen.getByText('✉ Nueva respuesta')).toBeInTheDocument();
      expect(screen.getByText('✕ Cancelar respuesta')).toBeInTheDocument();
    });
  });

  describe('button callbacks', () => {
    it('should call onReply when reply button is clicked', () => {
      const onReply = vi.fn();
      render(<EmailFormActions {...defaultProps} onReply={onReply} />);

      fireEvent.click(screen.getByText('↩ Responder'));

      expect(onReply).toHaveBeenCalledTimes(1);
    });

    it('should call onReplyAll when reply all button is clicked', () => {
      const onReplyAll = vi.fn();
      render(<EmailFormActions {...defaultProps} onReplyAll={onReplyAll} />);

      fireEvent.click(screen.getByText('↩ Responder a todos'));

      expect(onReplyAll).toHaveBeenCalledTimes(1);
    });

    it('should call onNewEmail when new email button is clicked', () => {
      const onNewEmail = vi.fn();
      render(<EmailFormActions {...defaultProps} onNewEmail={onNewEmail} />);

      fireEvent.click(screen.getByText('✉ Nueva respuesta'));

      expect(onNewEmail).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn();
      render(<EmailFormActions {...defaultProps} onCancel={onCancel} />);

      fireEvent.click(screen.getByText('✕ Cancelar respuesta'));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onSend when send button is clicked', () => {
      const onSend = vi.fn();
      render(<EmailFormActions {...defaultProps} onSend={onSend} />);

      fireEvent.click(screen.getByText('Enviar'));

      expect(onSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('locked state', () => {
    it('should disable reply button when locked', () => {
      render(<EmailFormActions {...defaultProps} replyLocked={true} />);

      const replyBtn = screen.getByText('↩ Responder').closest('button');
      expect(replyBtn).toBeDisabled();
      expect(replyBtn).toHaveClass('input--locked');
    });

    it('should disable reply all button when locked', () => {
      render(<EmailFormActions {...defaultProps} replyAllLocked={true} />);

      const btn = screen.getByText('↩ Responder a todos').closest('button');
      expect(btn).toBeDisabled();
    });

    it('should disable new email button when locked', () => {
      render(<EmailFormActions {...defaultProps} newEmailLocked={true} />);

      const btn = screen.getByText('✉ Nueva respuesta').closest('button');
      expect(btn).toBeDisabled();
    });

    it('should disable cancel button when locked', () => {
      render(<EmailFormActions {...defaultProps} cancelLocked={true} />);

      const btn = screen.getByText('✕ Cancelar respuesta').closest('button');
      expect(btn).toBeDisabled();
    });

    it('should disable send button when locked', () => {
      render(<EmailFormActions {...defaultProps} sendLocked={true} />);

      const btn = screen.getByText('Enviar').closest('button');
      expect(btn).toBeDisabled();
    });

    it('should not call callback when locked button is clicked', () => {
      const onReply = vi.fn();
      render(
        <EmailFormActions
          {...defaultProps}
          replyLocked={true}
          onReply={onReply}
        />
      );

      const btn = screen.getByText('↩ Responder').closest('button');
      fireEvent.click(btn);

      // Button is disabled, so click should not trigger callback
      expect(onReply).not.toHaveBeenCalled();
    });
  });

  describe('send button customization', () => {
    it('should display custom send button text', () => {
      render(
        <EmailFormActions {...defaultProps} sendButtonText="Enviar Ahora" />
      );

      expect(screen.getByText('Enviar Ahora')).toBeInTheDocument();
    });

    it('should use sending text when isSending is true', () => {
      render(
        <EmailFormActions
          {...defaultProps}
          isSending={true}
          sendingButtonText="Por favor espere..."
        />
      );

      expect(screen.getByText('Por favor espere...')).toBeInTheDocument();
    });

    it('should disable send button when isSending is true', () => {
      render(<EmailFormActions {...defaultProps} isSending={true} />);

      const sendBtn = screen.getByText('Enviando...').closest('button');
      expect(sendBtn).toBeDisabled();
    });

    it('should apply send button color', () => {
      const { container } = render(
        <EmailFormActions {...defaultProps} sendButtonColor="#ff0000" />
      );

      const sendBtn = screen.getByText('Enviar').closest('button');
      expect(sendBtn).toHaveStyle({ backgroundColor: '#ff0000' });
    });

    it('should apply send button icon', () => {
      const { container } = render(
        <EmailFormActions {...defaultProps} sendButtonIcon="fa fa-check" />
      );

      const sendBtn = screen.getByText('Enviar').closest('button');
      expect(sendBtn.querySelector('.fa-check')).toBeInTheDocument();
    });

    it('should hide send button icon when sendButtonIconHidden is true', () => {
      const { container } = render(
        <EmailFormActions {...defaultProps} sendButtonIconHidden={true} />
      );

      const sendBtn = screen.getByText('Enviar').closest('button');
      expect(sendBtn.querySelector('.fa')).not.toBeInTheDocument();
    });
  });

  describe('floating button mode', () => {
    it('should render with floating button class', () => {
      const { container } = render(
        <EmailFormActions {...defaultProps} floatingButton={true} />
      );

      expect(
        container.querySelector('.kace-floating-submit')
      ).toBeInTheDocument();
    });
  });

  describe('button styling', () => {
    it('should have email-form-actions class', () => {
      const { container } = render(<EmailFormActions {...defaultProps} />);

      expect(
        container.querySelector('.email-form-actions')
      ).toBeInTheDocument();
    });

    it('should apply btn class to all buttons', () => {
      const { container } = render(<EmailFormActions {...defaultProps} />);

      const buttons = container.querySelectorAll('.btn');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('accessibility', () => {
    it('should have proper button types', () => {
      const { container } = render(<EmailFormActions {...defaultProps} />);

      const buttons = container.querySelectorAll('button');
      buttons.forEach((btn) => {
        expect(btn.type).toBe('button');
      });
    });

    it('should indicate locked state with visual badge', () => {
      const { container } = render(
        <EmailFormActions {...defaultProps} replyLocked={true} />
      );

      const lockedBtn = container.querySelector('.input--locked');
      expect(lockedBtn).toBeInTheDocument();
    });
  });
});
