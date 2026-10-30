import { BaseService } from './baseService';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

/**
 * Misma forma que devuelve el POST `/case-attachments/search` tras mapear ítems.
 *
 * @param {Record<string, unknown>} attachment
 * @param {string|number} caseId
 * @returns {Record<string, unknown>}
 */
function mapAttachmentRowForStore(attachment, caseId) {
  return {
    ...attachment,
    attachmentType: attachment.attachmentType ?? attachment.type,
    isLocal: false,
    s3_payload: {
      id: attachment.case_id ?? caseId,
      contentType: attachment.description,
      fileName: attachment.path,
      url: 'case',
    },
  };
}

/**
 * @param {unknown[]} existing
 * @returns {unknown[]}
 */
function pendingLocalAttachments(existing) {
  if (!Array.isArray(existing)) {
    return [];
  }
  return existing.filter(
    (e) =>
      e && typeof e === 'object' && (e.isLocal === true || (!e.id && e.file))
  );
}

/**
 * Lista de adjuntos ya incluida en `GET /cases/:id` (o undefined si hay que ir al search).
 *
 * @param {Record<string, unknown> | null | undefined} caseRow
 * @returns {unknown[] | undefined} `[]` = sin adjuntos embebidos; `undefined` = no usar embebido
 */
function embeddedAttachmentListFromCaseRow(caseRow) {
  if (!caseRow || typeof caseRow !== 'object') {
    return undefined;
  }
  const raw =
    caseRow.attachments ?? caseRow.case_attachments ?? caseRow.caseAttachments;
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw;
  }
  // Algunos orígenes serializan arrays como objetos con índices + `length`.
  if (raw && typeof raw === 'object') {
    const rec = /** @type {Record<string, unknown>} */ (raw);
    const lenRaw = rec.length;
    const len =
      typeof lenRaw === 'number'
        ? lenRaw
        : typeof lenRaw === 'string'
          ? Number(lenRaw)
          : NaN;
    if (Number.isFinite(len) && len >= 0) {
      /** @type {unknown[]} */
      const out = [];
      for (let i = 0; i < len; i++) {
        if (String(i) in rec) out.push(rec[String(i)]);
      }
      return out;
    }
  }
  return undefined;
}

/**
 * Returns true when every item in the list has the `attachment_type` key (even if null).
 * An empty list returns true — no items to check, no need to fall back to search.
 * When the cases Lambda is deployed without the attachment_type column in its SELECT,
 * items will be missing this key entirely and we must fall back to the search endpoint
 * to get complete data.
 *
 * @param {unknown[] | undefined} embeddedList
 * @returns {boolean}
 */
function embeddedListHasAttachmentTypeKey(embeddedList) {
  if (!Array.isArray(embeddedList) || embeddedList.length === 0) return true;
  return embeddedList.every(
    (a) => !a || typeof a !== 'object' || 'attachment_type' in a
  );
}

/**
 * @param {unknown[] | undefined} embeddedList
 * @param {string|number} caseId
 * @returns {boolean}
 */
function embeddedListMatchesCaseId(embeddedList, caseId) {
  if (!Array.isArray(embeddedList) || !embeddedList.length) {
    return false;
  }
  return embeddedList.some((a) => {
    if (!a || typeof a !== 'object') return false;
    const cid = /** @type {Record<string, unknown>} */ (a).case_id;
    return cid != null && String(cid) === String(caseId);
  });
}

export class FileService extends BaseService {
  /**
   * @param {Object} params
   * @param {import('./apiService').ApiService} params.apiService
   * @param {any} params.store
   * @param {(eventName: string, payload: any) => void} [params.emitEvent]
   */
  constructor({ apiService, store, emitEvent }) {
    super({ store });
    this.api = apiService;
    this.emitEvent = emitEvent;
  }

  /**
   * TODO: Remove this method and use the new global configuration service.
   * Fetches global configuration settings for the selected group.
   * @param {Object} [args={}]
   * @returns {Promise<any>}
   */
  async fetchGlobalConfiguration(args = {}) {
    try {
      if (this.emitEvent) this.emitEvent('kaceAttachmentsLoading', true);
      const configId = this.storeService.get('configuration_id_selected_group');
      const response = await this.api.get(`/global-configuration/${configId}`);
      if (!response.ok) throw new Error('Failed to fetch global config');
      const data = await response.json();
      if (this.emitEvent) this.emitEvent('kaceAttachmentsLoading', false);
      return data.data.settings;
    } catch (error) {
      throw new Error(
        `Error al obtener los datos de configuración global: ${error.message}`
      );
    }
  }

