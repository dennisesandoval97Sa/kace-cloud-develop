import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import DOMPurify from 'dompurify';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import { resolveTemplate } from '#plugins/kace/components/email-form/EmailTemplatesUtils';
import { postMessageToParent } from '#plugins/kace/shared/postMessageToParent.util.js';
import { showStaleWarnings } from '#plugins/kace/shared/showStaleWarnings.js';
import { EMAIL_HTML_SANITIZE_CONFIG } from '#plugins/kace/shared/emailHtmlSanitizeConfig.js';
import { resolveTemplateAttachmentPlaceholders } from '#plugins/kace/shared/templateAttachmentImageResolver.js';
import Swal from 'sweetalert2';

/**
 * Encapsulates all state and side-effect logic for the EmailForm component.
 *
 * @param {{ onSubmit?: (data: import('#plugins/kace/components/email-form/EmailForm.jsx').EmailFormData) => void, onCancel?: () => void, customSendHandler?: (payload: object, context: object) => Promise<void>, customSaveHandler?: (context: { data: unknown, caseData: unknown, auxCaseData: unknown, currentCaseId: string|null, kaceEngine: unknown, apiService: unknown, storeService: unknown, caseService: unknown, postMessageToParent: Function, Swal: unknown }) => Promise<{caseId?: string}|null|undefined>, saveCaseBeforeSend?: boolean, getSubmissionData?: () => Record<string, unknown>, emitEvent?: (eventName: string, payload: any) => void, receivedEmail?: Record<string, unknown> }} handlers
 */
