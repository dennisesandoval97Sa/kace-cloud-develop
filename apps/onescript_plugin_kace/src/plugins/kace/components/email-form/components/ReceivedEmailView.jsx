import React from 'react';

const UUID_PREFIX_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i;

const displayAttachmentName = (name) =>
  typeof name === 'string' ? name.replace(UUID_PREFIX_RE, '') : name;

/**
 * @param {{ loading: boolean, receivedEmail: ReceivedEmailData | null, receivedAttachments?: Array, bodyModeRef: React.RefObject, onDownloadAttachment?: (attachment: Record<string, unknown>) => void, downloadingAttachmentId?: string|null }} props
 * @typedef {import('#plugins/kace/hooks/useReceivedEmail.js').ReceivedEmailData} ReceivedEmailData
 */
export const ReceivedEmailView = ({
  loading,
  receivedEmail,
  receivedAttachments = [],
  bodyModeRef,
  onDownloadAttachment,
  downloadingAttachmentId = null,
}) => {
  if (loading) {
    return (
      <div className="email-form-field">
        <label>Histórico Correos</label>
        <div className="email-received-loading">
          <div
            className="spinner-border spinner-border-sm text-primary"
            role="status"
          >
            <span className="sr-only">Cargando...</span>
          </div>
          <span className="email-received-loading-text">
            Obteniendo correo recibido...
          </span>
        </div>
      </div>
    );
  }

  const emailAttachments = receivedEmail?.attachments || receivedAttachments;
  const hasContent = receivedEmail || emailAttachments.length > 0;

  if (!hasContent) {
    return (
      <div className="email-form-field">
        <label>Histórico Correos</label>
        <p className="email-received-empty">Sin correos recibidos</p>
      </div>
    );
  }

  const { from, to, cc, bcc, date, bodyHtml } = receivedEmail || {};

  return (
    <div className="email-form-field">
      <label>Histórico Correos</label>

      <div className="email-received-scroll-container">
        {receivedEmail && (
          <div className="email-received-meta">
            <div className="email-received-meta-row">
              <span className="email-received-meta-label">De:</span>
              <span className="email-received-meta-value">{from}</span>
            </div>
            <div className="email-received-meta-row">
              <span className="email-received-meta-label">Para:</span>
              <span className="email-received-meta-value">{to}</span>
            </div>
            {cc && (
              <div className="email-received-meta-row">
                <span className="email-received-meta-label">CC:</span>
                <span className="email-received-meta-value">{cc}</span>
              </div>
            )}
            {bcc && (
              <div className="email-received-meta-row">
                <span className="email-received-meta-label">CCO:</span>
                <span className="email-received-meta-value">{bcc}</span>
              </div>
            )}
            <div className="email-received-meta-row">
              <span className="email-received-meta-label">Fecha envío:</span>
              <span className="email-received-meta-value">
                {date ? new Date(date).toLocaleString() : '—'}
              </span>
            </div>
          </div>
        )}

        <div className="email-body-wrapper email-body-wrapper--locked">
          <div
            ref={bodyModeRef}
            className="email-body-content"
            contentEditable={false}
            suppressContentEditableWarning
            data-placeholder="Sin contenido"
            {...(bodyHtml
              ? { dangerouslySetInnerHTML: { __html: bodyHtml } }
              : {})}
          />
        </div>

        {emailAttachments.length > 0 && (
          <div className="email-received-attachments">
            <label>Adjuntos recibidos</label>
            <ul className="email-attachments-list">
              {emailAttachments.map((file, index) => {
                const rawName =
                  typeof file === 'string'
                    ? file
                    : file.name || file.filename || `Adjunto ${index + 1}`;
                const name = displayAttachmentName(rawName);
                const size = typeof file === 'object' ? file.size : null;
                const downloadKey = `${index}-${rawName}`;
                const isDownloading = downloadingAttachmentId === downloadKey;
                return (
                  <li key={`recv-${index}`} className="email-attachments-item">
                    <i className="fa fa-paperclip email-attachments-icon" />
                    <span className="email-attachments-name" title={name}>
                      {name}
                    </span>
                    {size && (
                      <span className="email-attachments-size">
                        ({(size / 1024).toFixed(1)} KB)
                      </span>
                    )}
                    {onDownloadAttachment && typeof file === 'object' && (
                      <button
                        type="button"
                        className="email-attachments-download"
                        title="Descargar adjunto"
                        disabled={isDownloading}
                        onClick={() => onDownloadAttachment(file, downloadKey)}
                      >
                        <i
                          className={`fa ${isDownloading ? 'fa-spinner fa-spin' : 'fa-download'}`}
                        />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
