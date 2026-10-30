import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmailAttachments } from './EmailAttachments.jsx';

describe('EmailAttachments', () => {
  const defaultProps = {
    attachments: [],
    attachmentInputRef: { current: null },
    attachmentsLocked: false,
    validExtensions: undefined,
    allowMultiple: true,
    onAttachmentClick: vi.fn(),
    onAttachmentChange: vi.fn(),
    onAttachmentRemove: vi.fn(),
  };

  describe('accept constraint', () => {
    it('should not set the accept attribute when validExtensions is undefined', () => {
      render(
        <EmailAttachments {...defaultProps} validExtensions={undefined} />
      );

      const input = document.querySelector('input[type="file"]');
      expect(input).not.toHaveAttribute('accept');
    });

    it('should set the accept attribute to the provided validExtensions', () => {
      render(
        <EmailAttachments {...defaultProps} validExtensions=".pdf,.png,.docx" />
      );

      const input = document.querySelector('input[type="file"]');
      expect(input).toHaveAttribute('accept', '.pdf,.png,.docx');
    });
  });

  describe('multiple constraint', () => {
    it('should allow selecting multiple files when allowMultiple is true', () => {
      render(<EmailAttachments {...defaultProps} allowMultiple={true} />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toHaveAttribute('multiple');
    });

    it('should restrict to a single file when allowMultiple is false', () => {
      render(<EmailAttachments {...defaultProps} allowMultiple={false} />);

      const input = document.querySelector('input[type="file"]');
      expect(input).not.toHaveAttribute('multiple');
    });

    it('should default to allowing multiple files when allowMultiple is not provided', () => {
      const { allowMultiple, ...propsWithoutAllowMultiple } = defaultProps;
      render(<EmailAttachments {...propsWithoutAllowMultiple} />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toHaveAttribute('multiple');
    });
  });

  describe('interactions', () => {
    it('should call onAttachmentClick when the button is clicked', () => {
      const onAttachmentClick = vi.fn();
      render(
        <EmailAttachments
          {...defaultProps}
          onAttachmentClick={onAttachmentClick}
        />
      );

      fireEvent.click(screen.getByText('Elegir archivos'));

      expect(onAttachmentClick).toHaveBeenCalled();
    });

    it('should not trigger onAttachmentClick when locked', () => {
      const onAttachmentClick = vi.fn();
      render(
        <EmailAttachments
          {...defaultProps}
          attachmentsLocked={true}
          onAttachmentClick={onAttachmentClick}
        />
      );

      fireEvent.click(screen.getByText('Elegir archivos'));

      expect(onAttachmentClick).not.toHaveBeenCalled();
    });

    it('should disable the file input and button when locked', () => {
      render(<EmailAttachments {...defaultProps} attachmentsLocked={true} />);

      expect(screen.getByText('Elegir archivos')).toBeDisabled();
      expect(document.querySelector('input[type="file"]')).toBeDisabled();
    });

    it('should call onAttachmentChange when files are selected', () => {
      const onAttachmentChange = vi.fn();
      render(
        <EmailAttachments
          {...defaultProps}
          onAttachmentChange={onAttachmentChange}
        />
      );

      const input = document.querySelector('input[type="file"]');
      fireEvent.change(input, { target: { files: [] } });

      expect(onAttachmentChange).toHaveBeenCalled();
    });

    it('should call onAttachmentRemove with the correct index', () => {
      const onAttachmentRemove = vi.fn();
      const attachments = [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')];

      render(
        <EmailAttachments
          {...defaultProps}
          attachments={attachments}
          onAttachmentRemove={onAttachmentRemove}
        />
      );

      const removeIcons = document.querySelectorAll(
        '.email-attachments-remove'
      );
      fireEvent.click(removeIcons[1]);

      expect(onAttachmentRemove).toHaveBeenCalledWith(1);
    });

    it('should not render remove icons when locked', () => {
      const attachments = [new File(['a'], 'a.txt')];

      render(
        <EmailAttachments
          {...defaultProps}
          attachments={attachments}
          attachmentsLocked={true}
        />
      );

      expect(
        document.querySelectorAll('.email-attachments-remove').length
      ).toBe(0);
    });
  });

  describe('attachment list rendering', () => {
    it('should show the empty state hint when there are no attachments', () => {
      render(<EmailAttachments {...defaultProps} attachments={[]} />);

      expect(
        screen.getByText('Sin archivos seleccionados')
      ).toBeInTheDocument();
    });

    it('should list selected attachments with name and size', () => {
      const file = new File(['x'.repeat(2048)], 'document.pdf');
      render(<EmailAttachments {...defaultProps} attachments={[file]} />);

      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.getByText('1 archivo seleccionado')).toBeInTheDocument();
    });

    it('should pluralize the hint for multiple attachments', () => {
      const files = [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')];
      render(<EmailAttachments {...defaultProps} attachments={files} />);

      expect(screen.getByText('2 archivos seleccionados')).toBeInTheDocument();
    });
  });
});
