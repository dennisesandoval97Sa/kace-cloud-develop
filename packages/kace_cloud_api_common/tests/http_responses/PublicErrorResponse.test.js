import { HttpStatusCode } from 'axios';
import { HttpResponse, SearchSchema } from '../../src/index.js';
import AuthFailError from '@kace/core/src/shared/errors/AuthFailError.js';
import { CustomError } from '@kace/core/src/shared/errors/CustomError.js';
import { ValidationFailError } from '@kace/core/src/shared/errors/ValidationFailError.js';
import { InvalidArgumentError } from '@kace/core/src/shared/errors/InvalidArgumentError.js';
import { AuxiliaryDataInvalidError } from '@kace/core/src/aux_casos/domain/AuxiliaryDataInvalidError.js';
import { validationFailPublicFields } from '../../src/http_responses/HttpResponse.js';
import {
    AUTH_SESSION_COOKIE_STALE,
    BROKER_MAPPER_QUEUE_REQUIRED,
    CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE,
    CASE_BULK_TRANSITION_MIXED_CURRENT_TRANSITION,
    CASE_TRANSITION_CONDITIONS_NOT_MET,
    LITERAL_ENTITY_NOT_FOUND,
    TENANT_CONTEXT_ERROR,
    VALIDATION_ERROR,
} from '@kace/error-codes';

const ORIGINAL_ENV = {
    NODE_ENV: process.env.NODE_ENV,
    APPS_ENVIRONMENT: process.env.APPS_ENVIRONMENT,
    APPS_DEBUG: process.env.APPS_DEBUG,
    APPS_DEBUG_OVERRIDE: process.env.APPS_DEBUG_OVERRIDE,
};

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

function publicCompatibilityErrors(code, message) {
    return [{ code, message }];
}

