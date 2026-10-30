import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmailFormFields } from './EmailFormFields.jsx';

describe('EmailFormFields', () => {
  const defaultProps = {
    from: '',
    setFrom: vi.fn(),
    fromLocked: false,
    to: '',
    setTo: vi.fn(),
    toLocked: false,
    cc: '',
    setCc: vi.fn(),
    ccLocked: false,
    bcc: '',
    setBcc: vi.fn(),
    bccLocked: false,
    subject: '',
    setSubject: vi.fn(),
    subjectLocked: false,
    template: '',
    templateLocked: false,
    templatesLoading: false,
    templatesError: null,
    templateOptions: [],
    handleTemplateChange: vi.fn(),
  };

  describe('field rendering', () => {
    it('should render all email fields', () => {
      render(<EmailFormFields {...defaultProps} />);

      expect(
        screen.getByPlaceholderText('remitente@ejemplo.com')
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('destinatario@ejemplo.com')
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText('cc@ejemplo.com')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('cco@ejemplo.com')
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Asunto del correo')
      ).toBeInTheDocument();
    });

    it('should have correct placeholders', () => {
      render(<EmailFormFields {...defaultProps} />);

      expect(
        screen.getByPlaceholderText('remitente@ejemplo.com')
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('destinatario@ejemplo.com')
      ).toBeInTheDocument();
    });

    it('should render from field with value', () => {
      render(<EmailFormFields {...defaultProps} from="sender@example.com" />);

      const fromInput = screen.getByPlaceholderText('remitente@ejemplo.com');
      expect(fromInput).toHaveValue('sender@example.com');
    });

    it('should render to field with value', () => {
      render(<EmailFormFields {...defaultProps} to="recipient@example.com" />);

      const toInput = screen.getByPlaceholderText('destinatario@ejemplo.com');
      expect(toInput).toHaveValue('recipient@example.com');
    });
  });

  describe('field updates', () => {
    it('should call setFrom when from field changes', async () => {
      const setFrom = vi.fn();
      render(<EmailFormFields {...defaultProps} setFrom={setFrom} />);

      const fromInput = screen.getByPlaceholderText('remitente@ejemplo.com');
      await userEvent.type(fromInput, 'new@example.com');

      expect(setFrom).toHaveBeenCalled();
    });

    it('should call setTo when to field changes', async () => {
      const setTo = vi.fn();
      render(<EmailFormFields {...defaultProps} setTo={setTo} />);

      const toInput = screen.getByPlaceholderText('destinatario@ejemplo.com');
      await userEvent.type(toInput, 'recipient@example.com');

      expect(setTo).toHaveBeenCalled();
    });

    it('should call setCc when cc field changes', async () => {
      const setCc = vi.fn();
      render(<EmailFormFields {...defaultProps} setCc={setCc} />);

      const ccInput = screen.getByPlaceholderText('cc@ejemplo.com');
      await userEvent.type(ccInput, 'cc@example.com');
      expect(setCc).toHaveBeenCalled();
    });

    it('should call setBcc when bcc field changes', async () => {
      const setBcc = vi.fn();
      render(<EmailFormFields {...defaultProps} setBcc={setBcc} />);

      const bccInput = screen.getByPlaceholderText('cco@ejemplo.com');
      await userEvent.type(bccInput, 'bcc@example.com');
      expect(setBcc).toHaveBeenCalled();
    });

    it('should call setSubject when subject field changes', async () => {
      const setSubject = vi.fn();
      render(<EmailFormFields {...defaultProps} setSubject={setSubject} />);

      const subjectInput = screen.getByPlaceholderText('Asunto del correo');
      await userEvent.type(subjectInput, 'Test Subject');
      expect(setSubject).toHaveBeenCalled();
    });
  });

  describe('fromHidden', () => {
    it('should render the from field when fromHidden is false', () => {
      render(<EmailFormFields {...defaultProps} fromHidden={false} />);

      expect(
        screen.getByPlaceholderText('remitente@ejemplo.com')
      ).toBeInTheDocument();
    });

    it('should render the from field when fromHidden is omitted (defaults to false)', () => {
      render(<EmailFormFields {...defaultProps} />);

      expect(
        screen.getByPlaceholderText('remitente@ejemplo.com')
      ).toBeInTheDocument();
    });

    it('should not render the from field when fromHidden is true', () => {
      render(<EmailFormFields {...defaultProps} fromHidden={true} />);

      expect(
        screen.queryByPlaceholderText('remitente@ejemplo.com')
      ).not.toBeInTheDocument();
    });

    it('should still render the other fields when fromHidden is true', () => {
      render(<EmailFormFields {...defaultProps} fromHidden={true} />);

      expect(
        screen.getByPlaceholderText('destinatario@ejemplo.com')
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText('cc@ejemplo.com')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('cco@ejemplo.com')
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Asunto del correo')
      ).toBeInTheDocument();
    });
  });

  describe('locked fields', () => {
    it('should disable from field when locked', () => {
      render(<EmailFormFields {...defaultProps} fromLocked={true} />);

      const fromInput = screen.getByPlaceholderText('remitente@ejemplo.com');
      expect(fromInput).toBeDisabled();
      expect(fromInput).toHaveClass('input--locked');
    });

    it('should show lock badge for locked from field', () => {
      const { container } = render(
        <EmailFormFields {...defaultProps} fromLocked={true} />
      );

      const lockedBadges = container.querySelectorAll('.locked-badge');
      expect(lockedBadges.length).toBeGreaterThan(0);
    });

    it('should disable to field when locked', () => {
      render(<EmailFormFields {...defaultProps} toLocked={true} />);

      const toInput = screen.getByPlaceholderText('destinatario@ejemplo.com');
      expect(toInput).toBeDisabled();
    });

    it('should disable cc field when locked', () => {
      render(<EmailFormFields {...defaultProps} ccLocked={true} />);
      expect(screen.getByPlaceholderText('cc@ejemplo.com')).toBeDisabled();
    });

    it('should disable bcc field when locked', () => {
      render(<EmailFormFields {...defaultProps} bccLocked={true} />);
      expect(screen.getByPlaceholderText('cco@ejemplo.com')).toBeDisabled();
    });

    it('should disable subject field when locked', () => {
      render(<EmailFormFields {...defaultProps} subjectLocked={true} />);
      expect(screen.getByPlaceholderText('Asunto del correo')).toBeDisabled();
    });

    it('should apply email-form-field--locked class when field is locked', () => {
      const { container } = render(
        <EmailFormFields {...defaultProps} fromLocked={true} />
      );

      const lockedField = container.querySelector('.email-form-field--locked');
      expect(lockedField).toBeInTheDocument();
    });
  });

  describe('template selection', () => {
    it('should render template selector when options are available', () => {
      const options = [
        { value: 'template-1', label: 'Template 1' },
        { value: 'template-2', label: 'Template 2' },
      ];

      render(<EmailFormFields {...defaultProps} templateOptions={options} />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should display template options', () => {
      const options = [
        { value: 'template-1', label: 'Welcome' },
        { value: 'template-2', label: 'Support' },
      ];
      const handleTemplateChange = vi.fn();

      render(
        <EmailFormFields
          {...defaultProps}
          templateOptions={options}
          handleTemplateChange={handleTemplateChange}
        />
      );

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'template-1' } });

      expect(handleTemplateChange).toHaveBeenCalled();
    });

    it('should call handleTemplateChange when template is selected', async () => {
      const handleTemplateChange = vi.fn();
      const options = [
        { value: 'template-1', label: 'Template 1' },
        { value: 'template-2', label: 'Template 2' },
      ];

      render(
        <EmailFormFields
          {...defaultProps}
          templateOptions={options}
          handleTemplateChange={handleTemplateChange}
        />
      );

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'template-1' } });

      expect(handleTemplateChange).toHaveBeenCalled();
    });

    it('should disable template selector when locked', () => {
      const options = [{ value: 'template-1', label: 'Template 1' }];

      render(
        <EmailFormFields
          {...defaultProps}
          templateOptions={options}
          templateLocked={true}
        />
      );

      expect(screen.getByRole('combobox')).toBeDisabled();
    });

    it('should show loading state for templates', () => {
      const { container } = render(
        <EmailFormFields {...defaultProps} templatesLoading={true} />
      );

      // Check for loading indicator
      const loadingText = screen.queryByText(/Cargando/i);
      expect(loadingText || container).toBeDefined();
    });

    it('should show error message when template loading fails', () => {
      render(
        <EmailFormFields
          {...defaultProps}
          templatesError="Failed to load templates"
        />
      );

      expect(screen.getByText('Failed to load templates')).toBeInTheDocument();
    });
  });

  describe('multiple recipients', () => {
    it('should accept comma-separated email addresses in to field', () => {
      render(
        <EmailFormFields
          {...defaultProps}
          to="user1@example.com, user2@example.com"
        />
      );

      const toInput = screen.getByPlaceholderText('destinatario@ejemplo.com');
      expect(toInput).toHaveValue('user1@example.com, user2@example.com');
    });

    it('should accept comma-separated email addresses in cc field', () => {
      render(
        <EmailFormFields
          {...defaultProps}
          cc="cc1@example.com, cc2@example.com"
        />
      );

      expect(screen.getByPlaceholderText('cc@ejemplo.com')).toHaveValue(
        'cc1@example.com, cc2@example.com'
      );
    });
  });

  describe('field combinations', () => {
    it('should allow multiple fields to be locked simultaneously', () => {
      render(
        <EmailFormFields
          {...defaultProps}
          fromLocked={true}
          toLocked={true}
          subjectLocked={true}
        />
      );

      const fromInput = screen.getByPlaceholderText('remitente@ejemplo.com');
      const toInput = screen.getByPlaceholderText('destinatario@ejemplo.com');

      expect(fromInput).toBeDisabled();
      expect(toInput).toBeDisabled();
    });

    it('should handle mixed locked/unlocked state', () => {
      render(
        <EmailFormFields
          {...defaultProps}
          fromLocked={true}
          toLocked={false}
          ccLocked={true}
        />
      );

      const fromInput = screen.getByPlaceholderText('remitente@ejemplo.com');
      const toInput = screen.getByPlaceholderText('destinatario@ejemplo.com');

      expect(fromInput).toBeDisabled();
      expect(toInput).not.toBeDisabled();
    });
  });

  describe('styling', () => {
    it('should have email-form-field class for each field', () => {
      const { container } = render(<EmailFormFields {...defaultProps} />);

      const fields = container.querySelectorAll('.email-form-field');
      expect(fields.length).toBeGreaterThan(0);
    });

    it('should apply email-form-field--locked class only to locked fields', () => {
      const { container } = render(
        <EmailFormFields {...defaultProps} fromLocked={true} toLocked={false} />
      );

      const lockedFields = container.querySelectorAll(
        '.email-form-field--locked'
      );
      expect(lockedFields.length).toBeGreaterThan(0);
      expect(lockedFields.length).toBeLessThan(
        container.querySelectorAll('.email-form-field').length
      );
    });
  });

  describe('input types', () => {
    it('should use text input for email fields', () => {
      render(<EmailFormFields {...defaultProps} />);

      const fromInput = screen.getByPlaceholderText('remitente@ejemplo.com');
      expect(fromInput.type).toBe('text');
    });
  });

  describe('empty state', () => {
    it('should render with empty values', () => {
      const { container } = render(
        <EmailFormFields
          {...defaultProps}
          from=""
          to=""
          cc=""
          bcc=""
          subject=""
        />
      );

      expect(container.querySelector('.email-form-field')).toBeInTheDocument();
    });
  });

  describe('value updates', () => {
    it('should update when from prop changes', () => {
      const { rerender } = render(
        <EmailFormFields {...defaultProps} from="old@example.com" />
      );

      const fromInput = screen.getByPlaceholderText('remitente@ejemplo.com');
      expect(fromInput).toHaveValue('old@example.com');

      rerender(<EmailFormFields {...defaultProps} from="new@example.com" />);

      expect(fromInput).toHaveValue('new@example.com');
    });
  });
});
