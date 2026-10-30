import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailTemplatesService } from './emailTemplatesService.js';

vi.mock('./storeService.js', () => ({
  storeService: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

import { storeService as mockStoreService } from './storeService.js';

describe('EmailTemplatesService', () => {
  let apiService;
  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    apiService = { post: vi.fn() };
    service = new EmailTemplatesService({ apiService });
    delete globalThis.KACE_ENGINE;
  });

  describe('_resolveClassificationId (this.storeService fix)', () => {
    it('reads the current classification from this.storeService', async () => {
      mockStoreService.get.mockReturnValue(null);

      await service.fetchTemplates();

      expect(mockStoreService.get).toHaveBeenCalledWith(
        'classifications.current_classification'
      );
    });

    it('returns null when storeService.get throws', async () => {
      mockStoreService.get.mockImplementation(() => {
        throw new Error('store unavailable');
      });

      const templates = await service.fetchTemplates();

      expect(templates).toEqual([]);
    });
  });

  describe('fetchTemplates', () => {
    it('returns an empty array when there is no classification selected', async () => {
      mockStoreService.get.mockReturnValue(null);

      const templates = await service.fetchTemplates();

      expect(templates).toEqual([]);
      expect(apiService.post).not.toHaveBeenCalled();
    });

    it('joins multiple template_ids with a comma in the templates filter', async () => {
      mockStoreService.get.mockReturnValue('classification-1');
      apiService.post.mockImplementation((url) => {
        if (url === '/classification-template-relations/search') {
          return Promise.resolve({
            status: 200,
            data: {
              data: [
                { template_id: 'tpl-1' },
                { template_id: 'tpl-2' },
                { template_id: 'tpl-3' },
              ],
            },
          });
        }
        if (url === '/templates/search') {
          return Promise.resolve({ status: 200, data: { data: [] } });
        }
        throw new Error(`Unexpected url: ${url}`);
      });

      await service.fetchTemplates();

      const templatesSearchCall = apiService.post.mock.calls.find(
        ([url]) => url === '/templates/search'
      );
      expect(templatesSearchCall).toBeDefined();
      const [, body] = templatesSearchCall;
      const idFilter = body.filter.find((f) => f.field === 'plantillas.id');
      expect(idFilter).toEqual(
        expect.objectContaining({
          operator: 'in',
          value: 'tpl-1,tpl-2,tpl-3',
        })
      );
    });

    it('returns an empty array when no classification-template relations are found', async () => {
      mockStoreService.get.mockReturnValue('classification-1');
      apiService.post.mockResolvedValueOnce({
        status: 200,
        data: { data: [] },
      });

      const templates = await service.fetchTemplates();

      expect(templates).toEqual([]);
      expect(apiService.post).toHaveBeenCalledTimes(1);
    });

    it('returns an empty array when the relations request fails', async () => {
      mockStoreService.get.mockReturnValue('classification-1');
      apiService.post.mockRejectedValueOnce(new Error('network error'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const templates = await service.fetchTemplates();

      expect(templates).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('maps template fields from the search response', async () => {
      mockStoreService.get.mockReturnValue('classification-1');
      apiService.post.mockImplementation((url) => {
        if (url === '/classification-template-relations/search') {
          return Promise.resolve({
            status: 200,
            data: { data: [{ template_id: 'tpl-1' }] },
          });
        }
        if (url === '/templates/search') {
          return Promise.resolve({
            status: 200,
            data: {
              data: [
                {
                  id: 'tpl-1',
                  descripcion: 'Welcome email',
                  destinatario: 'to@example.com',
                  copia: 'cc@example.com',
                  copia_oculta: 'bcc@example.com',
                  asunto: 'Welcome!',
                  cuerpo: '<p>Hi</p>',
                },
              ],
            },
          });
        }
      });

      const templates = await service.fetchTemplates();

      expect(templates).toEqual([
        {
          value: 'tpl-1',
          label: 'Welcome email',
          destinatario: 'to@example.com',
          copia: 'cc@example.com',
          copia_oculta: 'bcc@example.com',
          asunto: 'Welcome!',
          cuerpo: '<p>Hi</p>',
        },
      ]);
    });

    it('throws when the templates search response is not successful', async () => {
      mockStoreService.get.mockReturnValue('classification-1');
      apiService.post.mockImplementation((url) => {
        if (url === '/classification-template-relations/search') {
          return Promise.resolve({
            status: 200,
            data: { data: [{ template_id: 'tpl-1' }] },
          });
        }
        return Promise.resolve({ status: 500, data: null });
      });

      await expect(service.fetchTemplates()).rejects.toThrow(
        'Failed to fetch email templates'
      );
    });
  });

  describe('_resolveApi', () => {
    it('falls back to the global KACE_ENGINE apiService when none was injected', async () => {
      const fallbackApi = {
        post: vi.fn().mockResolvedValue({ status: 200, data: { data: [] } }),
      };
      globalThis.KACE_ENGINE = {
        getService: vi.fn((name) =>
          name === 'apiService' ? fallbackApi : null
        ),
      };
      mockStoreService.get.mockReturnValue('classification-1');

      const serviceWithoutApi = new EmailTemplatesService({ apiService: null });
      await serviceWithoutApi.fetchTemplates();

      expect(fallbackApi.post).toHaveBeenCalled();
    });
  });

  describe('sendEmail', () => {
    it('posts to /emails/reply for reply actions', async () => {
      apiService.post.mockResolvedValue({
        status: 200,
        data: { data: { id: '1' } },
      });

      await service.sendEmail({ action: 'reply', to: ['a@example.com'] });

      expect(apiService.post).toHaveBeenCalledWith(
        '/emails/reply',
        expect.objectContaining({ to: ['a@example.com'] })
      );
    });

    it('posts to /emails/reply for replyAll actions', async () => {
      apiService.post.mockResolvedValue({
        status: 200,
        data: { data: { id: '1' } },
      });

      await service.sendEmail({ action: 'replyAll' });

      expect(apiService.post).toHaveBeenCalledWith(
        '/emails/reply',
        expect.any(Object)
      );
    });

    it('posts to /emails/send for other actions', async () => {
      apiService.post.mockResolvedValue({
        status: 201,
        data: { data: { id: '1' } },
      });

      await service.sendEmail({ action: 'newEmail' });

      expect(apiService.post).toHaveBeenCalledWith(
        '/emails/send',
        expect.any(Object)
      );
    });

    it('strips the action key from the payload sent to the API', async () => {
      apiService.post.mockResolvedValue({ status: 200, data: { data: {} } });

      await service.sendEmail({ action: 'newEmail', subject: 'Hi' });

      const [, payload] = apiService.post.mock.calls[0];
      expect(payload).not.toHaveProperty('action');
      expect(payload).toEqual({ subject: 'Hi' });
    });

    it('throws when the send response is not successful', async () => {
      apiService.post.mockResolvedValue({ status: 500 });

      await expect(service.sendEmail({ action: 'newEmail' })).rejects.toThrow(
        'Error al enviar el correo.'
      );
    });

    it('returns the response data on success', async () => {
      apiService.post.mockResolvedValue({
        status: 200,
        data: { data: { id: 'sent-1' } },
      });

      const result = await service.sendEmail({ action: 'newEmail' });

      expect(result).toEqual({ id: 'sent-1' });
    });
  });
});
