import { useState, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import Swal from 'sweetalert2';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import { getHandshakeParams } from '#plugins/kace/utils/withHandshakeEvaluatorContext.js';
import { RECEIVED_EMAIL_HTML_SANITIZE_CONFIG } from '#plugins/kace/shared/emailHtmlSanitizeConfig.js';
import { resolveTemplateAttachmentPlaceholders } from '#plugins/kace/shared/templateAttachmentImageResolver.js';

const DEFAULT_ATTACHMENTS_S3_BUCKET = 'attachments';

const buildSearchPayload = ({ casoId, interactionId }) => {
  if (interactionId) {
    return {
      filter: [
        {
          field: 'interactions.id',
          operator: 'eq',
          value: interactionId,
          type: 'AND',
        },
      ],
      relationship: [
        {
          table: 'interactions',
          condition: {
            column: 'interactions.email_id',
            refColumn: 'emails.id',
          },
          type: 'join',
        },
      ],
      order: { field: 'received_at', direction: 'desc' },
      limit: 1,
      offset: 0,
    };
  }

  return {
    filter: [
      {
        groupType: 'OR',
        filters: [
          {
            field: 'interaction_casos.caso_id',
            operator: 'eq',
            value: casoId,
            type: 'AND',
          },
          {
            field: 'emails.case_id_outbound',
            operator: 'eq',
            value: casoId,
            type: 'OR',
          },
        ],
      },
      {
        field: 'emails.is_outbound',
        operator: 'eq',
        value: false,
        type: 'AND',
      },
    ],
    relationship: [
      {
        table: 'interactions',
        condition: { column: 'interactions.email_id', refColumn: 'emails.id' },
        type: 'left',
      },
      {
        table: 'interaction_casos',
        condition: {
          column: 'interaction_casos.interaction_id',
          refColumn: 'interactions.id',
        },
        type: 'left',
      },
    ],
    order: { field: 'received_at', direction: 'desc' },
    limit: 1,
    offset: 0,
  };
};

const waitForKaceAuth = () =>
  new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    if (window['__KACE_AUTH_READY__']) {
      resolve();
      return;
    }
    try {
      const storeService = KaceEngine().getService('storeService');
      if (storeService?.get?.('config.kace_auth_ready')) {
        resolve();
        return;
      }
    } catch (_) {}

    const timeout = setTimeout(() => {
      window.removeEventListener('kaceAuthReady', onReady);
      resolve();
    }, 25000);

    const onReady = () => {
      clearTimeout(timeout);
      window.removeEventListener('kaceAuthReady', onReady);
      resolve();
    };

    window.addEventListener('kaceAuthReady', onReady);
  });

const waitForInteractionId = () =>
  new Promise((resolve) => {
    const id = getHandshakeParams()?.interaction_id;
    if (id) {
      resolve(id);
      return;
    }

    let timeout;
    const interval = setInterval(() => {
      const id = getHandshakeParams()?.interaction_id;
      if (id) {
        clearInterval(interval);
        clearTimeout(timeout);
        resolve(id);
      }
    }, 100);

    timeout = setTimeout(() => {
      clearInterval(interval);
      resolve(null);
    }, 10000);
  });

const resolvePersistedCaseId = (caseService) => {
  const store = caseService?.storeService;
  if (!store?.get) return null;

  const caseId = store.get('cases.case_id');
  if (caseId) return caseId;

  const caseData = store.get('cases.case_data');
  if (caseData?.id) return caseData.id;

  const handshake = store.get('auth.handshake_params');
  if (handshake?.case_id) return handshake.case_id;

  return null;
};

/**
 * @typedef ReceivedEmailData
 * @prop {string} from
 * @prop {string} to
 * @prop {string} [cc]
 * @prop {string} [bcc]
 * @prop {string} [date]
 * @prop {string} [subject]
 * @prop {string} [bodyHtml]
 * @prop {Array} [attachments]
 */

/**
 * @param {{ active?: boolean, autoLoad?: boolean, receivedAttachmentsS3Bucket?: string, customDownloadAttachmentHandler?: (attachment: Record<string, unknown>, context: { kaceEngine: unknown, apiService: unknown, fileService: unknown, caseService: unknown }) => Promise<void> }} options
 * - active: si es false el hook no hace nada (bodyMode desactivado)
 * - autoLoad: si es true hace fetch automático, si es false espera evento externo
 * - receivedAttachmentsS3Bucket: bucket key ("url") enviado a /download-s3-files para adjuntos recibidos
 * - customDownloadAttachmentHandler: si se provee, reemplaza la descarga por defecto vía fileService
 */
