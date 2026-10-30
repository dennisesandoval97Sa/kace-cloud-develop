import { jest } from '@jest/globals';
import { WorkflowStepExecutorService } from '../../../../src/shared/domain/services/WorkflowStepExecutorService.js';

const endpoint = {
    id: { value: 'endpoint-delete' },
    description: { value: 'Delete Channel Hub rule' },
    authorization: null,
    url: { value: 'https://channel-hub.example.test/rules/rule-1' },
    method: { value: 'DELETE' },
    headers: { value: { headers: {} } },
    body: { value: { body: {} } },
    body_type: { value: 'json' },
    is_dynamic_header: { value: false },
    is_dynamic_body: { value: false },
    filter_input: { value: { filter_input: [] } },
    context_position: { value: 'channel_hub_tag.delete_response' },
    on_error: { value: {} },
    on_success: { value: {} },
};

const createSubject = (response, options = {}) => {
    const httpClient = { request: jest.fn().mockResolvedValue(response) };
    const secretReplacer = {
        replaceSecretsInUrl: jest.fn(async (value) => value),
        replaceSecretsInHeader: jest.fn(async (value) => value),
        replaceSecretsInBody: jest.fn(async (value) => value),
    };
    return {
        httpClient,
        subject: new WorkflowStepExecutorService(
            httpClient,
            secretReplacer,
            null,
            { log: jest.fn() },
            null,
            null,
            options
        ),
    };
};

describe('WorkflowStepExecutorService HTTP policy', () => {
    it('throws a bounded endpoint error for non-2xx responses when strict mode is enabled', async () => {
        const { subject, httpClient } = createSubject(
            { status: 503, data: { private: 'upstream details' }, headers: {} },
            { failOnHttpError: true, requestTimeoutMs: 10_000 }
        );

        await expect(subject.executeEndpoint(endpoint)).rejects.toMatchObject({
            message: 'REST endpoint request failed',
            statusCode: 503,
            fields: {
                reason: 'http_error',
                endpoint_id: 'endpoint-delete',
                method: 'DELETE',
                status: 503,
            },
        });
        expect(httpClient.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'DELETE', timeout: 10_000 }));
    });

    it('preserves the existing response behavior when strict mode is disabled', async () => {
        const response = { status: 503, data: { problem: true }, headers: {} };
        const { subject } = createSubject(response);

        await expect(subject.executeEndpoint(endpoint)).resolves.toMatchObject({ result: response });
    });

    it('resolves the timeout immediately before every endpoint request', async () => {
        const requestTimeoutResolver = jest.fn().mockReturnValueOnce(10_000).mockReturnValueOnce(4_000);
        const { subject, httpClient } = createSubject(
            { status: 204, data: null, headers: {} },
            { requestTimeoutMs: 30_000, requestTimeoutResolver }
        );

        await subject.executeEndpoint(endpoint);
        await subject.executeEndpoint(endpoint);

        expect(requestTimeoutResolver).toHaveBeenCalledTimes(2);
        expect(httpClient.request.mock.calls.map(([config]) => config.timeout)).toEqual([10_000, 4_000]);
    });

    it('does not issue an HTTP request when the resolved budget is exhausted', async () => {
        const { subject, httpClient } = createSubject(
            { status: 204, data: null, headers: {} },
            { requestTimeoutResolver: () => 0 }
        );

        await expect(subject.executeEndpoint(endpoint)).rejects.toMatchObject({
            message: 'REST endpoint request deadline exceeded',
            statusCode: 504,
            fields: { reason: 'request_deadline_exceeded' },
        });
        expect(httpClient.request).not.toHaveBeenCalled();
    });
});
