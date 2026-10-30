import React from 'react';

export const EmailFormActions = ({
  replyLocked,
  replyAllLocked,
  newEmailLocked,
  cancelLocked,
  sendLocked,
  replyHidden,
  replyAllHidden,
  newEmailHidden,
  cancelHidden,
  sendHidden,
  isSending,
  sendButtonText = 'Enviar',
  sendingButtonText = 'Enviando...',
  sendButtonIcon = 'fa fa-paper-plane',
  sendButtonIconHidden = false,
  sendButtonColor,
  floatingButton = false,
  onReply,
  onReplyAll,
  onNewEmail,
  onCancel,
  onSend,
}) => (
  <div className="email-form-actions">
    {!replyHidden && (
      <button
        type="button"
        className={`btn${replyLocked ? ' input--locked' : ''}`}
        onClick={onReply}
        disabled={replyLocked}
      >
        ↩ Responder
      </button>
    )}
    {!replyAllHidden && (
      <button
        type="button"
        className={`btn${replyAllLocked ? ' input--locked' : ''}`}
        onClick={onReplyAll}
        disabled={replyAllLocked}
      >
        ↩ Responder a todos
      </button>
    )}
    {!newEmailHidden && (
      <button
        type="button"
        className={`btn${newEmailLocked ? ' input--locked' : ''}`}
        onClick={onNewEmail}
        disabled={newEmailLocked}
      >
        ✉ Nueva respuesta
      </button>
    )}
    {!cancelHidden && (
      <button
        type="button"
        className={`btn btn-cancel${cancelLocked ? ' input--locked' : ''}`}
        onClick={onCancel}
        disabled={cancelLocked}
      >
        ✕ Cancelar respuesta
      </button>
    )}
    {!sendHidden && (
      <button
        type="button"
        className={`btn btn-send${sendLocked || isSending ? ' input--locked' : ''}${floatingButton ? ' kace-floating-submit' : ''}`}
        style={
          sendButtonColor
            ? { backgroundColor: sendButtonColor, borderColor: sendButtonColor }
            : undefined
        }
        onClick={onSend}
        disabled={sendLocked || isSending}
      >
        {isSending ? (
          <>
            <i className="fa fa-spinner fa-spin" /> {sendingButtonText}
          </>
        ) : (
          <>
            {!sendButtonIconHidden && <i className={sendButtonIcon} />}{' '}
            {sendButtonText}
          </>
        )}
      </button>
    )}
  </div>
);
