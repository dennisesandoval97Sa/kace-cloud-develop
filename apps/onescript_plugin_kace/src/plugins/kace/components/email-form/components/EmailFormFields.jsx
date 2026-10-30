import React from 'react';

export const EmailFormFields = ({
  from,
  setFrom,
  fromLocked,
  fromHidden = false,
  to,
  setTo,
  toLocked,
  cc,
  setCc,
  ccLocked,
  bcc,
  setBcc,
  bccLocked,
  subject,
  setSubject,
  subjectLocked,
  template,
  templateLocked,
  templatesLoading,
  templatesError,
  templateOptions,
  handleTemplateChange,
}) => (
  <>
    {!fromHidden && (
      <div
        className={`email-form-field${fromLocked ? ' email-form-field--locked' : ''}`}
      >
        <label>
          De {fromLocked && <span className="locked-badge">🔒</span>}
        </label>
        <input
          type="text"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="remitente@ejemplo.com"
          disabled={fromLocked}
          className={fromLocked ? 'input--locked' : ''}
        />
      </div>
    )}

    <div
      className={`email-form-field${toLocked ? ' email-form-field--locked' : ''}`}
    >
      <label>Para {toLocked && <span className="locked-badge">🔒</span>}</label>
      <input
        type="text"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="destinatario@ejemplo.com"
        disabled={toLocked}
        className={toLocked ? 'input--locked' : ''}
      />
    </div>

    <div
      className={`email-form-field${ccLocked ? ' email-form-field--locked' : ''}`}
    >
      <label>CC {ccLocked && <span className="locked-badge">🔒</span>}</label>
      <input
        type="text"
        value={cc}
        onChange={(e) => setCc(e.target.value)}
        placeholder="cc@ejemplo.com"
        disabled={ccLocked}
        className={ccLocked ? 'input--locked' : ''}
      />
    </div>

    <div
      className={`email-form-field${bccLocked ? ' email-form-field--locked' : ''}`}
    >
      <label>CCO {bccLocked && <span className="locked-badge">🔒</span>}</label>
      <input
        type="text"
        value={bcc}
        onChange={(e) => setBcc(e.target.value)}
        placeholder="cco@ejemplo.com"
        disabled={bccLocked}
        className={bccLocked ? 'input--locked' : ''}
      />
    </div>

    <div
      className={`email-form-field${subjectLocked ? ' email-form-field--locked' : ''}`}
    >
      <label>
        Asunto {subjectLocked && <span className="locked-badge">🔒</span>}
      </label>
      <input
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Asunto del correo"
        disabled={subjectLocked}
        className={subjectLocked ? 'input--locked' : ''}
      />
    </div>

    <div
      className={`email-form-field${templateLocked ? ' email-form-field--locked' : ''}`}
    >
      <label>
        Plantilla {templateLocked && <span className="locked-badge">🔒</span>}
      </label>
      <select
        value={template}
        onChange={handleTemplateChange}
        disabled={templateLocked || templatesLoading}
        className={templateLocked ? 'input--locked' : ''}
      >
        {templatesLoading && <option value="">Cargando plantillas...</option>}
        {templatesError && <option value="">{templatesError}</option>}
        {!templatesLoading && !templatesError && (
          <>
            <option value="">-- Seleccionar plantilla --</option>
            {templateOptions.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  </>
);