export function useEmailForm({
  onSubmit,
  onCancel,
  customSendHandler,
  customSaveHandler,
  saveCaseBeforeSend = false,
  getSubmissionData = () => ({}),
  emitEvent,
  receivedEmail,
} = {}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [template, setTemplate] = useState('');
  const bodyRef = useRef(null);
  const templateChangeEpochRef = useRef(0);
  const [formVisible, setFormVisible] = useState(false);

  const [templateOptions, setTemplateOptions] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState(null);

  const attachmentInputRef = useRef(null);
  const [attachments, setAttachments] = useState([]);

  const [activeAction, setActiveAction] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  useEffect(() => {
    const caseService = KaceEngine().getService('cases');
    caseService
      .get('cases.case_data')
      .catch((err) =>
        console.error('[EmailForm] Failed to fetch case data:', err)
      );
  }, []);

  const loadTemplates = useCallback(() => {
    const storeService = KaceEngine().getService('storeService');
    const classificationId = storeService?.get(
      'classifications.current_classification'
    );

    if (!classificationId) {
      setTemplateOptions([]);
      setTemplatesLoading(false);
      setTemplatesError(null);
      return;
    }

    setTemplatesLoading(true);
    setTemplatesError(null);

    storeService.set('email.templates', null);

    const emailService = KaceEngine().getService('email');
    emailService
      .get('email.templates')
      .then((options) => setTemplateOptions(options))
      .catch((err) => {
        console.error('[EmailForm] Failed to fetch email templates:', err);
        setTemplatesError('No se pudieron cargar las plantillas.');
      })
      .finally(() => setTemplatesLoading(false));
  }, []);

  useEffect(() => {
    const storeService = KaceEngine().getService('storeService');
    let lastClassification =
      storeService?.get('classifications.current_classification') || null;

    loadTemplates();

    const interval = setInterval(() => {
      const current =
        storeService?.get('classifications.current_classification') || null;
      if (current !== lastClassification) {
        lastClassification = current;
        loadTemplates();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [loadTemplates]);

  const toStr = (value) => {
    if (!value) return '';
    if (Array.isArray(value))
      return value
        .map((v) => (typeof v === 'object' && v !== null ? v.email || '' : v))
        .filter(Boolean)
        .join(', ');
    if (typeof value === 'object') return value.email || '';
    return value;
  };

  const handleTemplateChange = useCallback(
    async (e) => {
      const myEpoch = ++templateChangeEpochRef.current;
      const selectedValue = e.target.value;
      setTemplate(selectedValue);

      if (!selectedValue) return;

      const selectedTemplate = templateOptions.find(
        (t) => t.value === selectedValue
      );
      if (!selectedTemplate) return;

      const resolved = resolveTemplate(selectedTemplate);

      if (activeAction !== 'reply' && activeAction !== 'replyAll') {
        setSubject(resolved.asunto ?? '');
      }

      if (bodyRef.current) {
        const rawCuerpo = resolved.cuerpo ?? '';

        const apiService = KaceEngine().getService('apiService');
        const html = await resolveTemplateAttachmentPlaceholders(
          rawCuerpo,
          apiService
        );

        if (myEpoch !== templateChangeEpochRef.current) return;

        bodyRef.current.innerHTML = DOMPurify.sanitize(
          html,
          EMAIL_HTML_SANITIZE_CONFIG
        );
      }
    },
    [templateOptions, activeAction]
  );

  const exec = useCallback((command, value = null) => {
    bodyRef.current?.focus();
    document.execCommand(command, false, value);
  }, []);

  const storeService = KaceEngine().getService('storeService');
  const globalConfig = storeService.get('config.global_config');
  const fileExtConfig = useMemo(
    () => globalConfig?.behaviors?.application?.agente?.files_extensions ?? {},
    [globalConfig]
  );

  const maxFileSizeMB = fileExtConfig.maximun_size_allowed || 0;
  const maxCount = fileExtConfig.quantity_files_allowed || 0;
  const allowedExtsList = useMemo(
    () =>
      (fileExtConfig.allowed_file_extensions || []).map((ext) =>
        ext.replace('.', '').toLowerCase()
      ),
    [fileExtConfig.allowed_file_extensions]
  );
  const validExtensions = useMemo(
    () =>
      allowedExtsList.length
        ? allowedExtsList.map((e) => `.${e}`).join(',')
        : undefined,
    [allowedExtsList]
  );
  const allowMultiple = !maxCount || maxCount > 1;

  const handleAttachmentClick = useCallback(() => {
    attachmentInputRef.current?.click();
  }, []);

  const handleAttachmentChange = useCallback(
    (e) => {
      const selected = Array.from(e.target.files || []);
      e.target.value = '';
      if (!selected.length) return;

      let toAdd = selected;
      const rejected = { quota: 0, extension: [], size: [], duplicate: [] };

      if (maxCount > 0) {
        const available = maxCount - attachments.length;
        if (available <= 0) {
          rejected.quota = toAdd.length;
          toAdd = [];
        } else if (toAdd.length > available) {
          rejected.quota = toAdd.length - available;
          toAdd = toAdd.slice(0, available);
        }
      }

      const valid = toAdd.filter((file) => {
        if (allowedExtsList.length > 0) {
          const ext = file.name.split('.').pop().toLowerCase();
          if (!allowedExtsList.includes(ext)) {
            rejected.extension.push(file.name);
            return false;
          }
        }
        if (maxFileSizeMB > 0 && file.size > maxFileSizeMB * 1024 * 1024) {
          rejected.size.push(file.name);
          return false;
        }
        if (attachments.some((f) => f.name === file.name)) {
          rejected.duplicate.push(file.name);
          return false;
        }
        return true;
      });

      if (valid.length) {
        setAttachments((prev) => [...prev, ...valid]);
      }

      const totalRejected =
        rejected.quota +
        rejected.extension.length +
        rejected.size.length +
        rejected.duplicate.length;

      if (totalRejected > 0) {
        const messages = [];
        if (rejected.extension.length)
          messages.push(
            `Extensión no permitida: ${rejected.extension.join(', ')}`
          );
        if (rejected.size.length)
          messages.push(
            `Supera el tamaño máximo permitido (${maxFileSizeMB} MB): ${rejected.size.join(', ')}`
          );
        if (rejected.duplicate.length)
          messages.push(
            `Ya estaban adjuntados: ${rejected.duplicate.join(', ')}`
          );
        if (rejected.quota > 0)
          messages.push(
            `Se alcanzó el máximo de ${maxCount} adjunto${maxCount > 1 ? 's' : ''} permitido${maxCount > 1 ? 's' : ''}; no se agregó${rejected.quota > 1 ? 'n' : ''} ${rejected.quota} archivo${rejected.quota > 1 ? 's' : ''}`
          );

        Swal.fire({
          icon: 'warning',
          title: 'Archivos no adjuntados',
          text: messages.join('\n'),
          confirmButtonText: 'Entendido',
        });
      }
    },
    [attachments, allowedExtsList, maxCount, maxFileSizeMB]
  );

  const handleAttachmentRemove = useCallback((index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const buildData = useCallback(
    (action) => ({
      from,
      to,
      cc,
      bcc,
      subject,
      template,
      body: bodyRef.current?.innerHTML || '',
      attachments,
      action,
    }),
    [from, to, cc, bcc, subject, template, attachments]
  );

  const handleReply = useCallback(() => {
    setFormVisible(true);
    setActiveAction('reply');
    setFrom((prev) => receivedEmail?.email_account || prev);
    setTo(toStr(receivedEmail?.from));
    setCc('');
    setBcc('');
    setSubject(receivedEmail?.subject ? `Re: ${receivedEmail.subject}` : '');
    onSubmit?.(buildData('reply'));
  }, [onSubmit, buildData, receivedEmail]);

  const handleReplyAll = useCallback(() => {
    setFormVisible(true);
    setActiveAction('replyAll');
    const ownAccount = receivedEmail?.email_account || '';
    setFrom((prev) => ownAccount || prev);

    const toEmails = (value) => {
      if (!value) return [];
      if (Array.isArray(value))
        return value.map((v) =>
          typeof v === 'object' && v !== null ? v.email || '' : v
        );
      if (typeof value === 'object') return [value.email || ''];
      return value.split(',').map((s) => s.trim());
    };

    const originalFrom = toStr(receivedEmail?.from);
    const originalTo = toEmails(receivedEmail?.to).filter(
      (e) => e && e.toLowerCase() !== ownAccount.toLowerCase()
    );
    const allTo = [originalFrom, ...originalTo].filter(Boolean);
    setTo(allTo.join(', '));

    setCc(toStr(receivedEmail?.cc));
    setBcc(toStr(receivedEmail?.bcc));
    setSubject(receivedEmail?.subject ? `Re: ${receivedEmail.subject}` : '');
    onSubmit?.(buildData('replyAll'));
  }, [onSubmit, buildData, receivedEmail]);

  const handleNewEmail = useCallback(() => {
    setFormVisible(true);
    setActiveAction('newEmail');
    setFrom((prev) => receivedEmail?.email_account || prev);
    setTo(toStr(receivedEmail?.from));
    setCc('');
    setBcc('');
    setSubject('');
    onSubmit?.(buildData('newEmail'));
  }, [onSubmit, buildData, receivedEmail]);

  const handleCancel = useCallback(() => {
    setFormVisible(false);
    setActiveAction(null);
    onCancel?.();
  }, [onCancel]);

  const buildPayload = useCallback(
    (caseId) => {
      const resolvedFrom = from || receivedEmail?.email_account || '';
      const resolvedInReplyTo = receivedEmail?.in_reply_to || '';
      const resolvedInteractionId = receivedEmail?.interaction_id || '';
      const resolvedCc = cc || '';
      const resolvedBcc = bcc || '';

      const base = { case_id: caseId, from: resolvedFrom };
      const payloads = {
        reply: {
          ...base,
          in_reply_to: resolvedInReplyTo,
          interaction_id: resolvedInteractionId,
          reply_message_to_send: bodyRef.current?.innerHTML || '',
          is_reply_all: false,
          cc: resolvedCc
            ? resolvedCc
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          bcc: resolvedBcc
            ? resolvedBcc
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          attachments: [],
        },
        replyAll: {
          ...base,
          in_reply_to: resolvedInReplyTo,
          interaction_id: resolvedInteractionId,
          reply_message_to_send: bodyRef.current?.innerHTML || '',
          is_reply_all: true,
          cc: resolvedCc
            ? resolvedCc
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          bcc: resolvedBcc
            ? resolvedBcc
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          attachments: [],
        },
        default: {
          ...base,
          to: to
            ? to
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          cc: cc
            ? cc
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          bcc: bcc
            ? bcc
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          subject,
          message_to_send: bodyRef.current?.innerHTML || '',
          template,
        },
        newEmail: {
          ...base,
          ...(resolvedInteractionId && {
            interaction_id: resolvedInteractionId,
          }),
          to: to
            ? to
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          cc: resolvedCc
            ? resolvedCc
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          bcc: resolvedBcc
            ? resolvedBcc
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          subject: subject || '',
          message_to_send: bodyRef.current?.innerHTML || '',
          attachments: [],
        },
      };
      return payloads[activeAction] || payloads.default;
    },
    [from, to, cc, bcc, subject, template, activeAction, receivedEmail]
  );

  const uploadAttachmentsAndGetUrls = useCallback(
    async (caseId, files, apiService) => {
      if (!files.length) return [];

      const filesWithKeys = files.map((file) => ({
        file,
        fileName: `${uuidv4()}_${file.name}`,
      }));

      await Promise.all(
        filesWithKeys.map(async ({ file, fileName }) => {
          const res = await apiService.post('/upload-s3-files', {
            id: caseId,
            contentType: file.type || 'application/octet-stream',
            fileName,
            url: 'attachments',
          });
          const uploadUrl = res?.data?.data?.uploadUrl;
          if (!uploadUrl)
            throw new Error('No se recibió la URL pre-firmada de S3');
          await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
            },
            body: file,
          });
          await apiService.post('/upload-s3-files/scan-s3-file', {
            url: 'attachments',
            id: caseId,
            fileName,
          });
        })
      );

      const urls = await Promise.all(
        filesWithKeys.map(async ({ file, fileName }) => {
          const res = await apiService.post('/download-s3-files', {
            id: caseId,
            contentType: file.type || 'application/octet-stream',
            fileName,
            url: 'attachments',
          });
          return res?.data?.data?.uploadUrl ?? res?.data?.uploadUrl;
        })
      );

      return urls.filter(Boolean);
    },
    []
  );

  const validateEmailFields = useCallback(() => {
    const body = bodyRef.current?.innerHTML || '';
    const isBodyEmpty = !body || body === '<br>' || body.trim() === '';

    if (activeAction === 'reply' || activeAction === 'replyAll') {
      if (isBodyEmpty) return ['Cuerpo del mensaje'];
    }

    if (activeAction === 'newEmail') {
      const missing = [];
      if (!to.trim()) missing.push('Para');
      if (!subject.trim()) missing.push('Asunto');
      if (isBodyEmpty) missing.push('Cuerpo del mensaje');
      if (missing.length) return missing;
    }

    return null;
  }, [activeAction, to, subject]);

  const saveCase = useCallback(
    async (caseService, storeService, currentCaseId) => {
      const submissionData = getSubmissionData();
      const caseData = submissionData?.case_data?.case ?? {};
      const auxCaseData =
        submissionData?.aux_cases?.data ??
        submissionData?.case_data?.aux_cases?.data ??
        {};
      const description =
        submissionData?.kaceDescription ?? submissionData?.kace_description;
      const isUpdate = Boolean(currentCaseId);

      if (customSaveHandler) {
        const kaceEngine = KaceEngine();
        const result = await customSaveHandler({
          data: submissionData,
          caseData,
          auxCaseData,
          currentCaseId,
          kaceEngine,
          apiService: kaceEngine?.getService('apiService'),
          storeService,
          caseService: kaceEngine?.getService('cases'),
          postMessageToParent,
          Swal,
        });
        const caseId = result?.caseId ?? currentCaseId;
        if (!caseId) {
          throw new Error('No se pudo guardar el caso.');
        }
        return caseId;
      }

      await caseService.validateCaseFields(
        caseData,
        auxCaseData,
        description,
        isUpdate
      );

      const submissionCaseData = storeService.get(
        'cases.submission_case_data'
      ) ?? {
        case: caseData,
        aux_cases: {
          data: auxCaseData,
          ...(isUpdate && {
            id:
              submissionData?.case_data?.aux_cases?.id ??
              storeService.get('cases.case_data')?.aux_case?.id ??
              storeService.get('aux_case.aux_case_id'),
          }),
        },
      };

      const { staleCodes = [] } = await caseService.createCase({
        caseData: submissionCaseData,
        description,
      });

      const newCaseId = storeService.get('cases.case_id');

      const caseTimerRaw = localStorage.getItem('caseTimer');
      const timerId = caseTimerRaw ? JSON.parse(caseTimerRaw)?.timerId : null;
      if (timerId) {
        try {
          await caseService.finishTimerAfterSubmit(
            timerId,
            'Formulario Guardado'
          );
          localStorage.removeItem('caseTimer');
        } catch (error) {
          throw new Error('Error actualizando el temporizador');
        }
      }

      await showStaleWarnings(staleCodes);

      const transition_id = submissionData?.case_data?.case?.transicion_id;
      const flow_id = submissionData?.flujo_id || null;
      emitEvent?.('submitButtonSubmitted', { transition_id, flow_id });

      return newCaseId;
    },
    [getSubmissionData, emitEvent, customSaveHandler]
  );

  const sendEmail = useCallback(
    async (
      caseId,
      kaceEngine,
      emailService,
      caseService,
      apiService,
      fileService
    ) => {
      let attachmentUrls = [];
      try {
        attachmentUrls = await uploadAttachmentsAndGetUrls(
          caseId,
          attachments,
          apiService
        );
      } catch (error) {
        throw new Error('Error al subir adjuntos: ' + (error.message || ''));
      }

      const payload = buildPayload(caseId);
      payload.attachments = attachmentUrls;

      if (customSendHandler) {
        await customSendHandler(payload, {
          activeAction,
          attachments,
          kaceEngine,
          apiService,
          emailService,
          caseService,
          fileService,
          postMessageToParent,
        });
      } else {
        await emailService.sendEmail({ ...payload, action: activeAction });
      }
    },
    [
      attachments,
      activeAction,
      buildPayload,
      customSendHandler,
      uploadAttachmentsAndGetUrls,
    ]
  );

  const handleSend = useCallback(async () => {
    try {
      setIsSending(true);
      setSendError(null);
      setSendSuccess(false);

      const kaceEngine = KaceEngine();
      const emailService = kaceEngine.getService('email');
      const caseService = kaceEngine.getService('cases');
      const apiService = kaceEngine.getService('apiService');
      const fileService = kaceEngine.getService('file');
      const storeService = kaceEngine.getService('storeService');

      let caseId = storeService.get('cases.case_id');

      if (!activeAction) {
        if (!saveCaseBeforeSend) {
          await Swal.fire({
            icon: 'info',
            title: 'Selecciona una acción',
            text: 'Debes seleccionar Responder, Responder a todos o Nueva respuesta antes de enviar.',
            confirmButtonText: 'Entendido',
          });
          return;
        }

        Swal.fire({
          title: 'Guardando caso...',
          text: 'Por favor espera mientras se guarda el caso',
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: false,
          didOpen: () => Swal.showLoading(),
        });

        try {
          caseId = await saveCase(caseService, storeService, caseId);
        } catch (error) {
          await Swal.fire({
            icon: 'error',
            title: 'Error al guardar el caso',
            text: error.message || 'No se pudo guardar el caso.',
            confirmButtonText: 'Entendido',
          });
          setSendError('Error al guardar el caso: ' + (error.message || ''));
          return;
        }

        await Swal.fire({
          icon: 'success',
          title: '¡Guardado!',
          text: 'El caso se guardó correctamente.',
          confirmButtonText: 'Entendido',
          timer: 3000,
          timerProgressBar: true,
        });

        if (caseId) {
          postMessageToParent({ route: `/agent/update/${caseId}?action=edit` });
        }
        return;
      }

      const missingFields = validateEmailFields();
      if (missingFields) {
        await Swal.fire({
          icon: 'warning',
          title: 'Campos obligatorios',
          text: `Los siguientes campos son requeridos: ${missingFields.join(', ')}`,
          confirmButtonText: 'Entendido',
        });
        return;
      }

      if (saveCaseBeforeSend) {
        Swal.fire({
          title: 'Guardando caso...',
          text: 'Por favor espera mientras se guarda el caso',
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: false,
          didOpen: () => Swal.showLoading(),
        });

        try {
          caseId = await saveCase(caseService, storeService, caseId);
          if (!caseId) {
            throw new Error(
              'No se pudo obtener el case_id después de guardar el caso.'
            );
          }
        } catch (error) {
          await Swal.fire({
            icon: 'error',
            title: 'Error al guardar el caso',
            text: error.message || 'No se pudo guardar el caso.',
            confirmButtonText: 'Entendido',
          });
          setSendError('Error al guardar el caso: ' + (error.message || ''));
          return;
        }
      }

      if (!caseId) {
        await Swal.fire({
          icon: 'error',
          title: 'No se puede enviar',
          text: 'No existe un caso guardado. Guarda el caso primero antes de enviar el correo.',
          confirmButtonText: 'Entendido',
        });
        setSendError('No existe un caso guardado.');
        return;
      }

      Swal.fire({
        title: 'Enviando correo...',
        text: 'Por favor espera mientras se procesa el envío',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });

      try {
        await sendEmail(
          caseId,
          kaceEngine,
          emailService,
          caseService,
          apiService,
          fileService
        );
      } catch (error) {
        await Swal.fire({
          icon: 'warning',
          title: 'Caso guardado, correo no enviado',
          text:
            error.message ||
            'El caso se guardó correctamente pero no se pudo enviar el correo.',
          confirmButtonText: 'Entendido',
        });
        setSendError(error.message || 'Error al enviar el correo.');
        if (saveCaseBeforeSend && caseId) {
          postMessageToParent({ route: `/agent/update/${caseId}?action=edit` });
        }
        return;
      }

      setAttachments([]);
      setSendSuccess(true);
      onSubmit?.(buildData('send'));

      const successMessage = saveCaseBeforeSend
        ? 'El caso se guardó y el correo se envió correctamente.'
        : 'El correo se envió correctamente.';

      await Swal.fire({
        icon: 'success',
        title: '¡Enviado!',
        text: successMessage,
        confirmButtonText: 'Entendido',
        timer: 3000,
        timerProgressBar: true,
      });

      if (saveCaseBeforeSend) {
        postMessageToParent({ route: `/agent/update/${caseId}?action=edit` });
      }
    } catch (error) {
      setSendError(error.message ?? 'Error inesperado.');
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Ocurrió un error inesperado.',
        confirmButtonText: 'Entendido',
      });
    } finally {
      setIsSending(false);
    }
  }, [
    activeAction,
    saveCaseBeforeSend,
    validateEmailFields,
    saveCase,
    sendEmail,
    buildData,
    onSubmit,
  ]);

  return {
    activeAction,
    formVisible,
    setFormVisible,
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
    attachments,
    attachmentInputRef,
    validExtensions,
    allowMultiple,
    handleAttachmentClick,
    handleAttachmentChange,
    handleAttachmentRemove,
    handleReply,
    handleReplyAll,
    handleNewEmail,
    handleCancel,
    isSending,
    sendError,
    sendSuccess,
    handleSend,
  };
}
