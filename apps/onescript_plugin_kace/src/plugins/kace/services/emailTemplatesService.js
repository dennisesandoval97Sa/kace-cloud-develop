import { BaseService } from './baseService';

export class EmailTemplatesService extends BaseService {
  /**
   * @param {Object} params
   * @param {import('./apiService').ApiService} params.apiService
   */
  constructor({ apiService }) {
    super({});
    this.api = apiService;
  }

  /**
   * Resolves the API service instance, falling back to the global engine if needed.
   * @returns {import('./apiService').ApiService}
   */
  _resolveApi() {
    if (
      !this.api &&
      typeof globalThis !== 'undefined' &&
      globalThis.KACE_ENGINE
    ) {
      const fallback = globalThis.KACE_ENGINE.getService('apiService');
      if (fallback) this.api = fallback;
    }
    return this.api;
  }

  /**
   * Fetches email templates from the API.
   * If a classification_id is available in the store, it first queries
   * classification-template-relations to get only the templates linked
   * to that classification. Falls back to all templates if none are found
   * or if no classification is selected.
   *
   * Called automatically by BaseService.get('email.templates').
   *
   * @returns {Promise<Array<{ value: string, label: string }>>}
   */
  async fetchTemplates() {
    const api = this._resolveApi();

    const classificationId = this._resolveClassificationId();

    if (!classificationId) {
      return [];
    }

    let templateIds = null;

    try {
      const relResponse = await api.post(
        '/classification-template-relations/search',
        {
          filter: [
            {
              field: 'classification_id',
              operator: 'eq',
              value: classificationId,
              type: 'AND',
            },
          ],
          limit: 0,
          offset: 0,
        }
      );

      if (relResponse.status === 200 && relResponse.data) {
        const relations =
          relResponse.data.data?.items ?? relResponse.data.data ?? [];
        if (relations.length > 0) {
          templateIds = relations.map((r) => r.template_id);
        } else {
          return [];
        }
      }
    } catch (err) {
      console.warn(
        '[EmailTemplatesService] Failed to fetch classification-template relations:',
        err
      );
      return [];
    }

    const filter = [
      {
        field: 'plantillas.deleted_at',
        operator: 'null',
        value: 'null',
        type: 'AND',
      },
    ];

    if (templateIds && templateIds.length > 0) {
      filter.push({
        field: 'plantillas.id',
        operator: 'in',
        value: templateIds.join(','),
        type: 'AND',
      });
    }

    const response = await api.post('/templates/search', {
      filter,
      limit: 0,
      offset: 0,
    });

    if (response.status === 200 && response.data) {
      const items = response.data.data?.items ?? response.data.data ?? [];
      return items.map((t) => ({
        value: String(t.id ?? t.value),
        label: String(t.descripcion ?? t.id),
        destinatario: t.destinatario ?? '',
        copia: t.copia ?? '',
        copia_oculta: t.copia_oculta ?? '',
        asunto: t.asunto ?? '',
        cuerpo: t.cuerpo ?? '',
      }));
    }

    throw new Error('Failed to fetch email templates');
  }

  /**
   * Resolves the current classification_id from the store.
   * @returns {string|null}
   */
  _resolveClassificationId() {
    return (
      this.storeService?.get('classifications.current_classification') ?? null
    );
  }

  /**
   * Sends an email or replies to a thread depending on the action.
   *
   * @param {Object} params - Ready-to-send payload
   * @param {'reply'|'replyAll'|'newEmail'|string} [params.action] - Determines endpoint
   * @returns {Promise<{ id: string }>}
   */
  async sendEmail(params) {
    const api = this._resolveApi();
    const { action, ...payload } = params;
    const isReply = action === 'reply' || action === 'replyAll';
    const endpoint = isReply ? '/emails/reply' : '/emails/send';

    const response = await api.post(endpoint, payload);

    if (response.status !== 200 && response.status !== 201) {
      throw new Error('Error al enviar el correo.');
    }

    return response.data?.data;
  }
}
