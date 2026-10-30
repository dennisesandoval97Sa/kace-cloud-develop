import { TenantContextManager } from './TenantContextManager.js';
import { TenantContext } from '@kace/core/src/shared';
import { Helper } from '@kace/core/src/shared';
import { HttpResponse } from '../http_responses/HttpResponse.js';
import { TENANT_CONTEXT_ERROR } from '@kace/error-codes';

/**
 * Middy middleware para cargar contexto de tenant
 *
 * Este middleware carga la configuración del tenant desde DynamoDB
 * antes de que el handler procese el request.
 *
 * @param {Object} opts - Opciones del middleware
 * @param {boolean} opts.cacheEnabled - Habilitar cache (default: true)
 * @param {boolean} opts.required - Si el tenant es requerido (default: true)
 * @param {string[]} opts.skipPaths - Rutas que no requieren tenant context
 *
 * @example
 * import middy from '@middy/core';
 * import {tenantMiddleware} from '@kace/api-common/middleware';
 *
 * const handler = middy(baseHandler)
 *   .use(tenantMiddleware({cacheEnabled: true}));
 */
const tenantMiddleware = (opts = {}) => {
    const options = {
        cacheEnabled: true,
        required: true,
        skipPaths: ['/health', '/healthcheck', '/_health'],
        ...opts,
    };

    return {
        before: async (request) => {
            const startTime = Date.now();
            request.internal = request.internal || {};

            try {
                // Skip middleware para rutas específicas (health checks, etc.)
                const path = request.event.path || request.event.rawPath;
                if (options.skipPaths.includes(path)) {
                    Helper.logDebug('TenantMiddleware: Skipping for path', { path });
                    return;
                }

                // Extract tenant ID
                const id = TenantContextManager.extractTenantId(request.event);

                // Load tenant configuration
                const tenant = await TenantContextManager.getTenant(id);

                const knexConfig = TenantContextManager.buildKnexConfig(tenant);

                request.context = request.context || {};
                request.context.tenant = tenant;
                request.context.knexConfig = knexConfig;
                request.context.id = id;

                // Store tenant for AsyncLocalStorage
                request.internal.tenant = tenant;
                request.internal.startTime = startTime;

                const contextLoadDuration = Date.now() - startTime;
                Helper.logDebug('Tenant context loaded', {
                    duration: contextLoadDuration,
                    cacheHit: contextLoadDuration < 10, // Less than 10ms likely cache hit
                });
            } catch (error) {
                Helper.logError('TenantMiddleware: Failed to load tenant context', error);
                Helper.logMetric('TenantContextError', 1);

                if (options.required) {
                    // Crear error HTTP estandarizado
                    const httpError = new Error(error.message);
                    httpError.statusCode = error.message.includes('not found') ? 404 : 400;
                    httpError.expose = true;
                    throw httpError;
                }
            }
        },

        after: async (request) => {
            // Log success metrics inside tenant context
            const tenant = request.internal?.tenant;
            if (tenant) {
                await TenantContext.run(tenant, async () => {
                    Helper.logMetric('APIRequest', 1);
                    Helper.logInfo('Request completed', {
                        statusCode: request.response?.statusCode,
                    });
                });
            }
        },

        onError: async (request) => {
            // Log errors inside tenant context if available
            const tenant = request.internal?.tenant;
            if (tenant) {
                await TenantContext.run(tenant, async () => {
                    Helper.logError('Request failed', request.error);
                    Helper.logMetric('APIError', 1);
                });
            } else {
                Helper.logError('Request failed', request.error);
                Helper.logMetric('APIError', 1);
            }

            // Retornar respuesta HTTP formateada
            if (request.error.statusCode) {
                const responseEvent = {
                    ...request.event,
                    kContext: {
                        ...(request.event?.kContext ?? {}),
                        awsRequestId: request.context?.awsRequestId ?? request.context?.requestId,
                    },
                };
                const response =
                    request.error.statusCode === 404
                        ? HttpResponse.notFound({
                              errors: request.error,
                              event: responseEvent,
                              code: TENANT_CONTEXT_ERROR,
                          })
                        : HttpResponse.badRequest({
                              errors: request.error,
                              event: responseEvent,
                              code: TENANT_CONTEXT_ERROR,
                          });

                request.response = response.toJson();
            }
        },
    };
};

export { tenantMiddleware };
