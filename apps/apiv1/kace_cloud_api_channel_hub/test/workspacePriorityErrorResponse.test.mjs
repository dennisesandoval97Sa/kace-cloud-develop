import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import {
    BAD_REQUEST_ERROR,
    CHANNEL_HUB_WORKSPACE_PRIORITIES_UNAVAILABLE,
    CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_FAILED,
    CONFLICT_ERROR,
} from '@kace/error-codes';
import { ChannelHubWorkspacePriorityReorderConflict } from '@kace/core/src/channel-hub-workspace-priorities/domain/channelHubWorkspacePriorityReorderConflict.js';
import { workspacePriorityErrorResponse } from '../src/controller.mjs';
import { WorkspacePriorityConflictError } from '../src/WorkspacePriorityApplication.mjs';

const MANAGED_ENV_KEYS = ['NODE_ENV', 'APPS_ENVIRONMENT', 'APPS_DEBUG'];
const ORIGINAL_ENV = Object.fromEntries(MANAGED_ENV_KEYS.map((key) => [key, process.env[key]]));

const eventFixture = () => ({
    headers: { origin: 'https://admin.appsmx.net' },
    httpMethod: 'POST',
    resource: '/{id}/workspace-priorities/reorder',
    kContext: { awsRequestId: 'security-regression-request' },
    tenantContext: {
        tenant: {
            apps_allowed_origins: { value: 'https://admin.appsmx.net' },
            apps_debug: { value: 'true' },
        },
    },
});

const responseBody = (error) => {
    const response = workspacePriorityErrorResponse(error, eventFixture()).toJson();
    return { response, body: JSON.parse(response.body) };
};

describe('workspace priority public error boundary', () => {
    beforeEach(() => {
        process.env.NODE_ENV = 'staging';
        process.env.APPS_ENVIRONMENT = 'staging';
        process.env.APPS_DEBUG = 'true';
    });

    afterEach(() => {
        for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    it('does not serialize AWS infrastructure exceptions when debug responses are enabled', () => {
        const error = Object.assign(
            new Error(
                'User arn:aws:sts::714281575970:assumed-role/channel-hub is not authorized to call sqs:SendMessage on arn:aws:sqs:us-east-1:714281575970:private-queue.fifo'
            ),
            { publicErrorCode: CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_FAILED }
        );

        const { response, body } = responseBody(error);

        expect(response.statusCode).toBe(500);
        expect(body.data.code).toBe(CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_FAILED);
        expect(body).not.toHaveProperty('errors');
        expect(response.body).not.toContain('arn:aws');
        expect(response.body).not.toContain('sqs:SendMessage');
        expect(response.body).not.toContain('private-queue.fifo');
    });

    it('does not serialize provider diagnostics for unclassified upstream failures', () => {
        const error = Object.assign(new Error('provider host=private.internal token=do-not-return'), {
            statusCode: 502,
        });

        const { response, body } = responseBody(error);

        expect(response.statusCode).toBe(502);
        expect(body.data.code).toBe(CHANNEL_HUB_WORKSPACE_PRIORITIES_UNAVAILABLE);
        expect(body).not.toHaveProperty('errors');
        expect(response.body).not.toContain('private.internal');
        expect(response.body).not.toContain('do-not-return');
    });

    it('does not serialize native parser details for malformed requests', () => {
        const { response, body } = responseBody(new SyntaxError('Unexpected token } in JSON at position 42'));

        expect(response.statusCode).toBe(400);
        expect(body.data.code).toBe(BAD_REQUEST_ERROR);
        expect(body).not.toHaveProperty('errors');
        expect(response.body).not.toContain('Unexpected token');
        expect(response.body).not.toContain('position 42');
    });

    it('returns only the active operation receipt and retry guidance for concurrent reorders', () => {
        const error = new WorkspacePriorityConflictError(
            new ChannelHubWorkspacePriorityReorderConflict({
                operationId: '11111111-1111-4111-8111-111111111111',
                status: 'in_progress',
                revision: 'private-revision',
                orderedWorkspaceIds: ['private-workspace-id'],
                createdBy: 'private-user-id',
            })
        );

        const { response, body } = responseBody(error);

        expect(response.statusCode).toBe(409);
        expect(response.headers['Retry-After']).toBe('1');
        expect(body.data).toEqual({
            code: CONFLICT_ERROR,
            activeOperation: {
                operationId: '11111111-1111-4111-8111-111111111111',
                status: 'in_progress',
            },
        });
        expect(response.body).not.toContain('private-revision');
        expect(response.body).not.toContain('private-workspace-id');
        expect(response.body).not.toContain('private-user-id');
    });

    it('does not expose an active operation supplied by an unrelated conflict', () => {
        const error = Object.assign(new Error('Unrelated conflict'), {
            statusCode: 409,
            activeOperation: {
                operationId: '11111111-1111-4111-8111-111111111111',
                status: 'in_progress',
            },
        });

        const { response, body } = responseBody(error);

        expect(response.statusCode).toBe(409);
        expect(response.headers).not.toHaveProperty('Retry-After');
        expect(body.data).toEqual({ code: CONFLICT_ERROR });
        expect(response.body).not.toContain('activeOperation');
    });

    it('normalizes a well-formed public error code before returning it', () => {
        const error = Object.assign(new Error('private failure'), {
            statusCode: 502,
            publicErrorCode: ` ${CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_FAILED} `,
        });

        const { body } = responseBody(error);

        expect(body.data.code).toBe(CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_FAILED);
    });

    it.each(['0x06000A', '0X060004', '0x06004', '060004', '', null, 60004])(
        'falls back to the safe status code mapping for malformed public code %p',
        (publicErrorCode) => {
            const error = Object.assign(new Error('private failure'), { statusCode: 502, publicErrorCode });

            const { body } = responseBody(error);

            expect(body.data.code).toBe(CHANNEL_HUB_WORKSPACE_PRIORITIES_UNAVAILABLE);
        }
    );
});
