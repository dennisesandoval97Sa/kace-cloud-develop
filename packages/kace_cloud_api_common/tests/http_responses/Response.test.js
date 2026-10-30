import { jest } from '@jest/globals';
import { Response } from '../../src/index.js';
import { ValidationFailError, Helper } from '@kace/core/src/shared/index.js';
import Joi from 'joi';
import { EventExamples } from './EventExamples.js';

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

function eventWithAllowedOrigins(event, allowedOrigins = 'https://admin.appsmx.net,http://localhost') {
    return {
        ...event,
        tenantContext: {
            tenant: {
                apps_allowed_origins: { value: allowedOrigins },
            },
        },
    };
}

function debugEvent() {
    return {
        tenant: { apps_debug: { value: 'true' } },
        tenantContext: {
            tenant: {
                apps_allowed_origins: { value: '*' },
                apps_debug: { value: 'true' },
            },
        },
    };
}

describe('Response', () => {
    afterEach(() => {
        restoreEnv();
    });

    it('should create a response with default values', () => {
        const response = new Response({});
        expect(response.message).toBe('Success');
        expect(response.statusCode).toBe(200);
        expect(response.data).toEqual({});
        expect(response.metadata).toEqual({ version: 'unknown' });
        expect(response.errors).toBeNull();
        expect(response.headers['Content-Type']).toBe('application/json');
        expect(response.headers['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
    });

    it('should create a response with provided values', () => {
        const response = new Response({
            message: 'Success',
            statusCode: 201,
            data: { key: 'value' },
            metadata: { meta: 'data' },
            errors: { error: 'message' },
            event: eventWithAllowedOrigins({
                headers: { origin: 'https://admin.appsmx.net' },
            }),
        });
        expect(response.message).toBe('Success');
        expect(response.statusCode).toBe(201);
        expect(response.data).toEqual({ key: 'value' });
        expect(response.metadata).toEqual({ meta: 'data', version: 'unknown' });
        expect(response.errors).toEqual({ error: 'message' });
        expect(response.headers['Access-Control-Allow-Origin']).toBe('https://admin.appsmx.net');
    });

    it('should throw an error for invalid status code', () => {
        expect(() => new Response({ statusCode: 99 })).toThrow('Response - Invalid status code: 99');
        expect(() => new Response({ statusCode: 600 })).toThrow('Response - Invalid status code: 600');
    });

    it('should add headers to the response', () => {
        const response = new Response({});
        response.addHeaders({ 'X-Custom-Header': 'value' });
        expect(response.headers['X-Custom-Header']).toBe('value');
    });

    it('should validate and set errors from Joi.ValidationError', () => {
        process.env.APPS_DEBUG = 'true';
        const joiError = new Joi.ValidationError(
            'Validation error',
            [{ message: 'Invalid field', path: ['field'], type: 'any.invalid' }],
            null
        );
        const response = new Response({ errors: joiError, event: debugEvent() });
        expect(response.errors).toEqual([{ field: 'field', message: 'Invalid field', type: 'any.invalid' }]);
        expect(response.message).toBe('The request could not be processed.');
    });

    it('should validate and set errors from ValidationFailError', () => {
        process.env.APPS_DEBUG = 'true';
        const validationError = new ValidationFailError('validation error', 'id');
        const response = new Response({ errors: validationError, event: debugEvent() });
        expect(response.message).toBe('The request could not be processed.');
        expect(response.errors).toEqual([{ field: 'id', message: 'validation error' }]);
    });

    it('should return JSON representation of the response', () => {
        const response = new Response({
            message: 'Success',
            statusCode: 200,
            data: { key: 'value' },
            metadata: { meta: 'data' },
        });
        const jsonResponse = response.toJson();
        expect(jsonResponse.statusCode).toBe(200);
        expect(jsonResponse.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(jsonResponse.body)).toEqual({
            message: 'Success',
            data: { key: 'value' },
            metadata: { meta: 'data', version: 'unknown', request_id: 'unknown' },
        });
    });

    it('should identify informational response', () => {
        const response = new Response({ statusCode: 100 });
        expect(response.isInformational()).toBe(true);
    });

    it('should identify successful response', () => {
        const response = new Response({ statusCode: 200 });
        expect(response.isSuccessful()).toBe(true);
    });

    it('should identify redirection response', () => {
        const response = new Response({ statusCode: 300 });
        expect(response.isRedirection()).toBe(true);
    });

    it('should identify client error response', () => {
        const response = new Response({ statusCode: 400 });
        expect(response.isClientError()).toBe(true);
    });

    it('should identify server error response', () => {
        const response = new Response({ statusCode: 500 });
        expect(response.isServerError()).toBe(true);
    });

    it('should identify OK response', () => {
        const response = new Response({ statusCode: 200 });
        expect(response.isOk()).toBe(true);
    });

    it('should identify forbidden response', () => {
        const response = new Response({ statusCode: 403 });
        expect(response.isForbidden()).toBe(true);
    });

    it('should identify not found response', () => {
        const response = new Response({ statusCode: 404 });
        expect(response.isNotFound()).toBe(true);
    });

    it('should return allow-origin header with a valid origin', () => {
        const event = eventWithAllowedOrigins(EventExamples.getIdEvent());

        const response = new Response({
            statusCode: 200,
            event,
        });

        expect(response.toJson().headers['Access-Control-Allow-Origin']).toBe(event.headers.origin);
    });

    it('should return allow-origin header with a secondary valid', () => {
        const event = eventWithAllowedOrigins(EventExamples.getIdEvent());

        const response = new Response({
            statusCode: 200,
            event: {
                ...event,
                headers: {
                    ...event.headers,
                    origin: 'http://localhost',
                },
            },
        });

        expect(response.toJson().headers['Access-Control-Allow-Origin']).toBe('http://localhost');
    });

    it('should return allow-origin header with base orgin', () => {
        const event = eventWithAllowedOrigins(EventExamples.getIdEvent());

        const response = new Response({
            statusCode: 200,
            event: {
                ...event,
                headers: {
                    ...event.headers,
                    origin: 'https://invalid.com',
                },
            },
        });

        expect(response.toJson().headers['Access-Control-Allow-Origin']).toBe('https://admin.appsmx.net');
    });

    it('should return X-Frame-Options header with a valid origin', () => {
        const response = new Response({ statusCode: 200 });

        expect(response.toJson().headers['X-Frame-Options']).toBeUndefined();
    });

    it('returns a controlled 413 when the serialized body exceeds the safe limit', () => {
        const response = new Response({ data: { blob: 'x'.repeat(6_300_000) }, event: EventExamples.getIdEvent() });

        const jsonResponse = response.toJson();
        const body = JSON.parse(jsonResponse.body);

        expect(jsonResponse.statusCode).toBe(413);
        expect(body.error).toBe('PAYLOAD_TOO_LARGE');
        expect(body.metadata.size_bytes).toBeGreaterThan(6_200_000);
        expect(body.metadata.limit_bytes).toBe(6_200_000);
        expect(body.metadata.request_id).toBe('unknown');
        expect(jsonResponse.headers).toEqual(response.headers);
    });

    it('does not alter normal-sized responses', () => {
        const response = new Response({ data: { ok: true }, statusCode: 200, event: EventExamples.getIdEvent() });

        const jsonResponse = response.toJson();

        expect(jsonResponse.statusCode).toBe(200);
        expect(JSON.parse(jsonResponse.body).data).toEqual({ ok: true });
    });

    it('includes subclass response fields before enforcing the payload-size limit', () => {
        class ExtendedResponse extends Response {
            responseBodyExtras() {
                return { code: 'SEMANTIC_CODE' };
            }
        }

        const response = new ExtendedResponse({ data: { ok: true } });

        expect(JSON.parse(response.toJson().body)).toEqual(
            expect.objectContaining({ code: 'SEMANTIC_CODE', message: 'Success', data: { ok: true } })
        );

        const oversizedResponse = new ExtendedResponse({ data: { blob: 'x'.repeat(6_300_000) } });
        const oversizedBody = JSON.parse(oversizedResponse.toJson().body);

        expect(oversizedBody.error).toBe('PAYLOAD_TOO_LARGE');
        expect(oversizedBody.code).toBeUndefined();
    });

    it('preserves semantic codes in array-shaped error details', () => {
        const response = new Response({
            statusCode: 400,
            errors: [{ code: 'RECIPIENT_INVALID', message: 'Invalid recipient' }],
            exposePublicErrorDetails: true,
        });

        expect(JSON.parse(response.toJson().body).errors).toEqual([
            { code: 'RECIPIENT_INVALID', message: 'Invalid recipient' },
        ]);
    });

    it('logs the oversize event', () => {
        const spy = jest.spyOn(Helper, 'logError').mockImplementation(() => {});
        const response = new Response({ data: { blob: 'x'.repeat(6_300_000) }, event: EventExamples.getIdEvent() });

        response.toJson();

        expect(spy).toHaveBeenCalledWith(
            'PAYLOAD_TOO_LARGE',
            expect.objectContaining({ size_bytes: expect.any(Number) })
        );
        spy.mockRestore();
    });

    // El serializador es compartido por las 95 lambdas y varios listados entregan `data`
    // como array (workspaces, adapters, mappers, transiciones de caso). Cualquier spread
    // sobre `this.data` lo aplanaría a `{ "0": … }` en silencio: estas dos pruebas fijan
    // el contrato de forma.
    describe('data shape contract', () => {
        it('emits an array data as an array', () => {
            const response = new Response({
                data: [{ id: 1 }, { id: 2 }],
                event: EventExamples.getIdEvent(),
            });

            const body = JSON.parse(response.toJson().body);

            expect(Array.isArray(body.data)).toBe(true);
            expect(body.data).toEqual([{ id: 1 }, { id: 2 }]);
        });

        it('emits an object data as an object', () => {
            const response = new Response({
                data: { id: 1, name: 'workspace' },
                event: EventExamples.getIdEvent(),
            });

            const body = JSON.parse(response.toJson().body);

            expect(Array.isArray(body.data)).toBe(false);
            expect(body.data).toEqual({ id: 1, name: 'workspace' });
        });
    });
});
