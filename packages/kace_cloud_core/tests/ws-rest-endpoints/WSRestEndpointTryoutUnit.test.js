import { jest } from '@jest/globals';
import { WorkflowStepExecutorService } from '../../src/shared/domain/services/WorkflowStepExecutorService.js';

describe('WSRestEndpoint Tryout Unit', () => {
    it('addInitialContext should be applied when executing an endpoint', async () => {
        const fakeHttpClient = {
            request: jest.fn().mockResolvedValue({ status: 200, data: { ok: true } }),
        };

        const fakeSecretReplacer = {
            replaceSecretsInUrl: async (u) => u,
            replaceSecretsInHeader: async (h) => h,
            replaceSecretsInBody: async (b) => b,
        };

        const finderService = null;

        const eventLogger = { log: async () => {} };
        const currentUser = { id: { value: 'test' } };

        const service = new WorkflowStepExecutorService(
            fakeHttpClient,
            fakeSecretReplacer,
            finderService,
            eventLogger,
            currentUser
        );

        service.addInitialContext({ case: { id: 'UNIT123' } });

        const endpoint = {
            id: { value: 'ep1' },
            method: { value: 'GET' },
            url: { value: 'https://example.com/context.case.id' },
            headers: { value: { headers: { 'content-type': 'application/json' } } },
            body: { value: { body: null } },
            is_dynamic_body: { value: false },
            is_dynamic_header: { value: false },
            filter_input: { value: { filter_input: [] } },
        };

        const { result } = await service.executeEndpoint(endpoint, { processResponse: false });

        expect(fakeHttpClient.request).toHaveBeenCalled();
        const calledWith = fakeHttpClient.request.mock.calls[0][0];
        expect(calledWith.url).toEqual('https://example.com/UNIT123');
        expect(result.status).toBe(200);
        expect(result.data.ok).toBe(true);
    });
});
