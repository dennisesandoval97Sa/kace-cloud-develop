import { production as knexConfig } from '@kace/database/knexfile';
import { createApiEvent, createAuthenticatedUser } from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { BROKER_MAPPER_QUEUE_REQUIRED, BROKER_MAPPER_VALIDATION_FAILED, VALIDATION_ERROR } from '@kace/error-codes';
import { Controller } from '../src/controller.mjs';

const ORIGINAL_ENV = {
    NODE_ENV: process.env.NODE_ENV,
    APPS_ENVIRONMENT: process.env.APPS_ENVIRONMENT,
    APPS_DEBUG: process.env.APPS_DEBUG,
    APPS_DEBUG_OVERRIDE: process.env.APPS_DEBUG_OVERRIDE,
};

const restoreEnv = () => {
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
};

const createController = ({ body, operation = 'create' }) => {
    const isUpdate = operation === 'update';
    const controller = new Controller(
        createApiEvent({
            body,
            resource: isUpdate ? '/{id}' : '/',
            pathParameters: isUpdate ? { id: '991f1a99-1d75-4b7d-8bd7-379ab919bb70' } : {},
        }),
        knexConfig
    );
    controller.user = createAuthenticatedUser({
        permissions: {
            administrador: [
                {
                    module_id: 'broker_mappers',
                    name: isUpdate ? 'BrokerMappersUpdate' : 'BrokerMappersCreate',
                    granted: true,
                },
            ],
        },
    });
    return controller;
};

describe('Broker mapper validation response', () => {
    afterEach(() => {
        restoreEnv();
    });

    it('returns the mapper validation code without raw fields when create omits required fields in production', async () => {
        process.env.NODE_ENV = 'production';

        const response = await createController({
            body: {
                rules: [],
            },
        }).actionCreate();
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(400);
        expect(body.data.code).toBe(BROKER_MAPPER_VALIDATION_FAILED);
        expect(body.errors).toEqual([
            {
                code: BROKER_MAPPER_VALIDATION_FAILED,
                message: 'The request could not be processed.',
            },
        ]);
        expect(response.toJson().body).not.toContain('"name"');
        expect(response.toJson().body).not.toContain('rest_flow_id');
    });

    it('returns the queue validation code for an invalid queue', async () => {
        process.env.NODE_ENV = 'production';

        const response = await createController({
            body: {
                name: 'Cases mapper',
                rest_flow_id: 'cases-flow',
                queue: 42,
                rules: [],
            },
        }).actionCreate();
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(400);
        expect(body.data.code).toBe(BROKER_MAPPER_QUEUE_REQUIRED);
        expect(response.toJson().body).not.toContain('"queue"');
    });

    it('prioritizes required mapper fields over an invalid queue', async () => {
        process.env.NODE_ENV = 'production';

        const response = await createController({
            body: {
                queue: 42,
                rules: [],
            },
        }).actionCreate();
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(400);
        expect(body.data.code).toBe(BROKER_MAPPER_VALIDATION_FAILED);
    });

    it('keeps optional rule parsing validation on the generic public validation code', async () => {
        process.env.NODE_ENV = 'production';

        const response = await createController({
            body: {
                name: 'Cases mapper',
                rest_flow_id: 'cases-flow',
                rules: [
                    {
                        target_entity: 'case',
                        target_field: 'title',
                        source_field: 'payload.title',
                        parse_to: 'json',
                    },
                ],
            },
        }).actionCreate();
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(400);
        expect(body.data.code).toBe(VALIDATION_ERROR);
    });

    it('exposes complete nested field paths only when debug is enabled', async () => {
        process.env.NODE_ENV = 'development';
        delete process.env.APPS_ENVIRONMENT;
        process.env.APPS_DEBUG = 'true';

        const response = await createController({
            body: {
                name: 'Cases mapper',
                rest_flow_id: 'cases-flow',
                rules: [
                    {
                        target_entity: 'case',
                        source_field: 'payload.title',
                    },
                ],
            },
        }).actionCreate();
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(400);
        expect(body.data.code).toBe(BROKER_MAPPER_VALIDATION_FAILED);
        expect(body.errors).toEqual([
            expect.objectContaining({
                field: 'rules.0.target_field',
                type: 'any.required',
            }),
        ]);
    });

    it('returns the mapper validation code without raw fields when edit clears the REST flow in production', async () => {
        process.env.NODE_ENV = 'production';

        const response = await createController({
            operation: 'update',
            body: {
                rest_flow_id: '',
            },
        }).actionUpdate();
        const body = JSON.parse(response.toJson().body);

        expect(response.statusCode).toBe(400);
        expect(body.data.code).toBe(BROKER_MAPPER_VALIDATION_FAILED);
        expect(response.toJson().body).not.toContain('rest_flow_id');
    });
});
