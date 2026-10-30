import React from 'react';

export const EmailAttachments = ({
  attachments,
  attachmentInputRef,
  attachmentsLocked,
  validExtensions,
  allowMultiple = true,
  onAttachmentClick,
  onAttachmentChange,
  onAttachmentRemove,
}) => (
  <div
    className={`email-form-field email-attachments-field${attachmentsLocked ? ' email-form-field--locked' : ''}`}
  >
    <label>
      Adjuntar archivos
      {attachmentsLocked && <span className="locked-badge">🔒</span>}
    </label>

    <div className="email-attachments-row">
      <button
        type="button"
        className={`btn email-attachments-btn${attachmentsLocked ? ' input--locked' : ''}`}
        onClick={!attachmentsLocked ? onAttachmentClick : undefined}
        disabled={attachmentsLocked}
      >
        Elegir archivos
      </button>

      <span className="email-attachments-hint">
        {attachments.length === 0
          ? 'Sin archivos seleccionados'
          : `${attachments.length} archivo${attachments.length > 1 ? 's' : ''} seleccionado${attachments.length > 1 ? 's' : ''}`}
      </span>

      <input
        type="file"
        multiple={allowMultiple}
        accept={validExtensions}
        ref={attachmentInputRef}
        onChange={onAttachmentChange}
        className="d-none"
        disabled={attachmentsLocked}
      />
    </div>

    {attachments.length > 0 && (
      <ul className="email-attachments-list">
        {attachments.map((file, index) => (
          <li key={`${file.name}-${index}`} className="email-attachments-item">
            <i className="fa fa-paperclip email-attachments-icon" />
            <span className="email-attachments-name" title={file.name}>
              {file.name}
            </span>
            <span className="email-attachments-size">
              ({(file.size / 1024).toFixed(1)} KB)
            </span>
            {!attachmentsLocked && (
              <i
                className="fa fa-times email-attachments-remove"
                title="Eliminar adjunto"
                onClick={() => onAttachmentRemove(index)}
              />
            )}
          </li>
        ))}
      </ul>
    )}
  </div>
);
