import { HttpStatusCode } from 'axios';
import { Response } from './Response.js';
import { Helper } from '@kace/core/src/shared/index.js';

/**
 * Código público y datos públicos de un error de validación del dominio, con el mismo criterio
 * que aplica `Response` cuando recibe el error como `errors`. Sin ellos la respuesta cae en el
 * genérico `0x050001` ("Bad request") y el cliente no puede explicar el bloqueo.
 *
 * @param {{ publicErrorCode?: string|null, toPublicData?: Function, constructor: Function }} error
 * @returns {{ code: string|null, publicData: object|null }}
 */
export const validationFailPublicFields = (error) => ({
    code: error.publicErrorCode ?? null,
    publicData: error.constructor?.exposesPublicData === true ? error.toPublicData() : null,
});

export class HttpResponse {
    static ok({ message = 'Success', data, metadata, errors, event, headers = {}, code } = {}) {
        return new Response({
            message,
            statusCode: HttpStatusCode.Ok,
            data,
            metadata,
            errors,
            event,
            headers,
            publicErrorCode: code,
        });
    }

    static accepted({ message = 'Accepted', data, metadata, event, code } = {}) {
        return new Response({
            message,
            statusCode: HttpStatusCode.Accepted,
            data,
            metadata,
            event,
            publicErrorCode: code,
        });
    }

    static created({ message = 'Resource(s) created', data, metadata, errors, event, code } = {}) {
        return new Response({
            message,
            statusCode: HttpStatusCode.Created,
            data,
            metadata,
            errors,
            event,
            publicErrorCode: code,
        });
    }

    static notFound({ message = 'Not found', data, metadata, errors, event, code } = {}) {
        return new Response({
            message,
            statusCode: HttpStatusCode.NotFound,
            data,
            metadata,
            errors,
            event,
            publicErrorCode: code,
        });
    }

    static badRequest({ message = 'Bad request', errors, event, code, publicData } = {}) {
        return new Response({
            message,
            statusCode: HttpStatusCode.BadRequest,
            errors,
            event,
            publicErrorCode: code,
            publicData,
        });
    }

    static validationsFail({ message = 'Validations fail', errors, event, code, publicData } = {}) {
        Helper.logError(message, errors);
        return HttpResponse.badRequest({ message, errors, event, code, publicData });
    }

    static internalServerError({ message = 'Unexpected error occurred', errors, event, code } = {}) {
        return new Response({
            message,
            statusCode: HttpStatusCode.InternalServerError,
            errors,
            event,
            publicErrorCode: code,
        });
    }

    static badGateway({ message = 'Bad gateway', errors, event, code } = {}) {
        return new Response({
            message,
            statusCode: HttpStatusCode.BadGateway,
            errors,
            event,
            publicErrorCode: code,
        });
    }

    static unauthorized({ message = 'Unauthorized', event, code } = {}) {
        return new Response({
            message,
            statusCode: HttpStatusCode.Unauthorized,
            event,
            publicErrorCode: code,
        });
    }

    static conflict({ message = 'Conflict', data, event, headers = {}, code, publicData } = {}) {
        return new Response({
            message,
            statusCode: HttpStatusCode.Conflict,
            data,
            event,
            headers,
            publicErrorCode: code,
            publicData,
        });
    }

    static methodNotAllowed({ message = 'Method not allowed', event, code } = {}) {
        return new Response({
            message,
            statusCode: HttpStatusCode.MethodNotAllowed,
            event,
            publicErrorCode: code,
        });
    }

    static forbidden({ message = 'Forbidden', event, code } = {}) {
        return new Response({
            message,
            statusCode: HttpStatusCode.Forbidden,
            event,
            publicErrorCode: code,
        });
    }

    static requestTimeout({ message = 'Request timeout', event, code } = {}) {
        return new Response({
            message,
            statusCode: HttpStatusCode.RequestTimeout,
            event,
            publicErrorCode: code,
        });
    }

    static custom(message, statusCode, event, publicErrorCode = null) {
        if (statusCode === 400) return HttpResponse.badRequest({ message, event, code: publicErrorCode });
        if (statusCode === 403) return HttpResponse.forbidden({ message, event, code: publicErrorCode });
        if (statusCode === 404) return HttpResponse.notFound({ message, event, code: publicErrorCode });
        if (statusCode === 422) {
            return new Response({
                message,
                statusCode: HttpStatusCode.UnprocessableEntity,
                event,
                publicErrorCode,
            });
        }
        return HttpResponse.internalServerError({
            errors: new Error(message),
            event,
            code: publicErrorCode,
        });
    }
}
