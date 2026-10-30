import { jest } from '@jest/globals';
import { knexConfig } from '../knexfile.js';
import WSRestEndpointMother from './domain/WSRestEndpointMother.js';
import { KnexWSRestEndpointRepository } from '../../src/ws-rest-endpoints/infrastructure/persistence/KnexWSRestEndpointRepository.js';
import { WSRestEndpointTryoutExecutor } from '../../src/ws-rest-endpoints/application/executor/WSRestEndpointTryoutExecutor.js';
import { AxiosHttpClient } from '../../src/shared/infrastructure/http/AxiosHttpClient.js';

describe('WSRestEndpoint Tryout Integration', () => {
    const repository = new KnexWSRestEndpointRepository(knexConfig);

    afterEach(async () => {
        jest.restoreAllMocks();
    });

    it('executes endpoint and replaces initial_context in url', async () => {
        const dto = WSRestEndpointMother.dto({ url: 'https://example.com/context.case.id', method: 'GET' });
        const endpoint = await WSRestEndpointMother.create(repository, dto);
        const mockRequest = jest.spyOn(AxiosHttpClient.prototype, 'request').mockImplementation(async (opts) => {
            return { status: 200, data: { ok: true, requestedUrl: opts.url } };
        });

        const executor = new WSRestEndpointTryoutExecutor(repository.connection);

        const initialContext = { case: { id: 'CASE123' } };
        const result = await executor.execute(endpoint.id.value, initialContext);

        expect(mockRequest).toHaveBeenCalled();
        const calledWith = mockRequest.mock.calls[0][0];
        expect(calledWith.url).toEqual('https://example.com/CASE123');
        expect(result).toBeDefined();
        expect(result.status).toBe(200);
        expect(result.data).toBeDefined();
        expect(result.data.ok).toBe(true);
    });
});