describe('public error response contract', () => {
    beforeEach(() => {
        // The debug gate reads these first; clearing them keeps every case below
        // driven by the tenant flag regardless of the developer's local .env.
        delete process.env.APPS_DEBUG;
        delete process.env.APPS_DEBUG_OVERRIDE;
    });

    afterEach(() => {
        restoreEnv();
    });

    it('suppresses Joi validation details in production responses', () => {
        process.env.NODE_ENV = 'production';
        const data = SearchSchema.validate({ id: 'invalid' });
        const response = HttpResponse.validationsFail({ errors: data.error, event: eventFixture() }).toJson();
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(HttpStatusCode.BadRequest);
        expect(body).toEqual({
            message: 'The request could not be processed.',
            data: { code: VALIDATION_ERROR },
            metadata: { request_id: 'request-id-1' },
            errors: publicCompatibilityErrors(VALIDATION_ERROR, 'The request could not be processed.'),
        });
        expect(response.body).not.toContain('"limit" is required');
    });

    it('preserves an explicit public code when wrapping Joi validation errors', () => {
        process.env.NODE_ENV = 'production';
        const data = SearchSchema.validate({ id: 'invalid' });
        const response = HttpResponse.validationsFail({
            errors: data.error,
            event: eventFixture(),
            code: CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE,
        }).toJson();
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(HttpStatusCode.BadRequest);
        expect(body.data.code).toBe(CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE);
        expect(body.errors).toEqual(
            publicCompatibilityErrors(CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE, 'The request could not be processed.')
        );
        expect(response.body).not.toContain('"limit" is required');
    });

    it('allows validation details when tenant debug is enabled and no env toggle vetoes it', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.APPS_ENVIRONMENT;
        const data = SearchSchema.validate({ id: 'invalid' });
        const response = HttpResponse.validationsFail({
            errors: data.error,
            event: eventFixture({ debug: 'true' }),
        }).toJson();
        const body = JSON.parse(response.body);

        expect(body.data.code).toBe(VALIDATION_ERROR);
        expect(body.errors).toEqual([
            {
                field: 'limit',
                message: '"limit" is required',
                type: 'any.required',
            },
        ]);
    });

    it('does not expose details when APPS_DEBUG vetoes an enabled tenant debug flag', () => {
        process.env.NODE_ENV = 'production';
        process.env.APPS_DEBUG = 'false';
        const data = SearchSchema.validate({ id: 'invalid' });
        const response = HttpResponse.validationsFail({
            errors: data.error,
            event: eventFixture({ debug: 'true' }),
        }).toJson();
        const body = JSON.parse(response.body);

        expect(body).toEqual({
            message: 'The request could not be processed.',
            data: { code: VALIDATION_ERROR },
            metadata: { request_id: 'request-id-1' },
            errors: publicCompatibilityErrors(VALIDATION_ERROR, 'The request could not be processed.'),
        });
        expect(response.body).not.toContain('"limit" is required');
    });

    it('preserves an explicit public code for Joi validation failures', () => {
        process.env.NODE_ENV = 'production';
        const data = SearchSchema.validate({ id: 'invalid' });
        const response = HttpResponse.validationsFail({
            errors: data.error,
            event: eventFixture(),
            code: BROKER_MAPPER_QUEUE_REQUIRED,
        }).toJson();
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(HttpStatusCode.BadRequest);
        expect(body.data.code).toBe(BROKER_MAPPER_QUEUE_REQUIRED);
        expect(body.errors).toEqual(
            publicCompatibilityErrors(BROKER_MAPPER_QUEUE_REQUIRED, 'The request could not be processed.')
        );
        expect(response.body).not.toContain('"limit" is required');
    });

    it('preserves an explicit public code when wrapping a domain validation error', () => {
        process.env.NODE_ENV = 'production';
        const response = HttpResponse.badRequest({
            errors: new ValidationFailError('Sensitive domain validation detail', 'private_field'),
            event: eventFixture(),
            code: CASE_TRANSITION_CONDITIONS_NOT_MET,
        }).toJson();
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(HttpStatusCode.BadRequest);
        expect(body.data.code).toBe(CASE_TRANSITION_CONDITIONS_NOT_MET);
        expect(body.errors).toEqual(
            publicCompatibilityErrors(CASE_TRANSITION_CONDITIONS_NOT_MET, 'The request could not be processed.')
        );
        expect(response.body).not.toContain('Sensitive domain validation detail');
        expect(response.body).not.toContain('private_field');
    });

    it('preserves an explicit public code for tenant-context errors', () => {
        process.env.NODE_ENV = 'production';
        const response = HttpResponse.badRequest({
            errors: new Error('Tenant not found: sensitive-tenant-id'),
            event: eventFixture(),
            code: TENANT_CONTEXT_ERROR,
        }).toJson();
        const body = JSON.parse(response.body);

        expect(body.data.code).toBe(TENANT_CONTEXT_ERROR);
        expect(body.errors).toEqual(publicCompatibilityErrors(TENANT_CONTEXT_ERROR, 'Bad request'));
        expect(response.body).not.toContain('sensitive-tenant-id');
    });

    it('maps method-not-allowed to a client-facing code instead of a generic internal error', () => {
        process.env.NODE_ENV = 'production';
        const response = HttpResponse.methodNotAllowed({
            message: 'PATCH /cases not supported',
            event: eventFixture(),
        }).toJson();
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(HttpStatusCode.MethodNotAllowed);
        expect(body).toEqual({
            message: 'Method not allowed',
            data: { code: '0x050005' },
            metadata: { request_id: 'request-id-1' },
            errors: publicCompatibilityErrors('0x050005', 'Method not allowed'),
        });
        expect(response.body).not.toContain('PATCH /cases not supported');
    });

    it('maps conflict to a client-facing code and suppresses conflict details', () => {
        process.env.NODE_ENV = 'production';
        const response = HttpResponse.conflict({
            message: 'Case sensitive-case-id already closed',
            data: { conflictingId: 'sensitive-case-id' },
            event: eventFixture(),
        }).toJson();
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(HttpStatusCode.Conflict);
        expect(body).toEqual({
            message: 'Conflict',
            data: { code: '0x050009' },
            metadata: { request_id: 'request-id-1' },
            errors: publicCompatibilityErrors('0x050009', 'Conflict'),
        });
        expect(response.body).not.toContain('sensitive-case-id');
    });

    it('can expose explicitly public conflict data while suppressing arbitrary data', () => {
        process.env.NODE_ENV = 'production';
        const response = HttpResponse.conflict({
            message: 'An interaction already exists for the provided email_id.',
            data: { sensitive: 'hidden-value' },
            publicData: { email_id: 'email-id', interaction_id: 'interaction-id' },
            code: '0x030031',
            event: eventFixture(),
        }).toJson();
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(HttpStatusCode.Conflict);
        expect(body.data).toEqual({
            code: '0x030031',
            email_id: 'email-id',
            interaction_id: 'interaction-id',
        });
        expect(response.body).not.toContain('hidden-value');
    });

    it('exposes badRequest publicData next to the code in production', () => {
        process.env.NODE_ENV = 'production';
        const detail = 'Operator account is not healthy: Microsoft: InvalidAuthenticationToken.';
        const response = HttpResponse.badRequest({
            message: detail,
            code: '0x060001',
            publicData: { detail },
            event: eventFixture(),
        }).toJson();
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(HttpStatusCode.BadRequest);
        expect(body.message).not.toContain('Operator account');
        expect(body.data).toEqual({ code: '0x060001', detail });
    });

    it('exposes validationsFail publicData next to the code in production', () => {
        process.env.NODE_ENV = 'production';
        const conditions = { combinator: 'and', failed: [{ field: 'cases.x', operator: '=' }] };
        const response = HttpResponse.validationsFail({
            message: 'The conditions configured for this transition are not met',
            errors: [{ message: 'The conditions configured for this transition are not met' }],
            code: '0x030004',
            publicData: { conditions },
            event: eventFixture(),
        }).toJson();
        const body = JSON.parse(response.body);

        expect(body.data).toEqual({ code: '0x030004', conditions });
    });

    it('publishes which auxiliary fields were rejected in production', () => {
        process.env.NODE_ENV = 'production';
        const error = new AuxiliaryDataInvalidError('"a" must be a number', [{ path: 'formA.a', reason: 'invalid' }]);
        const response = HttpResponse.validationsFail({
            message: error.message,
            errors: [{ message: error.message, path: 'formA.a' }],
            event: eventFixture(),
            ...validationFailPublicFields(error),
        }).toJson();
        const body = JSON.parse(response.body);

        expect(body.data).toEqual({
            code: '0x030067',
            fields: [{ field: 'aux_cases.formA.a', reason: 'invalid' }],
        });
        expect(body.errors).toEqual(publicCompatibilityErrors('0x030067', 'The request could not be processed.'));
    });

    it('announces the 0x0600 integration range as a bad request instead of a system failure', () => {
        process.env.NODE_ENV = 'production';
        const response = HttpResponse.badRequest({
            message: 'Operator account is not healthy: Microsoft: InvalidAuthenticationToken.',
            code: '0x060001',
            event: eventFixture(),
        }).toJson();
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(HttpStatusCode.BadRequest);
        expect(body.message).toBe('Bad request');
        expect(body.errors).toEqual(publicCompatibilityErrors('0x060001', 'Bad request'));
    });

    it('keeps badRequest publicData in data when detailed errors are exposed', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.APPS_ENVIRONMENT;
        const detail = 'Operator account is not healthy: Microsoft: InvalidAuthenticationToken.';
        const response = HttpResponse.badRequest({
            message: detail,
            code: '0x060001',
            publicData: { detail },
            event: eventFixture({ debug: 'true' }),
        }).toJson();
        const body = JSON.parse(response.body);

        expect(body.message).toBe(detail);
        expect(body.data).toEqual({ code: '0x060001', detail });
    });

    it('emits the literal entity code for domain errors while suppressing the entity name', () => {
        process.env.NODE_ENV = 'production';
        const response = HttpResponse.badRequest({
            errors: new InvalidArgumentError(
                'The entity sensitive-table-name does not exist',
                400,
                LITERAL_ENTITY_NOT_FOUND
            ),
            event: eventFixture(),
        }).toJson();
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(HttpStatusCode.BadRequest);
        expect(body.data.code).toBe(LITERAL_ENTITY_NOT_FOUND);
        expect(body.errors).toEqual(
            publicCompatibilityErrors(LITERAL_ENTITY_NOT_FOUND, 'The request could not be processed.')
        );
        expect(response.body).not.toContain('sensitive-table-name');
    });

    it('emits migrated fixed-width auth codes', () => {
        process.env.NODE_ENV = 'production';
        const response = HttpResponse.badRequest({
            errors: new AuthFailError('session cookie stale', 401, AUTH_SESSION_COOKIE_STALE),
            event: eventFixture(),
        }).toJson();
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(HttpStatusCode.Unauthorized);
        expect(body.data.code).toBe('0x070008');
        expect(body.errors).toEqual(publicCompatibilityErrors('0x070008', 'Authentication required'));
        expect(response.body).not.toContain('session cookie stale');
    });

    it('preserves public codes carried by custom domain errors', () => {
        process.env.NODE_ENV = 'production';
        const response = HttpResponse.badRequest({
            errors: new CustomError(
                'Cases must share the same current transition',
                400,
                [],
                CASE_BULK_TRANSITION_MIXED_CURRENT_TRANSITION
            ),
            event: eventFixture(),
        }).toJson();
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(HttpStatusCode.BadRequest);
        expect(body).toEqual({
            message: 'The request could not be processed.',
            data: { code: CASE_BULK_TRANSITION_MIXED_CURRENT_TRANSITION },
            metadata: { request_id: 'request-id-1' },
            errors: publicCompatibilityErrors(
                CASE_BULK_TRANSITION_MIXED_CURRENT_TRANSITION,
                'The request could not be processed.'
            ),
        });
        expect(response.body).not.toContain('Cases must share the same current transition');
    });

    it('preserves public codes carried by validation errors', () => {
        process.env.NODE_ENV = 'production';
        const response = HttpResponse.badRequest({
            errors: new ValidationFailError(
                'The conditions configured for this transition are not met',
                'transition_id',
                [],
                CASE_TRANSITION_CONDITIONS_NOT_MET
            ),
            event: eventFixture(),
        }).toJson();
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(HttpStatusCode.BadRequest);
        expect(body.data.code).toBe(CASE_TRANSITION_CONDITIONS_NOT_MET);
        expect(body.errors).toEqual(
            publicCompatibilityErrors(CASE_TRANSITION_CONDITIONS_NOT_MET, 'The request could not be processed.')
        );
        expect(response.body).not.toContain('transition_id');
    });

    it('includes toPublicData only when the error opts in with exposesPublicData', () => {
        process.env.NODE_ENV = 'production';
        class WindowExceeded extends CustomError {
            static exposesPublicData = true;

            constructor() {
                super('CASE_REOPEN_WINDOW_EXCEEDED:7', 422, [], '0x030047');
            }

            toPublicData() {
                return { days: 7 };
            }
        }

        const response = HttpResponse.internalServerError({
            errors: new WindowExceeded(),
            event: eventFixture(),
        }).toJson();
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(422);
        expect(body.data).toEqual({ code: '0x030047', days: 7 });
        expect(response.body).not.toContain('CASE_REOPEN_WINDOW_EXCEEDED:7');
    });

    it('publishes toPublicData for a validation error that opts in, next to its code', () => {
        process.env.NODE_ENV = 'production';
        // El diagnóstico de una regla de transición llega así: el mensaje se sanea en producción,
        // de modo que los datos son el único canal por el que el motivo alcanza al cliente.
        class ConditionsNotMet extends ValidationFailError {
            static exposesPublicData = true;

            constructor() {
                super(
                    'The conditions configured for this transition are not met',
                    'transition_id',
                    [],
                    CASE_TRANSITION_CONDITIONS_NOT_MET
                );
            }

            toPublicData() {
                return { conditions: { combinator: 'and', failed: [{ field: 'aux_cases.monto' }] } };
            }
        }

        const response = HttpResponse.badRequest({
            errors: new ConditionsNotMet(),
            event: eventFixture(),
        }).toJson();
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(HttpStatusCode.BadRequest);
        expect(body.data).toEqual({
            code: CASE_TRANSITION_CONDITIONS_NOT_MET,
            conditions: { combinator: 'and', failed: [{ field: 'aux_cases.monto' }] },
        });
        expect(response.body).not.toContain('transition_id');
    });

    it('does not copy toPublicData when a validation error does not opt in', () => {
        process.env.NODE_ENV = 'production';
        class SilentConditionsNotMet extends ValidationFailError {
            toPublicData() {
                return { conditions: { combinator: 'and', failed: [] } };
            }
        }

        const response = HttpResponse.badRequest({
            errors: new SilentConditionsNotMet('nope', 'transition_id', [], CASE_TRANSITION_CONDITIONS_NOT_MET),
            event: eventFixture(),
        }).toJson();
        const body = JSON.parse(response.body);

        expect(body.data).toEqual({ code: CASE_TRANSITION_CONDITIONS_NOT_MET });
    });

    it('does not copy toPublicData when exposesPublicData is missing', () => {
        process.env.NODE_ENV = 'production';
        class SilentWindowExceeded extends CustomError {
            constructor() {
                super('CASE_REOPEN_WINDOW_EXCEEDED:7', 422, [], '0x030047');
            }

            toPublicData() {
                return { days: 7 };
            }
        }

        const response = HttpResponse.internalServerError({
            errors: new SilentWindowExceeded(),
            event: eventFixture(),
        }).toJson();
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(422);
        expect(body.data).toEqual({ code: '0x030047' });
        expect(body.data.days).toBeUndefined();
    });
});
