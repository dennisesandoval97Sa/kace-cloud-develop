import { HttpResponse, Response, SearchSchema } from '../../src/index.js';
import { HttpStatusCode } from 'axios';
import { CustomError, InvalidArgumentError, ValidationFailError } from '@kace/core/src/shared/index.js';
import {
    SQL_BLACKLIST_WORD_DETECTED,
    VALIDATION_ERROR,
    WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED,
} from '@kace/error-codes';

describe('HttpResponse', () => {
    it('ok returns a success response', () => {
        const response = HttpResponse.ok({ data: { key: 'value' } });
        expect(response).toEqual(
            new Response({
                message: 'Success',
                statusCode: HttpStatusCode.Ok,
                data: { key: 'value' },
            })
        );
    });

    it('created returns a created response', () => {
        const response = HttpResponse.created({ data: { key: 'value' } });
        expect(response).toEqual(
            new Response({
                message: 'Resource(s) created',
                statusCode: HttpStatusCode.Created,
                data: { key: 'value' },
            })
        );
    });

    it('notFound returns a not found response', () => {
        const response = HttpResponse.notFound();
        expect(response).toEqual(
            new Response({
                message: 'Not found',
                statusCode: HttpStatusCode.NotFound,
            })
        );
    });

    it('badRequest returns a bad request response', () => {
        const response = HttpResponse.badRequest({ errors: ['error1'] });
        expect(response).toEqual(
            new Response({
                message: 'Bad request',
                statusCode: HttpStatusCode.BadRequest,
                errors: ['error1'],
            })
        );
    });

    it('validationsFail returns a validations fail response', () => {
        const response = HttpResponse.validationsFail({
            errors: ['validation error'],
        });
        expect(response).toEqual(
            new Response({
                message: 'Validations fail',
                statusCode: HttpStatusCode.BadRequest,
                errors: ['validation error'],
            })
        );
    });

    it('internalServerError returns an internal server error response', () => {
        const response = HttpResponse.internalServerError({
            errors: ['server error'],
        });
        expect(response).toEqual(
            new Response({
                message: 'Unexpected error occurred',
                statusCode: HttpStatusCode.InternalServerError,
                errors: ['server error'],
            })
        );
    });

    it('badGateway preserves the upstream failure status', () => {
        const error = new Error('upstream failure');
        const response = HttpResponse.badGateway({ errors: error });

        expect(response).toEqual(
            new Response({
                message: 'Bad gateway',
                statusCode: HttpStatusCode.BadGateway,
                errors: error,
            })
        );
        expect(response.statusCode).toBe(HttpStatusCode.BadGateway);
    });

    it('unauthorized returns an unauthorized response', () => {
        const response = HttpResponse.unauthorized();
        expect(response).toEqual(
            new Response({
                message: 'Unauthorized',
                statusCode: HttpStatusCode.Unauthorized,
            })
        );
    });

    it('methodNotAllowed returns a method not allowed response', () => {
        const response = HttpResponse.methodNotAllowed();
        expect(response).toEqual(
            new Response({
                message: 'Method not allowed',
                statusCode: HttpStatusCode.MethodNotAllowed,
            })
        );
    });

    it('forbidden returns a forbidden response', () => {
        const response = HttpResponse.forbidden();
        expect(response).toEqual(
            new Response({
                message: 'Forbidden',
                statusCode: HttpStatusCode.Forbidden,
            })
        );
    });

    it('custom returns a bad request response for status code 400', () => {
        const response = HttpResponse.custom('Bad request', 400);
        expect(response).toEqual(HttpResponse.badRequest({ message: 'Bad request' }));
    });

    it('custom keeps the public error code on a 400', () => {
        const response = HttpResponse.custom(
            'Some cases are already closed',
            400,
            undefined,
            SQL_BLACKLIST_WORD_DETECTED
        );
        expect(response).toEqual(
            HttpResponse.badRequest({
                message: 'Some cases are already closed',
                code: SQL_BLACKLIST_WORD_DETECTED,
            })
        );
    });

    it('custom returns a forbidden response for status code 403', () => {
        const response = HttpResponse.custom('Forbidden', 403, undefined, VALIDATION_ERROR);
        expect(response).toEqual(
            HttpResponse.forbidden({
                message: 'Forbidden',
                code: VALIDATION_ERROR,
            })
        );
    });

    it('custom returns a not found response for status code 404', () => {
        const response = HttpResponse.custom('Not found', 404);
        expect(response).toEqual(HttpResponse.notFound({ message: 'Not found' }));
    });

    it('custom keeps the public error code on a 404', () => {
        const response = HttpResponse.custom('Cases not found', 404, undefined, SQL_BLACKLIST_WORD_DETECTED);
        expect(response).toEqual(
            HttpResponse.notFound({
                message: 'Cases not found',
                code: SQL_BLACKLIST_WORD_DETECTED,
            })
        );
    });

    it('custom preserves 422 instead of mapping it to 500', () => {
        const response = HttpResponse.custom('Unprocessable', 422, undefined, SQL_BLACKLIST_WORD_DETECTED);
        expect(response.statusCode).toBe(HttpStatusCode.UnprocessableEntity);
        expect(response.data.code).toBe(SQL_BLACKLIST_WORD_DETECTED);
    });

    it('custom returns an internal server error response for other status codes', () => {
        const response = HttpResponse.custom('Error', 500);
        expect(response).toEqual(HttpResponse.internalServerError({ errors: new Error('Error') }));
    });

    it('joiError returns a bad request response', () => {
        const data = SearchSchema.validate({ id: 'invalid' });

        const response = HttpResponse.internalServerError({ errors: data.error });

        expect(response.message).toBe('The request could not be processed.');
        expect(response.statusCode).toBe(HttpStatusCode.BadRequest);
        expect(response.data.code).toBe(VALIDATION_ERROR);
        expect(response.errors).toBeNull();
    });

    it('Joi validation responses keep a specific public error code when provided', () => {
        const data = SearchSchema.validate({ id: 'invalid' });

        const response = HttpResponse.validationsFail({
            errors: data.error,
            code: WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED,
        });

        expect(response.message).toBe('The request could not be processed.');
        expect(response.statusCode).toBe(HttpStatusCode.BadRequest);
        expect(response.data.code).toBe(WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED);
        expect(response.errors).toBeNull();
    });

    it('ValidationFailError returns a bad request response', () => {
        const error = new ValidationFailError('validation error', 'id');

        const response = HttpResponse.internalServerError({ errors: error });

        expect(response.message).toBe('The request could not be processed.');
        expect(response.statusCode).toBe(HttpStatusCode.BadRequest);
        expect(response.data.code).toBe(VALIDATION_ERROR);
        expect(response.errors).toBeNull();
    });

    it('DomainError with a public code returns a sanitized bad request response', () => {
        const error = new InvalidArgumentError('unsafe input', 400, SQL_BLACKLIST_WORD_DETECTED);

        const response = HttpResponse.internalServerError({ errors: error });

        expect(response.message).toBe('The request could not be processed.');
        expect(response.statusCode).toBe(HttpStatusCode.BadRequest);
        expect(response.data.code).toBe(SQL_BLACKLIST_WORD_DETECTED);
        expect(response.errors).toBeNull();
    });

    it('RequestTimeoutError returns a bad request response', () => {
        const response = HttpResponse.requestTimeout();

        expect(response.message).toBe('Request timeout');
        expect(response.statusCode).toBe(HttpStatusCode.RequestTimeout);
    });

    it('CustomError returns a custom status code', () => {
        const error = new CustomError('Error', 404);

        const response = HttpResponse.internalServerError({ errors: error });

        expect(response.message).toBe('Not found');
        expect(response.statusCode).toBe(HttpStatusCode.NotFound);
    });
});
