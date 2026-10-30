import React, { useRef } from 'react';
import './EmailForm.css';
import { useEmailForm } from '#plugins/kace/hooks/useEmailForm.js';
import { useReceivedEmail } from '#plugins/kace/hooks/useReceivedEmail.js';
import { useEmailFormOverrides } from '#plugins/kace/hooks/useEmailFormOverrides.js';
import { EmailFormActions } from './components/EmailFormActions.jsx';
import { EmailFormFields } from './components/EmailFormFields.jsx';
import { EmailBodyEditor } from './components/EmailBodyEditor.jsx';
import { EmailAttachments } from './components/EmailAttachments.jsx';
import { ReceivedEmailView } from './components/ReceivedEmailView.jsx';
import { SendStatusAlerts } from './components/SendStatusAlerts.jsx';

/**
 * @typedef EmailFormData
 * @prop {string} from
 * @prop {string} to
 * @prop {string} cc
 * @prop {string} bcc
 * @prop {string} subject
 * @prop {string} template
 * @prop {string} body
 * @prop {File[]} attachments
 * @prop {'reply'|'replyAll'|'newEmail'|'send'} action
 */

export const EmailForm = ({
  onSubmit,
  onCancel,
  onActionChange,
  customSendHandler,
  customSaveHandler,
  fromLocked = false,
  fromHidden = false,
  toLocked = false,
  ccLocked = false,
  bccLocked = false,
  subjectLocked = false,
  templateLocked = false,
  bodyLocked = false,
  attachmentsLocked = false,
  replyLocked = false,
  replyAllLocked = false,
  newEmailLocked = false,
  cancelLocked = false,
  sendLocked = false,
  replyHidden = false,
  replyAllHidden = false,
  newEmailHidden = false,
  cancelHidden = false,
  sendHidden = false,
  bodyMode = false,
  receivedEmailAutoLoad = true,
  receivedAttachments = [],
  receivedAttachmentsS3Bucket = 'attachments',
  customDownloadAttachmentHandler,
  sendButtonText = 'Enviar',
  sendingButtonText = 'Enviando...',
  sendButtonIcon = 'fa fa-paper-plane',
  sendButtonIconHidden = false,
  sendButtonColor,
  floatingButton = false,
  saveCaseBeforeSend = false,
  submissionData: submissionDataProp,
  emitEvent,
  onMountCode = '',
  onActionChangeCode = '',
}) => {
  const submissionDataRef = useRef(submissionDataProp);
  submissionDataRef.current = submissionDataProp;
  const getSubmissionData = React.useCallback(
    typeof submissionDataProp === 'function'
      ? submissionDataProp
      : () => submissionDataRef.current,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [typeof submissionDataProp === 'function' ? submissionDataProp : null]
  );

  const baseProps = {
    fromLocked,
    fromHidden,
    toLocked,
    ccLocked,
    bccLocked,
    subjectLocked,
    templateLocked,
    bodyLocked,
    attachmentsLocked,
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
  };

  const {
    loading: receivedLoading,
    receivedEmail,
    downloadingAttachmentId,
    handleDownloadAttachment,
  } = useReceivedEmail({
    active: bodyMode,
    autoLoad: receivedEmailAutoLoad,
    receivedAttachmentsS3Bucket,
    customDownloadAttachmentHandler,
  });

  const {
    activeAction,
    formVisible,
    from,
    setFrom,
    to,
    setTo,
    cc,
    setCc,
    bcc,
    setBcc,
    subject,
    setSubject,
    template,
    bodyRef,
    templateOptions,
    templatesLoading,
    templatesError,
    handleTemplateChange,
    exec,
    handleReply,
    handleReplyAll,
    handleNewEmail,
    handleCancel,
    attachments,
    attachmentInputRef,
    validExtensions,
    allowMultiple,
    handleAttachmentClick,
    handleAttachmentChange,
    handleAttachmentRemove,
    isSending,
    sendError,
    sendSuccess,
    handleSend,
  } = useEmailForm({
    onSubmit,
    onCancel,
    customSendHandler,
    customSaveHandler,
    saveCaseBeforeSend,
    getSubmissionData,
    emitEvent,
    receivedEmail,
  });

  const fieldSetters = React.useMemo(
    () => ({
      from: setFrom,
      to: setTo,
      cc: setCc,
      bcc: setBcc,
      subject: setSubject,
    }),
    [setFrom, setTo, setCc, setBcc, setSubject]
  );

  const { overrides, setFieldLocked, setFieldHidden, setFieldValue, runCode } =
    useEmailFormOverrides(baseProps, getSubmissionData, fieldSetters);

  React.useEffect(() => {
    onActionChange?.(activeAction);
    if (onActionChangeCode?.trim()) {
      runCode(onActionChangeCode, { action: activeAction });
    }
  }, [activeAction, onActionChange, onActionChangeCode, runCode]);

  const didRunMountRef = useRef(false);
  React.useEffect(() => {
    if (didRunMountRef.current) return;
    if (!onMountCode?.trim()) return;
    didRunMountRef.current = true;
    runCode(onMountCode, { action: activeAction });
  }, [onMountCode, runCode, activeAction]);

  const bodyModeRef = useRef(null);

  const renderForm = () => (
    <>
      <EmailFormFields
        from={from}
        setFrom={setFrom}
        fromLocked={overrides.fromLocked}
        fromHidden={overrides.fromHidden}
        to={to}
        setTo={setTo}
        toLocked={overrides.toLocked}
        cc={cc}
        setCc={setCc}
        ccLocked={overrides.ccLocked}
        bcc={bcc}
        setBcc={setBcc}
        bccLocked={overrides.bccLocked}
        subject={subject}
        setSubject={setSubject}
        subjectLocked={overrides.subjectLocked}
        template={template}
        templateLocked={overrides.templateLocked}
        templatesLoading={templatesLoading}
        templatesError={templatesError}
        templateOptions={templateOptions}
        handleTemplateChange={handleTemplateChange}
      />
      <EmailBodyEditor
        bodyRef={bodyRef}
        bodyLocked={overrides.bodyLocked}
        exec={exec}
      />
      <EmailAttachments
        attachments={attachments}
        attachmentInputRef={attachmentInputRef}
        attachmentsLocked={overrides.attachmentsLocked}
        validExtensions={validExtensions}
        allowMultiple={allowMultiple}
        onAttachmentClick={handleAttachmentClick}
        onAttachmentChange={handleAttachmentChange}
        onAttachmentRemove={handleAttachmentRemove}
      />
    </>
  );

  const renderReceivedEmail = () => (
    <ReceivedEmailView
      loading={receivedLoading}
      receivedEmail={receivedEmail}
      receivedAttachments={receivedAttachments}
      bodyModeRef={bodyModeRef}
      onDownloadAttachment={handleDownloadAttachment}
      downloadingAttachmentId={downloadingAttachmentId}
    />
  );

  return (
    <div className="email-form-wrapper">
      <EmailFormActions
        replyLocked={overrides.replyLocked}
        replyAllLocked={overrides.replyAllLocked}
        newEmailLocked={overrides.newEmailLocked}
        cancelLocked={overrides.cancelLocked}
        sendLocked={overrides.sendLocked}
        replyHidden={overrides.replyHidden}
        replyAllHidden={overrides.replyAllHidden}
        newEmailHidden={overrides.newEmailHidden}
        cancelHidden={overrides.cancelHidden}
        sendHidden={overrides.sendHidden}
        isSending={isSending}
        sendButtonText={sendButtonText}
        sendingButtonText={sendingButtonText}
        sendButtonIcon={sendButtonIcon}
        sendButtonIconHidden={sendButtonIconHidden}
        sendButtonColor={sendButtonColor}
        floatingButton={floatingButton}
        onReply={handleReply}
        onReplyAll={handleReplyAll}
        onNewEmail={handleNewEmail}
        onCancel={handleCancel}
        onSend={handleSend}
      />

      <SendStatusAlerts sendSuccess={sendSuccess} sendError={sendError} />

      {!bodyMode && renderForm()}

      {bodyMode && !formVisible && renderReceivedEmail()}

      {bodyMode && formVisible && (
        <div className="email-body-mode-horizontal">
          <div className="email-body-mode-form">{renderForm()}</div>
          <div className="email-body-mode-body email-body-mode-body--readonly">
            {renderReceivedEmail()}
          </div>
        </div>
      )}
    </div>
  );
};