  /**
   * Scans a file for viruses.
   * @param {Object} params
   * @param {string} params.url
   * @param {string} params.id
   * @param {string} params.fileName
   * @returns {Promise<void>}
   */

  async scanFileForVirus({ url, id, fileName }) {
    try {
      const response = await this.api.post('/upload-s3-files/scan-s3-file', {
        url,
        id,
        fileName,
      });
      if (response.status === 200 && response.data) {
        return response.data.data;
      }
      throw new Error('Error al escanear el archivo por virus');
    } catch (error) {
      throw new Error(
        `Error al escanear el archivo por virus: ${error.message}`
      );
    }
  }
  /**
   * Uploads a file (S3 flow) and creates a case attachment record.
   * @param {Object} params
   * @param {string} params.id
   * @param {string} params.contentType
   * @param {string} params.fileName
   * @param {File} params.file
   * @param {number|null} [params.fileTypeNumeric=null] - Numeric type → campo `type`
   * @param {string|null} [params.fileTypeCategory=null] - Photo classification label → campo `attachment_type`
   * @param {string} [params.url='case']
   * @returns {Promise<void>}
   */
  async uploadFile({
    id,
    contentType,
    fileName,
    file,
    fileTypeNumeric = null,
    fileTypeCategory = null,
    url = 'case',
  }) {
    const s3_payload = {
      id,
      contentType,
      fileName,
      url,
    };
    const response = await this.api.post('/upload-s3-files', s3_payload);

    if (response.status === 200 && response.data) {
      const uploadUrl = response.data.data?.uploadUrl;

      if (!uploadUrl) {
        throw new Error('No se recibió la URL pre-firmada de S3');
      }

      await axios.put(uploadUrl, file, {
        headers: {
          'Content-Type': contentType,
        },
      });
      await this.scanFileForVirus({ url, id, fileName });

      const payload = {
        case_id: id,
        path: fileName,
        type: fileTypeNumeric ?? 1,
        description: contentType,
        size: 1,
        is_active: 'true',
        id: uuidv4(),
      };
      if (fileTypeCategory) {
        payload.attachment_type = fileTypeCategory;
      }
      await this.api.post('/case-attachments', payload);
    }
  }

  /**
   * Uploads all pending attachments (those without an id) for a given case.
   * @returns {Promise<void>}
   */
  async uploadPendingAttachments() {
    try {
      const caseId = this.storeService.get('cases.case_id');
      const attachments = this.storeService.get('cases.attachments') || [];

      if (!attachments?.length) return;

      const pending = attachments.filter((element) => !element.id);
      if (!pending.length) return;

      await Promise.all(
        pending.map((attachment) =>
          this.uploadFile({
            id: caseId,
            contentType: attachment.description,
            fileName: attachment.path,
            file: attachment.file,
            fileTypeCategory: attachment.tipoFoto?.label ?? null,
            fileTypeNumeric: attachment.attachmentType ?? null,
          })
        )
      );
    } catch (error) {
      throw new Error(
        `Error al subir los adjuntos pendientes: ${error.message}`
      );
    }
  }

  /**
   * Requests a download URL and opens it in a new window.
   * @param {any} payload
   * @returns {Promise<void>}
   */
  async downloadFile(payload) {
    const response = await this.api.post('/download-s3-files', payload);
    const uploadUrl = response?.data?.data?.uploadUrl;
    window.open(uploadUrl, '_blank', 'noopener,noreferrer');
  }