export function useReceivedEmail({
  active = true,
  autoLoad = true,
  receivedAttachmentsS3Bucket: receivedAttachmentsS3BucketProp,
  customDownloadAttachmentHandler,
} = {}) {
  // A parameter default only applies for `undefined`; an explicit '' (e.g. a
  // blank Formio field left cleared) would otherwise sail through and hit
  // /download-s3-files with an empty `url` bucket key.
  const receivedAttachmentsS3Bucket =
    receivedAttachmentsS3BucketProp || DEFAULT_ATTACHMENTS_S3_BUCKET;
  const [loading, setLoading] = useState(active);
  const [receivedEmail, setReceivedEmail] = useState(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState(null);

  const handleDownloadAttachment = useCallback(
    async (attachment, key) => {
      setDownloadingAttachmentId(key ?? attachment?.filename ?? null);
      try {
        const kaceEngine = KaceEngine();
        const apiService = kaceEngine.getService('apiService');
        const fileService = kaceEngine.getService('file');
        const caseService = kaceEngine.getService('cases');

        if (customDownloadAttachmentHandler) {
          await customDownloadAttachmentHandler(attachment, {
            kaceEngine,
            apiService,
            fileService,
            caseService,
          });
        } else {
          await fileService.downloadFile({
            id: attachment?.id,
            fileName: attachment?.filename,
            contentType: 'application/octet-stream',
            url: receivedAttachmentsS3Bucket,
          });
        }
      } catch (error) {
        console.error(
          '[useReceivedEmail] Error downloading attachment:',
          error
        );
        await Swal.fire({
          icon: 'error',
          title: 'Error al descargar',
          text: 'No se pudo descargar el adjunto.',
          confirmButtonText: 'Entendido',
        });
      } finally {
        setDownloadingAttachmentId(null);
      }
    },
    [customDownloadAttachmentHandler, receivedAttachmentsS3Bucket]
  );

  const setExternalEmail = useCallback((data) => {
    setReceivedEmail(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!active) {
      setLoading(false);
      return;
    }

    if (!autoLoad) {
      setLoading(true);
      const handler = (e) => setExternalEmail(e.detail || null);
      window.addEventListener('kace:setReceivedEmail', handler);
      return () => window.removeEventListener('kace:setReceivedEmail', handler);
    }

    let cancelled = false;

    const load = async () => {
      try {
        await waitForKaceAuth();
        if (cancelled) return;

        const kaceEngine = KaceEngine();
        const caseService = kaceEngine.getService('cases');
        const apiService = kaceEngine.getService('apiService');

        const interactionId = await waitForInteractionId();
        let casoId = resolvePersistedCaseId(caseService);

        if (!casoId && !interactionId) {
          try {
            await caseService.get('cases.case_data');
          } catch (_) {}
          if (cancelled) return;
          casoId = resolvePersistedCaseId(caseService);
        }

        if (!casoId && !interactionId) {
          setLoading(false);
          return;
        }

        const searchRes = await apiService.post(
          'emails/search',
          buildSearchPayload({ casoId, interactionId })
        );

        const emails =
          searchRes?.data?.data?.items || searchRes?.data?.data || [];

        if (!emails.length) {
          setLoading(false);
          return;
        }
        const emailId = emails[0].id;

        const detailRes = await apiService.get('emails/' + emailId);
        const detail = detailRes?.data?.data || detailRes?.data || {};
        const inlineHtml = detail?.body?.body_html || detail?.body?.body || '';

        let rawHtml = inlineHtml;
        try {
          const bodyRes = await apiService.get(
            `emails/${emailId}/body?part=html`
          );
          rawHtml =
            bodyRes?.data?.data?.content ||
            bodyRes?.data?.content ||
            inlineHtml;
        } catch (bodyErr) {
          console.error(
            '[useReceivedEmail] Failed to fetch external body, falling back to inline body:',
            bodyErr
          );
        }
        const resolved = await resolveTemplateAttachmentPlaceholders(
          rawHtml,
          apiService
        );
        const bodyHtml = DOMPurify.sanitize(
          resolved,
          RECEIVED_EMAIL_HTML_SANITIZE_CONFIG
        );

        const extractEmails = (val) => {
          if (!val) return '';
          if (Array.isArray(val))
            return val
              .map((v) =>
                typeof v === 'object' && v !== null ? v.email || '' : v
              )
              .filter(Boolean)
              .join(', ');
          if (typeof val === 'object') return val.email || '';
          return val;
        };

        setReceivedEmail({
          from: detail.sender || detail.email_account || '',
          to: extractEmails(detail.to),
          cc: extractEmails(detail.cc),
          bcc: extractEmails(detail.bcc),
          date: detail.received_at || '',
          subject: detail.subject || '',
          bodyHtml,
          attachments: detail.attachments || [],
          interaction_id: detail?.interaction?.id || '',
          in_reply_to: detail.channel_hub_message_id || '',
          email_account: detail.email_account || '',
        });
      } catch (e) {
        console.error('[useReceivedEmail] Error:', e);
      } finally {
        setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [active, autoLoad, setExternalEmail]);

  return {
    loading,
    receivedEmail,
    downloadingAttachmentId,
    handleDownloadAttachment,
  };
}
