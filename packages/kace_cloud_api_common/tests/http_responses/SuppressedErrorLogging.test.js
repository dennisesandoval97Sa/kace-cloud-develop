import { jest } from '@jest/globals';
import Joi from 'joi';
import { Helper, ValidationFailError, QueryDBError } from '@kace/core/src/shared/index.js';
import { HttpResponse, SearchSchema } from '../../src/index.js';

const MANAGED_ENV_KEYS = ['NODE_ENV', 'APPS_ENVIRONMENT', 'APPS_DEBUG', 'APPS_DEBUG_OVERRIDE'];
const ORIGINAL_ENV = Object.fromEntries(MANAGED_ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreEnv() {
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
}

function eventFixture({ debug = 'false' } = {}) {
    return {
        resource: '/custom-lists',
        httpMethod: 'POST',
        headers: { origin: 'https://admin.appsmx.net' },
        kContext: { awsRequestId: 'request-id-1' },
        tenant: { apps_debug: { value: debug } },
        tenantContext: {
            tenant: {
                apps_allowed_origins: { value: 'https://admin.appsmx.net' },
                apps_debug: { value: debug },
            },
        },
    };
}

function suppressedLogFor(logErrorSpy) {
    const call = logErrorSpy.mock.calls.find(([message]) => message === 'Response::suppressedErrorDetail');

    return call?.[1];
}

describe('suppressed error detail logging', () => {
    let logErrorSpy;

    beforeEach(() => {
        process.env.NODE_ENV = 'production';
        delete process.env.APPS_ENVIRONMENT;
        delete process.env.APPS_DEBUG;
        delete process.env.APPS_DEBUG_OVERRIDE;
        logErrorSpy = jest.spyOn(Helper, 'logError').mockImplementation(() => {});
    });

    afterEach(() => {
        logErrorSpy.mockRestore();
        restoreEnv();
    });

    it('logs the Joi field paths that the response withholds', () => {
        const data = SearchSchema.validate({ id: 'invalid' });

        const response = HttpResponse.validationsFail({ errors: data.error, event: eventFixture() }).toJson();

        expect(response.body).not.toContain('"limit" is required');
        expect(suppressedLogFor(logErrorSpy)).toMatchObject({
            request_id: 'request-id-1',
            public_error_code: '0x030001',
            status_code: 400,
            resource: '/custom-lists',
            validation: [{ field: 'limit', message: '"limit" is required', type: 'any.required' }],
        });
    });

    it('logs the original message and stack of an unexpected error', () => {
        const failure = new Error('connect ECONNREFUSED 10.0.0.7:5432');

        const response = HttpResponse.internalServerError({ errors: failure, event: eventFixture() }).toJson();

        expect(response.body).not.toContain('ECONNREFUSED');
        expect(suppressedLogFor(logErrorSpy)).toMatchObject({
            request_id: 'request-id-1',
            public_error_code: '0x010001',
            status_code: 500,
            error: 'connect ECONNREFUSED 10.0.0.7:5432',
            error_name: 'Error',
        });
        expect(suppressedLogFor(logErrorSpy).stack).toContain('Error: connect ECONNREFUSED');
    });

    it('logs the database message that the response replaces with a safe one', () => {
        const response = HttpResponse.badRequest({
            errors: new QueryDBError('duplicate key value violates unique constraint "cases_pkey"'),
            event: eventFixture(),
        }).toJson();

        expect(response.body).not.toContain('cases_pkey');
        expect(suppressedLogFor(logErrorSpy)).toMatchObject({
            public_error_code: '0x040001',
            // QueryDBError wraps the driver message in "Transaction failed [...]".
            error: expect.stringContaining('duplicate key value violates unique constraint "cases_pkey"'),
        });
    });

    it('logs the field of a suppressed ValidationFailError', () => {
        const response = HttpResponse.badRequest({
            errors: new ValidationFailError('A selected client filter is required.', 'filter'),
            event: eventFixture(),
        }).toJson();

        expect(response.body).not.toContain('A selected client filter is required.');
        expect(suppressedLogFor(logErrorSpy)).toMatchObject({
            validation: [{ field: 'filter', message: 'A selected client filter is required.' }],
        });
    });

    it('logs the original message when only the message carried the detail', () => {
        const response = HttpResponse.methodNotAllowed({
            message: 'PATCH /cases is not supported',
            event: eventFixture(),
        }).toJson();

        expect(response.body).not.toContain('PATCH /cases is not supported');
        expect(suppressedLogFor(logErrorSpy)).toMatchObject({
            public_error_code: '0x050005',
            status_code: 405,
            original_message: 'PATCH /cases is not supported',
        });
    });

    it('omits the Joi wrapper message and stack, which say nothing the breakdown does not', () => {
        const data = SearchSchema.validate({ id: 'invalid' });

        HttpResponse.validationsFail({ errors: data.error, event: eventFixture() }).toJson();

        const logged = suppressedLogFor(logErrorSpy);
        expect(logged.validation).toBeDefined();
        expect(logged.stack).toBeUndefined();
        expect(logged.error).toBeUndefined();
    });

    it('omits the original message when it is just a safe default of the response factory', () => {
        // badRequest defaults to 'Bad request' but a Joi error resolves to the
        // validation code, so the two safe messages differ without any real detail.
        const data = SearchSchema.validate({ id: 'invalid' });

        HttpResponse.badRequest({ errors: data.error, event: eventFixture() }).toJson();

        expect(suppressedLogFor(logErrorSpy).original_message).toBeUndefined();
    });

    it('does not log a suppression entry for successful responses', () => {
        HttpResponse.ok({ message: 'Success', data: { id: 1 }, event: eventFixture() }).toJson();

        expect(suppressedLogFor(logErrorSpy)).toBeUndefined();
    });

    it('does not log a suppression entry when the response already carries the detail', () => {
        process.env.NODE_ENV = 'development';
        process.env.APPS_DEBUG = 'true';
        const data = SearchSchema.validate({ id: 'invalid' });

        const response = HttpResponse.validationsFail({ errors: data.error, event: eventFixture() }).toJson();

        expect(response.body).toContain('is required');
        expect(suppressedLogFor(logErrorSpy)).toBeUndefined();
    });

    it('logs once per response, not once per error entry', () => {
        const joiError = new Joi.ValidationError(
            'Validation error',
            [
                { message: '"name" is required', path: ['name'], type: 'any.required' },
                { message: '"groups" is required', path: ['groups'], type: 'any.required' },
            ],
            null
        );

        HttpResponse.validationsFail({ errors: joiError, event: eventFixture() }).toJson();

        const suppressionCalls = logErrorSpy.mock.calls.filter(
            ([message]) => message === 'Response::suppressedErrorDetail'
        );

        expect(suppressionCalls).toHaveLength(1);
        expect(suppressionCalls[0][1].validation).toHaveLength(2);
    });
});