  /**
   * Lists case attachments for a case (search API).
   * @param {string|number} caseId
   * @returns {Promise<Array<Record<string, unknown>>>}
   */
  async fetchAttachmentsByCaseId(caseId) {
    try {
      if (caseId == null || caseId === '') {
        return [];
      }
      const caseRow = this.storeService.get('cases.case_data');
      const caseRowId =
        caseRow && typeof caseRow === 'object'
          ? (caseRow.id ?? caseRow.case_id)
          : null;
      const embeddedList = embeddedAttachmentListFromCaseRow(
        caseRow && typeof caseRow === 'object'
          ? /** @type {Record<string, unknown>} */ (caseRow)
          : null
      );
      if (
        caseRow &&
        typeof caseRow === 'object' &&
        embeddedList !== undefined &&
        embeddedListHasAttachmentTypeKey(embeddedList) &&
        ((caseRowId != null && String(caseRowId) === String(caseId)) ||
          embeddedListMatchesCaseId(embeddedList, caseId))
      ) {
        const normalized = embeddedList
          .map((a) =>
            a && typeof a === 'object'
              ? mapAttachmentRowForStore(
                  /** @type {Record<string, unknown>} */ (a),
                  caseId
                )
              : null
          )
          .filter((a) => a && typeof a === 'object');
        const pending = /** @type {Record<string, unknown>[]} */ (
          pendingLocalAttachments(this.storeService.get('cases.attachments'))
        );
        return [...normalized, ...pending];
      }

      const response = await this.api.post('/case-attachments/search', {
        filter: [
          {
            field: 'case_id',
            operator: 'eq',
            value: caseId,
            type: 'AND',
          },
        ],
        limit: 0,
        offset: 0,
      });
      const items = response?.data?.data?.items ?? [];
      const normalizedSearch = items.map((attachment) =>
        mapAttachmentRowForStore(attachment, caseId)
      );
      const pendingLocal = /** @type {Record<string, unknown>[]} */ (
        pendingLocalAttachments(this.storeService.get('cases.attachments'))
      );
      return [...normalizedSearch, ...pendingLocal];
    } catch (error) {
      throw new Error(`Error al cargar adjuntos del caso: ${error.message}`);
    }
  }

  /**
   * Soft-deletes a case attachment record.
   * @param {string} fileId
   * @returns {Promise<void>}
   */
  async deleteFile(fileId) {
    try {
      if (!fileId) {
        throw new Error('ID de adjunto requerido');
      }
      const response = await this.api.get(`/case-attachments/${fileId}/delete`);
      if (response.status !== 200) {
        throw new Error('No se pudo eliminar el adjunto');
      }
    } catch (error) {
      throw new Error(`Error al eliminar el adjunto: ${error.message}`);
    }
  }

  /**
   * Updates the type of existing attachments that were changed locally.
   * @returns {Promise<void>}
   */
  async updateModifiedAttachmentTypes() {
    const attachments = this.storeService.get('cases.attachments') || [];
    const modified = attachments.filter(
      (a) => a.id && (a.typeChanged || a.tipoFotoChanged)
    );
    if (!modified.length) return;
    const results = await Promise.allSettled(
      modified.map((a) => {
        /** @type {Record<string, unknown>} */
        const payload = {};
        if (a.typeChanged) payload.type = Number(a.attachmentType ?? a.type);
        if (a.tipoFotoChanged)
          payload.attachment_type = a.tipoFoto?.label ?? null;
        return this.api.post(`/case-attachments/${a.id}`, payload);
      })
    );
    const succeededIds = new Set(
      modified
        .filter((_, i) => results[i].status === 'fulfilled')
        .map((a) => a.id)
    );
    const cleaned = attachments.map((a) => {
      if ((!a.typeChanged && !a.tipoFotoChanged) || !succeededIds.has(a.id))
        return a;
      const { typeChanged, tipoFotoChanged, ...rest } = a;
      // Sync persistent fields so the localStorage cache stays consistent with the DB.
      // Without this, a stale cases.case_data reload would reconstruct tipoFoto from the
      // old attachment_type instead of the value the user just saved.
      if (a.tipoFotoChanged) rest.attachment_type = a.tipoFoto?.label ?? null;
      if (a.typeChanged) rest.type = Number(a.attachmentType ?? a.type);
      return rest;
    });
    this.storeService.set('cases.attachments', cleaned);
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length) {
      throw new Error(
        `Error al actualizar tipo de ${failed.length} adjunto(s): ${failed[0].reason?.message || 'unknown'}`
      );
    }
  }

  /**
   * Uploads pending attachments (no server id, has file blob) for a given case.
   * @param {string|number} caseId
   * @param {Array<{ id?: string, path: string, description: string, file?: File, tipoFoto?: {label: string}|null, attachmentType?: number|null }>} attachments
   * @returns {Promise<void>}
   */
  async uploadAttachments(caseId, attachments) {
    try {
      if (caseId == null || caseId === '') {
        throw new Error('ID de caso requerido para subir adjuntos');
      }
      if (!attachments?.length) {
        return;
      }
      const pending = attachments.filter(
        (element) => element && !element.id && element.file
      );
      if (!pending.length) {
        return;
      }
      await Promise.all(
        pending.map((attachment) =>
          this.uploadFile({
            id: caseId,
            contentType: attachment.description,
            fileName: attachment.path,
            file: attachment.file,
            fileTypeCategory: attachment.tipoFoto?.label ?? null,
            fileTypeNumeric: attachment.attachmentType ?? null,
          })
        )
      );
    } catch (error) {
      throw new Error(`Error al subir adjuntos del caso: ${error.message}`);
    }
  }
}
